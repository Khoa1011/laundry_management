package com.laundry.management.inventory.operations;

import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/inventory")
public class StockController {
    private final StockService commands;private final StockQueries queries;private final StockVisibility visibility;private final com.laundry.management.common.response.ApiProblemFactory problems;
    public StockController(StockService commands,StockQueries queries,StockVisibility visibility,com.laundry.management.common.response.ApiProblemFactory problems){this.commands=commands;this.queries=queries;this.visibility=visibility;this.problems=problems;}
    @ExceptionHandler({org.springframework.web.bind.MissingServletRequestParameterException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<com.laundry.management.common.response.ApiProblem> malformedQuery(Exception error,jakarta.servlet.http.HttpServletRequest request){return ResponseEntity.badRequest().body(problems.create(HttpStatus.BAD_REQUEST,com.laundry.management.common.exception.ErrorCode.VALIDATION_ERROR,"Invalid query","The inventory query contains a missing or invalid value.",request));}
    @PostMapping("/documents/preview") public Object preview(@Valid @RequestBody StockDtos.Save body,@RequestParam(required=false) Long documentId){return visibility.response(commands.preview(body,documentId));}
    @PostMapping("/documents") public ResponseEntity<Object> create(@Valid @RequestBody StockDtos.Save body,@RequestHeader(value="Idempotency-Key",required=false) String key){return ResponseEntity.status(201).body(visibility.response(commands.save(null,body,key)));}
    @PutMapping("/documents/{id}") public Object update(@PathVariable long id,@Valid @RequestBody StockDtos.Save body,@RequestHeader(value="Idempotency-Key",required=false) String key){return visibility.response(commands.save(id,body,key));}
    @PostMapping("/documents/{id}/cancel") public Object cancel(@PathVariable long id,@Valid @RequestBody StockDtos.Cancel body,@RequestHeader(value="Idempotency-Key",required=false) String key){return visibility.response(commands.cancel(id,body,key));}
    @PostMapping("/documents/{id}/receive") public Object receive(@PathVariable long id,@Valid @RequestBody StockDtos.Settlement body,@RequestHeader(value="Idempotency-Key",required=false) String key){return visibility.response(commands.settle(id,body,key,false));}
    @PostMapping("/documents/{id}/return-transit") public Object returnTransit(@PathVariable long id,@Valid @RequestBody StockDtos.Settlement body,@RequestHeader(value="Idempotency-Key",required=false) String key){return visibility.response(commands.settle(id,body,key,true));}
    @GetMapping("/documents/{id}") public Object detail(@PathVariable long id,@RequestParam Long branchId){return visibility.response(queries.detail(id,branchId));}
    @GetMapping("/documents/{id}/history") public Object history(@PathVariable long id,@RequestParam Long branchId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return visibility.response(queries.history(id,branchId,page,size));}
    @GetMapping({"/documents","/balances","/ledger","/reports","/dashboard","/reconciliation","/reports/export.csv"})
    public Object list(jakarta.servlet.http.HttpServletRequest request,@RequestParam Long branchId,@RequestParam(required=false) Long warehouseId,@RequestParam(required=false) Long itemId,@RequestParam(required=false) Long categoryId,@RequestParam(required=false) Long supplierId,
        @RequestParam(required=false) String search,@RequestParam(required=false) StockDtos.Kind kind,@RequestParam(required=false) String status,@RequestParam(required=false) Instant from,@RequestParam(required=false) Instant to,
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="newest") String sort){
        var f=new StockDtos.Filter(branchId,warehouseId,itemId,categoryId,supplierId,search,kind,status,from,to,page,size,sort);
        if(request.getRequestURI().endsWith("/export.csv"))return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=inventory.csv").body(queries.export(f));
        return visibility.response(switch(request.getRequestURI()){case "/api/inventory/documents"->queries.documents(f);case "/api/inventory/balances"->queries.balances(f);case "/api/inventory/ledger"->queries.ledger(f);case "/api/inventory/reports"->queries.report(f);case "/api/inventory/reconciliation"->queries.reconciliation(f);default->queries.dashboard(f);});}
    @GetMapping("/lots") public Object lots(@RequestParam Long branchId,@RequestParam long warehouseId,@RequestParam long itemId){return visibility.response(queries.lots(branchId,warehouseId,itemId));}
    @GetMapping("/packages") public Object packages(@RequestParam Long branchId,@RequestParam long itemId){return visibility.response(queries.packages(branchId,itemId));}
}

