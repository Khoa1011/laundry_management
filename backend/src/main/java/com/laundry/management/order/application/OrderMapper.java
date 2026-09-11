package com.laundry.management.order.application;

import com.fasterxml.jackson.databind.*;
import com.laundry.management.order.api.OrderDtos;
import com.laundry.management.order.domain.*;
import org.springframework.stereotype.Component;

@Component
public class OrderMapper {
    private final ObjectMapper json;
    public OrderMapper(ObjectMapper json){this.json=json;}
    public OrderDtos.Response detail(LaundryOrder o){
        return new OrderDtos.Response(o.getId(),o.getOrderCode(),o.getBranch().getId(),o.getBranch().getCode(),
            o.getCustomer()==null?null:o.getCustomer().getId(),o.getCustomerNameSnapshot(),o.getCustomerPhoneSnapshot(),
            o.getStatus(),o.getPromisedAt(),o.getNote(),o.getCurrency(),o.getTotalAmount(),
            o.getItems().stream().map(this::item).toList(),o.getCreatedAt(),actor(o.getCreatedBy()),
            o.getUpdatedAt(),actor(o.getUpdatedBy()),o.getCancelledAt(),actorNullable(o.getCancelledBy()),o.getCancelReason(),
            o.getReopenedAt(),actorNullable(o.getReopenedBy()),o.getReopenReason(),o.getVersion());
    }
    public OrderDtos.ListItemResponse list(LaundryOrder o){
        String summary=o.getItems().stream().limit(2).map(OrderItem::getServiceNameSnapshot).distinct()
            .reduce((a,b)->a+", "+b).orElse("");
        if(o.getItems().size()>2) summary += " +"+(o.getItems().size()-2);
        return new OrderDtos.ListItemResponse(o.getId(),o.getOrderCode(),o.getCustomerNameSnapshot(),
            o.getCustomerPhoneSnapshot(),summary,o.getTotalAmount(),o.getCurrency(),o.getStatus(),o.getPromisedAt(),o.getCreatedAt(),o.getVersion());
    }
    public OrderDtos.HistoryResponse history(OrderStatusHistory h){return new OrderDtos.HistoryResponse(h.getId(),h.getAction(),h.getFromStatus(),h.getToStatus(),h.getReason(),read(h.getChangedFieldsJson()),h.getSource(),actor(h.getActor()),h.getCreatedAt());}
    private OrderDtos.ItemResponse item(OrderItem i){return new OrderDtos.ItemResponse(i.getId(),i.getServiceId(),i.getItemTypeId(),i.getServiceCodeSnapshot(),i.getServiceNameSnapshot(),i.getItemTypeCodeSnapshot(),i.getItemTypeNameSnapshot(),i.getPricingMethodSnapshot(),i.getUnitTypeSnapshot(),i.getSharingModeSnapshot(),i.getQuantity(),i.getBillableQuantity(),i.getLineAmount(),i.getNote(),read(i.getPricingSnapshotJson()),i.getQuotedAt());}
    private OrderDtos.ActorResponse actor(com.laundry.management.auth.domain.UserAccount u){return new OrderDtos.ActorResponse(u.getId(),u.getDisplayName());}
    private OrderDtos.ActorResponse actorNullable(com.laundry.management.auth.domain.UserAccount u){return u==null?null:actor(u);}
    private JsonNode read(String value){try{return value==null?null:json.readTree(value);}catch(Exception e){return json.getNodeFactory().textNode("Unavailable snapshot");}}
}
