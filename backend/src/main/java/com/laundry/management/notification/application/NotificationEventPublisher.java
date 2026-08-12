package com.laundry.management.notification.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class NotificationEventPublisher {
    private final ApplicationEventPublisher publisher;

    public NotificationEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void notificationCreated(NotificationCreatedEvent event) {
        publisher.publishEvent(event);
    }

    public void stateChanged(NotificationStateChangedEvent event) {
        publisher.publishEvent(event);
    }
}
