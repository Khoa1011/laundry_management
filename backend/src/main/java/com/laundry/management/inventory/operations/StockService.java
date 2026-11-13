package com.laundry.management.inventory.operations;

import static com.laundry.management.inventory.operations.StockStore.*;
import static com.laundry.management.inventory.operations.StockMath.*;
import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.common.exception.*;
import com.laundry.management.operations.application.*;
import jakarta.validation.Valid;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

@Service @Validated
public class StockService {
    private final StockStore db;private final OperationsAccess access;private final CatalogPersistence audit;
    private final ObjectProvider<InventoryFinanceContract> finance;private final ApplicationEventPublisher events;private final Clock clock;
    public StockService(StockStore db,OperationsAccess access,CatalogPersistence audit,ObjectProvider<InventoryFinanceContract> finance,ApplicationEventPublisher events,Clock clock){
        this.db=db;this.access=access;this.audit=audit;this.finance=finance;this.events=events;this.clock=clock;}

    public void require(String permission){if(!access.has(permission))throw new ApiException(HttpStatus.FORBIDDEN,ErrorCode.FORBIDDEN,"Permission denied","Missing inventory capability.");}
    private String createPermission(StockDtos.Kind kind){return switch(kind){case RECEIPT->PermissionCodes.INVENTORY_RECEIPT_CREATE;case ISSUE->PermissionCodes.INVENTORY_ISSUE_CREATE;case TRANSFER->PermissionCodes.INVENTORY_TRANSFER_CREATE;case STOCKTAKE->PermissionCodes.INVENTORY_STOCKTAKE_CREATE;case ADJUSTMENT->PermissionCodes.INVENTORY_ADJUSTMENT_CREATE;};}
    private void locks(Long... branches){TreeSet<Long> ids=new TreeSet<>();for(Long branch:branches)if(branch!=null)ids.add(access.branch(branch));
        for(long id:ids){var b=db.one("SELECT * FROM branches WHERE id=? FOR UPDATE",id);if(!"ACTIVE".equals(b.get("status")))throw StockFailure.invalid("BRANCH_INACTIVE");}}
    public Map<String,Object> document(long id,Long branch){long scope=access.branch(branch);var d=db.one("SELECT * FROM stock_documents WHERE id=?",id);scope(d,scope);return d;}
    private void scope(Map<String,Object> d,long branch){if(id(d,"branchId")!=branch&&(d.get("destinationBranchId")==null||id(d,"destinationBranchId")!=branch))throw OperationsAccess.missing();
        access.branch(id(d,"branchId"));if(d.get("destinationBranchId")!=null)access.branch(id(d,"destinationBranchId"));}
    private Map<String,Object> locked(long id,Long branch){var initial=document(id,branch);locks(id(initial,"branchId"),initial.get("destinationBranchId")==null?null:id(initial,"destinationBranchId"));
        var d=db.one("SELECT * FROM stock_documents WHERE id=? FOR UPDATE",id);scope(d,access.branch(branch));return d;}
    private Map<String,Object> reference(String table,long id,long branch){var r=db.one("SELECT * FROM "+table+" WHERE id=? AND branch_id=? FOR UPDATE",id,branch);if(!bool(r,"active"))throw StockFailure.invalid("REFERENCE_INACTIVE");return r;}
    private Map<String,Object> warehouse(long id,long branch){return reference("warehouses",id,branch);}
    private Map<String,Object> item(long id,long branch){return reference("inventory_items",id,branch);}
    private boolean negative(long branch){var settings=db.rows("SELECT allow_negative FROM inventory_settings WHERE branch_id=? FOR UPDATE",branch);return !settings.isEmpty()&&bool(settings.get(0),"allowNegative");}

    @Transactional
    public Map<String,Object> preview(@Valid StockDtos.Save request,Long documentId){
        require(documentId==null?createPermission(request.kind()):PermissionCodes.INVENTORY_DOCUMENT_UPDATE);
        validateHeader(request);
        if(documentId!=null){var initial=document(documentId,request.branchId());if(id(initial,"branchId")!=request.branchId())throw StockFailure.invalid("DOCUMENT_IDENTITY_IMMUTABLE");if(!Objects.equals(initial.get("destinationBranchId"),request.destinationBranchId()))throw StockFailure.invalid("DESTINATION_BRANCH_IMMUTABLE");}
        locks(request.branchId(),request.destinationBranchId());StockBook book=new StockBook(db);
        if(documentId!=null){var previous=locked(documentId,request.branchId());OperationsAccess.version(id(previous,"version"),request.version());
            if(!previous.get("kind").equals(request.kind().name())||id(previous,"branchId")!=request.branchId()||!Objects.equals(previous.get("destinationBranchId"),request.destinationBranchId()))throw StockFailure.invalid("DOCUMENT_IDENTITY_IMMUTABLE");
            if("CANCELLED".equals(previous.get("status")))throw StockFailure.conflict("DOCUMENT_CANCELLED");
            var before=db.parse(previous.get("currentSnapshot"));
            if(!"DRAFT".equals(previous.get("status"))){
                if(economic(before.get("input")).equals(economic(db.parse(db.json(request)))))return before;
                requireNoSettlement(documentId);requireLatest(documentId,effects(before));book.reverse(effects(before),negative(request.branchId()));
            }
        }
        // Validate a complete transaction-local plan without persisting its movements.
        return prepare(request,book,true);
    }

    @Transactional
    public Map<String,Object> save(Long documentId,@Valid StockDtos.Save request,String key){
        require(documentId==null?createPermission(request.kind()):PermissionCodes.INVENTORY_DOCUMENT_UPDATE);
        validateHeader(request);
        var initial=documentId==null?null:document(documentId,request.branchId());
        if(initial!=null&&id(initial,"branchId")!=request.branchId())throw StockFailure.invalid("DOCUMENT_IDENTITY_IMMUTABLE");
        if(initial!=null&&!Objects.equals(initial.get("destinationBranchId"),request.destinationBranchId()))throw StockFailure.invalid("DESTINATION_BRANCH_IMMUTABLE");
        locks(request.branchId(),request.destinationBranchId(),initial==null||initial.get("destinationBranchId")==null?null:id(initial,"destinationBranchId"));String digest=digest("save:"+documentId,request);var replay=replay(request.branchId(),key,digest);if(replay!=null)return replay;
        Map<String,Object> previous=null,before=null;long version=0;boolean hadEffects=false;
        if(documentId!=null){previous=locked(documentId,request.branchId());OperationsAccess.version(id(previous,"version"),request.version());
            if(!previous.get("kind").equals(request.kind().name())||id(previous,"branchId")!=request.branchId())throw StockFailure.invalid("DOCUMENT_IDENTITY_IMMUTABLE");
            if("CANCELLED".equals(previous.get("status")))throw StockFailure.conflict("DOCUMENT_CANCELLED");
            before=db.parse(previous.get("currentSnapshot"));hadEffects=!"DRAFT".equals(previous.get("status"));
            if(hadEffects&&request.draft())throw StockFailure.invalid("RECORDED_CANNOT_BECOME_DRAFT");
            version=id(previous,"version")+1;long priorId=documentId,priorVersion=id(previous,"version");finance.orderedStream().forEach(f->f.requireRevisionAllowed(priorId,priorVersion));
        }
        boolean metadataOnly=hadEffects&&economic(before.get("input")).equals(economic(db.parse(db.json(request))));
        StockBook book=new StockBook(db);
        if(hadEffects&&!metadataOnly){requireNoSettlement(documentId);List<Map<String,Object>> old=effects(before);requireLatest(documentId,old);book.reverse(old,negative(request.branchId()));}
        Map<String,Object> snapshot;
        if(metadataOnly){snapshot=new LinkedHashMap<>(before);snapshot.put("input",db.parse(db.json(request)));snapshot.put("businessAt",request.businessAt().toString());snapshot.put("note",request.note());snapshot.put("reason",request.reason());snapshot.put("supplierId",request.supplierId());snapshot.put("supplierName",request.supplierId()==null?null:reference("suppliers",request.supplierId(),request.branchId()).get("name"));}
        else snapshot=prepare(request,book,!request.draft());Instant now=Instant.now(clock);
        if(documentId==null){String code=number(request.branchId(),request.kind());documentId=db.insert("INSERT INTO stock_documents(branch_id,destination_branch_id,code,kind,status,warehouse_id,destination_warehouse_id,supplier_id,business_at,created_at,updated_at,created_by,updated_by,version,current_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)",
            request.branchId(),request.destinationBranchId(),code,request.kind().name(),snapshot.get("status"),request.warehouseId(),request.destinationWarehouseId(),request.supplierId(),time(request.businessAt()),time(now),time(now),access.actor(),access.actor(),"{}");snapshot.put("code",code);
        }else snapshot.put("code",previous.get("code"));
        long id=documentId;snapshot.put("id",id);snapshot.put("version",version);snapshot.put("createdAt",previous==null?now.toString():previous.get("createdAt"));snapshot.put("createdBy",previous==null?access.actor():previous.get("createdBy"));snapshot.put("updatedAt",now.toString());snapshot.put("updatedBy",access.actor());
        List<Map<String,Object>> forward=metadataOnly?effects(before):book.effects.stream().filter(e->!"REVERSAL".equals(e.get("phase"))).toList();snapshot.put("effectiveEffects",forward);
        commit(id,version,previous==null?"CREATED":"REVISED",request.reason(),before,snapshot,book,now);
        if(request.kind()==StockDtos.Kind.TRANSFER&&!request.draft()&&!metadataOnly){
            if(previous!=null)db.jdbc().update("DELETE FROM stock_transit WHERE document_id=?",id);
            for(var line:lines(snapshot)){db.jdbc().update("INSERT INTO stock_transit(document_id,line_number,item_id,destination_item_id,dispatched,remaining_value) VALUES (?,?,?,?,?,?)",id,line.get("lineNumber"),line.get("itemId"),line.get("destinationItemId"),dec(line,"baseQuantity"),dec(line,"lineValue"));}
        }
        remember(request.branchId(),key,digest,snapshot,now);return snapshot;
    }

    private Map<String,Object> prepare(StockDtos.Save r,StockBook book,boolean apply){
        if(r.warehouseId()==null)throw StockFailure.invalid("WAREHOUSE_REQUIRED");warehouse(r.warehouseId(),r.branchId());
        if(r.businessAt().isAfter(Instant.now(clock).plusSeconds(300)))throw StockFailure.invalid("FUTURE_DATE");
        if(r.kind()==StockDtos.Kind.ISSUE&&!Set.of("LAUNDRY","PACKAGING","CONSUMPTION","DAMAGED","SUPPLIER_RETURN","OTHER").contains(Objects.toString(r.issueType(),"")))throw StockFailure.invalid("ISSUE_TYPE_REQUIRED");
        if((r.kind()==StockDtos.Kind.ADJUSTMENT||r.kind()==StockDtos.Kind.STOCKTAKE)&&blank(r.reason()))throw StockFailure.invalid("REASON_REQUIRED");
        if(r.supplierId()!=null)reference("suppliers",r.supplierId(),r.branchId());
        if(r.kind()==StockDtos.Kind.TRANSFER){if(r.destinationBranchId()==null||r.destinationWarehouseId()==null||r.destinationWarehouseId().equals(r.warehouseId()))throw StockFailure.invalid("DESTINATION_REQUIRED");warehouse(r.destinationWarehouseId(),r.destinationBranchId());}
        else if(r.destinationWarehouseId()!=null||r.destinationBranchId()!=null)throw StockFailure.invalid("UNEXPECTED_DESTINATION");
        if(r.kind()!=StockDtos.Kind.RECEIPT&&zero(r.charges()).signum()!=0)throw StockFailure.invalid("CHARGES_RECEIPT_ONLY");
        List<Map<String,Object>> prepared=new ArrayList<>();BigDecimal sum=BigDecimal.ZERO,gross=BigDecimal.ZERO,discountTotal=BigDecimal.ZERO,taxTotal=BigDecimal.ZERO;Set<String> unique=new HashSet<>();int n=0;
        for(var in:r.lines()){
            var item=item(in.itemId(),r.branchId());var unit=db.one("SELECT * FROM inventory_units WHERE id=? FOR UPDATE",item.get("baseUnitId"));
            BigDecimal factor=BigDecimal.ONE;String inputUnit=unit.get("name").toString();
            if(in.conversionId()!=null){var c=reference("inventory_unit_conversions",in.conversionId(),r.branchId());if(id(c,"itemId")!=in.itemId())throw StockFailure.invalid("CONVERSION_ITEM_MISMATCH");factor=dec(c,"factor");inputUnit=c.get("name").toString();}
            BigDecimal quantity;try{quantity=qty(in.quantity().multiply(factor));}catch(ArithmeticException e){throw StockFailure.invalid("QUANTITY_PRECISION");}
            if(quantity.precision()>19||quantity.signum()<=0&&r.kind()!=StockDtos.Kind.STOCKTAKE)throw StockFailure.invalid("POSITIVE_QUANTITY_REQUIRED:"+(n+1));
            String lot=blank(in.lotCode())?null:in.lotCode().trim();String expiry=in.expiryDate()==null?null:in.expiryDate().toString();
            if(bool(item,"trackLots")!=(lot!=null)||bool(item,"trackExpiry")!=(expiry!=null))throw StockFailure.invalid("LOT_REQUIRED:"+(n+1));
            boolean expired=in.expiryDate()!=null&&in.expiryDate().isBefore(LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh"))));
            if(expired&&(r.kind()==StockDtos.Kind.RECEIPT||r.kind()==StockDtos.Kind.TRANSFER||r.kind()==StockDtos.Kind.ISSUE&&!Set.of("DAMAGED","SUPPLIER_RETURN").contains(r.issueType())))throw StockFailure.invalid("LOT_EXPIRED:"+(n+1));
            if(!unique.add(in.itemId()+":"+lot))throw StockFailure.invalid("DUPLICATE_ITEM_LOT");
            BigDecimal amount=BigDecimal.ZERO;
            if(r.kind()==StockDtos.Kind.RECEIPT){if(in.unitPrice()==null)throw StockFailure.invalid("PRICE_REQUIRED:"+(n+1));amount=money(in.quantity().multiply(in.unitPrice()).subtract(zero(in.discount())).add(zero(in.tax())));if(amount.signum()<0)throw StockFailure.invalid("DISCOUNT_TOO_LARGE:"+(n+1));}
            if(r.kind()!=StockDtos.Kind.RECEIPT&&(zero(in.discount()).signum()!=0||zero(in.tax()).signum()!=0))throw StockFailure.invalid("RECEIPT_AMOUNTS_ONLY");
            Map<String,Object> line=new LinkedHashMap<>();line.put("lineNumber",++n);line.put("itemId",in.itemId());line.put("itemName",item.get("name"));line.put("itemCode",item.get("code"));line.put("baseUnit",unit.get("name"));line.put("baseUnitId",unit.get("id"));line.put("unitCode",unit.get("code"));line.put("inputUnit",inputUnit);line.put("factor",factor.toPlainString());line.put("quantity",in.quantity().toPlainString());line.put("baseQuantity",quantity.toPlainString());line.put("conversionId",in.conversionId());line.put("lotCode",lot);line.put("expiryDate",expiry);line.put("unitPrice",in.unitPrice()==null?null:in.unitPrice().toPlainString());line.put("discount",zero(in.discount()).toPlainString());line.put("tax",zero(in.tax()).toPlainString());line.put("lineValue",amount.toPlainString());line.put("balanceVersion",in.balanceVersion());line.put("increase",in.increase());
            if(r.kind()==StockDtos.Kind.TRANSFER){if(r.branchId().equals(r.destinationBranchId())&&in.destinationItemId()!=null&&!in.destinationItemId().equals(in.itemId()))throw StockFailure.invalid("DESTINATION_ITEM_INCOMPATIBLE");long target=in.destinationItemId()==null&&r.branchId().equals(r.destinationBranchId())?in.itemId():Objects.requireNonNullElse(in.destinationItemId(),-1L);var dest=item(target,r.destinationBranchId());var du=db.one("SELECT * FROM inventory_units WHERE id=?",dest.get("baseUnitId"));
                if(!unit.get("name").toString().equalsIgnoreCase(du.get("name").toString())||!unit.get("dimension").equals(du.get("dimension"))||bool(item,"trackLots")!=bool(dest,"trackLots")||bool(item,"trackExpiry")!=bool(dest,"trackExpiry"))throw StockFailure.invalid("DESTINATION_ITEM_INCOMPATIBLE");line.put("destinationItemId",target);line.put("destinationItemName",dest.get("name"));}
            prepared.add(line);sum=sum.add(amount);if(r.kind()==StockDtos.Kind.RECEIPT){gross=gross.add(money(in.quantity().multiply(in.unitPrice())));discountTotal=discountTotal.add(zero(in.discount()));taxTotal=taxTotal.add(zero(in.tax()));}
        }
        BigDecimal allocated=BigDecimal.ZERO;BigDecimal total=BigDecimal.ZERO;Map<String,BigDecimal> quantities=new LinkedHashMap<>();boolean allow=negative(r.branchId());
        for(int index=0;index<prepared.size();index++){
            var line=prepared.get(index);var in=r.lines().get(index);long item=in.itemId();BigDecimal q=dec(line,"baseQuantity");var pool=book.pool(r.branchId(),r.warehouseId(),item);line.put("availableQuantity",pool.quantity.toPlainString());line.put("currentBalanceVersion",pool.version);
            BigDecimal v=BigDecimal.ZERO,delta=q;
            if(r.kind()==StockDtos.Kind.RECEIPT){BigDecimal charge=index==prepared.size()-1?zero(r.charges()).subtract(allocated):sum.signum()==0?BigDecimal.ZERO:money(zero(r.charges()).multiply(dec(line,"lineValue")).divide(sum,8,RoundingMode.HALF_UP));allocated=allocated.add(charge);v=value(dec(line,"lineValue").add(charge));
                if(pool.quantity.signum()<0&&cost(pool.value,pool.quantity).compareTo(cost(v,q))!=0)throw StockFailure.conflict("NEGATIVE_VALUATION_REQUIRES_CORRECTION");}
            else if(r.kind()==StockDtos.Kind.ISSUE||r.kind()==StockDtos.Kind.TRANSFER){if(pool.quantity.signum()==0&&q.compareTo(pool.quantity)>0&&allow)throw StockFailure.invalid("UNKNOWN_COST_NEGATIVE_STOCK");v=issueValue(pool.quantity,pool.value,q);delta=q.negate();v=v.negate();}
            else if(r.kind()==StockDtos.Kind.STOCKTAKE){if(in.balanceVersion()==null||in.balanceVersion()!=pool.version)throw StockFailure.conflict("STOCKTAKE_STALE_RECOUNT");BigDecimal basis=line.get("lotCode")==null?pool.quantity:book.lotQuantity(r.warehouseId(),item,text(line,"lotCode"),text(line,"expiryDate"));delta=q.subtract(basis);line.put("systemQuantity",basis.toPlainString());line.put("difference",delta.toPlainString());v=adjustmentValue(pool,delta,in.unitPrice());}
            else{if(in.increase()==null)throw StockFailure.invalid("ADJUSTMENT_DIRECTION_REQUIRED");delta=in.increase()==1?q:q.negate();v=adjustmentValue(pool,delta,in.unitPrice());}
            line.put("lineValue",v.abs().toPlainString());line.put("averageCost",cost(v.abs(),delta.abs()).toPlainString());total=total.add(v.abs());quantities.merge(text(line,"baseUnitId"),q,BigDecimal::add);
            if(apply&&delta.signum()!=0)book.move(r.branchId(),r.warehouseId(),item,text(line,"lotCode"),text(line,"expiryDate"),index+1,"FORWARD",qty(delta),value(v),allow);
        }
        Map<String,BigDecimal> displayQuantities=new LinkedHashMap<>();Set<String> emittedUnits=new HashSet<>();
        for(var line:prepared){String unitId=text(line,"baseUnitId");if(!emittedUnits.add(unitId))continue;String name=text(line,"baseUnit");boolean ambiguous=prepared.stream().anyMatch(other->name.equals(text(other,"baseUnit"))&&!unitId.equals(text(other,"baseUnitId")));
            displayQuantities.put(ambiguous?name+" ("+text(line,"unitCode")+")":name,quantities.get(unitId));}
        if(value(total).precision()>24)throw StockFailure.invalid("AMOUNT_TOO_LARGE");
        Map<String,Object> result=new LinkedHashMap<>();result.put("branchId",r.branchId());result.put("kind",r.kind().name());result.put("status",r.draft()?"DRAFT":r.kind()==StockDtos.Kind.TRANSFER?"IN_TRANSIT":"RECORDED");result.put("warehouseId",r.warehouseId());result.put("warehouseName",warehouse(r.warehouseId(),r.branchId()).get("name"));result.put("destinationBranchId",r.destinationBranchId());result.put("destinationWarehouseId",r.destinationWarehouseId());result.put("supplierId",r.supplierId());result.put("supplierName",r.supplierId()==null?null:reference("suppliers",r.supplierId(),r.branchId()).get("name"));result.put("businessAt",r.businessAt().toString());result.put("issueType",r.issueType());result.put("note",r.note());result.put("reason",r.reason());result.put("charges",zero(r.charges()).toPlainString());result.put("totalValue",money(total).toPlainString());result.put("subtotal",money(gross).toPlainString());result.put("discountTotal",money(discountTotal).toPlainString());result.put("taxTotal",money(taxTotal).toPlainString());result.put("quantities",displayQuantities);result.put("lines",prepared);result.put("input",db.parse(db.json(r)));return result;
    }
    private void validateHeader(StockDtos.Save request){
        if(request.businessAt().isAfter(Instant.now(clock).plusSeconds(300)))throw StockFailure.invalid("FUTURE_DATE");
        if((request.kind()==StockDtos.Kind.STOCKTAKE||request.kind()==StockDtos.Kind.ADJUSTMENT)&&blank(request.reason()))throw StockFailure.invalid("REASON_REQUIRED");
    }
    private BigDecimal adjustmentValue(StockBook.Pool p,BigDecimal delta,BigDecimal price){if(delta.signum()<0)return issueValue(p.quantity,p.value,delta.negate()).negate();if(delta.signum()==0)return ZERO;
        if(p.quantity.signum()==0&&price==null)throw StockFailure.invalid("ADJUSTMENT_COST_REQUIRED");return value(delta.multiply(price==null?cost(p.value,p.quantity):price));}

    @Transactional
    public Map<String,Object> cancel(long id,@Valid StockDtos.Cancel r,String key){require(PermissionCodes.INVENTORY_DOCUMENT_CANCEL);var d=locked(id,r.branchId());String digest=digest("cancel:"+id,r);var cached=replay(id(d,"branchId"),key,digest);if(cached!=null)return cached;
        OperationsAccess.version(id(d,"version"),r.version());if("CANCELLED".equals(d.get("status")))throw StockFailure.conflict("ALREADY_CANCELLED");
        Map<String,Object> before=db.parse(d.get("currentSnapshot"));StockBook book=new StockBook(db);if(!"DRAFT".equals(d.get("status"))){requireNoSettlement(id);requireLatest(id,effects(before));finance.orderedStream().forEach(f->f.requireRevisionAllowed(id,id(d,"version")));book.reverse(effects(before),negative(id(d,"branchId")));}
        Map<String,Object> snapshot=new LinkedHashMap<>(before);snapshot.put("status","CANCELLED");snapshot.put("reason",r.reason());snapshot.put("version",id(d,"version")+1);snapshot.put("effectiveEffects",List.of());snapshot.put("updatedBy",access.actor());Instant now=Instant.now(clock);snapshot.put("updatedAt",now.toString());
        commit(id,id(d,"version")+1,"CANCELLED",r.reason(),before,snapshot,book,now);remember(id(d,"branchId"),key,digest,snapshot,now);return snapshot;}

    @Transactional
    public Map<String,Object> settle(long id,@Valid StockDtos.Settlement r,String key,boolean returning){require(PermissionCodes.INVENTORY_TRANSFER_RECEIVE);var d=locked(id,r.branchId());String digest=digest((returning?"return:":"receive:")+id,r);var cached=replay(id(d,"branchId"),key,digest);if(cached!=null)return cached;
        OperationsAccess.version(id(d,"version"),r.version());if(!Set.of("IN_TRANSIT","PARTIALLY_RECEIVED").contains(d.get("status")))throw StockFailure.conflict("TRANSFER_NOT_OPEN");
        Map<String,Object> before=db.parse(d.get("currentSnapshot"));Map<String,Object> snapshot=new LinkedHashMap<>(before);StockBook book=new StockBook(db);Set<Integer> used=new HashSet<>();
        for(var line:r.lines()){if(!used.add(line.lineNumber()))throw StockFailure.invalid("DUPLICATE_LINE");var transit=db.one("SELECT * FROM stock_transit WHERE document_id=? AND line_number=? FOR UPDATE",id,line.lineNumber());BigDecimal remaining=dec(transit,"dispatched").subtract(dec(transit,"received")).subtract(dec(transit,"returned"));if(line.quantity().compareTo(remaining)>0)throw StockFailure.invalid("TRANSIT_QUANTITY_EXCEEDED");
            var source=lines(before).get(line.lineNumber()-1);BigDecimal v=line.quantity().compareTo(remaining)==0?dec(transit,"remainingValue"):value(dec(transit,"remainingValue").multiply(line.quantity()).divide(remaining,8,RoundingMode.HALF_UP));
            long branch=returning?id(d,"branchId"):id(d,"destinationBranchId"),warehouse=returning?id(d,"warehouseId"):id(d,"destinationWarehouseId"),item=returning?id(transit,"itemId"):id(transit,"destinationItemId");
            book.move(branch,warehouse,item,text(source,"lotCode"),text(source,"expiryDate"),line.lineNumber(),returning?"RETURN_TRANSIT":"RECEIVE",line.quantity(),v,false);
            db.jdbc().update("UPDATE stock_transit SET "+(returning?"returned":"received")+"="+(returning?"returned":"received")+"+?, remaining_value=remaining_value-? WHERE document_id=? AND line_number=?",line.quantity(),v,id,line.lineNumber());}
        var transit=db.rows("SELECT * FROM stock_transit WHERE document_id=? ORDER BY line_number",id);boolean done=transit.stream().allMatch(t->dec(t,"dispatched").compareTo(dec(t,"received").add(dec(t,"returned")))==0);snapshot.put("status",done?"RECEIVED":"PARTIALLY_RECEIVED");snapshot.put("transit",transit);snapshot.put("version",id(d,"version")+1);snapshot.put("updatedBy",access.actor());Instant now=Instant.now(clock);snapshot.put("updatedAt",now.toString());
        commit(id,id(d,"version")+1,returning?"RETURN_TRANSIT":"RECEIVED",r.reason(),before,snapshot,book,now);remember(id(d,"branchId"),key,digest,snapshot,now);return snapshot;}

    private void commit(long id,long revision,String action,String reason,Map<String,Object> before,Map<String,Object> snapshot,StockBook book,Instant now){
        String issueType=text(snapshot,"issueType");
        for(var effect:book.effects)if(!effect.containsKey("issueType"))effect.put("issueType",issueType);
        db.jdbc().update("INSERT INTO stock_revisions(document_id,revision,action,actor_id,recorded_at,reason,before_snapshot,snapshot,effects) VALUES (?,?,?,?,?,?,?,?,?)",id,revision,action,access.actor(),time(now),reason,before==null?null:db.json(before),db.json(snapshot),db.json(book.effects));
        book.flush(id,revision,access.actor(),now,issueType);
        db.jdbc().update("UPDATE stock_documents SET status=?,warehouse_id=?,destination_warehouse_id=?,destination_branch_id=?,supplier_id=?,business_at=?,updated_at=?,updated_by=?,version=?,current_snapshot=? WHERE id=?",snapshot.get("status"),snapshot.get("warehouseId"),snapshot.get("destinationWarehouseId"),snapshot.get("destinationBranchId"),snapshot.get("supplierId"),time(Instant.parse(snapshot.get("businessAt").toString())),time(now),access.actor(),revision,db.json(snapshot),id);
        audit.audit(id(snapshot,"branchId"),"inventory","documents",id,action,"revision:"+revision);
        db.jdbc().update("UPDATE stock_documents SET total_value=? WHERE id=?",dec(snapshot,"totalValue"),id);
        for(var p:book.pools())events.publishEvent(new StockChangedEvent(p.branch,p.warehouse,p.item,id,revision,access.actor(),p.originalQuantity,p.quantity,now));
        if("STOCKTAKE".equals(snapshot.get("kind"))&&book.effects.stream().anyMatch(e->dec(e,"quantityDelta").signum()!=0))events.publishEvent(new StockAlertEvent(id(snapshot,"branchId"),id,revision,"STOCKTAKE_DIFFERENCE"));
        if("RETURN_TRANSIT".equals(action))events.publishEvent(new StockAlertEvent(id(snapshot,"branchId"),id,revision,"TRANSFER_RETURNED"));
    }
    private void requireLatest(long document,List<Map<String,Object>> effects){for(var e:effects){var latest=db.rows("SELECT document_id FROM stock_ledger WHERE warehouse_id=? AND item_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE",id(e,"warehouseId"),id(e,"itemId"));if(!latest.isEmpty()&&id(latest.get(0),"documentId")!=document)throw StockFailure.conflict("DOWNSTREAM_MOVEMENT_USE_ADJUSTMENT_OR_SUPPLIER_RETURN");}}
    private void requireNoSettlement(long id){if(!db.rows("SELECT document_id FROM stock_transit WHERE document_id=? AND (received>0 OR returned>0) FOR UPDATE",id).isEmpty())throw StockFailure.conflict("TRANSFER_SETTLED_RETURN_REMAINDER_OR_CREATE_ADJUSTMENT");}
    private String number(long branch,StockDtos.Kind kind){String type="STOCK_"+kind;var rows=db.rows("SELECT * FROM operations_sequences WHERE branch_id=? AND kind=? FOR UPDATE",branch,type);long next=rows.isEmpty()?1:id(rows.get(0),"nextValue");if(rows.isEmpty())db.jdbc().update("INSERT INTO operations_sequences(branch_id,kind,next_value) VALUES (?,?,?)",branch,type,next+1);else db.jdbc().update("UPDATE operations_sequences SET next_value=? WHERE branch_id=? AND kind=?",next+1,branch,type);return db.one("SELECT code FROM branches WHERE id=?",branch).get("code")+"-"+kind.name().substring(0,2)+"-"+String.format(Locale.ROOT,"%06d",next);}
    private Map<String,Object> replay(long branch,String key,String digest){if(key==null||!key.matches("[A-Za-z0-9_-]{8,100}"))throw StockFailure.invalid("IDEMPOTENCY_KEY_REQUIRED");var rows=db.rows("SELECT * FROM stock_commands WHERE branch_id=? AND command_key=? FOR UPDATE",branch,key);if(rows.isEmpty())return null;var row=rows.get(0);if(!digest.equals(row.get("payloadDigest")))throw StockFailure.conflict("IDEMPOTENCY_PAYLOAD_CHANGED");return db.parse(row.get("resultSnapshot"));}
    private void remember(long branch,String key,String digest,Map<String,Object> snapshot,Instant now){db.jdbc().update("INSERT INTO stock_commands(branch_id,command_key,payload_digest,result_snapshot,recorded_at) VALUES (?,?,?,?,?)",branch,key,digest,db.json(snapshot),time(now));}
    private String digest(String operation,Object request){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((access.actor()+":"+operation+":"+db.json(request)).getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private boolean blank(String s){return s==null||s.isBlank();}
    @SuppressWarnings("unchecked") private Map<String,Object> economic(Object input){
        var out=new LinkedHashMap<>((Map<String,Object>)input);for(String key:List.of("version","note","reason","businessAt","supplierId"))out.remove(key);
        out.put("charges",dec(out,"charges").stripTrailingZeros());
        out.put("lines",((List<Map<String,Object>>)out.get("lines")).stream().map(source->{var line=new LinkedHashMap<>(source);for(String key:List.of("quantity","discount","tax"))line.put(key,dec(line,key).stripTrailingZeros());if(line.get("unitPrice")!=null)line.put("unitPrice",dec(line,"unitPrice").stripTrailingZeros());return line;}).toList());return out;
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> effects(Map<String,Object> snapshot){return (List<Map<String,Object>>)snapshot.getOrDefault("effectiveEffects",List.of());}
    @SuppressWarnings("unchecked") public static List<Map<String,Object>> lines(Map<String,Object> snapshot){return (List<Map<String,Object>>)snapshot.get("lines");}
}
