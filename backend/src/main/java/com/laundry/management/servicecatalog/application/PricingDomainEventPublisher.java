package com.laundry.management.servicecatalog.application;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class PricingDomainEventPublisher {

    private final ApplicationEventPublisher publisher;

    public PricingDomainEventPublisher(ApplicationEventPublisher publisher) {
        this.publisher = publisher;
    }

    public void publish(PriceListPublishedEvent event) {
        publisher.publishEvent(event);
    }
}
