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
    private static final String PRICE_LIST_NAME = "Bảng giá menu tiệm Dung";

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
            branch -> seedPriceList(actor, branch, services, items, properties.publish()),
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
        item(items, "Quần áo theo kg", clothing, UnitType.KG, false, 10, actor);

        ItemType bedding = item(items, "Mền", null, null, false, 20, actor);
        item(items, "Mền nhỏ / mỏng", bedding, UnitType.ITEM, false, 10, actor);
        item(items, "Mền dày", bedding, UnitType.ITEM, true, 20, actor);
        item(items, "Mền dày lớn", bedding, UnitType.ITEM, true, 30, actor);
        item(items, "Mùng", bedding, UnitType.KG, false, 40, actor);
        item(items, "Ga giường", bedding, UnitType.KG, false, 50, actor);
        item(items, "Rèm cửa", bedding, UnitType.KG, true, 60, actor);

        ItemType objects = item(items, "Vật dụng", null, null, false, 30, actor);
        item(items, "Gấu / gối nhỏ", objects, UnitType.ITEM, false, 10, actor);
        item(items, "Gấu / gối lớn", objects, UnitType.ITEM, true, 20, actor);

        ItemType shoes = item(items, "Giày dép", null, UnitType.PAIR, false, 40, actor);
        item(items, "Giày thường", shoes, UnitType.PAIR, false, 10, actor);
        item(items, "Giày cần xử lý kỹ", shoes, UnitType.PAIR, true, 20, actor);

        ItemType extras = item(items, "Nhu cầu khác", null, null, false, 50, actor);
        item(items, "Thêm nước giặt", extras, UnitType.ITEM, false, 10, actor);
        item(items, "Thêm nước xả", extras, UnitType.ITEM, false, 20, actor);
        item(items, "Tẩy trắng", extras, UnitType.ITEM, true, 30, actor);
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
        service(services, "Giặt sấy quần áo", ProcessingType.WASH_DRY, UnitType.KG, true, 360, actor);
        service(services, "Giặt mền / ga / rèm", ProcessingType.WASH_DRY, UnitType.ITEM, false, 720, actor);
        service(services, "Giặt gấu / gối", ProcessingType.WASH_DRY, UnitType.ITEM, false, 720, actor);
        service(services, "Vệ sinh giày", ProcessingType.SHOE_CLEANING, UnitType.PAIR, false, 1440, actor);
        service(services, "Nhu cầu khác", ProcessingType.OTHER, UnitType.ITEM, false, 30, actor);
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
        eligible(actor, services, items, "Giặt sấy quần áo", "Quần áo theo kg");
        eligible(actor, services, items, "Giặt mền / ga / rèm",
            "Mền nhỏ / mỏng", "Mền dày", "Mền dày lớn", "Mùng", "Ga giường", "Rèm cửa");
        eligible(actor, services, items, "Giặt gấu / gối", "Gấu / gối nhỏ", "Gấu / gối lớn");
        eligible(actor, services, items, "Vệ sinh giày", "Giày thường", "Giày cần xử lý kỹ");
        eligible(actor, services, items, "Nhu cầu khác", "Thêm nước giặt", "Thêm nước xả", "Tẩy trắng");
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
                throw new IllegalStateException("Demo eligibility must not reference a group: " + itemName);
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
        Map<String, ItemType> items,
        boolean publish
    ) {
        PriceList list = priceListRepository.findByNameIgnoreCaseAndBranchId(PRICE_LIST_NAME, branch.getId())
            .orElseGet(() -> priceListRepository.saveAndFlush(new PriceList(
                codeGenerator.nextPriceListCode(), PRICE_LIST_NAME,
                "Bảng giá lấy từ menu dịch vụ do cửa hàng cung cấp.",
                branch, "VND", Instant.now().minus(1, ChronoUnit.DAYS), null, actor
            )));
        if (list.getStatus() != PriceListStatus.DRAFT) {
            log.info("Demo price list '{}' already exists as {}; existing pricing was not changed.",
                PRICE_LIST_NAME, list.getStatus());
            return;
        }

        clothingRule(list, services.get("Giặt sấy quần áo"), items.get("Quần áo theo kg"),
            "3", "30000", 30, actor);
        clothingRule(list, services.get("Giặt sấy quần áo"), items.get("Quần áo theo kg"),
            "4", "40000", 20, actor);
        clothingRule(list, services.get("Giặt sấy quần áo"), items.get("Quần áo theo kg"),
            null, null, 10, actor);

        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Mền nhỏ / mỏng"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "30000", actor);
        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Mền dày"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "80000", actor);
        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Mền dày lớn"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "100000", actor);
        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Mùng"),
            PricingMethod.BY_WEIGHT, UnitType.KG, "25000", actor);
        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Ga giường"),
            PricingMethod.BY_WEIGHT, UnitType.KG, "25000", actor);
        unitRule(list, services.get("Giặt mền / ga / rèm"), items.get("Rèm cửa"),
            PricingMethod.BY_WEIGHT, UnitType.KG, "25000", actor);

        unitRule(list, services.get("Giặt gấu / gối"), items.get("Gấu / gối nhỏ"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "25000", actor);
        unitRule(list, services.get("Giặt gấu / gối"), items.get("Gấu / gối lớn"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "40000", actor);

        unitRule(list, services.get("Vệ sinh giày"), items.get("Giày thường"),
            PricingMethod.BY_PAIR, UnitType.PAIR, "35000", actor);
        unitRule(list, services.get("Vệ sinh giày"), items.get("Giày cần xử lý kỹ"),
            PricingMethod.BY_PAIR, UnitType.PAIR, "40000", actor);

        unitRule(list, services.get("Nhu cầu khác"), items.get("Thêm nước giặt"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "10000", actor);
        unitRule(list, services.get("Nhu cầu khác"), items.get("Thêm nước xả"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "10000", actor);
        unitRule(list, services.get("Nhu cầu khác"), items.get("Tẩy trắng"),
            PricingMethod.BY_ITEM, UnitType.ITEM, "10000", actor);

        if (publish) {
            Instant now = Instant.now();
            List<PriceList> conflicts = priceListRepository.findOverlappingPublished(
                branch.getId(), list.getId(),
                List.of(PriceListStatus.ACTIVE, PriceListStatus.SCHEDULED, PriceListStatus.EXPIRED),
                list.getEffectiveFrom(), list.getEffectiveTo()
            );
            if (!conflicts.isEmpty()) {
                throw new IllegalStateException(
                    "Cannot publish demo pricing while another published price list overlaps the same branch."
                );
            }
            List<PriceRule> rules = priceRuleRepository.findByPriceListIdOrderByRulePriorityDescIdAsc(list.getId());
            rules.forEach(rule -> rule.publish(now, actor));
            list.publish(now, actor);
            priceRuleRepository.flush();
            priceListRepository.flush();
            log.info("Demo price list '{}' is ACTIVE and ready for order testing.", PRICE_LIST_NAME);
        } else {
            log.info("Demo price list '{}' is available as DRAFT for safe admin preview.", PRICE_LIST_NAME);
        }
    }

    private void clothingRule(
        PriceList list,
        LaundryService service,
        ItemType item,
        String maximumQuantity,
        String minimumCharge,
        int priority,
        UserAccount actor
    ) {
        ensureRule(list, service, item, priority, actor, rule -> rule.configure(
            service, item, PricingMethod.BY_WEIGHT, UnitType.KG, SharingMode.ANY, null,
            null, money("10000"), null, maximumQuantity == null ? null : quantity(maximumQuantity),
            minimumCharge == null ? null : money(minimumCharge), null, null, null,
            priority, list.getEffectiveFrom(), list.getEffectiveTo(), 1, List.of(), List.of(), actor
        ));
    }

    private void unitRule(
        PriceList list,
        LaundryService service,
        ItemType item,
        PricingMethod method,
        UnitType unit,
        String price,
        UserAccount actor
    ) {
        ensureRule(list, service, item, 0, actor, rule -> rule.configure(
            service, item, method, unit, SharingMode.ANY, null,
            null, money(price), null, null, null, null, null, null,
            0, list.getEffectiveFrom(), list.getEffectiveTo(), 1, List.of(), List.of(), actor
        ));
    }

    private void ensureRule(
        PriceList list,
        LaundryService service,
        ItemType item,
        int rulePriority,
        UserAccount actor,
        java.util.function.Consumer<PriceRule> configure
    ) {
        if (priceRuleRepository.existsByPriceListIdAndServiceIdAndItemTypeIdAndRulePriority(
            list.getId(), service.getId(), item.getId(), rulePriority)) return;
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
