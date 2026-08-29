package com.laundry.management.servicecatalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.common.exception.ApiException;
import com.laundry.management.servicecatalog.application.PricingCalculator;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import com.laundry.management.servicecatalog.seed.DemoCatalogSeedProperties;
import com.laundry.management.servicecatalog.seed.DemoCatalogSeedService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DemoCatalogSeedIntegrationTest {

    @Autowired DemoCatalogSeedService seedService;
    @Autowired BranchRepository branchRepository;
    @Autowired UserAccountRepository userRepository;
    @Autowired ItemTypeRepository itemRepository;
    @Autowired LaundryServiceRepository serviceRepository;
    @Autowired ServiceItemEligibilityRepository eligibilityRepository;
    @Autowired PriceListRepository priceListRepository;
    @Autowired PriceRuleRepository ruleRepository;

    @Test
    void seedsRealisticCatalogPricingAndRemainsIdempotent() {
        Branch branch = branchRepository.saveAndFlush(new Branch("DEMO-SEED", "Chi nhánh demo seed"));
        UserAccount actor = new UserAccount("demo-seed-owner", "not-used", "Demo Seed Owner", branch);
        actor.assignBranch(branch, true);
        userRepository.saveAndFlush(actor);
        DemoCatalogSeedProperties properties = new DemoCatalogSeedProperties(
            true, actor.getUsername(), branch.getCode()
        );

        seedService.initialize(properties);

        List<ItemType> seededItems = itemRepository.findAllByOrderBySortOrderAscNameViAscIdAsc().stream()
            .filter(item -> DEMO_ITEM_NAMES.contains(item.getNameVi()))
            .toList();
        assertThat(seededItems).hasSize(29);
        assertThat(serviceRepository.findAll().stream().filter(service ->
            DEMO_SERVICE_NAMES.contains(service.getNameVi()))).hasSize(6);
        assertThat(itemRepository.findByNameViIgnoreCase("Áo sơ mi").orElseThrow().getParent().getNameVi())
            .isEqualTo("Quần áo");
        assertThat(itemRepository.findByNameViIgnoreCase("Quần áo giặt theo kg").orElseThrow().getParent())
            .isNull();

        var shoeService = serviceRepository.findByNameViIgnoreCase("Vệ sinh giày").orElseThrow();
        Set<String> shoeEligibility = eligibilityRepository
            .findByServiceIdOrderByItemTypeNameViAscItemTypeIdAsc(shoeService.getId()).stream()
            .map(value -> value.getItemType().getNameVi()).collect(Collectors.toSet());
        assertThat(shoeEligibility).containsExactlyInAnyOrder(
            "Giày thể thao", "Giày da", "Giày vải", "Boot / Ủng", "Dép / Sandal"
        );
        assertThat(eligibilityRepository.findAllByOrderByServiceIdAscItemTypeIdAsc())
            .allMatch(value -> value.getItemType().getParent() != null
                || value.getItemType().getNameVi().equals("Quần áo giặt theo kg"));

        PriceList priceList = priceListRepository
            .findByNameIgnoreCaseAndBranchId("Giá bán tiêu chuẩn", branch.getId()).orElseThrow();
        assertThat(priceList.getStatus()).isEqualTo(PriceListStatus.DRAFT);
        List<PriceRule> rules = ruleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(priceList.getId());
        assertThat(rules).hasSize(8);
        assertHybrid(rules);
        assertQuantityPackage(rules);
        assertThat(eligibilityRepository.count() - rules.size()).isGreaterThanOrEqualTo(3);

        long itemCount = itemRepository.count();
        long serviceCount = serviceRepository.count();
        long eligibilityCount = eligibilityRepository.count();
        long priceListCount = priceListRepository.count();
        long ruleCount = ruleRepository.count();
        seedService.initialize(properties);
        assertThat(itemRepository.count()).isEqualTo(itemCount);
        assertThat(serviceRepository.count()).isEqualTo(serviceCount);
        assertThat(eligibilityRepository.count()).isEqualTo(eligibilityCount);
        assertThat(priceListRepository.count()).isEqualTo(priceListCount);
        assertThat(ruleRepository.count()).isEqualTo(ruleCount);
    }

    private void assertHybrid(List<PriceRule> rules) {
        PriceRule hybrid = rules.stream().filter(rule -> rule.getPricingMethod() == PricingMethod.HYBRID)
            .findFirst().orElseThrow();
        PricingCalculator calculator = new PricingCalculator();
        PricingCalculator.RuleTerms terms = terms(hybrid);
        assertThat(calculator.calculate(terms, bd("1")).finalAmount()).isEqualByComparingTo("25000");
        assertThat(calculator.calculate(terms, bd("3")).finalAmount()).isEqualByComparingTo("25000");
        assertThat(calculator.calculate(terms, bd("4")).finalAmount()).isEqualByComparingTo("35000");
        assertThat(calculator.calculate(terms, bd("5")).finalAmount()).isEqualByComparingTo("45000");
    }

    private void assertQuantityPackage(List<PriceRule> rules) {
        PriceRule packages = rules.stream()
            .filter(rule -> rule.getPricingMethod() == PricingMethod.QUANTITY_PACKAGE)
            .findFirst().orElseThrow();
        PricingCalculator calculator = new PricingCalculator();
        PricingCalculator.RuleTerms terms = terms(packages);
        assertThat(calculator.calculate(terms, bd("1")).finalAmount()).isEqualByComparingTo("80000");
        assertThat(calculator.calculate(terms, bd("2")).finalAmount()).isEqualByComparingTo("150000");
        assertThat(calculator.calculate(terms, bd("3")).finalAmount()).isEqualByComparingTo("210000");
        assertThatThrownBy(() -> calculator.calculate(terms, bd("4"))).isInstanceOf(ApiException.class)
            .hasMessageContaining("Chưa có giá bán");
    }

    private PricingCalculator.RuleTerms terms(PriceRule rule) {
        return new PricingCalculator.RuleTerms(
            rule.getPricingMethod(), rule.getUnitType(), rule.getBasePrice(), rule.getUnitPrice(),
            rule.getMinimumQuantity(), rule.getMaximumQuantity(), rule.getMinimumCharge(),
            rule.getIncludedQuantity(), rule.getExcessUnitPrice(), rule.getTierCalculationMode(),
            rule.getTiers().stream().map(tier -> new PricingCalculator.TierTerm(
                tier.getFromQuantity(), tier.getToQuantity(), tier.getUnitPrice())).toList(),
            rule.getPackagePrices().stream().map(item -> new PricingCalculator.PackagePriceTerm(
                item.getQuantity(), item.getTotalPrice())).toList()
        );
    }

    private BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    private static final Set<String> DEMO_SERVICE_NAMES = Set.of(
        "Giặt sấy thường", "Giặt sấy cao cấp", "Giặt chăn mền",
        "Vệ sinh giày", "Giặt thú bông", "Ủi đồ"
    );

    private static final Set<String> DEMO_ITEM_NAMES = Set.of(
        "Quần áo", "Áo sơ mi", "Áo thun", "Quần dài", "Quần short", "Váy / Đầm",
        "Đồ trẻ em", "Đồ mặc nhà", "Chăn ga", "Chăn mỏng", "Chăn dày", "Mền",
        "Ga giường", "Vỏ gối", "Topper / Tấm trải", "Giày dép", "Giày thể thao",
        "Giày da", "Giày vải", "Boot / Ủng", "Dép / Sandal", "Đồ đặc biệt",
        "Gấu bông nhỏ", "Gấu bông lớn", "Rèm cửa", "Thảm nhỏ", "Túi vải",
        "Quần áo giặt theo kg", "Đồ cần xử lý vết bẩn"
    );
}
