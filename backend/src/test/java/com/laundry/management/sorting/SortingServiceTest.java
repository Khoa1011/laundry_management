package com.laundry.management.sorting;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.auth.security.CurrentUser;
import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.order.domain.*;
import com.laundry.management.order.infrastructure.*;
import com.laundry.management.servicecatalog.domain.*;
import com.laundry.management.sorting.api.SortingDtos;
import com.laundry.management.sorting.application.SortingService;
import com.laundry.management.sorting.domain.ProcessingGroup;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import com.laundry.management.sorting.infrastructure.ProcessingGroupRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.context.ApplicationEventPublisher;

class SortingServiceTest {
    private final OrderRepository orders = mock(OrderRepository.class);
    private final OrderBagRepository bags = mock(OrderBagRepository.class);
    private final ProcessingGroupRepository groups = mock(ProcessingGroupRepository.class);
    private final OrderHistoryRepository history = mock(OrderHistoryRepository.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final CurrentUserProvider current = mock(CurrentUserProvider.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final LaundryOrder order = mock(LaundryOrder.class);
    private final OrderBag bag = mock(OrderBag.class);
    private final OrderItem item = mock(OrderItem.class);
    private final ItemType itemType = mock(ItemType.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final Instant now = Instant.parse("2026-10-08T10:00:00Z");
    private SortingService service;

    @BeforeEach void setup() {
        service = new SortingService(orders, bags, groups, history, users, current,
            new ObjectMapper(), events, Clock.fixed(now, ZoneOffset.UTC));
        when(current.resolveAuthorizedBranch(7L)).thenReturn(7L);
        when(current.getRequired()).thenReturn(new CurrentUser(19L, "operator", "Operator", 7L,
            Set.of(), Set.of(), List.of(7L), 0));
        when(users.findById(19L)).thenReturn(Optional.of(actor));
        Branch branch = mock(Branch.class); when(branch.getId()).thenReturn(7L);
        when(order.getId()).thenReturn(11L); when(order.getBranch()).thenReturn(branch);
        when(order.getStatus()).thenReturn(OrderStatus.RECEIVED);
        when(order.getOrderCode()).thenReturn("GS-DH-000011"); when(order.getItems()).thenReturn(List.of(item));
        when(bag.getId()).thenReturn(31L); when(bag.getBagCode()).thenReturn("GS-DH-000011-01");
        when(bag.getOrder()).thenReturn(order); when(bag.getStatus()).thenReturn(OrderBagStatus.RECEIVED);
        when(bag.getVersion()).thenReturn(0L);
        when(item.getId()).thenReturn(41L); when(item.getOrder()).thenReturn(order);
        when(item.getQuantity()).thenReturn(new BigDecimal("5.200"));
        when(item.getServiceNameSnapshot()).thenReturn("Giặt sấy");
        when(item.getItemTypeNameSnapshot()).thenReturn("Quần áo");
        when(item.getUnitTypeSnapshot()).thenReturn(UnitType.KG);
        when(item.getSharingModeSnapshot()).thenReturn(SharingMode.ANY);
        when(item.getItemType()).thenReturn(itemType);
        when(bags.findByIdAndOrderBranchId(31L,7L)).thenReturn(Optional.of(bag));
        when(orders.findForUpdate(11L,7L)).thenReturn(Optional.of(order));
        when(bags.findForUpdate(31L,11L)).thenReturn(Optional.of(bag));
        when(groups.findByBagOrderIdAndStatus(11L,GroupStatus.WAITING)).thenReturn(List.of());
        when(groups.findByBagIdOrderBySequenceNumberAsc(31L)).thenReturn(List.of());
        when(bags.countByOrderIdAndStatus(11L,OrderBagStatus.RECEIVED)).thenReturn(1L);
        when(bags.countByOrderIdAndStatusIn(eq(11L),anyList())).thenReturn(1L);
    }

    private SortingDtos.Draft draft(Long itemId, String quantity, boolean separate) {
        return new SortingDtos.Draft(itemId,new BigDecimal(quantity),ColorGroup.DARK,FabricCare.STANDARD,
            WashMode.SERVICE_DEFAULT,TemperatureProfile.SERVICE_DEFAULT,DetergentProfile.DEFAULT,
            SoftenerProfile.DEFAULT,HygieneLevel.STANDARD,separate,DryingInstruction.HANG_DRY,null);
    }
    private SortingDtos.ConfirmRequest request(long version, SortingDtos.Draft... drafts) {
        return new SortingDtos.ConfirmRequest(version,List.of(drafts));
    }
    private void fails(ErrorCode code, SortingDtos.ConfirmRequest request) {
        assertThatThrownBy(() -> service.confirm(31L,7L,request)).isInstanceOfSatisfying(ApiException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(code));
        verify(groups,never()).saveAllAndFlush(any());
    }

    @Test void crossBranchScanDoesNotRevealBag() {
        when(bags.findByIdAndOrderBranchId(31L,7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.scan("B31",7L)).isInstanceOfSatisfying(ApiException.class,
            exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SORTING_BAG_NOT_FOUND));
        verify(bags).findByIdAndOrderBranchId(31L,7L);
    }

    @Test void scanVisibleCodeAndBarcodeReturnsSameBag() {
        when(bags.findByBagCodeAndOrderBranchId("GS-DH-000011-01",7L)).thenReturn(Optional.of(bag));
        assertThat(service.scan("gs-dh-000011-01",7L).bagId()).isEqualTo(31L);
        assertThat(service.scan("B31",7L).bagCode()).isEqualTo("GS-DH-000011-01");
    }

    @Test void groupBarcodeResolvesOnlyWithinAuthorizedBranch() {
        ProcessingGroup group = mock(ProcessingGroup.class);
        when(group.getId()).thenReturn(51L);
        when(group.getBag()).thenReturn(bag);
        when(group.getItem()).thenReturn(item);
        when(groups.findByIdAndBagOrderBranchId(51L,7L)).thenReturn(Optional.of(group));
        assertThat(service.scanGroup("G51",7L).id()).isEqualTo(51L);
        when(groups.findByIdAndBagOrderBranchId(51L,7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.scanGroup("G51",7L))
            .isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SORTING_BAG_NOT_FOUND));
    }

    @Test void staleVersionRejects() { fails(ErrorCode.SORTING_VERSION_CONFLICT,request(9,draft(41L,"5.2",false))); }
    @Test void voidedBagRejects() {
        when(bag.getStatus()).thenReturn(OrderBagStatus.VOIDED);
        fails(ErrorCode.SORTING_BAG_NOT_ELIGIBLE,request(0,draft(41L,"5.2",false)));
    }
    @Test void legacyBagRejects() {
        when(bag.getStatus()).thenReturn(OrderBagStatus.LEGACY_UNVERIFIED);
        fails(ErrorCode.SORTING_BAG_NOT_ELIGIBLE,request(0,draft(41L,"5.2",false)));
    }
    @Test void nonReceivedOrderRejects() {
        when(order.getStatus()).thenReturn(OrderStatus.PROCESSING);
        fails(ErrorCode.SORTING_BAG_NOT_ELIGIBLE,request(0,draft(41L,"5.2",false)));
    }
    @Test void foreignOrderItemRejects() { fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(999L,"5.2",false))); }
    @Test void zeroQuantityRejects() { fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(41L,"0",false))); }
    @Test void overAllocationRejects() { fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(41L,"5.201",false))); }
    @Test void finalBagUnderAllocationRejects() { fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(41L,"5.199",false))); }
    @Test void privateLoadCannotBeWeakened() {
        when(item.getSharingModeSnapshot()).thenReturn(SharingMode.PRIVATE_LOAD);
        fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(41L,"5.2",false)));
    }
    @Test void itemTypeRestrictionCannotBeWeakened() {
        when(itemType.isRequiresSeparateWash()).thenReturn(true);
        fails(ErrorCode.SORTING_ALLOCATION_INVALID,request(0,draft(41L,"5.2",false)));
    }
    @Test void historicalOrderItemWithoutItemTypeCanStillBeSorted() {
        when(item.getItemType()).thenReturn(null);
        service.confirm(31L,7L,request(0,draft(41L,"5.2",false)));
        verify(bag).markSorted(actor,now);
    }
    @Test void partialSortAcrossTwoReceivedBagsIsAllowed() {
        when(bags.countByOrderIdAndStatus(11L,OrderBagStatus.RECEIVED)).thenReturn(2L);
        when(bags.countByOrderIdAndStatusIn(eq(11L),anyList())).thenReturn(2L);
        when(groups.findFirstByBagIdOrderBySequenceNumberDesc(31L)).thenReturn(Optional.empty());
        SortingDtos.BagContext result = service.confirm(31L,7L,request(0,draft(41L,"3.0",false)));
        assertThat(result.bagId()).isEqualTo(31L);
        @SuppressWarnings("unchecked") ArgumentCaptor<List<ProcessingGroup>> captor = ArgumentCaptor.forClass(List.class);
        verify(groups).saveAllAndFlush(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue().get(0).getGroupCode()).isEqualTo("GS-DH-000011-01-G01");
        assertThat(captor.getValue().get(0).getQuantity()).isEqualByComparingTo("3.0");
        verify(bag).markSorted(eq(actor),eq(now));
        verify(history).save(any(OrderStatusHistory.class));
        verify(order,never()).transition(any(),any(),any());
    }
    @Test void twoDraftsCanExactlyReconcileTheFinalBag() {
        service.confirm(31L,7L,request(0,draft(41L,"3.0",false),draft(41L,"2.2",false)));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<ProcessingGroup>> captor = ArgumentCaptor.forClass(List.class);
        verify(groups).saveAllAndFlush(captor.capture());
        assertThat(captor.getValue()).extracting(ProcessingGroup::getGroupCode)
            .containsExactly("GS-DH-000011-01-G01","GS-DH-000011-01-G02");
    }
    @Test void reopenedCodesAreNotReused() {
        ProcessingGroup old = mock(ProcessingGroup.class);
        when(old.getSequenceNumber()).thenReturn(2);
        when(groups.findFirstByBagIdOrderBySequenceNumberDesc(31L)).thenReturn(Optional.of(old));
        service.confirm(31L,7L,request(0,draft(41L,"5.2",false)));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<ProcessingGroup>> captor = ArgumentCaptor.forClass(List.class);
        verify(groups).saveAllAndFlush(captor.capture());
        assertThat(captor.getValue().get(0).getGroupCode()).endsWith("-G03");
    }
    @Test void waitingQueueIsBranchScopedAndPaginated() {
        when(groups.searchWaiting(anyLong(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any()))
            .thenReturn(Page.empty());
        service.waiting(7L,null,null,null,null,null,null,null,null,0,20);
        verify(groups).searchWaiting(eq(7L),eq(GroupStatus.WAITING),isNull(),isNull(),isNull(),
            isNull(),isNull(),isNull(),isNull(),isNull(),any());
    }

    @Test void reopenVoidsWaitingGroupsAndPreservesHistory() {
        when(bag.getStatus()).thenReturn(OrderBagStatus.SORTED);
        ProcessingGroup group = mock(ProcessingGroup.class);
        when(group.getStatus()).thenReturn(GroupStatus.WAITING);
        when(group.getGroupCode()).thenReturn("GS-DH-000011-01-G01");
        when(group.getBag()).thenReturn(bag);
        when(group.getItem()).thenReturn(item);
        when(groups.findByBagIdOrderBySequenceNumberAsc(31L)).thenReturn(List.of(group));
        service.reopen(31L,7L,new SortingDtos.ReopenRequest(0L,"  Sai màu  "));
        verify(group).voidGroup(actor,now,"Sai màu");
        verify(bag).reopenSorting(actor);
        verify(history).save(any(OrderStatusHistory.class));
    }

    @Test void reopenRequiresReasonAndSortedBag() {
        assertThatThrownBy(() -> service.reopen(31L,7L,new SortingDtos.ReopenRequest(0L,"Lý do")))
            .isInstanceOf(ApiException.class);
        when(bag.getStatus()).thenReturn(OrderBagStatus.SORTED);
        assertThatThrownBy(() -> service.reopen(31L,7L,new SortingDtos.ReopenRequest(0L,"  ")))
            .isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SORTING_ALLOCATION_INVALID));
        verify(groups,never()).flush();
    }

    @Test void reopenRequiresCurrentBagVersion() {
        when(bag.getStatus()).thenReturn(OrderBagStatus.SORTED);
        assertThatThrownBy(() -> service.reopen(31L,7L,new SortingDtos.ReopenRequest(7L,"Sai màu")))
            .isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SORTING_VERSION_CONFLICT));
        verify(groups,never()).flush();
    }

    @Test void voidedGroupCannotRequestPrint() {
        ProcessingGroup group = mock(ProcessingGroup.class);
        when(group.getBag()).thenReturn(bag);
        when(group.getStatus()).thenReturn(GroupStatus.VOIDED);
        when(groups.findByIdAndBagOrderBranchId(51L,7L)).thenReturn(Optional.of(group));
        assertThatThrownBy(() -> service.requestPrint(51L,7L))
            .isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SORTING_GROUP_NOT_PRINTABLE));
        verify(group,never()).recordPrintRequest(any(),any());
    }

    @Test void printRequestIsAuditedWithoutChangingGroupStatus() {
        ProcessingGroup group = mock(ProcessingGroup.class);
        when(group.getBag()).thenReturn(bag);
        when(group.getItem()).thenReturn(item);
        when(group.getStatus()).thenReturn(GroupStatus.WAITING);
        when(group.getGroupCode()).thenReturn("GS-DH-000011-01-G01");
        when(group.getPrintRequestCount()).thenReturn(1);
        when(groups.findByIdAndBagOrderBranchId(51L,7L)).thenReturn(Optional.of(group));
        service.requestPrint(51L,7L);
        verify(group).recordPrintRequest(actor,now);
        verify(history).save(any(OrderStatusHistory.class));
        verify(group,never()).voidGroup(any(),any(),any());
    }
}
