package com.laundry.management.employee.application;

import com.laundry.management.employee.infrastructure.EmployeeCodeSequenceRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class EmployeeCodeGenerator {

    private static final String EMPLOYEE_SEQUENCE = "EMPLOYEE";

    private final EmployeeCodeSequenceRepository sequenceRepository;

    public EmployeeCodeGenerator(EmployeeCodeSequenceRepository sequenceRepository) {
        this.sequenceRepository = sequenceRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public String nextCode() {
        long value = sequenceRepository.findByNameForUpdate(EMPLOYEE_SEQUENCE)
            .orElseThrow(() -> new IllegalStateException("Employee code sequence is missing after migration"))
            .takeNextValue();
        return "NV-" + String.format("%06d", value);
    }
}
