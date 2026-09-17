package com.laundry.management.washbatch.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.order.infrastructure.OrderRepository;
import com.laundry.management.washbatch.api.WashBatchDtos;
import com.laundry.management.washbatch.domain.*;
import com.laundry.management.washbatch.infrastructure.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WashBatchQueryService {
    private final WashBatchRepository batches; private final WashBatchOrderItemRepository orderItems; private final WashBatchHistoryRepository history;
    private final OrderRepository orders; private final WashBatchMapper mapper; private final CurrentUserProvider users;
    public WashBatchQueryService(WashBatchRepository batches,WashBatchOrderItemRepository orderItems,WashBatchHistoryRepository history,OrderRepository orders,WashBatchMapper mapper,CurrentUserProvider users){this.batches=batches;this.orderItems=orderItems;this.history=history;this.orders=orders;this.mapper=mapper;this.users=users;}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.PageResponse list(Long requestedBranch,WashBatchStatus status,String search,int page,int size){validateSize(size);Long branch=users.resolveAuthorizedBranch(requestedBranch);String pattern=pattern(search);
        Page<WashBatch> result=batches.search(branch,status,pattern,PageRequest.of(Math.max(0,page),size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id"))));
        List<Long> ids=result.stream().map(WashBatch::getId).toList();Map<Long,WashBatch> hydrated=ids.isEmpty()?Map.of():batches.findListDetails(ids).stream().collect(java.util.stream.Collectors.toMap(WashBatch::getId,java.util.function.Function.identity()));
        List<WashBatchDtos.ListItem> items=ids.stream().map(hydrated::get).filter(Objects::nonNull).map(mapper::list).toList();
        return new WashBatchDtos.PageResponse(items,result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.Detail detail(Long id,Long requestedBranch){Long branch=users.resolveAuthorizedBranch(requestedBranch);return mapper.detail(batches.findByIdAndBranchId(id,branch).orElseThrow(this::notFound));}

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).BATCH_READ)")
    @Transactional(readOnly=true)
    public WashBatchDtos.CandidatePage candidates(Long requestedBranch,String search,Long serviceId,int page,int size){validateSize(size);Long branch=users.resolveAuthorizedBranch(requestedBranch);
        Page<com.laundry.management.order.domain.OrderItem> result=orderItems.findCandidates(branch,OrderStatus.RECEIVED,serviceId,pattern(search),PageRequest.of(Math.max(0,page),size));
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
    private String pattern(String value){return value==null||value.isBlank()?null:"%"+value.trim().toLowerCase().replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
    private ApiException notFound(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.BATCH_NOT_FOUND,"Wash batch unavailable","The requested resource was not found in your branch.");}
}
