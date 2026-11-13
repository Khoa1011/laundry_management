package com.laundry.management.inventory.operations;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class StockDtos {
    private StockDtos() {}
    public enum Kind { RECEIPT, ISSUE, TRANSFER, STOCKTAKE, ADJUSTMENT }
    public record Line(@NotNull @Positive Long itemId, @Positive Long conversionId,
        @NotNull @DecimalMin("0") @Digits(integer=13,fraction=6) BigDecimal quantity,
        @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal unitPrice,
        @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal discount,
        @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal tax,
        @Size(max=80) String lotCode, LocalDate expiryDate, @Positive Long destinationItemId,
        @Min(-1) Long balanceVersion, @Min(0) @Max(1) Integer increase) {}
    public record Save(@NotNull @Positive Long branchId, @NotNull Kind kind, @Positive Long warehouseId,
        @Positive Long destinationBranchId, @Positive Long destinationWarehouseId, @Positive Long supplierId,
        @NotNull Instant businessAt, @Size(max=30) String issueType, @Size(max=1000) String note,
        @Size(max=1000) String reason, @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal charges,
        @NotNull Boolean draft, @Min(0) Long version, @NotEmpty @Size(max=100) List<@Valid Line> lines) {}
    public record Cancel(@NotNull @Positive Long branchId, @NotNull @Min(0) Long version,
        @NotBlank @Size(max=1000) String reason) {}
    public record SettlementLine(@Min(1) int lineNumber, @NotNull @DecimalMin(value="0",inclusive=false)
        @Digits(integer=13,fraction=6) BigDecimal quantity) {}
    public record Settlement(@NotNull @Positive Long branchId, @NotNull @Min(0) Long version,
        @NotBlank @Size(max=1000) String reason, @NotEmpty @Size(max=100) List<@Valid SettlementLine> lines) {}
    public record Filter(Long branchId, Long warehouseId, Long itemId, Long categoryId, Long supplierId,
        String search, Kind kind, String status, Instant from, Instant to, int page, int size, String sort) {}
}
