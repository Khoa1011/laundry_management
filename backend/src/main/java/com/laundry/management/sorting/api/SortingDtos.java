package com.laundry.management.sorting.api;

import com.laundry.management.order.domain.OrderBagStatus;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class SortingDtos {
    private SortingDtos() {}
    public record Item(Long id, String serviceCode, String serviceName, String itemTypeCode,
        String itemTypeName, Long serviceId, Long itemTypeId, UnitType unitType,
        SharingMode sharingMode, boolean requiresSeparateWash, BigDecimal quantity,
        BigDecimal alreadyAllocatedQuantity, BigDecimal remainingQuantity) {}
    public record Group(Long id, String groupCode, String barcode, Long orderItemId, Long orderBagId,
        String orderCode, String bagCode, String customerName, String serviceName, String itemTypeName,
        Long serviceId, Long itemTypeId, UnitType unitType, BigDecimal quantity,
        ColorGroup colorGroup, FabricCare fabricCare, WashMode washMode,
        TemperatureProfile temperatureProfile, DetergentProfile detergentProfile,
        SoftenerProfile softenerProfile, HygieneLevel hygieneLevel, boolean separateWash, boolean shareable,
        DryingInstruction dryingInstruction, String note, GroupStatus status, Instant createdAt,
        Instant promisedAt, Instant lastPrintRequestedAt, int printRequestCount,
        Instant voidedAt, String voidReason, long version) {}
    public record BagContext(Long bagId, String bagCode, int bagSequence, int activeBagCount, boolean lastUnsortedBag,
        OrderBagStatus bagStatus, long bagVersion, Instant bagCreatedAt, String bagVoidReason,
        Long orderId, String orderCode, OrderStatus orderStatus, String customerName, Instant promisedAt,
        List<Item> items, List<Group> groups) {}
    public record Draft(@NotNull Long orderItemId, @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @NotNull ColorGroup colorGroup, @NotNull FabricCare fabricCare, @NotNull WashMode washMode,
        @NotNull TemperatureProfile temperatureProfile, @NotNull DetergentProfile detergentProfile,
        @NotNull SoftenerProfile softenerProfile, @NotNull HygieneLevel hygieneLevel,
        @NotNull Boolean separateWash, @NotNull DryingInstruction dryingInstruction,
        @Size(max = 1000) String note) {}
    public record ConfirmRequest(@NotNull Long bagVersion, @NotEmpty @Size(max = 100) List<@Valid Draft> groups) {}
    public record ReopenRequest(@NotNull Long bagVersion, @NotBlank @Size(max = 500) String reason) {}
    public record PageResponse(List<Group> items, int page, int size, long totalElements, int totalPages) {}
    public record Stats(long total, long shareable, long separate) {}
    public record FilterOption(Long id, String label) {}
    public record FilterOptions(List<FilterOption> services, List<FilterOption> itemTypes) {}
}
