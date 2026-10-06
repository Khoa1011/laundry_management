package com.laundry.management.washbatch.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.washbatch.api.WashBatchDtos;
import com.laundry.management.washbatch.domain.*;
import com.laundry.management.washbatch.infrastructure.*;
import java.util.*;
import java.time.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WashBatchQueryService {
    private final WashBatchRepository batches; private final WashBatchOrderItemRepository orderItems; private final WashBatchHistoryRepository history;
    private final OrderRepository orders; private final WashBatchMapper mapper; private final CurrentUserProvider users; private final LaundryServiceRepository services; private final Clock clock;
    public WashBatchQueryService(WashBatchRepository batches,WashBatchOrderItemRepository orderItems,WashBatchHistoryRepository history,OrderRepository orders,WashBatchMapper mapper,CurrentUserProvider users,LaundryServiceRepository services,Clock clock){this.batches=batches;this.orderItems=orderItems;this.history=history;this.orders=orders;this.mapper=mapper;this.users=users;this.services=services;this.clock=clock;}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.PageResponse list(Long requestedBranch,WashBatchStatus status,String search,Long serviceId,Long createdBy,Instant createdFrom,Instant createdTo,String loadType,String warning,int page,int size){validateSize(size);validateFilter(loadType,Set.of("PRIVATE","SHARED"),"loadType");validateFilter(warning,Set.of("ITEM_NOTE_PRESENT","DIFFERENT_ITEM_TYPES","PRIORITY_ITEM","PROMISED_TIME_SOON"),"warning");Long branch=users.resolveAuthorizedBranch(requestedBranch);String pattern=pattern(search);Instant now=Instant.now(clock);
        Page<WashBatch> result=batches.search(branch,status,pattern,serviceId,createdBy,createdFrom,createdTo,"PRIVATE".equals(loadType),"SHARED".equals(loadType),"ITEM_NOTE_PRESENT".equals(warning),"DIFFERENT_ITEM_TYPES".equals(warning),"PRIORITY_ITEM".equals(warning),"PROMISED_TIME_SOON".equals(warning),now.plus(Duration.ofHours(24)),PageRequest.of(Math.max(0,page),size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id"))));
        List<Long> ids=result.stream().map(WashBatch::getId).toList();Map<Long,WashBatch> hydrated=ids.isEmpty()?Map.of():batches.findListDetails(ids).stream().collect(java.util.stream.Collectors.toMap(WashBatch::getId,java.util.function.Function.identity()));
        List<WashBatchDtos.ListItem> items=ids.stream().map(hydrated::get).filter(Objects::nonNull).map(mapper::list).toList();
        return new WashBatchDtos.PageResponse(items,result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.FilterOptions filterOptions(Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);return new WashBatchDtos.FilterOptions(services.findByStatusOrderByNameViAscIdAsc(CatalogStatus.ACTIVE).stream().map(value->new WashBatchDtos.FilterOption(value.getId(),value.getNameVi())).toList(),batches.findCreators(branch).stream().map(value->new WashBatchDtos.FilterOption(value.getId(),value.getDisplayName())).toList());}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.Detail detail(Long id,Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);return mapper.detail(batches.findByIdAndBranchId(id,branch).orElseThrow(this::notFound));}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ) or @permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_CREATE)")
    @Transactional(readOnly=true)
    public WashBatchDtos.CandidatePage candidates(Long requestedBranch,String search,Long serviceId,List<Long> requestedOrderIds,int page,int size){validateSize(size);Long branch=users.resolveAuthorizedBranch(requestedBranch);
        List<Long> orderIds=validatedOrderIds(requestedOrderIds);Pageable pageable=PageRequest.of(Math.max(0,page),size);
        Page<com.laundry.management.order.domain.OrderItem> result=orderIds.isEmpty()
            ? orderItems.findCandidates(branch,OrderStatus.RECEIVED,serviceId,pattern(search),pageable)
            : orderItems.findCandidatesForOrders(branch,OrderStatus.RECEIVED,serviceId,pattern(search),orderIds,pageable);
        return new WashBatchDtos.CandidatePage(result.stream().map(mapper::candidate).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.Stats stats(Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);return new WashBatchDtos.Stats(orderItems.countCandidates(branch,OrderStatus.RECEIVED),batches.countByBranchIdAndStatus(branch,WashBatchStatus.DRAFT),batches.countByBranchIdAndStatus(branch,WashBatchStatus.READY));}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_AUDIT_READ)")
    @Transactional(readOnly=true)
    public List<WashBatchDtos.History> history(Long id,Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);batches.findByIdAndBranchId(id,branch).orElseThrow(this::notFound);return history.findByBatchIdOrderByCreatedAtDescIdDesc(id).stream().map(mapper::history).toList();}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public List<WashBatchDtos.Reference> byOrder(Long orderId,Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);orders.findByIdAndBranchId(orderId,branch).orElseThrow(this::notFound);
        return batches.findByOrder(branch,orderId).stream().map(batch->mapper.reference(batch,batch.getActiveItems().stream().anyMatch(m->Objects.equals(m.getOrderItem().getOrder().getId(),orderId)))).toList();}

    private void validateSize(int size){if(size<1||size>100)throw new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.PAGE_SIZE_EXCEEDED,"Invalid page size","Use a page size between 1 and 100.");}
    private List<Long> validatedOrderIds(List<Long> values){if(values==null||values.isEmpty())return List.of();if(values.size()>100||values.stream().anyMatch(Objects::isNull))throw new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.VALIDATION_ERROR,"Invalid order filter","Provide at most 100 valid order IDs.");LinkedHashSet<Long> unique=new LinkedHashSet<>(values);if(unique.size()!=values.size()||unique.stream().anyMatch(value->value<1))throw new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.VALIDATION_ERROR,"Invalid order filter","Order IDs must be positive and unique.");return List.copyOf(unique);}
    private void validateFilter(String value,Set<String> allowed,String name){if(value!=null&&!value.isBlank()&&!allowed.contains(value))throw new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.VALIDATION_ERROR,"Invalid filter","Unsupported "+name+" filter.");}
    private String pattern(String value){return value==null||value.isBlank()?null:"%"+value.trim().toLowerCase().replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
    private ApiException notFound(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.BATCH_NOT_FOUND,"Wash batch unavailable","The requested resource was not found in your branch.");}
}
