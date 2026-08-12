package com.laundry.management.servicecatalog.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.TierCalculationMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PriceRuleValidator {

    public void validate(
        PriceList priceList,
        LaundryService service,
        ItemType itemType,
        CatalogDtos.PriceRuleRequest request,
        List<PriceRule> existingRules,
        Long excludedRuleId
    ) {
        if (service.getStatus() != CatalogStatus.ACTIVE) {
            throw invalid("Archived or inactive services cannot be used in new pricing rules.");
        }
        if (itemType != null && itemType.getStatus() != CatalogStatus.ACTIVE) {
            throw invalid("Archived or inactive item types cannot be used in new pricing rules.");
        }
        if (!service.isSharingAllowed()
            && (request.sharingMode() == SharingMode.SHARED_STANDARD
                || request.sharingMode() == SharingMode.SHARED_PRIORITY)) {
            throw new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorCode.PRICING_SHARING_NOT_ALLOWED,
                "Shared processing is unavailable",
                "The selected service does not allow shared processing."
            );
        }
        validateUnit(request.pricingMethod(), request.unitType());
        validateAmounts(request);
        validatePeriod(priceList, request.effectiveFrom(), request.effectiveTo());
        validateTiers(request);
        validateConflicts(request, existingRules, excludedRuleId);
    }

    private void validateUnit(PricingMethod method, UnitType unit) {
        boolean compatible = switch (method) {
            case BY_WEIGHT -> unit == UnitType.KG;
            case BY_ITEM -> unit == UnitType.ITEM;
            case BY_PAIR -> unit == UnitType.PAIR;
            case BY_SET -> unit == UnitType.SET;
            case FIXED -> unit == UnitType.FIXED;
            case PER_LOAD -> unit == UnitType.LOAD || unit == UnitType.KG;
            case HYBRID -> unit != UnitType.FIXED;
        };
        if (!compatible) {
            throw new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorCode.PRICING_UNIT_MISMATCH,
                "Pricing unit mismatch",
                "The selected unit is not compatible with the pricing method."
            );
        }
    }

    private void validateAmounts(CatalogDtos.PriceRuleRequest request) {
        if (request.minimumQuantity() != null && request.maximumQuantity() != null
            && request.maximumQuantity().compareTo(request.minimumQuantity()) < 0) {
            throw invalid("Maximum quantity must be greater than or equal to minimum quantity.");
        }
        switch (request.pricingMethod()) {
            case FIXED -> require(request.basePrice(), "Base price is required for fixed pricing.");
            case PER_LOAD -> {
                if (request.basePrice() == null && request.unitPrice() == null) {
                    throw invalid("Base price or unit price is required for per-load pricing.");
                }
                if (request.unitType() == UnitType.KG) {
                    requirePositive(request.includedQuantity(),
                        "Included quantity is required when per-load pricing receives kilograms.");
                }
            }
            case HYBRID -> {
                require(request.basePrice(), "Base price is required for hybrid pricing.");
                requirePositive(request.includedQuantity(), "Included quantity is required for hybrid pricing.");
                require(request.excessUnitPrice(), "Excess unit price is required for hybrid pricing.");
            }
            default -> {
                if ((request.tiers() == null || request.tiers().isEmpty()) && request.unitPrice() == null) {
                    throw invalid("Unit price is required when tiered pricing is not configured.");
                }
            }
        }
    }

    private void validatePeriod(PriceList list, Instant from, Instant to) {
        Instant resolvedFrom = from == null ? list.getEffectiveFrom() : from;
        Instant resolvedTo = to == null ? list.getEffectiveTo() : to;
        if (resolvedTo != null && !resolvedTo.isAfter(resolvedFrom)) {
            throw invalid("Rule effectiveTo must be later than effectiveFrom.");
        }
        if (resolvedFrom.isBefore(list.getEffectiveFrom())
            || (list.getEffectiveTo() != null
                && (resolvedTo == null || resolvedTo.isAfter(list.getEffectiveTo())))) {
            throw invalid("Rule effective period must stay within its price-list period.");
        }
    }

    private void validateTiers(CatalogDtos.PriceRuleRequest request) {
        List<CatalogDtos.TierRequest> tiers = request.tiers() == null ? List.of() : request.tiers().stream()
            .sorted(Comparator.comparing(CatalogDtos.TierRequest::sortOrder)
                .thenComparing(CatalogDtos.TierRequest::fromQuantity))
            .toList();
        if (tiers.isEmpty()) {
            if (request.tierCalculationMode() != null) {
                throw invalid("Tier calculation mode requires at least one tier.");
            }
            return;
        }
        if (request.tierCalculationMode() == null) {
            throw invalid("Select VOLUME or PROGRESSIVE for tiered pricing.");
        }
        if (request.pricingMethod() == PricingMethod.FIXED
            || request.pricingMethod() == PricingMethod.PER_LOAD
            || request.pricingMethod() == PricingMethod.HYBRID) {
            throw invalid("The selected pricing method does not support price tiers.");
        }
        if (tiers.get(0).fromQuantity().compareTo(BigDecimal.ZERO) != 0) {
            throw invalid("The first tier must start at zero.");
        }
        for (int index = 0; index < tiers.size(); index++) {
            CatalogDtos.TierRequest tier = tiers.get(index);
            if (tier.toQuantity() != null && tier.toQuantity().compareTo(tier.fromQuantity()) <= 0) {
                throw invalid("Each tier upper quantity must be greater than its lower quantity.");
            }
            if (index < tiers.size() - 1) {
                CatalogDtos.TierRequest next = tiers.get(index + 1);
                if (tier.toQuantity() == null || tier.toQuantity().compareTo(next.fromQuantity()) != 0) {
                    throw invalid("Price tiers must be continuous and non-overlapping.");
                }
            } else if (tier.toQuantity() != null) {
                throw invalid("The final tier must have no upper bound.");
            }
        }
    }

    private void validateConflicts(
        CatalogDtos.PriceRuleRequest request,
        List<PriceRule> existingRules,
        Long excludedRuleId
    ) {
        Instant from = request.effectiveFrom();
        Instant to = request.effectiveTo();
        for (PriceRule rule : existingRules) {
            if (Objects.equals(rule.getId(), excludedRuleId)) continue;
            boolean sameScope = rule.getService().getId().equals(request.serviceId())
                && Objects.equals(rule.getItemType() == null ? null : rule.getItemType().getId(), request.itemTypeId())
                && rule.getSharingMode() == request.sharingMode()
                && Objects.equals(rule.getPriorityLevel(), request.priorityLevel())
                && rule.getRulePriority() == request.rulePriority();
            if (sameScope && overlaps(
                from, to, rule.getEffectiveFrom(), rule.getEffectiveTo()
            )) {
                throw new ApiException(
                    HttpStatus.CONFLICT,
                    ErrorCode.PRICING_RULE_CONFLICT,
                    "Conflicting pricing rule",
                    "This rule overlaps rule " + rule.getId()
                        + " with the same scope, specificity, and priority."
                );
            }
        }
    }

    private boolean overlaps(Instant aFrom, Instant aTo, Instant bFrom, Instant bTo) {
        return (aTo == null || bFrom.isBefore(aTo))
            && (bTo == null || aFrom.isBefore(bTo));
    }

    private void require(BigDecimal value, String detail) {
        if (value == null || value.signum() < 0) throw invalid(detail);
    }

    private void requirePositive(BigDecimal value, String detail) {
        if (value == null || value.signum() <= 0) throw invalid(detail);
    }

    private ApiException invalid(String detail) {
        return new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ErrorCode.PRICING_VALIDATION_ERROR,
            "Invalid pricing rule",
            detail
        );
    }
}
