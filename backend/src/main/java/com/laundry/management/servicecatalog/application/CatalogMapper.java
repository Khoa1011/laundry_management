package com.laundry.management.servicecatalog.application;

import com.laundry.management.auth.domain.Branch;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import com.laundry.management.servicecatalog.domain.ItemType;
import com.laundry.management.servicecatalog.domain.LaundryService;
import com.laundry.management.servicecatalog.domain.PriceList;
import com.laundry.management.servicecatalog.domain.PriceRule;
import com.laundry.management.servicecatalog.domain.UnitType;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class CatalogMapper {

    public CatalogDtos.ServiceResponse service(LaundryService service) {
        return service(service, 0, 0);
    }

    public CatalogDtos.ServiceResponse service(
        LaundryService service,
        long eligibleItemTypeCount,
        long relatedPriceRuleCount
    ) {
        return new CatalogDtos.ServiceResponse(
            service.getId(), service.getCode(), service.getNameVi(), service.getNameEn(),
            service.getDescriptionVi(), service.getDescriptionEn(), service.getProcessingType(),
            service.getDefaultUnitType(), service.isSharingAllowed(), service.getEstimatedMinutes(),
            service.getMinimumQuantity(), service.getStatus(), service.getCreatedAt(), service.getUpdatedAt(),
            actor(service.getUpdatedBy()), service.getVersion(), eligibleItemTypeCount, relatedPriceRuleCount
        );
    }

    public CatalogDtos.ItemTypeResponse itemType(ItemType item, List<CatalogDtos.ItemTypeResponse> children) {
        return itemType(item, children, 0, 0);
    }

    public CatalogDtos.ItemTypeResponse itemType(
        ItemType item,
        List<CatalogDtos.ItemTypeResponse> children,
        long applicableServiceCount,
        long relatedPriceRuleCount
    ) {
        UnitType effectiveUnit = effectiveUnit(item);
        return new CatalogDtos.ItemTypeResponse(
            item.getId(), item.getCode(), item.getParent() == null ? null : item.getParent().getId(),
            item.getNameVi(), item.getNameEn(), item.getDescriptionVi(), item.getDescriptionEn(),
            item.getDefaultUnitType(), effectiveUnit, item.getDefaultUnitType() == null,
            item.isRequiresSeparateWash(), item.getDefaultColorRisk(), item.getDefaultHygieneLevel(),
            item.getSortOrder(), item.getStatus(), item.getCreatedAt(), item.getUpdatedAt(),
            actor(item.getUpdatedBy()), item.getVersion(), applicableServiceCount, relatedPriceRuleCount, children
        );
    }

    public CatalogDtos.PriceListResponse priceList(PriceList list, long ruleCount) {
        var status = list.getStatus();
        Instant now = Instant.now();
        if (status != com.laundry.management.servicecatalog.domain.PriceListStatus.DRAFT
            && status != com.laundry.management.servicecatalog.domain.PriceListStatus.ARCHIVED) {
            if (list.getEffectiveTo() != null && !list.getEffectiveTo().isAfter(now)) {
                status = com.laundry.management.servicecatalog.domain.PriceListStatus.EXPIRED;
            } else if (!list.getEffectiveFrom().isAfter(now)) {
                status = com.laundry.management.servicecatalog.domain.PriceListStatus.ACTIVE;
            } else {
                status = com.laundry.management.servicecatalog.domain.PriceListStatus.SCHEDULED;
            }
        }
        return new CatalogDtos.PriceListResponse(
            list.getId(), list.getCode(), list.getName(), list.getDescription(), branch(list.getBranch()),
            list.getCurrency(), status, list.getEffectiveFrom(), list.getEffectiveTo(), ruleCount,
            list.getCreatedAt(), list.getUpdatedAt(), actor(list.getUpdatedBy()), list.getPublishedAt(),
            actor(list.getPublishedBy()), list.getArchivedAt(), list.getVersion()
        );
    }

    public CatalogDtos.PriceRuleResponse rule(PriceRule rule) {
        LaundryService service = rule.getService();
        ItemType item = rule.getItemType();
        return new CatalogDtos.PriceRuleResponse(
            rule.getId(), rule.getPriceList().getId(),
            new CatalogDtos.ServiceOptionResponse(
                service.getId(), service.getCode(), service.getNameVi(), service.getNameEn()
            ),
            item == null ? null : new CatalogDtos.ItemTypeOptionResponse(
                item.getId(), item.getCode(), item.getNameVi(), item.getNameEn()
            ),
            rule.getPricingMethod(), rule.getUnitType(), rule.getSharingMode(), rule.getPriorityLevel(),
            rule.getBasePrice(), rule.getUnitPrice(), rule.getMinimumQuantity(), rule.getMaximumQuantity(),
            rule.getMinimumCharge(), rule.getIncludedQuantity(), rule.getExcessUnitPrice(),
            rule.getTierCalculationMode(), rule.getRulePriority(), rule.getEffectiveFrom(), rule.getEffectiveTo(),
            rule.getStatus(), rule.getVersionNumber(), rule.getPublishedAt(), rule.getRowVersion(),
            rule.getTiers().stream().map(tier -> new CatalogDtos.TierResponse(
                tier.getId(), tier.getFromQuantity(), tier.getToQuantity(), tier.getUnitPrice(), tier.getSortOrder()
            )).toList(),
            rule.getPackagePrices().stream().map(packagePrice -> new CatalogDtos.PackagePriceResponse(
                packagePrice.getId(), packagePrice.getQuantity(), packagePrice.getTotalPrice(), packagePrice.getSortOrder()
            )).toList()
        );
    }

    private UnitType effectiveUnit(ItemType item) {
        ItemType current = item;
        while (current != null) {
            if (current.getDefaultUnitType() != null) {
                return current.getDefaultUnitType();
            }
            current = current.getParent();
        }
        return null;
    }

    private CatalogDtos.BranchResponse branch(Branch branch) {
        return new CatalogDtos.BranchResponse(branch.getId(), branch.getCode(), branch.getName());
    }

    private CatalogDtos.ActorResponse actor(UserAccount actor) {
        return actor == null ? null : new CatalogDtos.ActorResponse(actor.getId(), actor.getDisplayName());
    }
}
