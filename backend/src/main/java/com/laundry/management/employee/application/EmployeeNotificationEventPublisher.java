package com.laundry.management.employee.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class EmployeeNotificationEventPublisher {
    private final ApplicationEventPublisher publisher;

    public EmployeeNotificationEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(EmployeeBranchChangedEvent event) {
        publisher.publishEvent(event);
    }

    public void publish(EmployeeStatusChangedEvent event) {
        publisher.publishEvent(event);
    }

    public void publish(EmployeeAccountLinkedEvent event) {
        publisher.publishEvent(event);
    }

    public void publish(EmployeeLinkedAccountLockedEvent event) {
        publisher.publishEvent(event);
    }
}
