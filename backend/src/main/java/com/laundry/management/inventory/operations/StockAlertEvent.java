package com.laundry.management.inventory.operations;
public record StockAlertEvent(long branchId,long documentId,long revision,String reason) {}
