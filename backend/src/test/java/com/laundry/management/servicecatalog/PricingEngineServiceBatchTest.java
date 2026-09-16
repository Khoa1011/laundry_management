package com.laundry.management.servicecatalog;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.application.CatalogAuthorizationService;
import com.laundry.management.servicecatalog.application.PricingCalculator;
import com.laundry.management.servicecatalog.application.PricingEngineService;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class PricingEngineServiceBatchTest {

    @Test
    void resolvesSharedBatchResourcesOnceBeforeRuleResolution() {
        CatalogAuthorizationService authorization = mock(CatalogAuthorizationService.class);
        LaundryServiceRepository services = mock(LaundryServiceRepository.class);
        ItemTypeRepository items = mock(ItemTypeRepository.class);
        PriceListRepository lists = mock(PriceListRepository.class);
        PriceRuleRepository rules = mock(PriceRuleRepository.class);
        ServiceItemEligibilityRepository eligibility = mock(ServiceItemEligibilityRepository.class);
        PricingEngineService service = new PricingEngineService(
            authorization, services, items, lists, rules, eligibility, mock(PricingCalculator.class));
        Instant effectiveAt = Instant.parse("2026-09-16T10:15:30Z");
        PriceList priceList = mock(PriceList.class);
        when(lists.findEffective(anyLong(), anyCollection(), any())).thenReturn(List.of(priceList));
        ItemType firstItem = activeItem(3L);
        ItemType secondItem = activeItem(5L);
        when(items.findAllById(any())).thenReturn(List.of(firstItem, secondItem));
        when(items.findParentIdsWithChildren(anyCollection())).thenReturn(List.of());
        LaundryService firstService = activeService(2L);
        LaundryService secondService = activeService(4L);
        when(services.findAllById(any())).thenReturn(List.of(firstService, secondService));
        when(eligibility.existsByServiceIdAndItemTypeId(anyLong(), anyLong())).thenReturn(false);

        assertThatThrownBy(() -> service.quoteForOrder(List.of(
            request(7L, 2L, 3L, effectiveAt), request(7L, 4L, 5L, effectiveAt))))
            .isInstanceOf(ApiException.class);

        verify(lists, times(1)).findEffective(anyLong(), anyCollection(), any());
        verify(items, times(1)).findAllById(any());
        verify(services, times(1)).findAllById(any());
        verify(items, never()).findByIdAndStatus(anyLong(), any());
        verify(services, never()).findByIdAndStatus(anyLong(), any());
    }

    private CatalogDtos.PricingPreviewRequest request(Long branchId, Long serviceId, Long itemTypeId, Instant at) {
        return new CatalogDtos.PricingPreviewRequest(branchId, serviceId, itemTypeId,
            null, null, SharingMode.ANY, null, BigDecimal.ONE, at);
    }

    private ItemType activeItem(Long id) {
        ItemType item = mock(ItemType.class);
        when(item.getId()).thenReturn(id);
        when(item.getStatus()).thenReturn(CatalogStatus.ACTIVE);
        return item;
    }

    private LaundryService activeService(Long id) {
        LaundryService service = mock(LaundryService.class);
        when(service.getId()).thenReturn(id);
        when(service.getStatus()).thenReturn(CatalogStatus.ACTIVE);
        return service;
    }
}
