package com.laundry.management.realtime;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.realtime.NotificationConnectionRegistry;
import java.time.*;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import com.laundry.management.auth.security.permission.PermissionCodes;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class RealtimeSseService {
    private final NotificationConnectionRegistry registry; private final CurrentUserProvider users;
    private final AtomicLong sequence=new AtomicLong(System.currentTimeMillis());
    public RealtimeSseService(NotificationConnectionRegistry registry,CurrentUserProvider users){this.registry=registry;this.users=users;}
    @PreAuthorize("@permissionChecker.hasAny(authentication, T(com.laundry.management.auth.security.permission.PermissionCodes).NOTIFICATION_READ_OWN, T(com.laundry.management.auth.security.permission.PermissionCodes).ORDER_READ)")
    public SseEmitter connect(){var user=users.getRequired();Set<String> topics=new HashSet<>();if(user.permissions().contains(PermissionCodes.NOTIFICATION_READ_OWN))topics.add("notification");if(user.permissions().contains(PermissionCodes.ORDER_READ))topics.add("order");String id=nextId();return registry.register(user.id(),tokenLifetime(),event("connected",id,new RealtimeEnvelope(id,"connected",null,null,null,null,Instant.now())),topics);}
    public void dispatch(Collection<Long> recipients,RealtimeEnvelope envelope){recipients.forEach(id->registry.sendToUser(id,"order",event(envelope.type(),envelope.eventId(),envelope)));}
    public RealtimeEnvelope envelope(String type,Long branchId,Long entityId,String code,long version,Instant occurredAt){return new RealtimeEnvelope(nextId(),type,branchId,entityId,code,version,occurredAt);}
    private SseEmitter.SseEventBuilder event(String name,String id,Object data){return SseEmitter.event().name(name).id(id).data(data);}
    private String nextId(){return Long.toString(sequence.incrementAndGet());}
    private long tokenLifetime(){Object value=SecurityContextHolder.getContext().getAuthentication().getCredentials();if(value instanceof Jwt jwt&&jwt.getExpiresAt()!=null)return Math.max(1000,Duration.between(Instant.now(),jwt.getExpiresAt()).toMillis());return 15*60*1000L;}
}
