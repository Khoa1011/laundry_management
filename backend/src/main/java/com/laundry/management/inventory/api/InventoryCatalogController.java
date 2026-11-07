package com.laundry.management.inventory.api;

import com.laundry.management.inventory.application.InventoryCatalogService;
import com.laundry.management.operations.api.OperationsDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;

@RestController
@RequestMapping("/api/inventory")
public class InventoryCatalogController {
    private final InventoryCatalogService service;
    public InventoryCatalogController(InventoryCatalogService service) { this.service=service; }

    @GetMapping("/warehouses")
    public PageResponse<WarehouseResponse> listWarehouse(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listWarehouse(branchId, page, size, search, active);
    }
    @GetMapping("/warehouses/{id}")
    public WarehouseResponse getWarehouse(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getWarehouse(id, branchId); }
    @PostMapping("/warehouses")
    public ResponseEntity<WarehouseResponse> createWarehouse(@Valid @RequestBody WarehouseRequest request) {
        var created=service.saveWarehouse(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/warehouses/"+created.id())).body(created);
    }
    @PutMapping("/warehouses/{id}")
    public WarehouseResponse updateWarehouse(@PathVariable Long id, @Valid @RequestBody WarehouseRequest request) { return service.saveWarehouse(id, request); }

    @GetMapping("/categories")
    public PageResponse<InventoryCategoryResponse> listInventoryCategory(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listInventoryCategory(branchId, page, size, search, active);
    }
    @GetMapping("/categories/{id}")
    public InventoryCategoryResponse getInventoryCategory(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getInventoryCategory(id, branchId); }
    @PostMapping("/categories")
    public ResponseEntity<InventoryCategoryResponse> createInventoryCategory(@Valid @RequestBody InventoryCategoryRequest request) {
        var created=service.saveInventoryCategory(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/categories/"+created.id())).body(created);
    }
    @PutMapping("/categories/{id}")
    public InventoryCategoryResponse updateInventoryCategory(@PathVariable Long id, @Valid @RequestBody InventoryCategoryRequest request) { return service.saveInventoryCategory(id, request); }

    @GetMapping("/units")
    public PageResponse<InventoryUnitResponse> listInventoryUnit(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listInventoryUnit(branchId, page, size, search, active);
    }
    @GetMapping("/units/{id}")
    public InventoryUnitResponse getInventoryUnit(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getInventoryUnit(id, branchId); }
    @PostMapping("/units")
    public ResponseEntity<InventoryUnitResponse> createInventoryUnit(@Valid @RequestBody InventoryUnitRequest request) {
        var created=service.saveInventoryUnit(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/units/"+created.id())).body(created);
    }
    @PutMapping("/units/{id}")
    public InventoryUnitResponse updateInventoryUnit(@PathVariable Long id, @Valid @RequestBody InventoryUnitRequest request) { return service.saveInventoryUnit(id, request); }

    @GetMapping("/suppliers")
    public PageResponse<SupplierResponse> listSupplier(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listSupplier(branchId, page, size, search, active);
    }
    @GetMapping("/suppliers/{id}")
    public SupplierResponse getSupplier(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getSupplier(id, branchId); }
    @PostMapping("/suppliers")
    public ResponseEntity<SupplierResponse> createSupplier(@Valid @RequestBody SupplierRequest request) {
        var created=service.saveSupplier(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/suppliers/"+created.id())).body(created);
    }
    @PutMapping("/suppliers/{id}")
    public SupplierResponse updateSupplier(@PathVariable Long id, @Valid @RequestBody SupplierRequest request) { return service.saveSupplier(id, request); }

    @GetMapping("/items")
    public PageResponse<InventoryItemResponse> listInventoryItem(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listInventoryItem(branchId, page, size, search, active);
    }
    @GetMapping("/items/{id}")
    public InventoryItemResponse getInventoryItem(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getInventoryItem(id, branchId); }
    @PostMapping("/items")
    public ResponseEntity<InventoryItemResponse> createInventoryItem(@Valid @RequestBody InventoryItemRequest request) {
        var created=service.saveInventoryItem(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/items/"+created.id())).body(created);
    }
    @PutMapping("/items/{id}")
    public InventoryItemResponse updateInventoryItem(@PathVariable Long id, @Valid @RequestBody InventoryItemRequest request) { return service.saveInventoryItem(id, request); }

    @GetMapping("/conversions")
    public PageResponse<InventoryConversionResponse> listInventoryConversion(@RequestParam(required=false) Long branchId, @RequestParam(defaultValue="0") int page,
        @RequestParam(defaultValue="20") int size, @RequestParam(required=false) String search, @RequestParam(required=false) Boolean active) {
        return service.listInventoryConversion(branchId, page, size, search, active);
    }
    @GetMapping("/conversions/{id}")
    public InventoryConversionResponse getInventoryConversion(@PathVariable Long id, @RequestParam(required=false) Long branchId) { return service.getInventoryConversion(id, branchId); }
    @PostMapping("/conversions")
    public ResponseEntity<InventoryConversionResponse> createInventoryConversion(@Valid @RequestBody InventoryConversionRequest request) {
        var created=service.saveInventoryConversion(null, request);
        return ResponseEntity.created(URI.create("/api/inventory/conversions/"+created.id())).body(created);
    }
    @PutMapping("/conversions/{id}")
    public InventoryConversionResponse updateInventoryConversion(@PathVariable Long id, @Valid @RequestBody InventoryConversionRequest request) { return service.saveInventoryConversion(id, request); }
}
