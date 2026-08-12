package com.laundry.management.employee.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "employee_code_sequences")
public class EmployeeCodeSequence {

    @Id
    @Column(name = "sequence_name", length = 40)
    private String sequenceName;

    @Column(name = "next_value", nullable = false)
    private long nextValue;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected EmployeeCodeSequence() {
    }

    public long takeNextValue() {
        long allocated = nextValue;
        nextValue++;
        return allocated;
    }
}
