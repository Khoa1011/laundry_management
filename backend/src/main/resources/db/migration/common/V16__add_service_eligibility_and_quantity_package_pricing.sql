CREATE TABLE service_item_eligibility (
    id BIGINT NOT NULL AUTO_INCREMENT,
    service_id BIGINT NOT NULL,
    item_type_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_service_item_eligibility UNIQUE (service_id, item_type_id),
    CONSTRAINT fk_service_item_eligibility_service FOREIGN KEY (service_id) REFERENCES laundry_services (id),
    CONSTRAINT fk_service_item_eligibility_item FOREIGN KEY (item_type_id) REFERENCES item_types (id),
    CONSTRAINT fk_service_item_eligibility_actor FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX idx_service_item_eligibility_item_service
    ON service_item_eligibility (item_type_id, service_id);

CREATE TABLE price_rule_package_prices (
    id BIGINT NOT NULL AUTO_INCREMENT,
    price_rule_id BIGINT NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    total_price DECIMAL(18,2) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_price_rule_package_quantity UNIQUE (price_rule_id, quantity),
    CONSTRAINT fk_price_rule_package_rule FOREIGN KEY (price_rule_id) REFERENCES price_rules (id),
    CONSTRAINT ck_price_rule_package_quantity CHECK (quantity > 0 AND quantity = FLOOR(quantity)),
    CONSTRAINT ck_price_rule_package_total CHECK (total_price >= 0),
    CONSTRAINT ck_price_rule_package_sort CHECK (sort_order >= 0)
);

CREATE INDEX idx_price_rule_package_rule_sort
    ON price_rule_package_prices (price_rule_id, sort_order, id);
