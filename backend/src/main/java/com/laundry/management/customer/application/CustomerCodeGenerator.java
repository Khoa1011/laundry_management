package com.laundry.management.customer.application;

import com.laundry.management.customer.infrastructure.CustomerCodeSequenceRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CustomerCodeGenerator {

    private static final String CUSTOMER_SEQUENCE = "CUSTOMER";

    private final CustomerCodeSequenceRepository sequenceRepository;

    public CustomerCodeGenerator(CustomerCodeSequenceRepository sequenceRepository) {
        this.sequenceRepository = sequenceRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextCode() {
        long value = sequenceRepository.findByNameForUpdate(CUSTOMER_SEQUENCE)
            .orElseThrow(() -> new IllegalStateException("Customer code sequence is missing after migration"))
            .takeNextValue();
        return "KH-" + String.format("%06d", value);
    }
}
