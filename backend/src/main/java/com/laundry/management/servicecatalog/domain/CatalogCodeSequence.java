package com.laundry.management.servicecatalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "catalog_code_sequences")
public class CatalogCodeSequence {

    @Id
    @Column(name = "sequence_name", length = 40)
    private String sequenceName;

    @Column(name = "next_value", nullable = false)
    private long nextValue;

    protected CatalogCodeSequence() {
    }

    public long takeNext() {
        return nextValue++;
    }
}
