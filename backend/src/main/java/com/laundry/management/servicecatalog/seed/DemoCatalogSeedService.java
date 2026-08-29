package com.laundry.management.servicecatalog.seed;

import com.laundry.management.auth.domain.AccountStatus;
import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.auth.infrastructure.BranchRepository;
import com.laundry.management.auth.infrastructure.UserAccountRepository;
import com.laundry.management.servicecatalog.application.CatalogCodeGenerator;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PricingMethod;
import com.laundry.management.servicecatalog.domain.ProcessingType;
import com.laundry.management.servicecatalog.domain.ServiceItemEligibility;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import com.laundry.management.servicecatalog.infrastructure.ServiceItemEligibilityRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DemoCatalogSeedService {

    private static final Logger log = LoggerFactory.getLogger(DemoCatalogSeedService.class);
    private static final String PRICE_LIST_NAME = "Giá bán tiêu chuẩn";

    private final Environment environment;
    private final UserAccountRepository userRepository;
    private final BranchRepository branchRepository;
    private final ItemTypeRepository itemRepository;
    private final LaundryServiceRepository serviceRepository;
    private final ServiceItemEligibilityRepository eligibilityRepository;
    private final PriceListRepository priceListRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final CatalogCodeGenerator codeGenerator;

    public DemoCatalogSeedService(
        Environment environment,
        UserAccountRepository userRepository,
        BranchRepository branchRepository,
        ItemTypeRepository itemRepository,
        LaundryServiceRepository serviceRepository,
        ServiceItemEligibilityRepository eligibilityRepository,
        PriceListRepository priceListRepository,
        PriceRuleRepository priceRuleRepository,
        CatalogCodeGenerator codeGenerator
    ) {
        this.environment = environment;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.itemRepository = itemRepository;
        this.serviceRepository = serviceRepository;
        this.eligibilityRepository = eligibilityRepository;
        this.priceListRepository = priceListRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.codeGenerator = codeGenerator;
    }

    @Transactional
    public void initialize(DemoCatalogSeedProperties properties) {
        refuseProductionProfile();
        UserAccount actor = requireActor(properties.actorUsername());
        Map<String, ItemType> items = seedItemTypes(actor);
        Map<String, LaundryService> services = seedServices(actor);
        seedEligibility(actor, services, items);

        branch(properties.branchCode()).ifPresentOrElse(
            branch -> seedPriceList(actor, branch, services, items),
            () -> log.warn("Demo catalog seed skipped pricing because branch '{}' does not exist.",
                properties.branchCode())
        );
        log.info("Demo catalog seed is ready: {} services and {} item types are available.",
            services.size(), items.size());
    }

    private void refuseProductionProfile() {
        boolean production = Arrays.stream(environment.getActiveProfiles())
            .map(String::toLowerCase)
            .anyMatch(profile -> profile.equals("prod") || profile.equals("production")
                || profile.startsWith("prod-") || profile.startsWith("production-"));
        if (production) {
            throw new IllegalStateException("Demo catalog seed must not run with a production profile");
        }
    }

    private UserAccount requireActor(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalStateException("APP_DEMO_SEED_ACTOR_USERNAME is required when demo seed is enabled");
        }
        UserAccount actor = userRepository.findByUsernameIgnoreCase(username.trim())
            .orElseThrow(() -> new IllegalStateException(
                "Demo seed actor does not exist. Enable bootstrap or provide an existing username."));
        if (actor.getStatus() != AccountStatus.ACTIVE || actor.isLocked()) {
            throw new IllegalStateException("Demo seed actor must be active and unlocked");
        }
        return actor;
    }

    private java.util.Optional<Branch> branch(String branchCode) {
        if (branchCode == null || branchCode.isBlank()) return java.util.Optional.empty();
        return branchRepository.findByCodeIgnoreCase(branchCode.trim())
            .filter(branch -> branch.getStatus() == AccountStatus.ACTIVE);
    }

    private Map<String, ItemType> seedItemTypes(UserAccount actor) {
        Map<String, ItemType> items = new LinkedHashMap<>();

        ItemType clothing = item(items, "Quần áo", null, UnitType.KG, false, 10, actor);
        item(items, "Áo sơ mi", clothing, null, false, 10, actor);
        item(items, "Áo thun", clothing, null, false, 20, actor);
        item(items, "Quần dài", clothing, null, false, 30, actor);
        item(items, "Quần short", clothing, null, false, 40, actor);
        item(items, "Váy / Đầm", clothing, null, false, 50, actor);
        item(items, "Đồ trẻ em", clothing, null, false, 60, actor);
        item(items, "Đồ mặc nhà", clothing, null, false, 70, actor);

        ItemType bedding = item(items, "Chăn ga", null, null, false, 20, actor);
        item(items, "Chăn mỏng", bedding, UnitType.ITEM, false, 10, actor);
        item(items, "Chăn dày", bedding, UnitType.ITEM, false, 20, actor);
        item(items, "Mền", bedding, UnitType.ITEM, false, 30, actor);
        item(items, "Ga giường", bedding, UnitType.SET, false, 40, actor);
        item(items, "Vỏ gối", bedding, UnitType.ITEM, false, 50, actor);
        item(items, "Topper / Tấm trải", bedding, UnitType.ITEM, false, 60, actor);

        ItemType shoes = item(items, "Giày dép", null, UnitType.PAIR, false, 30, actor);
        item(items, "Giày thể thao", shoes, null, false, 10, actor);
        item(items, "Giày da", shoes, null, false, 20, actor);
        item(items, "Giày vải", shoes, null, false, 30, actor);
        item(items, "Boot / Ủng", shoes, null, false, 40, actor);
        item(items, "Dép / Sandal", shoes, null, false, 50, actor);

        ItemType special = item(items, "Đồ đặc biệt", null, null, false, 40, actor);
        item(items, "Gấu bông nhỏ", special, UnitType.ITEM, false, 10, actor);
        item(items, "Gấu bông lớn", special, UnitType.ITEM, true, 20, actor);
        item(items, "Rèm cửa", special, UnitType.KG, true, 30, actor);
        item(items, "Thảm nhỏ", special, UnitType.ITEM, false, 40, actor);
        item(items, "Túi vải", special, UnitType.ITEM, false, 50, actor);

        item(items, "Quần áo giặt theo kg", null, UnitType.KG, false, 50, actor);
        item(items, "Đồ cần xử lý vết bẩn", null, UnitType.ITEM, true, 60, actor);
        return items;
    }

    private ItemType item(
        Map<String, ItemType> items,
        String name,
        ItemType parent,
        UnitType unit,
        boolean separateWash,
        int sortOrder,
        UserAccount actor
    ) {
        ItemType value = itemRepository.findByNameViIgnoreCase(name).orElseGet(() ->
            itemRepository.saveAndFlush(new ItemType(
                codeGenerator.nextItemTypeCode(), parent, name, null,
                "Dữ liệu demo phục vụ kiểm thử giao diện và báo giá.", null,
                unit, separateWash, null, null, sortOrder, actor
            ))
        );
        items.put(name, value);
        return value;
    }

    private Map<String, LaundryService> seedServices(UserAccount actor) {
        Map<String, LaundryService> services = new LinkedHashMap<>();
        service(services, "Giặt sấy thường", ProcessingType.WASH_DRY, UnitType.KG, true, 360, actor);
        service(services, "Giặt sấy cao cấp", ProcessingType.WASH_DRY, UnitType.KG, false, 480, actor);
        service(services, "Giặt chăn mền", ProcessingType.WASH_DRY, UnitType.ITEM, false, 720, actor);
        service(services, "Vệ sinh giày", ProcessingType.SHOE_CLEANING, UnitType.PAIR, false, 1440, actor);
        service(services, "Giặt thú bông", ProcessingType.WASH_DRY, UnitType.ITEM, false, 720, actor);
        service(services, "Ủi đồ", ProcessingType.IRON, UnitType.ITEM, true, 120, actor);
        return services;
    }

    private void service(
        Map<String, LaundryService> services,
        String name,
        ProcessingType processingType,
        UnitType unit,
        boolean sharingAllowed,
        int estimatedMinutes,
        UserAccount actor
    ) {
        LaundryService value = serviceRepository.findByNameViIgnoreCase(name).orElseGet(() ->
            serviceRepository.saveAndFlush(new LaundryService(
                codeGenerator.nextServiceCode(), name, null,
                "Dịch vụ demo phục vụ kiểm thử cấu hình và báo giá.", null,
                processingType, unit, sharingAllowed, estimatedMinutes, null, actor
            ))
        );
        services.put(name, value);
    }

    private void seedEligibility(
        UserAccount actor,
        Map<String, LaundryService> services,
        Map<String, ItemType> items
    ) {
        eligible(actor, services, items, "Giặt sấy thường",
            "Áo sơ mi", "Áo thun", "Quần dài", "Quần short", "Váy / Đầm", "Đồ trẻ em",
            "Đồ mặc nhà", "Quần áo giặt theo kg");
        eligible(actor, services, items, "Giặt sấy cao cấp", "Áo sơ mi", "Váy / Đầm", "Quần dài");
        eligible(actor, services, items, "Giặt chăn mền",
            "Chăn mỏng", "Chăn dày", "Mền", "Ga giường", "Vỏ gối", "Topper / Tấm trải");
        eligible(actor, services, items, "Vệ sinh giày",
            "Giày thể thao", "Giày da", "Giày vải", "Boot / Ủng", "Dép / Sandal");
        eligible(actor, services, items, "Giặt thú bông", "Gấu bông nhỏ", "Gấu bông lớn");
        eligible(actor, services, items, "Ủi đồ", "Áo sơ mi", "Áo thun", "Quần dài", "Váy / Đầm");
    }

    private void eligible(
        UserAccount actor,
        Map<String, LaundryService> services,
        Map<String, ItemType> items,
        String serviceName,
        String... itemNames
    ) {
        LaundryService service = services.get(serviceName);
        for (String itemName : itemNames) {
            ItemType item = items.get(itemName);
            if (item.getParent() == null) {
                if (!itemName.equals("Quần áo giặt theo kg")) {
                    throw new IllegalStateException("Demo eligibility must not reference a group: " + itemName);
                }
            }
            if (!eligibilityRepository.existsByServiceIdAndItemTypeId(service.getId(), item.getId())) {
                eligibilityRepository.save(new ServiceItemEligibility(service, item, actor));
            }
        }
        eligibilityRepository.flush();
    }

    private void seedPriceList(
        UserAccount actor,
        Branch branch,
        Map<String, LaundryService> services,
        Map<String, ItemType> items
    ) {
        PriceList list = priceListRepository.findByNameIgnoreCaseAndBranchId(PRICE_LIST_NAME, branch.getId())
            .orElseGet(() -> priceListRepository.saveAndFlush(new PriceList(
                codeGenerator.nextPriceListCode(), PRICE_LIST_NAME,
                "Bảng giá demo có cả giá cấu hình và tổ hợp cố tình để trống cho Coverage.",
                branch, "VND", Instant.now().minus(1, ChronoUnit.DAYS), null, actor
            )));
        if (list.getStatus() != PriceListStatus.DRAFT) {
            log.info("Demo price list '{}' already exists as {}; existing pricing was not changed.",
                PRICE_LIST_NAME, list.getStatus());
            return;
        }

        hybrid(list, services.get("Giặt sấy thường"), items.get("Quần áo giặt theo kg"), actor);
        packageRule(list, services.get("Vệ sinh giày"), items.get("Giày thể thao"), actor);
        unitRule(list, services.get("Giặt chăn mền"), items.get("Chăn mỏng"), "60000", actor);
        unitRule(list, services.get("Giặt chăn mền"), items.get("Chăn dày"), "90000", actor);
        unitRule(list, services.get("Giặt chăn mền"), items.get("Mền"), "75000", actor);
        unitRule(list, services.get("Giặt thú bông"), items.get("Gấu bông nhỏ"), "50000", actor);
        unitRule(list, services.get("Giặt thú bông"), items.get("Gấu bông lớn"), "90000", actor);
        unitRule(list, services.get("Ủi đồ"), items.get("Áo sơ mi"), "15000", actor);
        log.info("Demo price list '{}' is available as DRAFT for safe admin preview.", PRICE_LIST_NAME);
    }

    private void hybrid(PriceList list, LaundryService service, ItemType item, UserAccount actor) {
        ensureRule(list, service, item, actor, rule -> rule.configure(
            service, item, PricingMethod.HYBRID, UnitType.KG, SharingMode.ANY, null,
            money("25000"), null, null, null, null, quantity("3"), money("10000"), null,
            0, list.getEffectiveFrom(), list.getEffectiveTo(), 1, List.of(), List.of(), actor
        ));
    }

    private void packageRule(PriceList list, LaundryService service, ItemType item, UserAccount actor) {
        ensureRule(list, service, item, actor, rule -> rule.configure(
            service, item, PricingMethod.QUANTITY_PACKAGE, UnitType.PAIR, SharingMode.ANY, null,
            null, null, null, null, null, null, null, null,
            0, list.getEffectiveFrom(), list.getEffectiveTo(), 1, List.of(), List.of(
                new PriceRule.PriceRulePackagePriceValue(quantity("1"), money("80000"), 10),
                new PriceRule.PriceRulePackagePriceValue(quantity("2"), money("150000"), 20),
                new PriceRule.PriceRulePackagePriceValue(quantity("3"), money("210000"), 30)
            ), actor
        ));
    }

    private void unitRule(
        PriceList list,
        LaundryService service,
        ItemType item,
        String price,
        UserAccount actor
    ) {
        ensureRule(list, service, item, actor, rule -> rule.configure(
            service, item, PricingMethod.BY_ITEM, UnitType.ITEM, SharingMode.ANY, null,
            null, money(price), null, null, null, null, null, null,
            0, list.getEffectiveFrom(), list.getEffectiveTo(), 1, List.of(), List.of(), actor
        ));
    }

    private void ensureRule(
        PriceList list,
        LaundryService service,
        ItemType item,
        UserAccount actor,
        java.util.function.Consumer<PriceRule> configure
    ) {
        if (priceRuleRepository.existsByPriceListIdAndServiceIdAndItemTypeId(
            list.getId(), service.getId(), item.getId())) return;
        PriceRule rule = new PriceRule(list, service, item, actor);
        configure.accept(rule);
        priceRuleRepository.saveAndFlush(rule);
    }

    private BigDecimal money(String value) {
        return new BigDecimal(value).setScale(2);
    }

    private BigDecimal quantity(String value) {
        return new BigDecimal(value).setScale(3);
    }
}
