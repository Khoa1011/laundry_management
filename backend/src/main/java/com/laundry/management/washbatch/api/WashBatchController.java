package com.laundry.management.washbatch.api;

import com.laundry.management.washbatch.application.*;
import com.laundry.management.washbatch.domain.WashBatchStatus;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wash-batches")
public class WashBatchController {
    private final WashBatchApplicationService commands; private final WashBatchQueryService queries;
    public WashBatchController(WashBatchApplicationService commands,WashBatchQueryService queries){this.commands=commands;this.queries=queries;}
    @GetMapping public WashBatchDtos.PageResponse list(@RequestParam(required=false) Long branchId,@RequestParam(required=false) WashBatchStatus status,@RequestParam(required=false) String search,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return queries.list(branchId,status,search,page,size);}
    @GetMapping("/candidates") public WashBatchDtos.CandidatePage candidates(@RequestParam(required=false) Long branchId,@RequestParam(required=false) String search,@RequestParam(required=false) Long serviceId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return queries.candidates(branchId,search,serviceId,page,size);}
    @GetMapping("/stats") public WashBatchDtos.Stats stats(@RequestParam(required=false) Long branchId){return queries.stats(branchId);}
    @GetMapping("/{id}") public WashBatchDtos.Detail detail(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId){return queries.detail(id,branchId);}
    @GetMapping("/{id}/history") public List<WashBatchDtos.History> history(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId){return queries.history(id,branchId);}
    @GetMapping("/by-order/{orderId}") public List<WashBatchDtos.Reference> byOrder(@PathVariable Long orderId,@RequestHeader(value="X-Branch-Id",required=false) Long branchId){return queries.byOrder(orderId,branchId);}
    @PostMapping public ResponseEntity<WashBatchDtos.Detail> create(@Valid @RequestBody WashBatchDtos.CreateRequest request){WashBatchDtos.Detail value=commands.create(request);return ResponseEntity.created(URI.create("/api/wash-batches/"+value.id())).body(value);}
    @PostMapping("/{id}/add-items") public WashBatchDtos.Detail addItems(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody WashBatchDtos.ItemsRequest request){return commands.addItems(id,branchId,request);}
    @PostMapping("/{id}/remove-items") public WashBatchDtos.Detail removeItems(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody WashBatchDtos.ItemsRequest request){return commands.removeItems(id,branchId,request);}
    @PatchMapping("/{id}/note") public WashBatchDtos.Detail updateNote(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody WashBatchDtos.NoteRequest request){return commands.updateNote(id,branchId,request);}
    @PostMapping("/{id}/mark-ready") public WashBatchDtos.Detail markReady(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody WashBatchDtos.VersionRequest request){return commands.markReady(id,branchId,request);}
    @PostMapping("/{id}/cancel") public WashBatchDtos.Detail cancel(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody WashBatchDtos.CancelRequest request){return commands.cancel(id,branchId,request);}
}
