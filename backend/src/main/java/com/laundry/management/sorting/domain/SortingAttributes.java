package com.laundry.management.sorting.domain;

public final class SortingAttributes {
    private SortingAttributes() {}
    public enum ColorGroup { WHITE, LIGHT, DARK, COLORED, MIXED, UNKNOWN }
    public enum FabricCare { STANDARD, DELICATE, WOOL, DENIM, SYNTHETIC, BEDDING, MIXED, UNKNOWN }
    public enum WashMode { SERVICE_DEFAULT, NORMAL, GENTLE, HEAVY, HYGIENE }
    public enum TemperatureProfile { SERVICE_DEFAULT, COLD, T30, T40, T60, T90 }
    public enum DetergentProfile { DEFAULT, HYPOALLERGENIC, NO_FRAGRANCE, CUSTOMER_SUPPLIED, NONE }
    public enum SoftenerProfile { DEFAULT, NONE, NO_FRAGRANCE, CUSTOMER_SUPPLIED }
    public enum HygieneLevel { STANDARD, HIGH }
    public enum DryingInstruction { TUMBLE_NORMAL, TUMBLE_LOW, HANG_DRY, DO_NOT_DRY }
    public enum GroupStatus { WAITING, VOIDED }
}
