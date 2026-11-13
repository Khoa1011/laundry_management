package com.laundry.management.inventory.operations;

import com.laundry.management.operations.application.OperationsAccess;
import com.laundry.management.auth.security.permission.PermissionCodes;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class StockVisibility {
    private final OperationsAccess access;
    public StockVisibility(OperationsAccess access){this.access=access;}
    private static final Set<String> MONEY=Set.of("subtotal","discountTotal","taxTotal","unitPrice","discount","tax","charges","lineValue","totalValue","stockValue","averageCost","valueDelta","valueAfter","remainingValue","openingValue","incomingValue","outgoingValue","closingValue","adjustmentValue","transitValue","receiptValue","issueValue","ledgerValue");
    public Object response(Object value){return clean(value,access.has(PermissionCodes.INVENTORY_COST_READ));}
    private Object clean(Object value,boolean costs){
        if(value instanceof Map<?,?> map){Map<String,Object> out=new LinkedHashMap<>();map.forEach((k,v)->{String key=k.toString();if(!key.equals("effectiveEffects"))out.put(key,!costs&&MONEY.contains(key)?null:v instanceof Number&&(MONEY.contains(key)||key.equals("quantity")||key.equals("factor"))?v instanceof BigDecimal n?n.toPlainString():v.toString():clean(v,costs));});return out;}
        if(value instanceof Collection<?> list)return list.stream().map(v->clean(v,costs)).toList();
        if(value instanceof BigDecimal n)return n.toPlainString();return value;
    }
}
