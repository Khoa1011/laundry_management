package com.laundry.management.sorting.api;

import com.laundry.management.sorting.application.SortingService;
import com.laundry.management.sorting.domain.SortingAttributes.*;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sorting")
public class SortingController {
    private final SortingService sorting;
    public SortingController(SortingService sorting) { this.sorting = sorting; }

    @GetMapping("/scan")
    public SortingDtos.BagContext scan(@RequestParam String code, @RequestParam(required = false) Long branchId) {
        return sorting.scan(code, branchId);
    }
    @GetMapping("/groups/scan")
    public SortingDtos.Group scanGroup(@RequestParam String code, @RequestParam(required = false) Long branchId) {
        return sorting.scanGroup(code, branchId);
    }
    @PostMapping("/bags/{bagId}/confirm")
    public SortingDtos.BagContext confirm(@PathVariable Long bagId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody SortingDtos.ConfirmRequest request) { return sorting.confirm(bagId, branchId, request); }
    @PostMapping("/bags/{bagId}/reopen")
    public SortingDtos.BagContext reopen(@PathVariable Long bagId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId,
        @Valid @RequestBody SortingDtos.ReopenRequest request) { return sorting.reopen(bagId, branchId, request); }
    @PostMapping("/groups/{groupId}/print-requests")
    public SortingDtos.Group print(@PathVariable Long groupId,
        @RequestHeader(value = "X-Branch-Id", required = false) Long branchId) { return sorting.requestPrint(groupId, branchId); }
    @GetMapping("/waiting")
    public SortingDtos.PageResponse waiting(@RequestParam(required = false) Long branchId,
        @RequestParam(required = false) String search, @RequestParam(required = false) Long serviceId,
        @RequestParam(required = false) Long itemTypeId, @RequestParam(required = false) ColorGroup color,
        @RequestParam(required = false) WashMode washMode, @RequestParam(required = false) Boolean separateWash,
        @RequestParam(required = false) Instant promisedFrom, @RequestParam(required = false) Instant promisedTo,
        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return sorting.waiting(branchId, search, serviceId, itemTypeId, color, washMode, separateWash,
            promisedFrom, promisedTo, page, size);
    }
    @GetMapping("/waiting/stats")
    public SortingDtos.Stats stats(@RequestParam(required = false) Long branchId) { return sorting.stats(branchId); }
    @GetMapping("/waiting/filter-options")
    public SortingDtos.FilterOptions filterOptions(@RequestParam(required = false) Long branchId) {
        return sorting.filterOptions(branchId);
    }
}
