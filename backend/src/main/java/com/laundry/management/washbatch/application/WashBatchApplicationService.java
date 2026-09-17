package com.laundry.management.washbatch.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.*;
import com.laundry.management.auth.infrastructure.*;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.washbatch.api.WashBatchDtos;
import com.laundry.management.washbatch.domain.*;
import com.laundry.management.washbatch.infrastructure.*;
import java.time.*;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WashBatchApplicationService {
    private final WashBatchRepository batches; private final WashBatchOrderItemRepository orderItems; private final WashBatchActiveItemRepository active;
    private final WashBatchHistoryRepository history; private final BranchRepository branches; private final UserAccountRepository users;
    private final CurrentUserProvider currentUsers; private final WashBatchCompatibilityService compatibility; private final WashBatchNumberGenerator numbers;
    private final WashBatchMapper mapper; private final ObjectMapper json; private final ApplicationEventPublisher events; private final Clock clock;
    public WashBatchApplicationService(WashBatchRepository batches,WashBatchOrderItemRepository orderItems,WashBatchActiveItemRepository active,
        WashBatchHistoryRepository history,BranchRepository branches,UserAccountRepository users,CurrentUserProvider currentUsers,
        WashBatchCompatibilityService compatibility,WashBatchNumberGenerator numbers,WashBatchMapper mapper,ObjectMapper json,
        ApplicationEventPublisher events,Clock clock){this.batches=batches;this.orderItems=orderItems;this.active=active;this.history=history;this.branches=branches;this.users=users;
        this.currentUsers=currentUsers;this.compatibility=compatibility;this.numbers=numbers;this.mapper=mapper;this.json=json;this.events=events;this.clock=clock;}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_CREATE) and (!#request.markReady() or @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_MARK_READY))")
    @Transactional
    public WashBatchDtos.Detail create(WashBatchDtos.CreateRequest request){Long branchId=currentUsers.resolveAuthorizedBranch(request.branchId());
        Branch branch=branches.findByIdForUpdate(branchId).orElseThrow(this::notFound);UserAccount actor=actor();List<OrderItem> items=validatedItems(branchId,request.orderItemIds(),null);
        WashBatch batch=new WashBatch(numbers.next(branch),branch,items.get(0).getService(),clean(request.note()),actor);List<WashBatchItem> memberships=items.stream().map(i->batch.addItem(i,actor)).toList();
        batches.saveAndFlush(batch);claim(items,memberships);record(batch,WashBatchHistoryAction.CREATED,null,WashBatchStatus.DRAFT,null,itemAudit(items),actor);
        if(request.markReady()){Instant now=Instant.now(clock);batch.markReady(actor,now);record(batch,WashBatchHistoryAction.MARKED_READY,WashBatchStatus.DRAFT,WashBatchStatus.READY,null,safe(Map.of("warnings",compatibility.warnings(items))),actor);}
        batches.flush();publish(batch,"batch.created");if(request.markReady())publish(batch,"batch.ready");return mapper.detail(batch);}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_UPDATE)")
    @Transactional
    public WashBatchDtos.Detail addItems(Long id,Long branchId,WashBatchDtos.ItemsRequest request){WashBatch batch=locked(id,branchId);requireVersion(batch,request.version());requireDraft(batch);
        Set<Long> existingIds=batch.getActiveItems().stream().map(m->m.getOrderItem().getId()).collect(java.util.stream.Collectors.toSet());
        if(request.orderItemIds().stream().anyMatch(existingIds::contains))throw assigned();
        List<OrderItem> additions=loadItems(batch.getBranch().getId(),request.orderItemIds());List<OrderItem> combined=new ArrayList<>(batch.getActiveItems().stream().map(WashBatchItem::getOrderItem).toList());combined.addAll(additions);validateCompatibility(batch.getBranch().getId(),combined,batch.getId());
        UserAccount actor=actor();List<WashBatchItem> memberships=additions.stream().map(i->batch.addItem(i,actor)).toList();batch.touch(actor,Instant.now(clock));batches.flush();claim(additions,memberships);
        record(batch,WashBatchHistoryAction.ITEMS_ADDED,batch.getStatus(),batch.getStatus(),null,itemAudit(additions),actor);batches.flush();publish(batch,"batch.items-added");return mapper.detail(batch);}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_UPDATE)")
    @Transactional
    public WashBatchDtos.Detail removeItems(Long id,Long branchId,WashBatchDtos.ItemsRequest request){WashBatch batch=locked(id,branchId);requireVersion(batch,request.version());requireDraft(batch);
        Set<Long> requested=unique(request.orderItemIds());Map<Long,WashBatchItem> memberships=new LinkedHashMap<>();batch.getActiveItems().forEach(m->memberships.put(m.getOrderItem().getId(),m));
        if(!memberships.keySet().containsAll(requested))throw incompatible(List.of("ITEM_NOT_IN_BATCH"));if(memberships.size()-requested.size()<1)throw itemsRequired("A wash batch must retain at least one item; cancel it instead.");
        UserAccount actor=actor();Instant now=Instant.now(clock);requested.forEach(itemId->memberships.get(itemId).remove(actor,now));active.release(requested);batch.touch(actor,now);
        List<OrderItem> removed=requested.stream().map(idValue->memberships.get(idValue).getOrderItem()).toList();record(batch,WashBatchHistoryAction.ITEMS_REMOVED,batch.getStatus(),batch.getStatus(),null,itemAudit(removed),actor);
        batches.flush();publish(batch,"batch.items-removed");return mapper.detail(batch);}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_UPDATE)")
    @Transactional
    public WashBatchDtos.Detail updateNote(Long id,Long branchId,WashBatchDtos.NoteRequest request){WashBatch batch=locked(id,branchId);requireVersion(batch,request.version());requireDraft(batch);String note=clean(request.note());
        if(Objects.equals(note,batch.getNote()))return mapper.detail(batch);UserAccount actor=actor();batch.updateNote(note,actor,Instant.now(clock));record(batch,WashBatchHistoryAction.NOTE_UPDATED,batch.getStatus(),batch.getStatus(),null,safe(Map.of("noteRecorded",note!=null)),actor);
        batches.flush();publish(batch,"batch.updated");return mapper.detail(batch);}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_MARK_READY)")
    @Transactional
    public WashBatchDtos.Detail markReady(Long id,Long branchId,WashBatchDtos.VersionRequest request){WashBatch batch=locked(id,branchId);requireVersion(batch,request.version());requireDraft(batch);List<OrderItem> items=batch.getActiveItems().stream().map(WashBatchItem::getOrderItem).toList();
        if(items.isEmpty())throw itemsRequired("A wash batch must contain at least one active item.");validateCompatibility(batch.getBranch().getId(),items,batch.getId());UserAccount actor=actor();WashBatchStatus from=batch.getStatus();batch.markReady(actor,Instant.now(clock));
        record(batch,WashBatchHistoryAction.MARKED_READY,from,WashBatchStatus.READY,null,safe(Map.of("warnings",compatibility.warnings(items))),actor);batches.flush();publish(batch,"batch.ready");return mapper.detail(batch);}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_CANCEL)")
    @Transactional
    public WashBatchDtos.Detail cancel(Long id,Long branchId,WashBatchDtos.CancelRequest request){WashBatch batch=locked(id,branchId);requireVersion(batch,request.version());
        if(batch.getStatus()!=WashBatchStatus.DRAFT&&batch.getStatus()!=WashBatchStatus.READY)throw invalidTransition();UserAccount actor=actor();Instant now=Instant.now(clock);WashBatchStatus from=batch.getStatus();List<WashBatchItem> memberships=batch.getActiveItems();
        List<Long> ids=memberships.stream().map(m->m.getOrderItem().getId()).toList();memberships.forEach(m->m.remove(actor,now));if(!ids.isEmpty())active.release(ids);String reason=clean(request.reason());batch.cancel(reason,actor,now);
        record(batch,WashBatchHistoryAction.CANCELLED,from,WashBatchStatus.CANCELLED,reason,safe(Map.of("releasedItemIds",ids)),actor);batches.flush();publish(batch,"batch.cancelled");return mapper.detail(batch);}

    private List<OrderItem> validatedItems(Long branchId,List<Long> ids,Long allowedBatchId){List<OrderItem> items=loadItems(branchId,ids);validateCompatibility(branchId,items,allowedBatchId);return items;}
    private List<OrderItem> loadItems(Long branchId,List<Long> requestedIds){Set<Long> ids=unique(requestedIds);List<OrderItem> items=orderItems.lockOrderItems(ids);if(items.size()!=ids.size())throw incompatible(List.of("ITEM_UNAVAILABLE"));
        if(items.stream().anyMatch(i->!Objects.equals(i.getOrder().getBranch().getId(),branchId)))throw notFound();return items;}
    private Set<Long> unique(List<Long> values){LinkedHashSet<Long> ids=new LinkedHashSet<>(values);if(ids.size()!=values.size())throw invalid("Order item IDs must be unique.");return ids;}
    private void validateCompatibility(Long branchId,List<OrderItem> items,Long allowedBatchId){var result=compatibility.evaluate(branchId,items,allowedBatchId);if(result.blockers().contains(WashBatchCompatibilityService.ALREADY_ASSIGNED))throw assigned();if(!result.compatible())throw incompatible(result.blockers());}
    private void claim(List<OrderItem> items,List<WashBatchItem> memberships){try{List<WashBatchActiveItem> locks=new ArrayList<>();for(int i=0;i<items.size();i++)locks.add(new WashBatchActiveItem(items.get(i),memberships.get(i)));active.saveAllAndFlush(locks);}catch(DataIntegrityViolationException ex){throw assigned();}}
    private WashBatch locked(Long id,Long requestedBranch){Long branch=currentUsers.resolveAuthorizedBranch(requestedBranch);return batches.findForUpdate(id,branch).orElseThrow(this::notFound);}
    private void requireVersion(WashBatch batch,long version){if(batch.getVersion()!=version)throw new ApiException(HttpStatus.CONFLICT,ErrorCode.BATCH_VERSION_CONFLICT,"Wash batch changed","Reload the latest batch before continuing.");}
    private void requireDraft(WashBatch batch){if(batch.getStatus()!=WashBatchStatus.DRAFT)throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.BATCH_IMMUTABLE,"Wash batch is immutable","Only draft batches can change composition or note.");}
    private void record(WashBatch batch,WashBatchHistoryAction action,WashBatchStatus from,WashBatchStatus to,String reason,String changed,UserAccount actor){history.save(new WashBatchHistory(batch,action,from,to,reason,changed,actor));}
    private String itemAudit(List<OrderItem> items){return safe(Map.of("itemCount",items.size(),"items",items.stream().map(i->Map.of("orderItemId",i.getId(),"orderId",i.getOrder().getId(),"serviceCode",i.getServiceCodeSnapshot(),"itemTypeCode",i.getItemTypeCodeSnapshot())).toList()));}
    private String safe(Object value){try{return json.writeValueAsString(value);}catch(Exception ex){throw new IllegalStateException("Unable to serialize wash batch audit",ex);}}
    private void publish(WashBatch batch,String type){events.publishEvent(new WashBatchChangedEvent(batch.getId(),batch.getBatchCode(),batch.getBranch().getId(),batch.getVersion(),type,Instant.now(clock)));}
    private UserAccount actor(){return users.findById(currentUsers.getRequired().id()).orElseThrow(this::notFound);} private String clean(String value){return value==null||value.isBlank()?null:value.trim();}
    private ApiException notFound(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.BATCH_NOT_FOUND,"Wash batch unavailable","The requested wash batch resource was not found in your branch.");}
    private ApiException assigned(){return new ApiException(HttpStatus.CONFLICT,ErrorCode.BATCH_ITEM_ALREADY_ASSIGNED,"Order item already assigned","One or more items were assigned to another active wash batch.");}
    private ApiException incompatible(List<String> blockers){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.BATCH_INCOMPATIBLE,"Wash batch is incompatible",String.join(",",blockers));}
    private ApiException itemsRequired(String detail){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.BATCH_ITEMS_REQUIRED,"Wash batch items required",detail);}
    private ApiException invalid(String detail){return new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.VALIDATION_ERROR,"Invalid wash batch request",detail);}
    private ApiException invalidTransition(){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.BATCH_INVALID_TRANSITION,"Invalid wash batch transition","Only draft or ready batches can be cancelled.");}
}
