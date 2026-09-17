package com.laundry.management.washbatch.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.laundry.management.order.domain.OrderStatus;
import com.laundry.management.servicecatalog.domain.*;
import com.laundry.management.washbatch.domain.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class WashBatchDtos {
    private WashBatchDtos() {}
    public record CreateRequest(@NotNull Long branchId,@NotEmpty @Size(max=100) List<@NotNull Long> orderItemIds,
        @Size(max=2000) String note,boolean markReady) {}
    public record ItemsRequest(@NotNull Long version,@NotEmpty @Size(max=100) List<@NotNull Long> orderItemIds) {}
    public record NoteRequest(@NotNull Long version,@Size(max=2000) String note) {}
    public record VersionRequest(@NotNull Long version) {}
    public record CancelRequest(@NotNull Long version,@NotBlank @Size(max=500) String reason) {}
    public record Actor(Long id,String displayName) {}
    public record Branch(Long id,String code,String name) {}
    public record Service(Long id,String code,String name) {}
    public record Quantity(UnitType unitType,BigDecimal quantity) {}
    public record Candidate(Long orderItemId,Long orderId,String orderCode,OrderStatus orderStatus,String customerName,String customerPhone,
        Long serviceId,String serviceCode,String serviceName,Long itemTypeId,String itemTypeCode,String itemTypeName,
        SharingMode sharingMode,BigDecimal quantity,UnitType unitType,String itemNote,Instant promisedAt,Instant orderCreatedAt,List<String> warnings) {}
    public record CandidatePage(List<Candidate> items,int page,int size,long totalElements,int totalPages) {}
    public record BatchItem(Long batchItemId,Long orderItemId,boolean active,Long orderId,String orderCode,OrderStatus orderStatus,
        String customerName,String customerPhone,Long serviceId,String serviceCode,String serviceName,Long itemTypeId,String itemTypeCode,
        String itemTypeName,SharingMode sharingMode,BigDecimal quantity,UnitType unitType,String itemNote,Instant promisedAt,Instant orderCreatedAt,
        Instant addedAt,Actor addedBy,Instant removedAt,Actor removedBy) {}
    public record Summary(long orderCount,long itemCount,List<Quantity> quantities) {}
    public record Detail(Long id,String batchCode,Branch branch,Service service,WashBatchStatus status,String note,long version,
        Summary summary,List<BatchItem> items,List<String> warnings,Instant createdAt,Actor createdBy,Instant updatedAt,Actor updatedBy,
        Instant readyAt,Actor readyBy,Instant cancelledAt,Actor cancelledBy,String cancelReason) {}
    public record ListItem(Long id,String batchCode,String serviceName,WashBatchStatus status,long orderCount,long itemCount,
        List<Quantity> quantities,Instant createdAt,Actor createdBy,long version) {}
    public record PageResponse(List<ListItem> items,int page,int size,long totalElements,int totalPages) {}
    public record Stats(long candidateCount,long draftCount,long readyCount) {}
    public record History(Long id,WashBatchHistoryAction action,WashBatchStatus fromStatus,WashBatchStatus toStatus,
        String reason,JsonNode changedFields,Actor actor,Instant createdAt) {}
    public record Reference(Long id,String batchCode,WashBatchStatus status,String serviceName,boolean active,Instant createdAt) {}
}
