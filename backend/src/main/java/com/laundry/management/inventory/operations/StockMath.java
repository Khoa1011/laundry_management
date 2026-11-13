package com.laundry.management.inventory.operations;

import java.math.*;

public final class StockMath {
    private StockMath() {}
    public static final BigDecimal ZERO=new BigDecimal("0.000000");
    public static BigDecimal qty(BigDecimal n) { return n.setScale(6,RoundingMode.UNNECESSARY); }
    public static BigDecimal value(BigDecimal n) { return n.setScale(6,RoundingMode.HALF_UP); }
    public static BigDecimal money(BigDecimal n) { return n.setScale(2,RoundingMode.HALF_UP); }
    public static BigDecimal cost(BigDecimal value,BigDecimal quantity) { return quantity.signum()==0?BigDecimal.ZERO:value.divide(quantity,8,RoundingMode.HALF_UP); }
    public static BigDecimal issueValue(BigDecimal quantity,BigDecimal value,BigDecimal requested) {
        return quantity.compareTo(requested)==0?value:value(requested.multiply(cost(value,quantity)));
    }
    public static BigDecimal zero(BigDecimal n) { return n==null?BigDecimal.ZERO:n; }
}
