package com.laundry.management.servicecatalog.application;

import com.laundry.management.servicecatalog.infrastructure.CatalogCodeSequenceRepository;
import org.springframework.stereotype.Component;

@Component
public class CatalogCodeGenerator {

    private final CatalogCodeSequenceRepository repository;

    public CatalogCodeGenerator(CatalogCodeSequenceRepository repository) {
        this.repository = repository;
    }

    public String nextServiceCode() {
        return format("DV", repository.lockByName("SERVICE").takeNext());
    }

    public String nextItemTypeCode() {
        return format("LD", repository.lockByName("ITEM_TYPE").takeNext());
    }

    public String nextPriceListCode() {
        return format("BG", repository.lockByName("PRICE_LIST").takeNext());
    }

    private String format(String prefix, long value) {
        return "%s-%06d".formatted(prefix, value);
    }
}
