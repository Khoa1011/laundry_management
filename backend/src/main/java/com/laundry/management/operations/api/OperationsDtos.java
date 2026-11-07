package com.laundry.management.operations.api;

import jakarta.validation.constraints.*;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class OperationsDtos {
    private OperationsDtos() {}
    public record PageResponse<T>(List<T> items, int page, int size, long totalElements, int totalPages) {}
    public record WarehouseRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note) {}
    public record WarehouseResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt) {}
    public record InventoryCategoryRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note) {}
    public record InventoryCategoryResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt) {}
    public record InventoryUnitRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @NotBlank @Pattern(regexp="COUNT|MASS|VOLUME") String dimension) {}
    public record InventoryUnitResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, String dimension) {}
    public record SupplierRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @Size(max=30) String phone, @Email @Size(max=150) String email, @Size(max=500) String address, @Size(max=50) String taxNumber, @Size(max=150) String contactName, @Size(max=500) String materialGroups) {}
    public record SupplierResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, String phone, String email, String address, String taxNumber, String contactName, String materialGroups) {}
    public record InventoryItemRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @NotNull @Positive Long categoryId, @NotNull @Positive Long baseUnitId, @Positive Long supplierId, @Size(max=1000) String description, @DecimalMin("0") @Digits(integer=17, fraction=2) BigDecimal referencePrice, @NotNull @DecimalMin("0") @Digits(integer=13, fraction=6) BigDecimal minimumStock, @DecimalMin("0") @Digits(integer=13, fraction=6) BigDecimal maximumStock, boolean trackLots, boolean trackExpiry) {}
    public record InventoryItemResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, Long categoryId, Long baseUnitId, Long supplierId, String description, @JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal referencePrice, @JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal minimumStock, @JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal maximumStock, boolean trackLots, boolean trackExpiry) {}
    public record InventoryConversionRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @NotNull @Positive Long itemId, @NotNull @Positive Long inputUnitId, @NotNull @DecimalMin(value="0", inclusive=false) @Digits(integer=13, fraction=6) BigDecimal factor) {}
    public record InventoryConversionResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, Long itemId, Long inputUnitId, @JsonFormat(shape=JsonFormat.Shape.STRING) BigDecimal factor) {}
    public record CashAccountRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @NotBlank @Pattern(regexp="CASH|BANK|EWALLET|OTHER") String accountType) {}
    public record CashAccountResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, String accountType) {}
    public record TransactionCategoryRequest(@NotNull @Positive Long branchId, @Min(0) Long version, @NotBlank @Size(max=150) String name, @NotNull Boolean active, @Size(max=1000) String note, @NotBlank @Pattern(regexp="INCOME|EXPENSE") String direction) {}
    public record TransactionCategoryResponse(Long id, Long branchId, String code, String name, boolean active, String note, long version, Instant createdAt, Instant updatedAt, String direction) {}
}
