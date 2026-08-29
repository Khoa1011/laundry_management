package com.laundry.management.servicecatalog.api;

import com.laundry.management.servicecatalog.application.PriceListApplicationService;
import com.laundry.management.servicecatalog.application.PricingAuditService;
import com.laundry.management.servicecatalog.application.PricingEngineService;
import com.laundry.management.servicecatalog.domain.PriceListStatus;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PriceListController {

    private final PriceListApplicationService priceLists;
    private final PricingAuditService auditService;
    private final PricingEngineService pricingEngine;

    public PriceListController(
        PriceListApplicationService priceLists,
        PricingAuditService auditService,
        PricingEngineService pricingEngine
    ) {
        this.priceLists = priceLists;
        this.auditService = auditService;
        this.pricingEngine = pricingEngine;
    }

    @GetMapping("/price-lists")
    public CatalogDtos.PriceListPageResponse list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long branchId,
        @RequestParam(required = false) PriceListStatus status
    ) {
        return priceLists.list(page, size, search, branchId, status);
    }

    @GetMapping("/price-lists/{id}")
    public CatalogDtos.PriceListDetailResponse detail(@PathVariable Long id) {
        return priceLists.detail(id);
    }

    @PostMapping("/price-lists")
    public ResponseEntity<CatalogDtos.PriceListResponse> create(
        @Valid @RequestBody CatalogDtos.PriceListRequest request
    ) {
        var created = priceLists.create(request);
        return ResponseEntity.created(URI.create("/api/price-lists/" + created.id())).body(created);
    }

    @PutMapping("/price-lists/{id}")
    public CatalogDtos.PriceListResponse update(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.PriceListRequest request
    ) {
        return priceLists.update(id, request);
    }

    @PostMapping("/price-lists/{id}/duplicate")
    public CatalogDtos.PriceListDetailResponse duplicate(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.DuplicatePriceListRequest request
    ) {
        return priceLists.duplicate(id, request);
    }

    @PostMapping({"/price-lists/{id}/publish", "/price-lists/{id}/schedule"})
    public CatalogDtos.PriceListDetailResponse publish(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.PriceListLifecycleRequest request
    ) {
        return priceLists.publish(id, request);
    }

    @PostMapping("/price-lists/{id}/archive")
    public CatalogDtos.PriceListResponse archive(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.PriceListLifecycleRequest request
    ) {
        return priceLists.archive(id, request);
    }

    @GetMapping("/price-lists/{priceListId}/rules")
    public List<CatalogDtos.PriceRuleResponse> rules(@PathVariable Long priceListId) {
        return priceLists.detail(priceListId).rules();
    }

    @GetMapping("/catalog/summary")
    public CatalogDtos.CatalogSummaryResponse summary(@RequestParam(required = false) Long branchId) {
        return priceLists.summary(branchId);
    }

    @PostMapping("/price-lists/{id}/preview")
    public CatalogDtos.PricingPreviewResponse preview(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.PricingPreviewRequest request
    ) {
        return pricingEngine.previewPriceList(id, request);
    }

    @GetMapping("/price-lists/{id}/coverage")
    public CatalogDtos.PriceCoverageResponse coverage(@PathVariable Long id) {
        return priceLists.coverage(id);
    }

    @PostMapping("/price-lists/{priceListId}/rules")
    public ResponseEntity<CatalogDtos.PriceRuleResponse> addRule(
        @PathVariable Long priceListId,
        @Valid @RequestBody CatalogDtos.PriceRuleRequest request
    ) {
        var created = priceLists.addRule(priceListId, request);
        return ResponseEntity.created(URI.create(
            "/api/price-lists/" + priceListId + "/rules/" + created.id()
        )).body(created);
    }

    @PutMapping("/price-lists/{priceListId}/rules/{ruleId}")
    public CatalogDtos.PriceRuleResponse updateRule(
        @PathVariable Long priceListId,
        @PathVariable Long ruleId,
        @Valid @RequestBody CatalogDtos.PriceRuleRequest request
    ) {
        return priceLists.updateRule(priceListId, ruleId, request);
    }

    @DeleteMapping("/price-lists/{priceListId}/rules/{ruleId}")
    public ResponseEntity<Void> deleteRule(
        @PathVariable Long priceListId,
        @PathVariable Long ruleId,
        @RequestParam long rowVersion
    ) {
        priceLists.deleteRule(priceListId, ruleId, rowVersion);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/price-lists/{id}/history")
    public CatalogDtos.AuditPageResponse priceListHistory(
        @PathVariable Long id,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Long branchId = priceLists.get(id).branch().id();
        return auditService.list("PRICE_LIST", id, branchId, page, size);
    }

    @GetMapping("/price-rules/{id}/versions")
    public CatalogDtos.AuditPageResponse priceRuleHistory(
        @PathVariable Long id,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return auditService.list("PRICE_RULE", id, priceLists.branchIdForRule(id), page, size);
    }
}
