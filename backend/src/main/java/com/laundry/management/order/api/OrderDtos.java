package com.laundry.management.order.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.laundry.management.order.domain.*;
import com.laundry.management.servicecatalog.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OrderDtos {
    private OrderDtos() {}

    public record ItemRequest(
        @NotNull Long serviceId, Long itemTypeId, @NotNull SharingMode sharingMode,
        @Min(0) Integer priorityLevel, @NotNull @DecimalMin("0.001") BigDecimal quantity,
        @Size(max=1000) String note
    ) {}
    public record CreateRequest(
        @NotNull Long branchId, Long customerId, @Size(max=150) String guestName,
        @Size(max=30) String guestPhone, Instant promisedAt, @Size(max=2000) String note,
        @NotEmpty @Size(max=100) List<@Valid ItemRequest> items
    ) {}
    public record UpdateRequest(
        @NotNull Long version, Instant promisedAt, @Size(max=2000) String note,
        @Size(max=100) List<@Valid ItemRequest> items
    ) {}
    public record TransitionRequest(@NotNull Long version) {}
    public record ReasonedTransitionRequest(@NotNull Long version, @NotBlank @Size(max=500) String reason) {}
    public record ItemResponse(Long id, Long serviceId, Long itemTypeId, String serviceCode, String serviceName,
        String itemTypeCode, String itemTypeName, PricingMethod pricingMethod, UnitType unitType,
        SharingMode sharingMode, BigDecimal quantity, BigDecimal billableQuantity, BigDecimal lineAmount,
        String note, JsonNode pricingSnapshot, Instant quotedAt) {}
    public record ActorResponse(Long id, String displayName) {}
    public record Response(Long id, String orderCode, Long branchId, String branchCode, Long customerId,
        String customerName, String customerPhone, OrderStatus status, Instant promisedAt, String note,
        String currency, BigDecimal totalAmount, List<ItemResponse> items, Instant createdAt,
        ActorResponse createdBy, Instant updatedAt, ActorResponse updatedBy,
        Instant cancelledAt, ActorResponse cancelledBy, String cancelReason,
        Instant reopenedAt, ActorResponse reopenedBy, String reopenReason, long version) {}
    public record ListItemResponse(Long id, String orderCode, String customerName, String customerPhone,
        String serviceSummary, BigDecimal totalAmount, String currency, OrderStatus status,
        Instant promisedAt, Instant createdAt, long version) {}
    public record PageResponse(List<ListItemResponse> items, int page, int size, long totalElements, int totalPages) {}
    public record HistoryResponse(Long id, OrderHistoryAction action, OrderStatus fromStatus, OrderStatus toStatus,
        String reason, JsonNode changedFields, OrderStatusSource source, ActorResponse actor, Instant createdAt) {}
}
