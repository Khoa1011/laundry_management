package com.laundry.management.servicecatalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.servicecatalog.application.PricingCalculator;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PriceRuleStatus;
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
        UserAccount actor = new UserAccount("demo-seed-admin", "not-used", "Demo Seed Admin", branch);
        actor.assignBranch(branch, true);
        userRepository.saveAndFlush(actor);
        DemoCatalogSeedProperties properties = new DemoCatalogSeedProperties(
            true, actor.getUsername(), branch.getCode(), true
        );

        seedService.initialize(properties);

        List<ItemType> seededItems = itemRepository.findAllByOrderBySortOrderAscNameViAscIdAsc().stream()
            .filter(item -> DEMO_ITEM_NAMES.contains(item.getNameVi()))
            .toList();
        assertThat(seededItems).hasSize(19);
        assertThat(serviceRepository.findAll().stream().filter(service ->
            DEMO_SERVICE_NAMES.contains(service.getNameVi()))).hasSize(5);
        assertThat(itemRepository.findByNameViIgnoreCase("Quần áo theo kg").orElseThrow().getParent().getNameVi())
            .isEqualTo("Quần áo");

        var shoeService = serviceRepository.findByNameViIgnoreCase("Vệ sinh giày").orElseThrow();
        Set<String> shoeEligibility = eligibilityRepository
            .findByServiceIdOrderByItemTypeNameViAscItemTypeIdAsc(shoeService.getId()).stream()
            .map(value -> value.getItemType().getNameVi()).collect(Collectors.toSet());
        assertThat(shoeEligibility).containsExactlyInAnyOrder(
            "Giày thường", "Giày cần xử lý kỹ"
        );
        assertThat(eligibilityRepository.findAllByOrderByServiceIdAscItemTypeIdAsc())
            .allMatch(value -> value.getItemType().getParent() != null);

        PriceList priceList = priceListRepository
            .findByNameIgnoreCaseAndBranchId("Bảng giá menu tiệm Dung", branch.getId()).orElseThrow();
        assertThat(priceList.getStatus()).isEqualTo(PriceListStatus.ACTIVE);
        List<PriceRule> rules = ruleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(priceList.getId());
        assertThat(rules).hasSize(16).allMatch(rule -> rule.getStatus() == PriceRuleStatus.ACTIVE);
        assertClothingBands(rules);
        assertMenuPrices(rules);
        assertThat(eligibilityRepository.count()).isEqualTo(14);

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

    private void assertClothingBands(List<PriceRule> rules) {
        List<PriceRule> clothing = rules.stream()
            .filter(rule -> rule.getItemType().getNameVi().equals("Quần áo theo kg"))
            .sorted(java.util.Comparator.comparingInt(PriceRule::getRulePriority).reversed())
            .toList();
        assertThat(clothing).hasSize(3);
        PricingCalculator calculator = new PricingCalculator();
        assertThat(calculator.calculate(terms(clothing.get(0)), bd("2.5")).finalAmount())
            .isEqualByComparingTo("30000");
        assertThat(calculator.calculate(terms(clothing.get(1)), bd("3.5")).finalAmount())
            .isEqualByComparingTo("40000");
        assertThat(calculator.calculate(terms(clothing.get(2)), bd("5")).finalAmount())
            .isEqualByComparingTo("50000");
    }

    private void assertMenuPrices(List<PriceRule> rules) {
        PricingCalculator calculator = new PricingCalculator();
        assertPrice(calculator, rules, "Mền nhỏ / mỏng", "1", "30000");
        assertPrice(calculator, rules, "Mền dày lớn", "1", "100000");
        assertPrice(calculator, rules, "Rèm cửa", "2", "50000");
        assertPrice(calculator, rules, "Gấu / gối nhỏ", "1", "25000");
        assertPrice(calculator, rules, "Giày cần xử lý kỹ", "1", "40000");
        assertPrice(calculator, rules, "Thêm nước xả", "1", "10000");
    }

    private void assertPrice(
        PricingCalculator calculator,
        List<PriceRule> rules,
        String itemName,
        String quantity,
        String expected
    ) {
        PriceRule rule = rules.stream().filter(value -> value.getItemType().getNameVi().equals(itemName))
            .findFirst().orElseThrow();
        assertThat(calculator.calculate(terms(rule), bd(quantity)).finalAmount())
            .isEqualByComparingTo(expected);
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
        "Giặt sấy quần áo", "Giặt mền / ga / rèm", "Giặt gấu / gối",
        "Vệ sinh giày", "Nhu cầu khác"
    );

    private static final Set<String> DEMO_ITEM_NAMES = Set.of(
        "Quần áo", "Quần áo theo kg", "Mền", "Mền nhỏ / mỏng", "Mền dày",
        "Mền dày lớn", "Mùng", "Ga giường", "Rèm cửa", "Vật dụng",
        "Gấu / gối nhỏ", "Gấu / gối lớn", "Giày dép", "Giày thường",
        "Giày cần xử lý kỹ", "Nhu cầu khác", "Thêm nước giặt", "Thêm nước xả", "Tẩy trắng"
    );
}
