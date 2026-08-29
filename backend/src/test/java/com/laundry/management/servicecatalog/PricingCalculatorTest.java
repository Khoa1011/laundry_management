package com.laundry.management.servicecatalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.servicecatalog.application.PricingCalculator;
import com.laundry.management.servicecatalog.domain.PricingExplanationCode;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.TierCalculationMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class PricingCalculatorTest {

    private final PricingCalculator calculator = new PricingCalculator();

    @Test
    void calculatesWeightItemPairAndSetWithMinimumQuantity() {
        for (var method : List.of(
            PricingMethod.BY_WEIGHT, PricingMethod.BY_ITEM, PricingMethod.BY_PAIR, PricingMethod.BY_SET
        )) {
            UnitType unit = switch (method) {
                case BY_WEIGHT -> UnitType.KG;
                case BY_ITEM -> UnitType.ITEM;
                case BY_PAIR -> UnitType.PAIR;
                case BY_SET -> UnitType.SET;
                default -> throw new IllegalStateException();
            };
            var result = calculator.calculate(
                terms(method, unit, null, bd("25000"), bd("3"), null, null, null, null, null, List.of()),
                bd("1.2")
            );
            assertThat(result.billableQuantity()).isEqualByComparingTo("3");
            assertThat(result.finalAmount()).isEqualByComparingTo("75000.00");
            assertThat(result.explanationCode()).isEqualTo(PricingExplanationCode.MINIMUM_QUANTITY_APPLIED);
        }
    }

    @Test
    void calculatesFixedPriceAndMinimumCharge() {
        var fixed = calculator.calculate(
            terms(PricingMethod.FIXED, UnitType.FIXED, bd("30000"), null, null, null, null, null, null, null, List.of()),
            BigDecimal.ONE
        );
        assertThat(fixed.finalAmount()).isEqualByComparingTo("30000.00");
        assertThat(fixed.explanationCode()).isEqualTo(PricingExplanationCode.FIXED_PRICE);

        var minimum = calculator.calculate(
            terms(PricingMethod.BY_WEIGHT, UnitType.KG, null, bd("10000"), null, null, bd("50000"), null, null, null, List.of()),
            bd("2")
        );
        assertThat(minimum.finalAmount()).isEqualByComparingTo("50000.00");
        assertThat(minimum.explanationCode()).isEqualTo(PricingExplanationCode.MINIMUM_CHARGE_APPLIED);
    }

    @Test
    void calculatesPerLoadFromKilogramsAndExplicitLoads() {
        var kilograms = calculator.calculate(
            terms(PricingMethod.PER_LOAD, UnitType.KG, null, bd("150000"), null, null, null, bd("8"), null, null, List.of()),
            bd("9")
        );
        assertThat(kilograms.billableQuantity()).isEqualByComparingTo("2");
        assertThat(kilograms.finalAmount()).isEqualByComparingTo("300000.00");

        var loads = calculator.calculate(
            terms(PricingMethod.PER_LOAD, UnitType.LOAD, null, bd("150000"), null, null, null, null, null, null, List.of()),
            bd("1.2")
        );
        assertThat(loads.billableQuantity()).isEqualByComparingTo("2");
    }

    @Test
    void calculatesHybridIncludedAndExcessQuantity() {
        var included = calculator.calculate(
            terms(PricingMethod.HYBRID, UnitType.KG, bd("100000"), null, null, null, null, bd("5"), bd("20000"), null, List.of()),
            bd("4")
        );
        assertThat(included.finalAmount()).isEqualByComparingTo("100000.00");
        assertThat(included.explanationCode()).isEqualTo(PricingExplanationCode.HYBRID_INCLUDED_QUANTITY);

        var excess = calculator.calculate(
            terms(PricingMethod.HYBRID, UnitType.KG, bd("100000"), null, null, null, null, bd("5"), bd("20000"), null, List.of()),
            bd("7")
        );
        assertThat(excess.surchargeAmount()).isEqualByComparingTo("40000.00");
        assertThat(excess.finalAmount()).isEqualByComparingTo("140000.00");
        assertThat(excess.explanationCode()).isEqualTo(PricingExplanationCode.HYBRID_EXCESS_QUANTITY);
    }

    @Test
    void explainsHybridAndMinimumChargeComponents() {
        var hybrid = calculator.calculate(
            terms(PricingMethod.HYBRID, UnitType.KG, bd("25000"), null, null, null, null,
                bd("3"), bd("10000"), null, List.of()), bd("4")
        );
        assertThat(hybrid.finalAmount()).isEqualByComparingTo("35000.00");
        assertThat(hybrid.components()).extracting(PricingCalculator.Component::type)
            .containsExactly(
                com.laundry.management.servicecatalog.domain.PricingComponentType.BASE,
                com.laundry.management.servicecatalog.domain.PricingComponentType.EXCESS
            );

        var minimum = calculator.calculate(
            terms(PricingMethod.BY_WEIGHT, UnitType.KG, null, bd("10000"), null, null,
                bd("30000"), null, null, null, List.of()), bd("2")
        );
        assertThat(minimum.finalAmount()).isEqualByComparingTo("30000.00");
        assertThat(minimum.components().get(1).amount()).isEqualByComparingTo("10000.00");
    }

    @Test
    void calculatesExactQuantityPackagesAndRejectsMissingQuantity() {
        var terms = new PricingCalculator.RuleTerms(
            PricingMethod.QUANTITY_PACKAGE, UnitType.PAIR, null, null, null, null, null,
            null, null, null, List.of(), List.of(
                new PricingCalculator.PackagePriceTerm(bd("1"), bd("80000")),
                new PricingCalculator.PackagePriceTerm(bd("2"), bd("150000")),
                new PricingCalculator.PackagePriceTerm(bd("3"), bd("210000"))
            )
        );
        assertThat(calculator.calculate(terms, bd("1")).finalAmount()).isEqualByComparingTo("80000.00");
        assertThat(calculator.calculate(terms, bd("2")).finalAmount()).isEqualByComparingTo("150000.00");
        assertThat(calculator.calculate(terms, bd("3")).finalAmount()).isEqualByComparingTo("210000.00");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> calculator.calculate(terms, bd("4")))
            .isInstanceOf(com.laundry.management.common.exception.ApiException.class);
    }

    @Test
    void calculatesVolumeAndProgressiveTiersAtBoundaries() {
        List<PricingCalculator.TierTerm> tiers = List.of(
            new PricingCalculator.TierTerm(bd("0"), bd("5"), bd("25000")),
            new PricingCalculator.TierTerm(bd("5"), bd("10"), bd("23000")),
            new PricingCalculator.TierTerm(bd("10"), null, bd("21000"))
        );
        var volume = calculator.calculate(
            terms(PricingMethod.BY_WEIGHT, UnitType.KG, null, null, null, null, null, null, null, TierCalculationMode.VOLUME, tiers),
            bd("12")
        );
        assertThat(volume.finalAmount()).isEqualByComparingTo("252000.00");
        assertThat(volume.explanationCode()).isEqualTo(PricingExplanationCode.VOLUME_TIER_APPLIED);

        var progressive = calculator.calculate(
            terms(PricingMethod.BY_WEIGHT, UnitType.KG, null, null, null, null, null, null, null, TierCalculationMode.PROGRESSIVE, tiers),
            bd("12")
        );
        assertThat(progressive.finalAmount()).isEqualByComparingTo("282000.00");
        assertThat(progressive.explanationCode()).isEqualTo(PricingExplanationCode.PROGRESSIVE_TIERS_APPLIED);
    }

    private PricingCalculator.RuleTerms terms(
        PricingMethod method,
        UnitType unit,
        BigDecimal basePrice,
        BigDecimal unitPrice,
        BigDecimal minimumQuantity,
        BigDecimal maximumQuantity,
        BigDecimal minimumCharge,
        BigDecimal includedQuantity,
        BigDecimal excessUnitPrice,
        TierCalculationMode tierMode,
        List<PricingCalculator.TierTerm> tiers
    ) {
        return new PricingCalculator.RuleTerms(
            method, unit, basePrice, unitPrice, minimumQuantity, maximumQuantity, minimumCharge,
            includedQuantity, excessUnitPrice, tierMode, tiers
        );
    }

    private BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
