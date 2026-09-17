package com.laundry.management.washbatch.application;

import com.laundry.management.order.domain.*;
import com.laundry.management.servicecatalog.domain.SharingMode;
import com.laundry.management.washbatch.domain.WashBatchActiveItem;
import com.laundry.management.washbatch.infrastructure.WashBatchActiveItemRepository;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class WashBatchCompatibilityService {
    public static final String DIFFERENT_BRANCH="DIFFERENT_BRANCH",ORDER_NOT_WAITING="ORDER_NOT_WAITING",ALREADY_ASSIGNED="ALREADY_ASSIGNED",
        DIFFERENT_SERVICE="DIFFERENT_SERVICE",PRIVATE_LOAD_CONFLICT="PRIVATE_LOAD_CONFLICT",ITEM_NOTE_PRESENT="ITEM_NOTE_PRESENT",
        DIFFERENT_ITEM_TYPES="DIFFERENT_ITEM_TYPES",PRIORITY_ITEM="PRIORITY_ITEM",PROMISED_TIME_SOON="PROMISED_TIME_SOON";
    private final WashBatchActiveItemRepository active; private final Clock clock;
    public WashBatchCompatibilityService(WashBatchActiveItemRepository active,Clock clock){this.active=active;this.clock=clock;}

    public CompatibilityResult evaluate(Long branchId,List<OrderItem> items,Long allowedBatchId){
        LinkedHashSet<String> blockers=new LinkedHashSet<>(),warnings=new LinkedHashSet<>();
        if(items.isEmpty())return new CompatibilityResult(false,List.of("ITEMS_REQUIRED"),List.of());
        if(items.stream().anyMatch(i->!Objects.equals(i.getOrder().getBranch().getId(),branchId)))blockers.add(DIFFERENT_BRANCH);
        if(items.stream().anyMatch(i->i.getOrder().getStatus()!=OrderStatus.RECEIVED))blockers.add(ORDER_NOT_WAITING);
        if(items.stream().map(OrderItem::getServiceId).distinct().count()>1)blockers.add(DIFFERENT_SERVICE);
        Set<Long> orderIds=new HashSet<>();items.forEach(i->orderIds.add(i.getOrder().getId()));
        if(orderIds.size()>1&&items.stream().anyMatch(i->i.getSharingModeSnapshot()==SharingMode.PRIVATE_LOAD))blockers.add(PRIVATE_LOAD_CONFLICT);
        Set<Long> ids=items.stream().map(OrderItem::getId).collect(java.util.stream.Collectors.toSet());
        for(WashBatchActiveItem assignment:active.findByOrderItemIdIn(ids)){
            if(allowedBatchId==null||!Objects.equals(assignment.getMembership().getBatch().getId(),allowedBatchId))blockers.add(ALREADY_ASSIGNED);
        }
        warnings.addAll(warnings(items));
        return new CompatibilityResult(blockers.isEmpty(),List.copyOf(blockers),List.copyOf(warnings));
    }
    public List<String> warnings(List<OrderItem> items){LinkedHashSet<String> warnings=new LinkedHashSet<>();
        if(items.stream().anyMatch(i->i.getNote()!=null&&!i.getNote().isBlank()))warnings.add(ITEM_NOTE_PRESENT);
        if(items.stream().map(OrderItem::getItemTypeId).distinct().count()>1)warnings.add(DIFFERENT_ITEM_TYPES);
        if(items.stream().anyMatch(i->i.getSharingModeSnapshot()==SharingMode.SHARED_PRIORITY))warnings.add(PRIORITY_ITEM);
        Instant soon=Instant.now(clock).plus(Duration.ofHours(24));
        if(items.stream().map(i->i.getOrder().getPromisedAt()).filter(Objects::nonNull).anyMatch(t->!t.isAfter(soon)))warnings.add(PROMISED_TIME_SOON);
        return List.copyOf(warnings);}
    public record CompatibilityResult(boolean compatible,List<String> blockers,List<String> warnings) {}
}
