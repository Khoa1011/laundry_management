package com.laundry.management.order.api;

import com.laundry.management.order.application.*;
import com.laundry.management.order.domain.OrderStatus;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/orders")
public class OrderController {
    private final OrderApplicationService commands; private final OrderQueryService queries;
    public OrderController(OrderApplicationService commands,OrderQueryService queries){this.commands=commands;this.queries=queries;}
    @GetMapping public OrderDtos.PageResponse list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(required=false) String search,@RequestParam(required=false) OrderStatus status,@RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to,@RequestParam(required=false) Long branchId){return queries.list(page,size,search,status,from,to,branchId);}
    @GetMapping("/{id}") public OrderDtos.Response get(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId){return queries.get(id,branchId);}
    @PostMapping public ResponseEntity<OrderDtos.Response> create(@Valid @RequestBody OrderDtos.CreateRequest request){OrderDtos.Response created=commands.create(request);return ResponseEntity.created(URI.create("/api/orders/"+created.id())).body(created);}
    @PatchMapping("/{id}") public OrderDtos.Response update(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long branchId,@Valid @RequestBody OrderDtos.UpdateRequest request){return commands.update(id,branchId,request);}
    @PostMapping("/{id}/start-processing") public OrderDtos.Response start(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b,@Valid @RequestBody OrderDtos.TransitionRequest r){return commands.start(id,b,r);}
    @PostMapping("/{id}/mark-ready") public OrderDtos.Response ready(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b,@Valid @RequestBody OrderDtos.TransitionRequest r){return commands.ready(id,b,r);}
    @PostMapping("/{id}/complete") public OrderDtos.Response complete(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b,@Valid @RequestBody OrderDtos.TransitionRequest r){return commands.complete(id,b,r);}
    @PostMapping("/{id}/cancel") public OrderDtos.Response cancel(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b,@Valid @RequestBody OrderDtos.ReasonedTransitionRequest r){return commands.cancel(id,b,r);}
    @PostMapping("/{id}/reopen") public OrderDtos.Response reopen(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b,@Valid @RequestBody OrderDtos.ReasonedTransitionRequest r){return commands.reopen(id,b,r);}
    @GetMapping("/{id}/history") public List<OrderDtos.HistoryResponse> history(@PathVariable Long id,@RequestHeader(value="X-Branch-Id",required=false) Long b){return queries.history(id,b);}
}
