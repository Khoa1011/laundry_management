ALTER TABLE order_bags DROP CONSTRAINT ck_order_bags_status;

ALTER TABLE order_bags ADD COLUMN voided_at TIMESTAMP(6) NULL;
ALTER TABLE order_bags ADD COLUMN voided_by BIGINT NULL;
ALTER TABLE order_bags ADD COLUMN void_reason VARCHAR(500) NULL;

ALTER TABLE order_bags ADD CONSTRAINT fk_order_bags_voided_by
    FOREIGN KEY (voided_by) REFERENCES users (id);

ALTER TABLE order_bags ADD CONSTRAINT ck_order_bags_status
    CHECK (status IN ('RECEIVED', 'LEGACY_UNVERIFIED', 'VOIDED'));

ALTER TABLE order_bags ADD CONSTRAINT ck_order_bags_void_metadata CHECK (
    (status = 'VOIDED' AND voided_at IS NOT NULL AND voided_by IS NOT NULL
        AND void_reason IS NOT NULL AND CHAR_LENGTH(TRIM(void_reason)) > 0)
    OR (status <> 'VOIDED' AND voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
);
