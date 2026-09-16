package com.laundry.management.realtime;

import com.laundry.management.auth.security.CurrentUserProvider;
import com.laundry.management.notification.realtime.NotificationConnectionRegistry;
import java.time.*;
import java.util.Collection;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class RealtimeSseService {
    private final NotificationConnectionRegistry registry; private final CurrentUserProvider users; private final RealtimeTopicResolver topics;
    private final AtomicLong sequence=new AtomicLong(System.currentTimeMillis());
    public RealtimeSseService(NotificationConnectionRegistry registry,CurrentUserProvider users,RealtimeTopicResolver topics){this.registry=registry;this.users=users;this.topics=topics;}
    @PreAuthorize("@realtimeTopicResolver.hasAny(authentication)")
    public SseEmitter connect(){var user=users.getRequired();Set<String> allowedTopics=topics.resolve(user.permissions());String id=nextId();return registry.register(user.id(),tokenLifetime(),event("connected",id,new RealtimeEnvelope(id,"connected",null,null,null,null,Instant.now())),allowedTopics);}
    public void dispatch(RealtimeTopic topic,Collection<Long> recipients,RealtimeEnvelope envelope){recipients.forEach(id->registry.sendToUser(id,topic.value(),event(envelope.type(),envelope.eventId(),envelope)));}
    public RealtimeEnvelope envelope(String type,Long branchId,Long entityId,String code,long version,Instant occurredAt){return new RealtimeEnvelope(nextId(),type,branchId,entityId,code,version,occurredAt);}
    private SseEmitter.SseEventBuilder event(String name,String id,Object data){return SseEmitter.event().name(name).id(id).data(data);}
    private String nextId(){return Long.toString(sequence.incrementAndGet());}
    private long tokenLifetime(){Object value=SecurityContextHolder.getContext().getAuthentication().getCredentials();if(value instanceof Jwt jwt&&jwt.getExpiresAt()!=null)return Math.max(1000,Duration.between(Instant.now(),jwt.getExpiresAt()).toMillis());return 15*60*1000L;}
}
