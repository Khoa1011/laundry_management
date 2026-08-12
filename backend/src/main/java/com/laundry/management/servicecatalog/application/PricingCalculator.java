package com.laundry.management.servicecatalog.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.domain.PricingExplanationCode;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.TierCalculationMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PricingCalculator {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    public Calculation calculate(RuleTerms rule, BigDecimal actualQuantity) {
        if (actualQuantity == null || actualQuantity.signum() <= 0) {
            throw invalid("Quantity must be greater than zero.");
        }
        if (rule.maximumQuantity() != null && actualQuantity.compareTo(rule.maximumQuantity()) > 0) {
            throw invalid("Quantity exceeds the maximum supported by the selected pricing rule.");
        }

        BigDecimal billableQuantity = max(actualQuantity, rule.minimumQuantity());
        BigDecimal unitPrice = rule.unitPrice();
        BigDecimal baseAmount;
        BigDecimal surcharge = ZERO;
        PricingExplanationCode explanation;

        switch (rule.pricingMethod()) {
            case FIXED -> {
                billableQuantity = BigDecimal.ONE;
                unitPrice = null;
                baseAmount = money(required(rule.basePrice(), "Base price is required for FIXED pricing."));
                explanation = PricingExplanationCode.FIXED_PRICE;
            }
            case PER_LOAD -> {
                BigDecimal loads = billableLoads(rule, actualQuantity);
                billableQuantity = loads;
                unitPrice = first(rule.unitPrice(), rule.basePrice());
                baseAmount = money(loads.multiply(required(unitPrice, "A load price is required.")));
                explanation = PricingExplanationCode.PER_LOAD_PRICE;
            }
            case HYBRID -> {
                BigDecimal included = required(rule.includedQuantity(), "Included quantity is required for HYBRID pricing.");
                baseAmount = money(required(rule.basePrice(), "Base price is required for HYBRID pricing."));
                BigDecimal excess = billableQuantity.subtract(included).max(BigDecimal.ZERO);
                if (excess.signum() > 0) {
                    surcharge = money(excess.multiply(required(
                        rule.excessUnitPrice(), "Excess unit price is required when quantity exceeds the included amount."
                    )));
                    explanation = PricingExplanationCode.HYBRID_EXCESS_QUANTITY;
                } else {
                    explanation = PricingExplanationCode.HYBRID_INCLUDED_QUANTITY;
                }
                unitPrice = rule.excessUnitPrice();
            }
            default -> {
                if (rule.tierMode() == TierCalculationMode.VOLUME) {
                    TierTerm tier = volumeTier(rule.tiers(), billableQuantity);
                    unitPrice = tier.unitPrice();
                    baseAmount = money(billableQuantity.multiply(unitPrice));
                    explanation = PricingExplanationCode.VOLUME_TIER_APPLIED;
                } else if (rule.tierMode() == TierCalculationMode.PROGRESSIVE) {
                    baseAmount = progressiveAmount(rule.tiers(), billableQuantity);
                    unitPrice = null;
                    explanation = PricingExplanationCode.PROGRESSIVE_TIERS_APPLIED;
                } else {
                    unitPrice = required(rule.unitPrice(), "Unit price is required for unit pricing.");
                    baseAmount = money(billableQuantity.multiply(unitPrice));
                    explanation = billableQuantity.compareTo(actualQuantity) > 0
                        ? PricingExplanationCode.MINIMUM_QUANTITY_APPLIED
                        : PricingExplanationCode.STANDARD_UNIT_PRICE;
                }
            }
        }

        BigDecimal finalAmount = money(baseAmount.add(surcharge));
        if (rule.minimumCharge() != null && finalAmount.compareTo(rule.minimumCharge()) < 0) {
            finalAmount = money(rule.minimumCharge());
            explanation = PricingExplanationCode.MINIMUM_CHARGE_APPLIED;
        }
        return new Calculation(
            quantity(actualQuantity), quantity(billableQuantity), moneyNullable(unitPrice),
            baseAmount, surcharge, ZERO, finalAmount, explanation
        );
    }

    private BigDecimal billableLoads(RuleTerms rule, BigDecimal actualQuantity) {
        if (rule.unitType() == UnitType.KG && rule.includedQuantity() != null
            && rule.includedQuantity().signum() > 0) {
            return actualQuantity.divide(rule.includedQuantity(), 0, RoundingMode.CEILING);
        }
        return actualQuantity.setScale(0, RoundingMode.CEILING);
    }

    private TierTerm volumeTier(List<TierTerm> tiers, BigDecimal quantity) {
        return tiers.stream()
            .filter(tier -> quantity.compareTo(tier.fromQuantity()) >= 0
                && (tier.toQuantity() == null || quantity.compareTo(tier.toQuantity()) < 0))
            .findFirst()
            .orElseThrow(() -> invalid("No volume tier covers the billable quantity."));
    }

    private BigDecimal progressiveAmount(List<TierTerm> tiers, BigDecimal quantity) {
        BigDecimal total = BigDecimal.ZERO;
        for (TierTerm tier : tiers) {
            if (quantity.compareTo(tier.fromQuantity()) <= 0) continue;
            BigDecimal upper = tier.toQuantity() == null
                ? quantity
                : quantity.min(tier.toQuantity());
            BigDecimal segment = upper.subtract(tier.fromQuantity());
            if (segment.signum() > 0) {
                total = total.add(segment.multiply(tier.unitPrice()));
            }
            if (tier.toQuantity() == null || quantity.compareTo(tier.toQuantity()) <= 0) break;
        }
        return money(total);
    }

    private BigDecimal required(BigDecimal value, String detail) {
        if (value == null || value.signum() < 0) throw invalid(detail);
        return value;
    }

    private BigDecimal first(BigDecimal first, BigDecimal second) {
        return first == null ? second : first;
    }

    private BigDecimal max(BigDecimal value, BigDecimal minimum) {
        return minimum != null && minimum.compareTo(value) > 0 ? minimum : value;
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal moneyNullable(BigDecimal value) {
        return value == null ? null : money(value);
    }

    private BigDecimal quantity(BigDecimal value) {
        return value.stripTrailingZeros().scale() < 0 ? value.setScale(0) : value.stripTrailingZeros();
    }

    private ApiException invalid(String detail) {
        return new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ErrorCode.PRICING_VALIDATION_ERROR,
            "Unable to calculate price",
            detail
        );
    }

    public record RuleTerms(
        PricingMethod pricingMethod,
        UnitType unitType,
        BigDecimal basePrice,
        BigDecimal unitPrice,
        BigDecimal minimumQuantity,
        BigDecimal maximumQuantity,
        BigDecimal minimumCharge,
        BigDecimal includedQuantity,
        BigDecimal excessUnitPrice,
        TierCalculationMode tierMode,
        List<TierTerm> tiers
    ) {
        public RuleTerms {
            tiers = tiers == null ? List.of() : List.copyOf(tiers);
        }
    }

    public record TierTerm(
        BigDecimal fromQuantity,
        BigDecimal toQuantity,
        BigDecimal unitPrice
    ) {
    }

    public record Calculation(
        BigDecimal actualQuantity,
        BigDecimal billableQuantity,
        BigDecimal unitPrice,
        BigDecimal baseAmount,
        BigDecimal surchargeAmount,
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        PricingExplanationCode explanationCode
    ) {
    }
}
