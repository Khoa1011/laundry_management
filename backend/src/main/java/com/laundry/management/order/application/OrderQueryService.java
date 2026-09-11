package com.laundry.management.order.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.*;
import com.laundry.management.order.api.OrderDtos;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.order.infrastructure.*;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderQueryService {
    private final OrderRepository orders; private final OrderHistoryRepository history; private final OrderMapper mapper; private final CurrentUserProvider users;
    public OrderQueryService(OrderRepository orders,OrderHistoryRepository history,OrderMapper mapper,CurrentUserProvider users){this.orders=orders;this.history=history;this.mapper=mapper;this.users=users;}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_READ)")
    @Transactional(readOnly=true)
    public OrderDtos.PageResponse list(int page,int size,String search,OrderStatus status,Instant from,Instant to,Long branchId){
        if(size<1||size>100)throw new ApiException(HttpStatus.BAD_REQUEST,ErrorCode.PAGE_SIZE_EXCEEDED,"Invalid page size","Use a page size between 1 and 100.");
        Long branch=users.resolveAuthorizedBranch(branchId);String pattern=search==null||search.isBlank()?null:"%"+escape(search.trim().toLowerCase())+"%";
        Page<com.laundry.management.order.domain.LaundryOrder> result=orders.search(branch,status,pattern,from,to,PageRequest.of(Math.max(0,page),size,Sort.by(Sort.Order.desc("createdAt"),Sort.Order.desc("id"))));
        return new OrderDtos.PageResponse(result.stream().map(mapper::list).toList(),result.getNumber(),result.getSize(),result.getTotalElements(),result.getTotalPages());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_READ)")
    @Transactional(readOnly=true) public OrderDtos.Response get(Long id,Long branchId){Long b=users.resolveAuthorizedBranch(branchId);return mapper.detail(orders.findByIdAndBranchId(id,b).orElseThrow(this::missing));}
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_AUDIT_READ)")
    @Transactional(readOnly=true) public List<OrderDtos.HistoryResponse> history(Long id,Long branchId){Long b=users.resolveAuthorizedBranch(branchId);orders.findByIdAndBranchId(id,b).orElseThrow(this::missing);return history.findByOrderIdOrderByCreatedAtDescIdDesc(id).stream().map(mapper::history).toList();}
    private RuntimeException missing(){return new ApiException(HttpStatus.NOT_FOUND,ErrorCode.ORDER_NOT_FOUND,"Order not found","The order was not found in your branch.");}
    private String escape(String v){return v.replace("!","!!").replace("%","!%").replace("_","!_");}
}
