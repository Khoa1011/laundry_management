-- Intentionally no synthetic backfill: migration must fail if historical order items lack a truthful item type.
ALTER TABLE order_items MODIFY COLUMN item_type_id BIGINT NOT NULL;
ALTER TABLE order_items MODIFY COLUMN item_type_code_snapshot VARCHAR(40) NOT NULL;
ALTER TABLE order_items MODIFY COLUMN item_type_name_snapshot VARCHAR(150) NOT NULL;

UPDATE permissions
SET description_vi = 'Tra cứu dữ liệu intake tối thiểu và tạo đơn mới với giá do hệ thống tính trong chi nhánh được phép.',
    description_en = 'Query minimal intake data and create orders with server-authoritative pricing within the allowed branch scope.'
WHERE code = 'order.create';
