package com.laundry.management.inventory.operations;

/** A future Finance adapter participates in the same transaction and may reject settled-source revisions. */
public interface InventoryFinanceContract {
    void requireRevisionAllowed(long documentId,long currentRevision);
}
