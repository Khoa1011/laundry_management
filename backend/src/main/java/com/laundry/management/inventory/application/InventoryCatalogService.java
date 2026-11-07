package com.laundry.management.inventory.application;

import com.laundry.management.inventory.domain.*;
import com.laundry.management.inventory.infrastructure.*;
import com.laundry.management.operations.api.OperationsDtos.*;
import com.laundry.management.operations.application.*;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class InventoryCatalogService {
    private final CatalogPersistence data;
    private final OperationsAccess access;
    private final WarehouseRepository warehouse;
    private final InventoryCategoryRepository inventoryCategory;
    private final InventoryUnitRepository inventoryUnit;
    private final SupplierRepository supplier;
    private final InventoryItemRepository inventoryItem;
    private final InventoryConversionRepository inventoryConversion;
    private final InventorySettingsRepository settings;
    public InventoryCatalogService(CatalogPersistence data, OperationsAccess access, WarehouseRepository warehouse, InventoryCategoryRepository inventoryCategory, InventoryUnitRepository inventoryUnit, SupplierRepository supplier, InventoryItemRepository inventoryItem, InventoryConversionRepository inventoryConversion, InventorySettingsRepository settings) {
        this.data=data; this.access=access;
        this.warehouse=warehouse;
        this.inventoryCategory=inventoryCategory;
        this.inventoryUnit=inventoryUnit;
        this.supplier=supplier;
        this.inventoryItem=inventoryItem;
        this.inventoryConversion=inventoryConversion;
        this.settings=settings;
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_WAREHOUSE_READ)")
    @Transactional(readOnly=true)
    public PageResponse<WarehouseResponse> listWarehouse(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(warehouse, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapWarehouse).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_WAREHOUSE_READ)")
    @Transactional(readOnly=true)
    public WarehouseResponse getWarehouse(Long id, Long branchId) { return mapWarehouse(data.get(warehouse, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_WAREHOUSE_MANAGE)")
    @Transactional
    public WarehouseResponse saveWarehouse(Long id, @Valid WarehouseRequest request) {
        Long branch=access.branch(request.branchId());
        data.lockBranch(branch);
        if(id!=null && !request.active() && settings.findCurrentForUpdate(branch).filter(s -> id.equals(s.getDefaultWarehouseId())).isPresent())
            throw new OperationsValidationException("active","defaultInUse");
        Warehouse record;
        if(id==null) { record=new Warehouse(); data.initialize(record, branch, "Warehouse", "KHO"); }
        else { record=data.get(warehouse, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        data.update(record, request.name(), request.active(), request.note());
        warehouse.saveAndFlush(record);
        data.audit(branch, "inventory", "warehouses", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note");
        return mapWarehouse(record);
    }
    private WarehouseResponse mapWarehouse(Warehouse record) { return new WarehouseResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_CATEGORY_READ)")
    @Transactional(readOnly=true)
    public PageResponse<InventoryCategoryResponse> listInventoryCategory(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(inventoryCategory, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapInventoryCategory).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_CATEGORY_READ)")
    @Transactional(readOnly=true)
    public InventoryCategoryResponse getInventoryCategory(Long id, Long branchId) { return mapInventoryCategory(data.get(inventoryCategory, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_CATEGORY_MANAGE)")
    @Transactional
    public InventoryCategoryResponse saveInventoryCategory(Long id, @Valid InventoryCategoryRequest request) {
        Long branch=access.branch(request.branchId());
        InventoryCategory record;
        if(id==null) { record=new InventoryCategory(); data.initialize(record, branch, "InventoryCategory", "NVT"); }
        else { record=data.get(inventoryCategory, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        data.update(record, request.name(), request.active(), request.note());
        inventoryCategory.saveAndFlush(record);
        data.audit(branch, "inventory", "categories", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note");
        return mapInventoryCategory(record);
    }
    private InventoryCategoryResponse mapInventoryCategory(InventoryCategory record) { return new InventoryCategoryResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_READ)")
    @Transactional(readOnly=true)
    public PageResponse<InventoryUnitResponse> listInventoryUnit(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(inventoryUnit, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapInventoryUnit).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_READ)")
    @Transactional(readOnly=true)
    public InventoryUnitResponse getInventoryUnit(Long id, Long branchId) { return mapInventoryUnit(data.get(inventoryUnit, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_MANAGE)")
    @Transactional
    public InventoryUnitResponse saveInventoryUnit(Long id, @Valid InventoryUnitRequest request) {
        Long branch=access.branch(request.branchId());
        InventoryUnit record;
        if(id==null) { record=new InventoryUnit(); data.initialize(record, branch, "InventoryUnit", "DV"); }
        else { record=data.get(inventoryUnit, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        if(id!=null && !record.getDimension().equals(request.dimension())) throw new OperationsValidationException("dimension","immutable");
        data.update(record, request.name(), request.active(), request.note());
        record.setDimension(request.dimension());
        inventoryUnit.saveAndFlush(record);
        data.audit(branch, "inventory", "units", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,dimension");
        return mapInventoryUnit(record);
    }
    private InventoryUnitResponse mapInventoryUnit(InventoryUnit record) { return new InventoryUnitResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getDimension()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_SUPPLIER_READ)")
    @Transactional(readOnly=true)
    public PageResponse<SupplierResponse> listSupplier(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(supplier, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapSupplier).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_SUPPLIER_READ)")
    @Transactional(readOnly=true)
    public SupplierResponse getSupplier(Long id, Long branchId) { return mapSupplier(data.get(supplier, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_SUPPLIER_MANAGE)")
    @Transactional
    public SupplierResponse saveSupplier(Long id, @Valid SupplierRequest request) {
        Long branch=access.branch(request.branchId());
        Supplier record;
        if(id==null) { record=new Supplier(); data.initialize(record, branch, "Supplier", "NCC"); }
        else { record=data.get(supplier, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        data.update(record, request.name(), request.active(), request.note());
        record.setPhone(request.phone());
        record.setEmail(request.email());
        record.setAddress(request.address());
        record.setTaxNumber(request.taxNumber());
        record.setContactName(request.contactName());
        record.setMaterialGroups(request.materialGroups());
        supplier.saveAndFlush(record);
        data.audit(branch, "inventory", "suppliers", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,phone,email,address,taxNumber,contactName,materialGroups");
        return mapSupplier(record);
    }
    private SupplierResponse mapSupplier(Supplier record) { return new SupplierResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getPhone(), record.getEmail(), record.getAddress(), record.getTaxNumber(), record.getContactName(), record.getMaterialGroups()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_ITEM_READ)")
    @Transactional(readOnly=true)
    public PageResponse<InventoryItemResponse> listInventoryItem(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(inventoryItem, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapInventoryItem).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_ITEM_READ)")
    @Transactional(readOnly=true)
    public InventoryItemResponse getInventoryItem(Long id, Long branchId) { return mapInventoryItem(data.get(inventoryItem, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_ITEM_MANAGE)")
    @Transactional
    public InventoryItemResponse saveInventoryItem(Long id, @Valid InventoryItemRequest request) {
        Long branch=access.branch(request.branchId());
        InventoryItem record;
        if(id==null) { record=new InventoryItem(); data.initialize(record, branch, "InventoryItem", "VT"); }
        else { record=data.get(inventoryItem, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        data.active(inventoryCategory, request.categoryId(), branch);
        data.active(inventoryUnit, request.baseUnitId(), branch);
        if(request.supplierId()!=null) data.active(supplier, request.supplierId(), branch);
        if(id!=null && !record.getBaseUnitId().equals(request.baseUnitId())) throw new OperationsValidationException("baseUnitId","immutable");
        if(request.maximumStock()!=null && request.maximumStock().compareTo(request.minimumStock())<0) throw new OperationsValidationException("maximumStock","maxStock");
        if(request.trackExpiry() && !request.trackLots()) throw new OperationsValidationException("trackExpiry","expiry");
        if(request.referencePrice()!=null && !access.has(PermissionCodes.INVENTORY_COST_UPDATE)) throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "Permission denied", "Reference price update permission is required.");
        data.update(record, request.name(), request.active(), request.note());
        record.setCategoryId(request.categoryId());
        record.setBaseUnitId(request.baseUnitId());
        record.setSupplierId(request.supplierId());
        record.setDescription(request.description());
        if(access.has(PermissionCodes.INVENTORY_COST_UPDATE) && request.referencePrice()!=null) record.setReferencePrice(request.referencePrice());
        record.setMinimumStock(request.minimumStock());
        record.setMaximumStock(request.maximumStock());
        record.setTrackLots(request.trackLots());
        record.setTrackExpiry(request.trackExpiry());
        inventoryItem.saveAndFlush(record);
        data.audit(branch, "inventory", "items", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,categoryId,baseUnitId,supplierId,description,minimumStock,maximumStock,trackLots,trackExpiry" + (request.referencePrice()!=null?",referencePrice":""));
        return mapInventoryItem(record);
    }
    private InventoryItemResponse mapInventoryItem(InventoryItem record) { return new InventoryItemResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getCategoryId(), record.getBaseUnitId(), record.getSupplierId(), record.getDescription(), access.has(PermissionCodes.INVENTORY_COST_READ)?record.getReferencePrice():null, record.getMinimumStock(), record.getMaximumStock(), record.getTrackLots(), record.getTrackExpiry()); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_READ)")
    @Transactional(readOnly=true)
    public PageResponse<InventoryConversionResponse> listInventoryConversion(Long branchId, int page, int size, String search, Boolean active) {
        var result=data.list(inventoryConversion, branchId, page, size, search, active);
        return data.response(result, result.getContent().stream().map(this::mapInventoryConversion).toList());
    }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_READ)")
    @Transactional(readOnly=true)
    public InventoryConversionResponse getInventoryConversion(Long id, Long branchId) { return mapInventoryConversion(data.get(inventoryConversion, id, branchId)); }
    @PreAuthorize("@permissionChecker.has(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).INVENTORY_UNIT_MANAGE)")
    @Transactional
    public InventoryConversionResponse saveInventoryConversion(Long id, @Valid InventoryConversionRequest request) {
        Long branch=access.branch(request.branchId());
        InventoryConversion record;
        if(id==null) { record=new InventoryConversion(); data.initialize(record, branch, "InventoryConversion", "QD"); }
        else { record=data.get(inventoryConversion, id, branch); OperationsAccess.version(record.getVersion(), request.version()); }
        var item=data.active(inventoryItem, request.itemId(), branch);
        var base=data.active(inventoryUnit, item.getBaseUnitId(), branch);
        var input=data.active(inventoryUnit, request.inputUnitId(), branch);
        if(!base.getDimension().equals(input.getDimension())) throw new OperationsValidationException("inputUnitId","unitMismatch");
        if(id!=null && !record.getItemId().equals(request.itemId())) throw new OperationsValidationException("itemId","immutable");
        data.update(record, request.name(), request.active(), request.note());
        record.setItemId(request.itemId());
        record.setInputUnitId(request.inputUnitId());
        record.setFactor(request.factor());
        inventoryConversion.saveAndFlush(record);
        data.audit(branch, "inventory", "conversions", record.getId(), id==null?"CREATED":"UPDATED", "name,active,note,itemId,inputUnitId,factor");
        return mapInventoryConversion(record);
    }
    private InventoryConversionResponse mapInventoryConversion(InventoryConversion record) { return new InventoryConversionResponse(record.getId(), record.getBranchId(), record.getCode(), record.getName(), record.isActive(), record.getNote(), record.getVersion(), record.getCreatedAt(), record.getUpdatedAt(), record.getItemId(), record.getInputUnitId(), record.getFactor()); }
}
