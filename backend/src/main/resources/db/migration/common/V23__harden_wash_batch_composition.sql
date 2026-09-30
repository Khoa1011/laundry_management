ALTER TABLE wash_batch_items
    ADD COLUMN removal_reason VARCHAR(40) NULL;

UPDATE wash_batch_items
SET removal_reason = 'REMOVED_BY_OPERATOR'
WHERE removed_at IS NOT NULL;

UPDATE wash_batch_items
SET removal_reason = 'BATCH_CANCELLED'
WHERE removed_at IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM wash_batches batch
      WHERE batch.id = wash_batch_items.wash_batch_id
        AND batch.status = 'CANCELLED'
        AND batch.cancelled_at = wash_batch_items.removed_at
  );

ALTER TABLE wash_batch_items
    ADD CONSTRAINT ck_wash_batch_items_removal_reason
    CHECK (
        (removed_at IS NULL AND removal_reason IS NULL)
        OR (removed_at IS NOT NULL AND removal_reason IN ('REMOVED_BY_OPERATOR', 'BATCH_CANCELLED'))
    );

UPDATE permissions
SET description_vi = 'Xem danh sách và chi tiết mẻ trong chi nhánh được phép.',
    description_en = 'View wash-batch lists and details within allowed branches.'
WHERE code = 'batch.read';

UPDATE permissions
SET description_vi = 'Đọc danh sách ứng viên theo chi nhánh và tạo mẻ nháp hoặc mẻ sẵn sàng từ các món hợp lệ.',
    description_en = 'Read branch-scoped composition candidates and create draft or ready batches from eligible items.'
WHERE code = 'batch.create';
