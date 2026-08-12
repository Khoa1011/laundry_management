package com.laundry.management.servicecatalog.application;

import com.laundry.management.common.exception.ApiException;
import com.laundry.management.common.exception.ErrorCode;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.PriceRuleStatus;
import com.laundry.management.servicecatalog.domain.PricingExplanationCode;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.servicecatalog.infrastructure.ItemTypeRepository;
import com.laundry.management.servicecatalog.infrastructure.LaundryServiceRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceListRepository;
import com.laundry.management.servicecatalog.infrastructure.PriceRuleRepository;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PricingEngineService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PricingEngineService.class);
    private static final Collection<PriceListStatus> QUOTABLE_LIST_STATUSES =
        List.of(PriceListStatus.SCHEDULED, PriceListStatus.ACTIVE, PriceListStatus.EXPIRED);
    private static final Collection<PriceRuleStatus> QUOTABLE_RULE_STATUSES =
        List.of(PriceRuleStatus.ACTIVE, PriceRuleStatus.EXPIRED);

    private final CatalogAuthorizationService authorizationService;
    private final LaundryServiceRepository serviceRepository;
    private final ItemTypeRepository itemTypeRepository;
    private final PriceListRepository priceListRepository;
    private final PriceRuleRepository priceRuleRepository;
    private final PricingCalculator calculator;

    public PricingEngineService(
        CatalogAuthorizationService authorizationService,
        LaundryServiceRepository serviceRepository,
        ItemTypeRepository itemTypeRepository,
        PriceListRepository priceListRepository,
        PriceRuleRepository priceRuleRepository,
        PricingCalculator calculator
    ) {
        this.authorizationService = authorizationService;
        this.serviceRepository = serviceRepository;
        this.itemTypeRepository = itemTypeRepository;
        this.priceListRepository = priceListRepository;
        this.priceRuleRepository = priceRuleRepository;
        this.calculator = calculator;
    }

    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).PRICING_PREVIEW)")
    @Transactional(readOnly = true)
    public CatalogDtos.PricingPreviewResponse preview(CatalogDtos.PricingPreviewRequest request) {
        authorizationService.requireBranch(request.branchId());
        LaundryService service = serviceRepository.findByIdAndStatus(request.serviceId(), CatalogStatus.ACTIVE)
            .orElseThrow(() -> unavailable("Service", ErrorCode.SERVICE_NOT_FOUND));
        ItemType itemType = request.itemTypeId() == null ? null
            : itemTypeRepository.findByIdAndStatus(request.itemTypeId(), CatalogStatus.ACTIVE)
                .orElseThrow(() -> unavailable("Item type", ErrorCode.ITEM_TYPE_NOT_FOUND));
        validateSharing(service, request.sharingMode());

        List<PriceList> lists = priceListRepository.findEffective(
            request.branchId(), QUOTABLE_LIST_STATUSES, request.effectiveAt()
        );
        if (lists.isEmpty()) {
            throw new ApiException(
                HttpStatus.NOT_FOUND, ErrorCode.PRICING_RULE_NOT_FOUND,
                "No effective price list",
                "No published price list is effective for the selected branch and time."
            );
        }
        if (lists.size() > 1) {
            throw new ApiException(
                HttpStatus.CONFLICT, ErrorCode.PRICING_LIST_CONFLICT,
                "Ambiguous price lists",
                "Multiple published price lists are effective for the selected branch and time."
            );
        }
        PriceList priceList = lists.get(0);
        List<PriceRule> candidates = priceRuleRepository.findResolutionCandidates(
            priceList.getId(), QUOTABLE_RULE_STATUSES, service.getId(),
            itemType == null ? null : itemType.getId(), request.sharingMode(), request.priorityLevel(),
            request.quantity(), request.effectiveAt()
        );
        PriceRule rule = resolve(candidates);
        if (request.pricingMethod() != null && request.pricingMethod() != rule.getPricingMethod()) {
            throw compatibility("The client pricing method does not match the authoritative rule.");
        }
        if (request.unitType() != null && request.unitType() != rule.getUnitType()) {
            throw compatibility("The client unit does not match the authoritative rule.");
        }

        PricingCalculator.Calculation calculation = calculator.calculate(
            new PricingCalculator.RuleTerms(
                rule.getPricingMethod(), rule.getUnitType(), rule.getBasePrice(), rule.getUnitPrice(),
                rule.getMinimumQuantity(), rule.getMaximumQuantity(), rule.getMinimumCharge(),
                rule.getIncludedQuantity(), rule.getExcessUnitPrice(), rule.getTierCalculationMode(),
                rule.getTiers().stream().map(tier -> new PricingCalculator.TierTerm(
                    tier.getFromQuantity(), tier.getToQuantity(), tier.getUnitPrice()
                )).toList()
            ),
            request.quantity()
        );
        Instant quotedAt = Instant.now();
        String explanation = explanation(rule, calculation);
        String itemName = itemType == null ? null : itemType.getNameVi();
        CatalogDtos.PricingSnapshot snapshot = new CatalogDtos.PricingSnapshot(
            priceList.getId(), priceList.getName(), rule.getId(), rule.getVersionNumber(),
            service.getId(), service.getCode(), service.getNameVi(),
            itemType == null ? null : itemType.getId(),
            itemType == null ? null : itemType.getCode(), itemName,
            rule.getPricingMethod(), rule.getUnitType(), rule.getSharingMode(),
            calculation.actualQuantity(), calculation.billableQuantity(),
            rule.getBasePrice(), calculation.unitPrice(), rule.getMinimumQuantity(),
            rule.getMinimumCharge(), rule.getIncludedQuantity(), rule.getExcessUnitPrice(),
            calculation.baseAmount(), calculation.surchargeAmount(), calculation.discountAmount(),
            calculation.finalAmount(), calculation.explanationCode(), explanation, quotedAt
        );
        LOGGER.info(
            "Pricing rule selected priceListId={} ruleId={} ruleVersion={} specificity={} priority={} effectiveAt={}",
            priceList.getId(), rule.getId(), rule.getVersionNumber(), specificity(rule),
            rule.getRulePriority(), request.effectiveAt()
        );
        return new CatalogDtos.PricingPreviewResponse(
            priceList.getCurrency(), priceList.getId(), priceList.getName(), rule.getId(),
            rule.getVersionNumber(), service.getId(), service.getCode(), service.getNameVi(),
            itemType == null ? null : itemType.getId(), itemType == null ? null : itemType.getCode(),
            itemName, rule.getPricingMethod(), rule.getUnitType(), rule.getSharingMode(),
            calculation.actualQuantity(), calculation.billableQuantity(), calculation.unitPrice(),
            calculation.baseAmount(), calculation.surchargeAmount(), calculation.discountAmount(),
            calculation.finalAmount(), request.effectiveAt(), calculation.explanationCode(),
            explanation, snapshot
        );
    }

    private PriceRule resolve(List<PriceRule> candidates) {
        if (candidates.isEmpty()) {
            throw new ApiException(
                HttpStatus.NOT_FOUND, ErrorCode.PRICING_RULE_NOT_FOUND,
                "No matching pricing rule",
                "No pricing rule matches the selected service, item type, mode, quantity, and effective time."
            );
        }
        Comparator<PriceRule> comparator = Comparator
            .comparingInt(this::specificity).reversed()
            .thenComparing(PriceRule::getRulePriority, Comparator.reverseOrder())
            .thenComparing(PriceRule::getEffectiveFrom, Comparator.reverseOrder())
            .thenComparing(PriceRule::getVersionNumber, Comparator.reverseOrder());
        List<PriceRule> sorted = candidates.stream().sorted(comparator).toList();
        PriceRule selected = sorted.get(0);
        if (sorted.size() > 1 && comparator.compare(selected, sorted.get(1)) == 0) {
            throw new ApiException(
                HttpStatus.CONFLICT, ErrorCode.PRICING_RULE_CONFLICT,
                "Ambiguous pricing rules",
                "Rules " + selected.getId() + " and " + sorted.get(1).getId()
                    + " have indistinguishable matching precedence."
            );
        }
        return selected;
    }

    private int specificity(PriceRule rule) {
        int result = rule.getItemType() == null ? 0 : 4;
        result += rule.getSharingMode() == SharingMode.ANY ? 0 : 2;
        result += rule.getPriorityLevel() == null ? 0 : 1;
        return result;
    }

    private void validateSharing(LaundryService service, SharingMode mode) {
        if (!service.isSharingAllowed()
            && (mode == SharingMode.SHARED_STANDARD || mode == SharingMode.SHARED_PRIORITY)) {
            throw new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PRICING_SHARING_NOT_ALLOWED,
                "Shared processing is unavailable",
                "The selected service does not support shared processing."
            );
        }
    }

    private String explanation(PriceRule rule, PricingCalculator.Calculation calculation) {
        NumberFormat number = NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN"));
        number.setMaximumFractionDigits(3);
        String actual = number.format(calculation.actualQuantity());
        String billable = number.format(calculation.billableQuantity());
        return switch (calculation.explanationCode()) {
            case MINIMUM_QUANTITY_APPLIED ->
                "Số lượng thực tế " + actual + "; áp dụng mức tính tối thiểu " + billable + ".";
            case MINIMUM_CHARGE_APPLIED ->
                "Giá tính theo số lượng thấp hơn mức thu tối thiểu; áp dụng mức thu tối thiểu.";
            case FIXED_PRICE -> "Áp dụng mức giá cố định của quy tắc.";
            case PER_LOAD_PRICE -> "Số lượng thực tế " + actual + "; tính " + billable + " mẻ.";
            case HYBRID_INCLUDED_QUANTITY -> "Số lượng nằm trong phần đã bao gồm của mức giá cơ bản.";
            case HYBRID_EXCESS_QUANTITY -> "Áp dụng giá cơ bản và tính thêm phần vượt số lượng bao gồm.";
            case VOLUME_TIER_APPLIED -> "Áp dụng một đơn giá bậc cho toàn bộ số lượng tính tiền.";
            case PROGRESSIVE_TIERS_APPLIED -> "Tổng tiền được cộng theo từng khoảng bậc giá.";
            default -> "Số lượng tính tiền " + billable + " theo đơn giá của quy tắc.";
        };
    }

    private ApiException unavailable(String resource, ErrorCode code) {
        return new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY, code, resource + " unavailable",
            "The selected " + resource.toLowerCase(Locale.ROOT) + " does not exist or is not active."
        );
    }

    private ApiException compatibility(String detail) {
        return new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PRICING_UNIT_MISMATCH,
            "Pricing compatibility check failed", detail
        );
    }
}
