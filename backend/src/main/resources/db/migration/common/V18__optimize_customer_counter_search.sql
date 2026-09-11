ALTER TABLE customers ADD COLUMN phone_search_reverse VARCHAR(20) NULL;
UPDATE customers SET phone_search_reverse = CONCAT(
    SUBSTRING(normalized_phone,12,1), SUBSTRING(normalized_phone,11,1),
    SUBSTRING(normalized_phone,10,1), SUBSTRING(normalized_phone,9,1),
    SUBSTRING(normalized_phone,8,1), SUBSTRING(normalized_phone,7,1),
    SUBSTRING(normalized_phone,6,1), SUBSTRING(normalized_phone,5,1),
    SUBSTRING(normalized_phone,4,1), SUBSTRING(normalized_phone,3,1),
    SUBSTRING(normalized_phone,2,1), SUBSTRING(normalized_phone,1,1)
);
CREATE INDEX idx_customers_branch_phone_reverse ON customers (branch_id, phone_search_reverse, id);
CREATE INDEX idx_customers_branch_name_active ON customers (branch_id, status, full_name, id);
