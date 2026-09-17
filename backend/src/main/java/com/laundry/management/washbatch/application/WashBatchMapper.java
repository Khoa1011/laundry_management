package com.laundry.management.washbatch.application;

import com.fasterxml.jackson.databind.*;
import com.laundry.management.auth.domain.UserAccount;
import com.laundry.management.order.domain.OrderItem;
import com.laundry.management.servicecatalog.domain.UnitType;
import com.laundry.management.washbatch.api.WashBatchDtos;
import com.laundry.management.washbatch.domain.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class WashBatchMapper {
    private final ObjectMapper json; private final WashBatchCompatibilityService compatibility;
    public WashBatchMapper(ObjectMapper json,WashBatchCompatibilityService compatibility){this.json=json;this.compatibility=compatibility;}
    public WashBatchDtos.Candidate candidate(OrderItem i){return new WashBatchDtos.Candidate(i.getId(),i.getOrder().getId(),i.getOrder().getOrderCode(),i.getOrder().getStatus(),
        i.getOrder().getCustomerNameSnapshot(),i.getOrder().getCustomerPhoneSnapshot(),i.getServiceId(),i.getServiceCodeSnapshot(),i.getServiceNameSnapshot(),
        i.getItemTypeId(),i.getItemTypeCodeSnapshot(),i.getItemTypeNameSnapshot(),i.getSharingModeSnapshot(),i.getQuantity(),i.getUnitTypeSnapshot(),i.getNote(),
        i.getOrder().getPromisedAt(),i.getOrder().getCreatedAt(),compatibility.warnings(List.of(i)));}
    public WashBatchDtos.Detail detail(WashBatch b){List<WashBatchItem> shown=shown(b);List<OrderItem> orderItems=shown.stream().map(WashBatchItem::getOrderItem).toList();
        return new WashBatchDtos.Detail(b.getId(),b.getBatchCode(),new WashBatchDtos.Branch(b.getBranch().getId(),b.getBranch().getCode(),b.getBranch().getName()),
            new WashBatchDtos.Service(b.getService().getId(),b.getService().getCode(),b.getService().getNameVi()),b.getStatus(),b.getNote(),b.getVersion(),
            summary(shown),shown.stream().map(this::item).toList(),compatibility.warnings(orderItems),b.getCreatedAt(),actor(b.getCreatedBy()),b.getUpdatedAt(),actor(b.getUpdatedBy()),
            b.getReadyAt(),actorNullable(b.getReadyBy()),b.getCancelledAt(),actorNullable(b.getCancelledBy()),b.getCancelReason());}
    public WashBatchDtos.ListItem list(WashBatch b){List<WashBatchItem> shown=shown(b);WashBatchDtos.Summary summary=summary(shown);
        return new WashBatchDtos.ListItem(b.getId(),b.getBatchCode(),b.getService().getNameVi(),b.getStatus(),summary.orderCount(),summary.itemCount(),summary.quantities(),b.getCreatedAt(),actor(b.getCreatedBy()),b.getVersion());}
    public WashBatchDtos.History history(WashBatchHistory h){return new WashBatchDtos.History(h.getId(),h.getAction(),h.getFromStatus(),h.getToStatus(),h.getReason(),read(h.getChangedFieldsJson()),actor(h.getActor()),h.getCreatedAt());}
    public WashBatchDtos.Reference reference(WashBatch b,boolean active){return new WashBatchDtos.Reference(b.getId(),b.getBatchCode(),b.getStatus(),b.getService().getNameVi(),active,b.getCreatedAt());}
    private List<WashBatchItem> shown(WashBatch b){List<WashBatchItem> active=b.getActiveItems();return active.isEmpty()&&b.getStatus()==WashBatchStatus.CANCELLED?b.getItems():active;}
    private WashBatchDtos.Summary summary(List<WashBatchItem> items){long orders=items.stream().map(i->i.getOrderItem().getOrder().getId()).distinct().count();Map<UnitType,BigDecimal> quantities=new EnumMap<>(UnitType.class);
        items.forEach(i->quantities.merge(i.getOrderItem().getUnitTypeSnapshot(),i.getOrderItem().getQuantity(),BigDecimal::add));
        return new WashBatchDtos.Summary(orders,items.size(),quantities.entrySet().stream().map(e->new WashBatchDtos.Quantity(e.getKey(),e.getValue())).toList());}
    private WashBatchDtos.BatchItem item(WashBatchItem m){OrderItem i=m.getOrderItem();return new WashBatchDtos.BatchItem(m.getId(),i.getId(),m.isActive(),i.getOrder().getId(),i.getOrder().getOrderCode(),i.getOrder().getStatus(),
        i.getOrder().getCustomerNameSnapshot(),i.getOrder().getCustomerPhoneSnapshot(),i.getServiceId(),i.getServiceCodeSnapshot(),i.getServiceNameSnapshot(),i.getItemTypeId(),i.getItemTypeCodeSnapshot(),i.getItemTypeNameSnapshot(),
        i.getSharingModeSnapshot(),i.getQuantity(),i.getUnitTypeSnapshot(),i.getNote(),i.getOrder().getPromisedAt(),i.getOrder().getCreatedAt(),m.getAddedAt(),actor(m.getAddedBy()),m.getRemovedAt(),actorNullable(m.getRemovedBy()));}
    private WashBatchDtos.Actor actor(UserAccount u){return new WashBatchDtos.Actor(u.getId(),u.getDisplayName());} private WashBatchDtos.Actor actorNullable(UserAccount u){return u==null?null:actor(u);}
    private JsonNode read(String value){try{return value==null?null:json.readTree(value);}catch(Exception ex){return json.getNodeFactory().objectNode();}}
}
