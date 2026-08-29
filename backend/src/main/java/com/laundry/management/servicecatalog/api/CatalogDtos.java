package com.laundry.management.servicecatalog.api;

import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRuleStatus;
import com.laundry.management.servicecatalog.domain.PricingExplanationCode;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.PricingComponentType;
import com.laundry.management.servicecatalog.domain.ProcessingType;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.TierCalculationMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record ServiceRequest(
        @NotBlank @Size(max = 150) String nameVi,
        @Size(max = 150) String nameEn,
        @Size(max = 1000) String descriptionVi,
        @Size(max = 1000) String descriptionEn,
        @NotNull ProcessingType processingType,
        @NotNull UnitType defaultUnitType,
        boolean sharingAllowed,
        @Min(1) @Max(10080) Integer estimatedMinutes,
        @DecimalMin("0.000") BigDecimal minimumQuantity,
        Long version
    ) {
    }

    public record CatalogStatusRequest(@NotNull CatalogStatus status, @NotNull Long version) {
    }

    public record ServiceResponse(
        Long id,
        String code,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        ProcessingType processingType,
        UnitType defaultUnitType,
        boolean sharingAllowed,
        Integer estimatedMinutes,
        BigDecimal minimumQuantity,
        CatalogStatus status,
        Instant createdAt,
        Instant updatedAt,
        ActorResponse updatedBy,
        long version,
        long eligibleItemTypeCount,
        long relatedPriceRuleCount
    ) {
    }

    public record ServiceListResponse(
        List<ServiceResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }

    public record ItemTypeRequest(
        Long parentId,
        @NotBlank @Size(max = 150) String nameVi,
        @Size(max = 150) String nameEn,
        @Size(max = 1000) String descriptionVi,
        @Size(max = 1000) String descriptionEn,
        UnitType defaultUnitType,
        boolean requiresSeparateWash,
        @Size(max = 30) String defaultColorRisk,
        @Size(max = 30) String defaultHygieneLevel,
        @Min(0) int sortOrder,
        Long version
    ) {
    }

    public record ItemTypeResponse(
        Long id,
        String code,
        Long parentId,
        String nameVi,
        String nameEn,
        String descriptionVi,
        String descriptionEn,
        UnitType defaultUnitType,
        UnitType effectiveUnitType,
        boolean inheritedUnit,
        boolean requiresSeparateWash,
        String defaultColorRisk,
        String defaultHygieneLevel,
        int sortOrder,
        CatalogStatus status,
        Instant createdAt,
        Instant updatedAt,
        ActorResponse updatedBy,
        long version,
        long applicableServiceCount,
        long relatedPriceRuleCount,
        List<ItemTypeResponse> children
    ) {
    }

    public record EligibilityUpdateRequest(
        @NotNull Long serviceVersion,
        @NotNull @Size(max = 500) List<@NotNull Long> itemTypeIds
    ) {
    }

    public record ServiceEligibilityResponse(
        Long serviceId,
        long serviceVersion,
        List<ItemTypeOptionResponse> eligibleItemTypes
    ) {
    }

    public record PriceListRequest(
        @NotBlank @Size(max = 180) String name,
        @Size(max = 1000) String description,
        @NotNull Long branchId,
        @Size(min = 3, max = 3) String currency,
        @NotNull Instant effectiveFrom,
        Instant effectiveTo,
        Long version
    ) {
    }

    public record PriceListLifecycleRequest(
        @NotNull Long version,
        @Size(max = 500) String reason
    ) {
    }

    public record DuplicatePriceListRequest(
        @NotBlank @Size(max = 180) String name,
        @NotNull Instant effectiveFrom,
        Instant effectiveTo
    ) {
    }

    public record PriceListResponse(
        Long id,
        String code,
        String name,
        String description,
        BranchResponse branch,
        String currency,
        PriceListStatus status,
        @NotNull Instant effectiveFrom,
        Instant effectiveTo,
        long ruleCount,
        Instant createdAt,
        Instant updatedAt,
        ActorResponse updatedBy,
        Instant publishedAt,
        ActorResponse publishedBy,
        Instant archivedAt,
        long version
    ) {
    }

    public record PriceListPageResponse(
        List<PriceListResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }

    public record TierRequest(
        @NotNull @DecimalMin("0.000") BigDecimal fromQuantity,
        @DecimalMin("0.001") BigDecimal toQuantity,
        @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
        @Min(0) int sortOrder
    ) {
    }

    public record PackagePriceRequest(
        @NotNull @DecimalMin("1.000") BigDecimal quantity,
        @NotNull @DecimalMin("0.00") BigDecimal totalPrice,
        @Min(0) int sortOrder
    ) {
    }

    public record PriceRuleRequest(
        @NotNull Long serviceId,
        Long itemTypeId,
        @NotNull PricingMethod pricingMethod,
        @NotNull UnitType unitType,
        @NotNull SharingMode sharingMode,
        @Min(0) Integer priorityLevel,
        @DecimalMin("0.00") BigDecimal basePrice,
        @DecimalMin("0.00") BigDecimal unitPrice,
        @DecimalMin("0.000") BigDecimal minimumQuantity,
        @DecimalMin("0.001") BigDecimal maximumQuantity,
        @DecimalMin("0.00") BigDecimal minimumCharge,
        @DecimalMin("0.000") BigDecimal includedQuantity,
        @DecimalMin("0.00") BigDecimal excessUnitPrice,
        TierCalculationMode tierCalculationMode,
        int rulePriority,
        @NotNull Instant effectiveFrom,
        Instant effectiveTo,
        @Valid List<TierRequest> tiers,
        @Valid List<PackagePriceRequest> packagePrices,
        Long rowVersion
    ) {
    }

    public record TierResponse(
        Long id,
        BigDecimal fromQuantity,
        BigDecimal toQuantity,
        BigDecimal unitPrice,
        int sortOrder
    ) {
    }

    public record PackagePriceResponse(
        Long id,
        BigDecimal quantity,
        BigDecimal totalPrice,
        int sortOrder
    ) {
    }

    public record PriceRuleResponse(
        Long id,
        Long priceListId,
        ServiceOptionResponse service,
        ItemTypeOptionResponse itemType,
        PricingMethod pricingMethod,
        UnitType unitType,
        SharingMode sharingMode,
        Integer priorityLevel,
        BigDecimal basePrice,
        BigDecimal unitPrice,
        BigDecimal minimumQuantity,
        BigDecimal maximumQuantity,
        BigDecimal minimumCharge,
        BigDecimal includedQuantity,
        BigDecimal excessUnitPrice,
        TierCalculationMode tierCalculationMode,
        int rulePriority,
        Instant effectiveFrom,
        Instant effectiveTo,
        PriceRuleStatus status,
        int versionNumber,
        Instant publishedAt,
        long rowVersion,
        List<TierResponse> tiers,
        List<PackagePriceResponse> packagePrices
    ) {
    }

    public record PriceListDetailResponse(
        PriceListResponse priceList,
        List<PriceRuleResponse> rules
    ) {
    }

    public record PricingPreviewRequest(
        @NotNull Long branchId,
        @NotNull Long serviceId,
        Long itemTypeId,
        PricingMethod pricingMethod,
        UnitType unitType,
        @NotNull SharingMode sharingMode,
        @Min(0) Integer priorityLevel,
        @NotNull @DecimalMin(value = "0.001") BigDecimal quantity,
        @NotNull Instant effectiveAt
    ) {
    }

    public record PricingPreviewResponse(
        String currency,
        Long priceListId,
        String priceListName,
        Long priceRuleId,
        int priceRuleVersion,
        Long serviceId,
        String serviceCode,
        String serviceName,
        Long itemTypeId,
        String itemTypeCode,
        String itemTypeName,
        PricingMethod pricingMethod,
        UnitType unitType,
        SharingMode sharingMode,
        BigDecimal actualQuantity,
        BigDecimal billableQuantity,
        BigDecimal unitPrice,
        BigDecimal baseAmount,
        BigDecimal surchargeAmount,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        Instant effectiveAt,
        PricingExplanationCode explanationCode,
        String explanation,
        List<PricingComponentResponse> pricingComponents,
        PricingSnapshot snapshot
    ) {
    }

    public record PricingSnapshot(
        Long priceListId,
        String priceListNameSnapshot,
        Long priceRuleId,
        int priceRuleVersion,
        Long serviceId,
        String serviceCodeSnapshot,
        String serviceNameSnapshot,
        Long itemTypeId,
        String itemTypeCodeSnapshot,
        String itemTypeNameSnapshot,
        PricingMethod pricingMethodSnapshot,
        UnitType unitTypeSnapshot,
        SharingMode sharingModeSnapshot,
        BigDecimal actualQuantity,
        BigDecimal billableQuantity,
        BigDecimal basePriceSnapshot,
        BigDecimal unitPriceSnapshot,
        BigDecimal minimumQuantitySnapshot,
        BigDecimal minimumChargeSnapshot,
        BigDecimal includedQuantitySnapshot,
        BigDecimal excessUnitPriceSnapshot,
        BigDecimal baseAmount,
        BigDecimal surchargeAmount,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        PricingExplanationCode pricingExplanationCode,
        String pricingExplanationSnapshot,
        List<PricingComponentResponse> pricingComponents,
        Instant quotedAt
    ) {
    }

    public record PricingComponentResponse(
        PricingComponentType type,
        String label,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal amount
    ) {
    }

    public record ServiceCoverageResponse(
        Long serviceId,
        String serviceCode,
        String serviceName,
        long eligibleItemTypeCount,
        long coveredItemTypeCount,
        long missingItemTypeCount
    ) {
    }

    public record PriceCoverageResponse(
        Long priceListId,
        long eligibleCombinationCount,
        long coveredCombinationCount,
        long missingCombinationCount,
        List<ServiceCoverageResponse> services
    ) {
    }

    public record CatalogSummaryResponse(
        long activeServiceCount,
        long activeItemTypeCount,
        long eligibleCombinationCount,
        long coveredCombinationCount,
        long configurationIssueCount,
        Long effectivePriceListId
    ) {
    }

    public record AuditResponse(
        Long id,
        String entityType,
        Long entityId,
        String action,
        Map<String, Object> oldValue,
        Map<String, Object> newValue,
        String reason,
        BranchResponse branch,
        ActorResponse actor,
        Instant createdAt
    ) {
    }

    public record AuditPageResponse(
        List<AuditResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
    ) {
    }

    public record BranchResponse(Long id, String code, String name) {
    }

    public record ActorResponse(Long id, String name) {
    }

    public record ServiceOptionResponse(Long id, String code, String nameVi, String nameEn) {
    }

    public record ItemTypeOptionResponse(Long id, String code, String nameVi, String nameEn) {
    }
}
