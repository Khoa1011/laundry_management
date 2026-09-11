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

    public OrderApplicationService(OrderRepository orders, OrderHistoryRepository history, BranchRepository branches,
        CustomerRepository customers, UserAccountRepository users, LaundryServiceRepository services,
        ItemTypeRepository itemTypes, PricingEngineService pricing, OrderNumberGenerator numbers,
        OrderMapper mapper, ObjectMapper json, CurrentUserProvider currentUsers, ApplicationEventPublisher events,
        OrderTransitionPolicy transitions) {
        this.orders=orders;this.history=history;this.branches=branches;this.customers=customers;this.users=users;
        this.services=services;this.itemTypes=itemTypes;this.pricing=pricing;this.numbers=numbers;this.mapper=mapper;
        this.json=json;this.currentUsers=currentUsers;this.events=events;this.transitions=transitions;
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
        List<OrderItem> quoted=quoteItems(branchId,request.items());
        Branch locked=branches.findByIdForUpdate(branchId).orElseThrow(this::notFound);
        LaundryOrder order=new LaundryOrder(numbers.next(locked),locked,customer,name,phone,request.promisedAt(),clean(request.note()),actor);
        quoted.forEach(order::addItem); orders.saveAndFlush(order);
        record(order,OrderHistoryAction.CREATED,null,OrderStatus.RECEIVED,null,"{\"fields\":[\"customer\",\"items\",\"promisedAt\",\"note\"]}",actor);
        publish(order,"order.created");
        return mapper.detail(order);
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_UPDATE)")
    @Transactional
    public OrderDtos.Response update(Long id, Long requestedBranchId, OrderDtos.UpdateRequest request) {
        LaundryOrder order=locked(id,requestedBranchId); requireVersion(order,request.version());
        if(order.getStatus()==OrderStatus.COMPLETED || order.getStatus()==OrderStatus.CANCELLED)
            throw immutable("Completed or cancelled orders cannot be edited.");
        if(request.items()!=null && order.getStatus()!=OrderStatus.RECEIVED)
            throw immutable("Services can only be edited while an order is received.");
        UserAccount actor=actor();
        if(request.items()!=null){if(request.items().isEmpty())throw invalidItems();order.replaceItems(quoteItems(order.getBranch().getId(),request.items()));}
        order.updateMetadata(request.promisedAt(),clean(request.note()),actor);
        record(order,OrderHistoryAction.UPDATED,order.getStatus(),order.getStatus(),null,
            request.items()==null?"{\"fields\":[\"promisedAt\",\"note\"]}":"{\"fields\":[\"items\",\"promisedAt\",\"note\"]}",actor);
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

    private List<OrderItem> quoteItems(Long branchId,List<OrderDtos.ItemRequest> requested){
        if(requested==null||requested.isEmpty())throw invalidItems();
        return requested.stream().map(item->{
            Instant now=Instant.now();
            CatalogDtos.PricingPreviewResponse q=pricing.quoteForOrder(new CatalogDtos.PricingPreviewRequest(branchId,item.serviceId(),item.itemTypeId(),null,null,item.sharingMode(),item.priorityLevel(),item.quantity(),now));
            LaundryService service=services.findById(q.serviceId()).orElseThrow(this::notFound);
            ItemType itemType=q.itemTypeId()==null?null:itemTypes.findById(q.itemTypeId()).orElseThrow(this::notFound);
            try{return new OrderItem(service,itemType,q.serviceCode(),q.serviceName(),q.itemTypeCode(),q.itemTypeName(),q.pricingMethod(),q.unitType(),q.sharingMode(),q.actualQuantity(),q.billableQuantity(),q.finalAmount(),clean(item.note()),json.writeValueAsString(q.snapshot()),q.snapshot().quotedAt());}
            catch(Exception ex){throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,ErrorCode.INTERNAL_ERROR,"Pricing snapshot failed","The authoritative price could not be recorded.");}
        }).toList();
    }
    private LaundryOrder locked(Long id,Long requestedBranch){Long b=currentUsers.resolveAuthorizedBranch(requestedBranch);return orders.findForUpdate(id,b).orElseThrow(this::notFound);}
    private void record(LaundryOrder o,OrderHistoryAction a,OrderStatus f,OrderStatus t,String reason,String changed,UserAccount actor){history.save(new OrderStatusHistory(o,a,f,t,reason,changed,OrderStatusSource.MANUAL_COMMAND,actor));}
    private void publish(LaundryOrder o,String type){events.publishEvent(new OrderChangedEvent(o.getId(),o.getOrderCode(),o.getBranch().getId(),o.getStatus(),o.getVersion(),type,Instant.now()));}
    private void requireVersion(LaundryOrder o,long v){if(o.getVersion()!=v)throw new ApiException(HttpStatus.CONFLICT,ErrorCode.ORDER_VERSION_CONFLICT,"Order changed","This order was updated by another user. Reload and try again.");}
    private UserAccount actor(){return users.findById(currentUsers.getRequired().id()).orElseThrow(this::notFound);}
    private ApiException notFound(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.ORDER_NOT_FOUND,"Order resource unavailable","The requested order resource was not found in your branch.");}
    private ApiException invalidCustomer(String d){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_CUSTOMER_INVALID,"Invalid order customer",d);}
    private ApiException invalidItems(){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_ITEMS_REQUIRED,"Order items required","Add at least one eligible service item.");}
    private ApiException immutable(String d){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.ORDER_IMMUTABLE,"Order is immutable",d);}
    private String clean(String v){if(v==null||v.isBlank())return null;return v.trim();}
}
