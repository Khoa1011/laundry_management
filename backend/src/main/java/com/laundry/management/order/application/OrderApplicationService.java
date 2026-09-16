package com.laundry.management.order.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.customer.domain.*;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import com.laundry.management.order.api.OrderDtos;
import com.laundry.management.order.domain.*;
import com.laundry.management.order.infrastructure.*;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.application.PricingEngineService;
import com.laundry.management.servicecatalog.domain.*;
import com.laundry.management.servicecatalog.infrastructure.*;
import java.time.Instant;
import java.time.Clock;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderApplicationService {
    private final OrderRepository orders; private final OrderHistoryRepository history;
    private final BranchRepository branches; private final CustomerRepository customers;
    private final UserAccountRepository users; private final LaundryServiceRepository services;
    private final ItemTypeRepository itemTypes; private final PricingEngineService pricing;
    private final OrderNumberGenerator numbers; private final OrderMapper mapper; private final ObjectMapper json;
    private final CurrentUserProvider currentUsers; private final ApplicationEventPublisher events;
    private final OrderTransitionPolicy transitions;
    private final Clock clock;

    public OrderApplicationService(OrderRepository orders, OrderHistoryRepository history, BranchRepository branches,
        CustomerRepository customers, UserAccountRepository users, LaundryServiceRepository services,
        ItemTypeRepository itemTypes, PricingEngineService pricing, OrderNumberGenerator numbers,
        OrderMapper mapper, ObjectMapper json, CurrentUserProvider currentUsers, ApplicationEventPublisher events,
        OrderTransitionPolicy transitions, Clock clock) {
        this.orders=orders;this.history=history;this.branches=branches;this.customers=customers;this.users=users;
        this.services=services;this.itemTypes=itemTypes;this.pricing=pricing;this.numbers=numbers;this.mapper=mapper;
        this.json=json;this.currentUsers=currentUsers;this.events=events;this.transitions=transitions;
        this.clock=clock;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_CREATE)")
    @Transactional
    public OrderDtos.Response create(OrderDtos.CreateRequest request) {
        Long branchId=currentUsers.resolveAuthorizedBranch(request.branchId());
        Branch branch=branches.findById(branchId).orElseThrow(this::notFound);
        UserAccount actor=actor();
        Customer customer=null; String name=clean(request.guestName()), phone=clean(request.guestPhone());
        if(request.customerId()!=null){
            customer=customers.findByIdAndBranchId(request.customerId(),branchId).orElseThrow(() -> invalidCustomer("Customer is unavailable in this branch."));
            if(customer.getStatus()!=CustomerStatus.ACTIVE) throw invalidCustomer("The selected customer is inactive.");
            name=customer.getFullName(); phone=customer.getPhone();
        } else if(name==null && phone==null) throw invalidCustomer("Provide a customer or at least a guest name or phone.");
        QuoteResult quoted=quoteItems(branchId,request.items());
        Branch locked=branches.findByIdForUpdate(branchId).orElseThrow(this::notFound);
        LaundryOrder order=new LaundryOrder(numbers.next(locked),locked,customer,name,phone,request.promisedAt(),clean(request.note()),quoted.currency(),actor);
        quoted.items().forEach(order::addItem); orders.saveAndFlush(order);
        record(order,OrderHistoryAction.CREATED,null,OrderStatus.RECEIVED,null,writeAudit(Map.of(
            "fields",List.of("customer","items","promisedAt","note"),
            "currency",quoted.currency(),"pricingEffectiveAt",quoted.effectiveAt(),
            "items",Map.of("before",List.of(),"after",auditItems(quoted.items())))),actor);
        publish(order,"order.created");
        return mapper.detail(order);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_UPDATE)")
    @Transactional
    public OrderDtos.Response update(Long id, Long requestedBranchId, OrderDtos.UpdateRequest request) {
        LaundryOrder order=locked(id,requestedBranchId); requireVersion(order,request.version());
        if(order.getStatus()==OrderStatus.COMPLETED || order.getStatus()==OrderStatus.CANCELLED)
            throw immutable("Completed or cancelled orders cannot be edited.");
        if(request.itemsPresent() && order.getStatus()!=OrderStatus.RECEIVED)
            throw immutable("Services can only be edited while an order is received.");
        UserAccount actor=actor();
        List<String> fields=new ArrayList<>(); Map<String,Object> changed=new LinkedHashMap<>();
        if(request.itemsPresent()){
            if(request.items()==null||request.items().isEmpty())throw invalidItems();
            List<Map<String,Object>> before=auditItems(order.getItems());
            String beforeCurrency=order.getCurrency();
            QuoteResult replacement=quoteItems(order.getBranch().getId(),request.items());
            order.replaceItems(replacement.items(),replacement.currency(),actor);
            fields.add("items"); changed.put("items",Map.of("before",before,"after",auditItems(replacement.items())));
            changed.put("currency",Map.of("before",beforeCurrency,"after",replacement.currency()));
            changed.put("pricingEffectiveAt",replacement.effectiveAt());
        }
        if(request.promisedAtPresent()&&!Objects.equals(order.getPromisedAt(),request.promisedAt())){
            changed.put("promisedAt",nullableChange(order.getPromisedAt(),request.promisedAt()));
            fields.add("promisedAt"); order.updatePromisedAt(request.promisedAt(),actor);
        }
        String requestedNote=clean(request.note());
        if(request.notePresent()&&!Objects.equals(order.getNote(),requestedNote)){
            changed.put("note",Map.of("changed",true)); fields.add("note"); order.updateNote(requestedNote,actor);
        }
        if(fields.isEmpty())return mapper.detail(order);
        changed.put("fields",fields);
        record(order,OrderHistoryAction.UPDATED,order.getStatus(),order.getStatus(),null,writeAudit(changed),actor);
        orders.flush(); publish(order,"order.updated"); return mapper.detail(order);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_START_PROCESSING)")
    @Transactional public OrderDtos.Response start(Long id,Long branchId,OrderDtos.TransitionRequest r){return transition(id,branchId,r.version(),null,OrderStatus.PROCESSING,OrderHistoryAction.STARTED_PROCESSING,"order.processing");}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_MARK_READY)")
    @Transactional public OrderDtos.Response ready(Long id,Long branchId,OrderDtos.TransitionRequest r){return transition(id,branchId,r.version(),null,OrderStatus.READY,OrderHistoryAction.MARKED_READY,"order.ready");}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_COMPLETE)")
    @Transactional public OrderDtos.Response complete(Long id,Long branchId,OrderDtos.TransitionRequest r){return transition(id,branchId,r.version(),null,OrderStatus.COMPLETED,OrderHistoryAction.COMPLETED,"order.completed");}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_CANCEL)")
    @Transactional public OrderDtos.Response cancel(Long id,Long branchId,OrderDtos.ReasonedTransitionRequest r){return transition(id,branchId,r.version(),r.reason(),OrderStatus.CANCELLED,OrderHistoryAction.CANCELLED,"order.cancelled");}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_REOPEN)")
    @Transactional public OrderDtos.Response reopen(Long id,Long branchId,OrderDtos.ReasonedTransitionRequest r){return transition(id,branchId,r.version(),r.reason(),OrderStatus.REOPENED,OrderHistoryAction.REOPENED,"order.reopened");}

    private OrderDtos.Response transition(Long id,Long branchId,long version,String reason,OrderStatus target,OrderHistoryAction action,String event){
        LaundryOrder order=locked(id,branchId);requireVersion(order,version);OrderStatus from=order.getStatus();
        if(!transitions.canMove(from,target))throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_INVALID_TRANSITION,"Invalid order transition","Cannot move an order from "+from+" to "+target+".");
        UserAccount actor=actor();String cleanReason=clean(reason);order.transition(target,actor,cleanReason);record(order,action,from,target,cleanReason,null,actor);orders.flush();publish(order,event);return mapper.detail(order);
    }

    private QuoteResult quoteItems(Long branchId,List<OrderDtos.ItemRequest> requested){
        if(requested==null||requested.isEmpty())throw invalidItems();
        Instant effectiveAt=Instant.now(clock);
        List<CatalogDtos.PricingPreviewRequest> pricingRequests=requested.stream().map(item->
            new CatalogDtos.PricingPreviewRequest(branchId,item.serviceId(),item.itemTypeId(),null,null,
                item.sharingMode(),item.priorityLevel(),item.quantity(),effectiveAt)).toList();
        List<CatalogDtos.PricingPreviewResponse> quotes=pricing.quoteForOrder(pricingRequests);
        Set<String> currencies=new LinkedHashSet<>(); quotes.forEach(q->currencies.add(q.currency()));
        if(currencies.size()!=1)throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
            ErrorCode.ORDER_CURRENCY_CONFLICT,"Inconsistent order currencies",
            "All order items must be quoted in the same authoritative currency.");
        Map<Long,LaundryService> serviceMap=new HashMap<>();
        services.findAllById(quotes.stream().map(CatalogDtos.PricingPreviewResponse::serviceId).collect(java.util.stream.Collectors.toSet()))
            .forEach(value->serviceMap.put(value.getId(),value));
        Map<Long,ItemType> itemTypeMap=new HashMap<>();
        itemTypes.findAllById(quotes.stream().map(CatalogDtos.PricingPreviewResponse::itemTypeId).collect(java.util.stream.Collectors.toSet()))
            .forEach(value->itemTypeMap.put(value.getId(),value));
        List<OrderItem> result=new ArrayList<>();
        for(int index=0;index<quotes.size();index++){
            CatalogDtos.PricingPreviewResponse q=quotes.get(index); OrderDtos.ItemRequest item=requested.get(index);
            LaundryService service=Optional.ofNullable(serviceMap.get(q.serviceId())).orElseThrow(this::notFound);
            ItemType itemType=Optional.ofNullable(itemTypeMap.get(q.itemTypeId())).orElseThrow(this::notFound);
            try{result.add(new OrderItem(service,itemType,q.serviceCode(),q.serviceName(),q.itemTypeCode(),q.itemTypeName(),q.pricingMethod(),q.unitType(),q.sharingMode(),q.actualQuantity(),q.billableQuantity(),q.finalAmount(),clean(item.note()),json.writeValueAsString(q.snapshot()),q.snapshot().quotedAt()));}
            catch(Exception ex){throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,ErrorCode.INTERNAL_ERROR,"Pricing snapshot failed","The authoritative price could not be recorded.");}
        }
        return new QuoteResult(result,currencies.iterator().next(),effectiveAt);
    }
    private LaundryOrder locked(Long id,Long requestedBranch){Long b=currentUsers.resolveAuthorizedBranch(requestedBranch);return orders.findForUpdate(id,b).orElseThrow(this::notFound);}
    private void record(LaundryOrder o,OrderHistoryAction a,OrderStatus f,OrderStatus t,String reason,String changed,UserAccount actor){history.save(new OrderStatusHistory(o,a,f,t,reason,changed,OrderStatusSource.MANUAL_COMMAND,actor));}
    private void publish(LaundryOrder o,String type){events.publishEvent(new OrderChangedEvent(o.getId(),o.getOrderCode(),o.getBranch().getId(),o.getStatus(),o.getVersion(),type,Instant.now(clock)));}
    private void requireVersion(LaundryOrder o,long v){if(o.getVersion()!=v)throw new ApiException(HttpStatus.CONFLICT,ErrorCode.ORDER_VERSION_CONFLICT,"Order changed","This order was updated by another user. Reload and try again.");}
    private UserAccount actor(){return users.findById(currentUsers.getRequired().id()).orElseThrow(this::notFound);}
    private ApiException notFound(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.ORDER_NOT_FOUND,"Order resource unavailable","The requested order resource was not found in your branch.");}
    private ApiException invalidCustomer(String d){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_CUSTOMER_INVALID,"Invalid order customer",d);}
    private ApiException invalidItems(){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_ITEMS_REQUIRED,"Order items required","Add at least one eligible service item.");}
    private ApiException immutable(String d){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_IMMUTABLE,"Order is immutable",d);}
    private String clean(String v){if(v==null||v.isBlank())return null;return v.trim();}
    private List<Map<String,Object>> auditItems(List<OrderItem> values){return values.stream().map(item->{
        Map<String,Object> value=new LinkedHashMap<>(); value.put("serviceCode",item.getServiceCodeSnapshot());
        value.put("serviceName",item.getServiceNameSnapshot()); value.put("itemTypeCode",item.getItemTypeCodeSnapshot());
        value.put("itemTypeName",item.getItemTypeNameSnapshot()); value.put("quantity",item.getQuantity());
        value.put("lineAmount",item.getLineAmount()); value.put("pricingMethod",item.getPricingMethodSnapshot().name());
        return value;
    }).toList();}
    private Map<String,Object> nullableChange(Object before,Object after){Map<String,Object> value=new LinkedHashMap<>();value.put("before",before);value.put("after",after);return value;}
    private String writeAudit(Object value){try{return json.writeValueAsString(value);}catch(Exception ex){throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,ErrorCode.INTERNAL_ERROR,"Order audit failed","The order change could not be audited.");}}
    private record QuoteResult(List<OrderItem> items,String currency,Instant effectiveAt){}
}
