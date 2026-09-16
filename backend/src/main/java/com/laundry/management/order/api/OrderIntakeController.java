package com.laundry.management.order.api;

import com.laundry.management.order.application.OrderIntakeQueryService;
import com.laundry.management.servicecatalog.api.CatalogDtos;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders/intake")
public class OrderIntakeController {
    private final OrderIntakeQueryService intake;
    public OrderIntakeController(OrderIntakeQueryService intake){this.intake=intake;}

    @GetMapping("/customers")
    public List<OrderDtos.IntakeCustomerResponse> customers(@RequestParam String query,
        @RequestParam(required=false) Long branchId){return intake.customers(query,branchId);}

    @GetMapping("/services")
    public List<OrderDtos.IntakeServiceResponse> services(@RequestParam(required=false) Long branchId){
        return intake.services(branchId);
    }

    @GetMapping("/services/{serviceId}/items")
    public List<OrderDtos.IntakeItemTypeResponse> itemTypes(@PathVariable Long serviceId,
        @RequestParam(required=false) Long branchId){return intake.itemTypes(serviceId,branchId);}

    @PostMapping("/quote")
    public CatalogDtos.PricingPreviewResponse quote(@Valid @RequestBody OrderDtos.IntakeQuoteRequest request){
        return intake.quote(request);
    }
}
