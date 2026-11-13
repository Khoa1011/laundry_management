package com.laundry.management.inventory.operations;

import com.laundry.management.auth.security.permission.PermissionCodes;
import com.laundry.management.notification.application.*;
import com.laundry.management.notification.domain.*;
import java.time.*;
import java.util.Map;
import org.slf4j.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.event.*;

@Component
public class StockNotificationListener {
    private static final Logger LOG=LoggerFactory.getLogger(StockNotificationListener.class);
    private final StockStore db;private final NotificationApplicationService notifications;
    public StockNotificationListener(StockStore db,NotificationApplicationService notifications){this.db=db;this.notifications=notifications;}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT) @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void changed(StockChangedEvent e){try{
        var item=db.one("SELECT minimum_stock FROM inventory_items WHERE id=?",e.itemId());var minimum=StockStore.dec(item,"minimumStock");
        boolean low=e.current().compareTo(minimum)<0&&e.previous().compareTo(minimum)>=0||e.current().signum()<=0&&e.previous().signum()>0;
        if(low)send(e.branchId(),e.documentId(),e.revision(),"LOW_STOCK:"+e.warehouseId()+":"+e.itemId(),"Vật tư cần bổ sung","Có vật tư xuống dưới ngưỡng tối thiểu hoặc đã hết. Kiểm tra tồn kho.","/inventory/balances",PermissionCodes.INVENTORY_STOCK_READ);
        var expiry=db.rows("SELECT id FROM stock_lots WHERE warehouse_id=? AND item_id=? AND quantity>0 AND expiry_date<=? LIMIT 1",e.warehouseId(),e.itemId(),LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusDays(30));
        if(!expiry.isEmpty()&&e.current().compareTo(e.previous())>0)send(e.branchId(),e.documentId(),e.revision(),"EXPIRING:"+e.warehouseId()+":"+e.itemId(),"Vật tư gần hết hạn","Kiểm tra lô vật tư gần hết hạn trong kho.","/inventory/dashboard",PermissionCodes.INVENTORY_OVERVIEW_READ);
    }catch(RuntimeException ex){LOG.warn("Inventory {} committed; notification dispatch failed",e.documentId());}}
    @TransactionalEventListener(phase=TransactionPhase.AFTER_COMMIT) @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void discrepancy(StockAlertEvent e){try{boolean transfer="TRANSFER_RETURNED".equals(e.reason());send(e.branchId(),e.documentId(),e.revision(),e.reason(),transfer?"Chuyển kho có hàng hoàn trả":"Kiểm kê có chênh lệch",transfer?"Có hàng đang chuyển được hoàn trả về kho nguồn. Kiểm tra chứng từ.":"Kết quả kiểm kê đã được lưu và điều chỉnh tồn.","/inventory/documents/"+e.documentId(),PermissionCodes.INVENTORY_DOCUMENT_READ);}catch(RuntimeException ex){LOG.warn("Inventory {} committed; discrepancy notification failed",e.documentId());}}
    private void send(long branch,long document,long revision,String event,String title,String message,String link,String permission){notifications.notifyByPermission(CreateNotificationCommand.builder().type(NotificationType.GENERIC_INTERNAL).severity(NotificationSeverity.WARNING)
        .titleKey("inventoryAlerts."+event.split(":")[0]+".title").messageKey("inventoryAlerts."+event.split(":")[0]+".message").titleFallback(title).messageFallback(message).metadata(Map.of("documentId",document))
        .audienceType(NotificationAudienceType.USERS_BY_PERMISSION_IN_BRANCH).targetPermissionCode(permission).branchId(branch).excludeActor(false).referenceType(NotificationReferenceType.INVENTORY).referenceId(Long.toString(document)).deepLink(link)
        .deduplicationKey("stock:"+document+":"+revision+":"+event).createdBySystem(true).build());}
}
