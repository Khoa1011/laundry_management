package com.laundry.management.servicecatalog.api;

import com.laundry.management.servicecatalog.application.PricingEngineService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pricing")
public class PricingController {

    private final PricingEngineService pricingEngine;

    public PricingController(PricingEngineService pricingEngine) {
        this.pricingEngine = pricingEngine;
    }

    @PostMapping("/preview")
    public CatalogDtos.PricingPreviewResponse preview(
        @Valid @RequestBody CatalogDtos.PricingPreviewRequest request
    ) {
        return pricingEngine.preview(request);
    }
}
