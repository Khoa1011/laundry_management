package com.laundry.management.servicecatalog.api;

import com.laundry.management.servicecatalog.application.ItemTypeApplicationService;
import com.laundry.management.servicecatalog.application.ServiceCatalogApplicationService;
import com.laundry.management.servicecatalog.domain.CatalogStatus;
import com.laundry.management.servicecatalog.domain.ProcessingType;
import com.laundry.management.servicecatalog.domain.UnitType;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ServiceCatalogController {

    private final ServiceCatalogApplicationService serviceCatalog;
    private final ItemTypeApplicationService itemTypes;

    public ServiceCatalogController(
        ServiceCatalogApplicationService serviceCatalog,
        ItemTypeApplicationService itemTypes
    ) {
        this.serviceCatalog = serviceCatalog;
        this.itemTypes = itemTypes;
    }

    @GetMapping("/api/services")
    public CatalogDtos.ServiceListResponse services(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) CatalogStatus status,
        @RequestParam(required = false) ProcessingType processingType,
        @RequestParam(required = false) UnitType unitType
    ) {
        return serviceCatalog.list(page, size, search, status, processingType, unitType);
    }

    @GetMapping("/api/services/{id}")
    public CatalogDtos.ServiceResponse service(@PathVariable Long id) {
        return serviceCatalog.get(id);
    }

    @PostMapping("/api/services")
    public ResponseEntity<CatalogDtos.ServiceResponse> createService(
        @Valid @RequestBody CatalogDtos.ServiceRequest request
    ) {
        var created = serviceCatalog.create(request);
        return ResponseEntity.created(URI.create("/api/services/" + created.id())).body(created);
    }

    @PutMapping("/api/services/{id}")
    public CatalogDtos.ServiceResponse updateService(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.ServiceRequest request
    ) {
        return serviceCatalog.update(id, request);
    }

    @PatchMapping("/api/services/{id}/status")
    public CatalogDtos.ServiceResponse changeServiceStatus(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.CatalogStatusRequest request
    ) {
        return serviceCatalog.changeStatus(id, request);
    }

    @GetMapping({"/api/item-types", "/api/item-types/tree"})
    public List<CatalogDtos.ItemTypeResponse> itemTypeTree() {
        return itemTypes.tree();
    }

    @GetMapping("/api/item-types/{id}")
    public CatalogDtos.ItemTypeResponse itemType(@PathVariable Long id) {
        return itemTypes.get(id);
    }

    @PostMapping("/api/item-types")
    public ResponseEntity<CatalogDtos.ItemTypeResponse> createItemType(
        @Valid @RequestBody CatalogDtos.ItemTypeRequest request
    ) {
        var created = itemTypes.create(request);
        return ResponseEntity.created(URI.create("/api/item-types/" + created.id())).body(created);
    }

    @PutMapping("/api/item-types/{id}")
    public CatalogDtos.ItemTypeResponse updateItemType(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.ItemTypeRequest request
    ) {
        return itemTypes.update(id, request);
    }

    @PatchMapping("/api/item-types/{id}/status")
    public CatalogDtos.ItemTypeResponse changeItemTypeStatus(
        @PathVariable Long id,
        @Valid @RequestBody CatalogDtos.CatalogStatusRequest request
    ) {
        return itemTypes.changeStatus(id, request);
    }
}
