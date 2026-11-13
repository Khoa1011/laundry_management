package com.laundry.management.inventory.operations;

import static com.laundry.management.inventory.operations.StockStore.*;
import static com.laundry.management.inventory.operations.StockMath.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** A locked transaction-local plan. Build all effects before inserting an immutable revision and ledger. */
public final class StockBook {
    private final StockStore store;
    private final Map<String,Pool> pools=new LinkedHashMap<>();
    private final Map<String,Lot> lots=new LinkedHashMap<>();
    public final List<Map<String,Object>> effects=new ArrayList<>();
    public StockBook(StockStore store) {this.store=store;}
    public static final class Pool {
        public final long branch,warehouse,item,version;public BigDecimal quantity,value;public final BigDecimal originalQuantity,originalValue;boolean touched;
        Pool(long b,long w,long i,long v,BigDecimal q,BigDecimal n){branch=b;warehouse=w;item=i;version=v;quantity=q;value=n;originalQuantity=q;originalValue=n;}
    }
    private static final class Lot {
        long warehouse,item,version;String code,expiry;BigDecimal quantity;boolean touched;
    }
    public Pool pool(long branch,long warehouse,long item) {
        String key=warehouse+":"+item;
        return pools.computeIfAbsent(key,k->{var rows=store.rows("SELECT * FROM stock_balances WHERE warehouse_id=? AND item_id=? FOR UPDATE",warehouse,item);
            if(rows.isEmpty())return new Pool(branch,warehouse,item,-1,ZERO,ZERO);
            var r=rows.get(0);return new Pool(branch,warehouse,item,id(r,"version"),dec(r,"quantity"),dec(r,"stockValue"));});
    }
    public BigDecimal lotQuantity(long warehouse,long item,String code,String expiry) {return lot(warehouse,item,code,expiry).quantity;}
    private Lot lot(long warehouse,long item,String code,String expiry) {
        return lots.computeIfAbsent(warehouse+":"+item+":"+code,k->{var l=new Lot();l.warehouse=warehouse;l.item=item;l.code=code;l.expiry=expiry;
            var rows=store.rows("SELECT * FROM stock_lots WHERE warehouse_id=? AND item_id=? AND lot_code=? FOR UPDATE",warehouse,item,code);
            l.version=rows.isEmpty()?-1:id(rows.get(0),"version");l.quantity=rows.isEmpty()?ZERO:dec(rows.get(0),"quantity");
            if(!rows.isEmpty()&&!Objects.equals(expiry,text(rows.get(0),"expiryDate")))throw StockFailure.invalid("LOT_EXPIRY_MISMATCH");return l;});
    }
    public void move(long branch,long warehouse,long item,String lot,String expiry,int line,String phase,
        BigDecimal quantity,BigDecimal value,boolean allowNegative) {
        Pool p=pool(branch,warehouse,item);BigDecimal next=qty(p.quantity.add(quantity));BigDecimal nextValue=value(p.value.add(value));
        if(!allowNegative&&next.signum()<0)throw StockFailure.invalid("INSUFFICIENT_STOCK:"+line);
        if(next.signum()==0&&nextValue.signum()!=0)throw StockFailure.conflict("VALUATION_RESIDUE_USE_ADJUSTMENT");
        if(next.signum()>0&&nextValue.signum()<0||next.signum()<0&&nextValue.signum()>0)throw StockFailure.conflict("UNSAFE_VALUATION_USE_ADJUSTMENT");
        if(next.precision()>19||nextValue.precision()>24)throw StockFailure.invalid("AMOUNT_TOO_LARGE");
        if(lot!=null){Lot l=lot(warehouse,item,lot,expiry);l.quantity=qty(l.quantity.add(quantity));l.touched=true;if(l.quantity.signum()<0)throw StockFailure.invalid("INSUFFICIENT_LOT_STOCK:"+line);}
        p.quantity=next;p.value=nextValue;p.touched=true;
        Map<String,Object> e=new LinkedHashMap<>();e.put("branchId",branch);e.put("warehouseId",warehouse);e.put("itemId",item);e.put("lotCode",lot);e.put("expiryDate",expiry);e.put("lineNumber",line);e.put("phase",phase);
        e.put("quantityDelta",quantity.toPlainString());e.put("valueDelta",value.toPlainString());e.put("quantityAfter",next.toPlainString());e.put("valueAfter",nextValue.toPlainString());effects.add(e);
    }
    public void reverse(List<Map<String,Object>> old,boolean allowNegative) {
        List<Map<String,Object>> reversed=new ArrayList<>(old);Collections.reverse(reversed);int n=0;
        for(var e:reversed){move(id(e,"branchId"),id(e,"warehouseId"),id(e,"itemId"),text(e,"lotCode"),text(e,"expiryDate"),++n,"REVERSAL",dec(e,"quantityDelta").negate(),dec(e,"valueDelta").negate(),allowNegative);effects.get(effects.size()-1).put("issueType",e.get("issueType"));}
    }
    public void flush(long document,long revision,long actor,Instant now,String issueType) {
        for(Pool p:pools.values()){
            if(!p.touched)continue;
            if(p.version<0)store.jdbc().update("INSERT INTO stock_balances(branch_id,warehouse_id,item_id,quantity,stock_value,version) VALUES (?,?,?,?,?,0)",p.branch,p.warehouse,p.item,p.quantity,p.value);
            else if(store.jdbc().update("UPDATE stock_balances SET quantity=?,stock_value=?,version=version+1 WHERE warehouse_id=? AND item_id=? AND version=?",p.quantity,p.value,p.warehouse,p.item,p.version)!=1)throw StockFailure.conflict("BALANCE_CHANGED");
        }
        for(Lot l:lots.values()){
            if(!l.touched)continue;
            if(l.version<0)store.jdbc().update("INSERT INTO stock_lots(warehouse_id,item_id,lot_code,expiry_date,quantity,version) VALUES (?,?,?,?,?,0)",l.warehouse,l.item,l.code,l.expiry,l.quantity);
            else if(store.jdbc().update("UPDATE stock_lots SET quantity=?,version=version+1 WHERE warehouse_id=? AND item_id=? AND lot_code=? AND version=?",l.quantity,l.warehouse,l.item,l.code,l.version)!=1)throw StockFailure.conflict("LOT_CHANGED");
        }
        for(var e:effects)store.jdbc().update("INSERT INTO stock_ledger(document_id,revision,branch_id,warehouse_id,item_id,lot_code,expiry_date,line_number,phase,quantity_delta,value_delta,quantity_after,value_after,recorded_at,actor_id,issue_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            document,revision,id(e,"branchId"),id(e,"warehouseId"),id(e,"itemId"),e.get("lotCode"),e.get("expiryDate"),e.get("lineNumber"),e.get("phase"),dec(e,"quantityDelta"),dec(e,"valueDelta"),dec(e,"quantityAfter"),dec(e,"valueAfter"),time(now),actor,e.getOrDefault("issueType",issueType));
    }
    public Collection<Pool> pools() {return pools.values().stream().filter(p->p.touched).toList();}
}
