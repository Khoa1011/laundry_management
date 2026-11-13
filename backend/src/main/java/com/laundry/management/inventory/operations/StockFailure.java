package com.laundry.management.inventory.operations;

import com.laundry.management.common.exception.*;
import org.springframework.http.HttpStatus;

public final class StockFailure {
    private StockFailure() {}
    public static ApiException conflict(String reason) { return new ApiException(HttpStatus.CONFLICT,ErrorCode.STOCK_CONFLICT,"Stock conflict",reason); }
    public static ApiException invalid(String reason) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,ErrorCode.STOCK_INVALID,"Invalid stock operation",reason); }
}
