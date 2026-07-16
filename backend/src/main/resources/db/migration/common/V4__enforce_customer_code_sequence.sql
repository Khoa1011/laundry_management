CREATE TABLE customer_code_sequences (
    sequence_name VARCHAR(40) NOT NULL,
    next_value BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (sequence_name),
    CONSTRAINT ck_customer_code_sequence_positive CHECK (next_value > 0)
);

INSERT INTO customer_code_sequences (sequence_name, next_value) VALUES ('CUSTOMER', 1);

ALTER TABLE customers MODIFY COLUMN customer_code VARCHAR(30) NOT NULL;
