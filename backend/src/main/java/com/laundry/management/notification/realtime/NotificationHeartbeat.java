package com.laundry.management.notification.realtime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationHeartbeat {
    private final NotificationSseService sseService;

    public NotificationHeartbeat(NotificationSseService sseService) {
        this.sseService = sseService;
    }

    @Scheduled(fixedDelayString = "${app.notification.sse.heartbeat-ms:25000}")
    public void sendHeartbeat() {
        sseService.heartbeat();
    }
}
