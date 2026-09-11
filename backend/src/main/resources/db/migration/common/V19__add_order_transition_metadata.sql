ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP(6) NULL;
ALTER TABLE orders ADD COLUMN cancelled_by BIGINT NULL;
ALTER TABLE orders ADD COLUMN cancel_reason VARCHAR(500) NULL;
ALTER TABLE orders ADD COLUMN reopened_at TIMESTAMP(6) NULL;
ALTER TABLE orders ADD COLUMN reopened_by BIGINT NULL;
ALTER TABLE orders ADD COLUMN reopen_reason VARCHAR(500) NULL;

ALTER TABLE orders ADD CONSTRAINT fk_orders_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_reopened_by FOREIGN KEY (reopened_by) REFERENCES users (id);
