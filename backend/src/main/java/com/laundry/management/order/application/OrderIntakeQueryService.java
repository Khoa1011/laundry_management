package com.laundry.management.order.application;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.customer.application.PhoneNormalizer;
import com.laundry.management.customer.infrastructure.CustomerRepository;
import com.laundry.management.order.api.OrderDtos;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.application.PricingEngineService;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderIntakeQueryService {
    private static final String CREATE_PERMISSION =
        "@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_CREATE)";

    private final CurrentUserProvider currentUsers;
    private final CustomerRepository customers;
    private final PhoneNormalizer phoneNormalizer;
    private final LaundryServiceRepository services;
    private final ServiceItemEligibilityRepository eligibility;
    private final PricingEngineService pricing;
    private final Clock clock;

    public OrderIntakeQueryService(CurrentUserProvider currentUsers, CustomerRepository customers,
        PhoneNormalizer phoneNormalizer, LaundryServiceRepository services,
        ServiceItemEligibilityRepository eligibility, PricingEngineService pricing, Clock clock) {
        this.currentUsers=currentUsers; this.customers=customers; this.phoneNormalizer=phoneNormalizer;
        this.services=services; this.eligibility=eligibility; this.pricing=pricing; this.clock=clock;
    }

    @PreAuthorize(CREATE_PERMISSION)
    @Transactional(readOnly=true)
    public List<OrderDtos.IntakeCustomerResponse> customers(String query, Long requestedBranchId) {
        Long branchId=currentUsers.resolveAuthorizedBranch(requestedBranchId);
        String value=query==null?"":query.trim();
        if(value.length()<2)return List.of();
        String digits=value.replaceAll("\\D","");
        String exact=phoneNormalizer.tryNormalizeForSearch(value).orElse(null);
        boolean suffix=value.matches("\\d{3,4}");
        String namePattern=exact==null&&!suffix?"%"+escape(value.toLowerCase(Locale.ROOT))+"%":null;
        String reverseSuffix=suffix?new StringBuilder(digits).reverse()+"%":null;
        return customers.counterSearch(branchId,namePattern,exact,reverseSuffix,PageRequest.of(0,20)).stream()
            .map(customer->new OrderDtos.IntakeCustomerResponse(customer.getId(),customer.getCustomerCode(),
                customer.getFullName(),customer.getPhone())).toList();
    }

    @PreAuthorize(CREATE_PERMISSION)
    @Transactional(readOnly=true)
    public List<OrderDtos.IntakeServiceResponse> services(Long requestedBranchId) {
        currentUsers.resolveAuthorizedBranch(requestedBranchId);
        return services.findByStatusOrderByNameViAscIdAsc(CatalogStatus.ACTIVE).stream()
            .map(service->new OrderDtos.IntakeServiceResponse(service.getId(),service.getCode(),
                service.getNameVi(),service.getDefaultUnitType(),service.isSharingAllowed())).toList();
    }

    @PreAuthorize(CREATE_PERMISSION)
    @Transactional(readOnly=true)
    public List<OrderDtos.IntakeItemTypeResponse> itemTypes(Long serviceId, Long requestedBranchId) {
        currentUsers.resolveAuthorizedBranch(requestedBranchId);
        return eligibility.findActiveLeafByServiceId(serviceId).stream().map(value->{
            var item=value.getItemType();
            return new OrderDtos.IntakeItemTypeResponse(item.getId(),item.getCode(),item.getNameVi(),
                item.getDefaultUnitType());
        }).toList();
    }

    @PreAuthorize(CREATE_PERMISSION)
    @Transactional(readOnly=true)
    public CatalogDtos.PricingPreviewResponse quote(OrderDtos.IntakeQuoteRequest request) {
        Long branchId=currentUsers.resolveAuthorizedBranch(request.branchId());
        return pricing.quoteForOrder(new CatalogDtos.PricingPreviewRequest(branchId,request.serviceId(),
            request.itemTypeId(),null,null,request.sharingMode(),request.priorityLevel(),request.quantity(),
            Instant.now(clock)));
    }

    private String escape(String value){return value.replace("!","!!").replace("%","!%").replace("_","!_");}
}
