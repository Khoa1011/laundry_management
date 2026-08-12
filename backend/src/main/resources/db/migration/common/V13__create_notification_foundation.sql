CREATE TABLE notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,
    notification_type VARCHAR(60) NOT NULL,
    severity VARCHAR(30) NOT NULL,
    title_key VARCHAR(180) NOT NULL,
    message_key VARCHAR(180) NOT NULL,
    title_fallback VARCHAR(250) NOT NULL,
    message_fallback VARCHAR(1000) NOT NULL,
    metadata_json TEXT NULL,
    branch_id BIGINT NULL,
    actor_user_id BIGINT NULL,
    audience_type VARCHAR(60) NOT NULL,
    reference_type VARCHAR(40) NULL,
    reference_id VARCHAR(100) NULL,
    deep_link VARCHAR(500) NULL,
    exclude_actor BOOLEAN NOT NULL DEFAULT TRUE,
    deduplication_key VARCHAR(190) NULL,
    created_by_system BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_by BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_notifications_deduplication_key UNIQUE (deduplication_key),
    CONSTRAINT fk_notifications_branch FOREIGN KEY (branch_id) REFERENCES branches (id),
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_user_id) REFERENCES users (id),
    CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_notifications_severity CHECK (
        severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'ACTION_REQUIRED')
    ),
    CONSTRAINT ck_notifications_audience_type CHECK (
        audience_type IN (
            'SPECIFIC_USERS',
            'SPECIFIC_EMPLOYEES',
            'ALL_ACTIVE_USERS_IN_BRANCH',
            'ALL_ACTIVE_EMPLOYEES_IN_BRANCH',
            'USERS_BY_POSITION_IN_BRANCH',
            'USERS_BY_PERMISSION_IN_BRANCH'
        )
    ),
    CONSTRAINT ck_notifications_actor CHECK (
        created_by_system = TRUE OR actor_user_id IS NOT NULL
    )
);

CREATE TABLE notification_recipients (
    id BIGINT NOT NULL AUTO_INCREMENT,
    notification_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    delivered_at TIMESTAMP(6) NULL,
    seen_at TIMESTAMP(6) NULL,
    read_at TIMESTAMP(6) NULL,
    dismissed_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_notification_recipients_notification_user UNIQUE (notification_id, user_id),
    CONSTRAINT fk_notification_recipients_notification
        FOREIGN KEY (notification_id) REFERENCES notifications (id),
    CONSTRAINT fk_notification_recipients_user
        FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE notification_preferences (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sound_key VARCHAR(40) NOT NULL DEFAULT 'SOFT_CHIME',
    sound_volume INT NOT NULL DEFAULT 65,
    toast_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bell_animation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_notification_preferences_user UNIQUE (user_id),
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_notification_preferences_sound CHECK (
        sound_key IN ('NONE', 'SOFT_CHIME', 'CLEAR_BELL', 'DIGITAL_PING', 'DOUBLE_TONE', 'URGENT_ALERT')
    ),
    CONSTRAINT ck_notification_preferences_volume CHECK (sound_volume BETWEEN 0 AND 100)
);

CREATE INDEX idx_notification_recipients_user_visible_created
    ON notification_recipients (user_id, dismissed_at, created_at, notification_id);
CREATE INDEX idx_notification_recipients_user_read_created
    ON notification_recipients (user_id, read_at, created_at, notification_id);
CREATE INDEX idx_notification_recipients_user_notification
    ON notification_recipients (user_id, notification_id);
CREATE INDEX idx_notifications_created
    ON notifications (created_at, id);
CREATE INDEX idx_notifications_branch_created
    ON notifications (branch_id, created_at, id);
CREATE INDEX idx_notifications_type_created
    ON notifications (notification_type, created_at, id);
CREATE INDEX idx_notifications_expires
    ON notifications (expires_at);

INSERT INTO permission_modules (
    code, name_vi, name_en, description_vi, description_en, display_order, status
) VALUES (
    'notification',
    'Thông báo',
    'Notifications',
    'Nhận, theo dõi và gửi thông báo nội bộ theo người dùng, nhân viên, chi nhánh, vị trí công việc hoặc quyền hiệu lực.',
    'Receive, track, and send internal notifications by user, employee, branch, position, or effective permission.',
    30,
    'ACTIVE'
);

INSERT INTO permissions (
    code, name, module, resource, action, name_vi, name_en,
    description_vi, description_en, risk_level, display_order,
    is_system, status
) VALUES
    ('notification.read-own', 'Xem thông báo của bản thân', 'notification', 'notification', 'read-own',
     'Xem thông báo của bản thân', 'View own notifications',
     'Xem danh sách, chi tiết, số chưa đọc và luồng thời gian thực của tài khoản hiện tại.',
     'View the current account notification list, detail, unread count, and realtime stream.', 'LOW', 10, TRUE, 'ACTIVE'),
    ('notification.mark-read-own', 'Đánh dấu thông báo đã đọc', 'notification', 'notification', 'mark-read-own',
     'Đánh dấu thông báo đã đọc', 'Mark own notification read',
     'Đánh dấu một thông báo của tài khoản hiện tại là đã đọc.',
     'Mark one notification belonging to the current account as read.', 'LOW', 20, TRUE, 'ACTIVE'),
    ('notification.mark-all-read-own', 'Đánh dấu tất cả thông báo đã đọc', 'notification', 'notification', 'mark-all-read-own',
     'Đánh dấu tất cả thông báo đã đọc', 'Mark all own notifications read',
     'Đánh dấu toàn bộ thông báo đang hiển thị của tài khoản hiện tại là đã đọc.',
     'Mark all visible notifications belonging to the current account as read.', 'LOW', 30, TRUE, 'ACTIVE'),
    ('notification.dismiss-own', 'Ẩn thông báo của bản thân', 'notification', 'notification', 'dismiss-own',
     'Ẩn thông báo của bản thân', 'Dismiss own notifications',
     'Ẩn một thông báo khỏi danh sách thông thường của tài khoản hiện tại.',
     'Hide one notification from the current account normal list.', 'LOW', 40, TRUE, 'ACTIVE'),
    ('notification.preferences.manage-own', 'Quản lý tùy chọn thông báo', 'notification', 'notification.preferences', 'manage-own',
     'Quản lý tùy chọn thông báo', 'Manage own notification preferences',
     'Quản lý âm thanh, âm lượng, thông báo nổi và hiệu ứng chuông của tài khoản hiện tại.',
     'Manage the current account sound, volume, toast, and bell-animation preferences.', 'LOW', 50, TRUE, 'ACTIVE'),
    ('notification.send-specific', 'Gửi thông báo cho người dùng', 'notification', 'notification', 'send-specific',
     'Gửi thông báo cho người dùng', 'Send notifications to users',
     'Gửi thông báo đến các tài khoản được chọn trong phạm vi chi nhánh được phép.',
     'Send notifications to selected accounts within the allowed branch scope.', 'MEDIUM', 60, TRUE, 'ACTIVE'),
    ('notification.send-employee', 'Gửi thông báo cho nhân viên', 'notification', 'notification', 'send-employee',
     'Gửi thông báo cho nhân viên', 'Send notifications to employees',
     'Gửi thông báo đến các nhân viên được chọn có tài khoản hợp lệ.',
     'Send notifications to selected employees with eligible linked accounts.', 'MEDIUM', 70, TRUE, 'ACTIVE'),
    ('notification.broadcast-branch-users', 'Gửi thông báo cho người dùng chi nhánh', 'notification', 'notification', 'broadcast-branch-users',
     'Gửi thông báo cho người dùng chi nhánh', 'Broadcast to branch users',
     'Gửi thông báo đến toàn bộ tài khoản hợp lệ trong một chi nhánh được phép.',
     'Broadcast notifications to all eligible accounts in an allowed branch.', 'HIGH', 80, TRUE, 'ACTIVE'),
    ('notification.broadcast-branch-employees', 'Gửi thông báo cho nhân viên chi nhánh', 'notification', 'notification', 'broadcast-branch-employees',
     'Gửi thông báo cho nhân viên chi nhánh', 'Broadcast to branch employees',
     'Gửi thông báo đến toàn bộ nhân viên đang hoạt động có tài khoản hợp lệ trong một chi nhánh.',
     'Broadcast notifications to all active employees with eligible accounts in a branch.', 'HIGH', 90, TRUE, 'ACTIVE'),
    ('notification.send-by-position', 'Gửi thông báo theo vị trí công việc', 'notification', 'notification', 'send-by-position',
     'Gửi thông báo theo vị trí công việc', 'Send notifications by position',
     'Gửi thông báo đến nhân viên có vị trí công việc được chọn trong một chi nhánh.',
     'Send notifications to employees holding selected positions in a branch.', 'HIGH', 100, TRUE, 'ACTIVE'),
    ('notification.send-by-permission', 'Gửi thông báo theo quyền hiệu lực', 'notification', 'notification', 'send-by-permission',
     'Gửi thông báo theo quyền hiệu lực', 'Send notifications by effective permission',
     'Gửi thông báo đến người dùng có quyền hiệu lực được chọn trong một chi nhánh, có áp dụng DENY.',
     'Send notifications to users with a selected effective permission in a branch, honoring DENY overrides.', 'HIGH', 110, TRUE, 'ACTIVE'),
    ('notification.manage', 'Quản trị hệ thống thông báo', 'notification', 'notification', 'manage',
     'Quản trị hệ thống thông báo', 'Manage notification system',
     'Truy cập chẩn đoán và quản trị nền tảng thông báo mà không mặc nhiên cấp quyền xem nội dung cá nhân.',
     'Access notification diagnostics and administration without implicitly granting access to personal content.', 'HIGH', 120, TRUE, 'ACTIVE');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.module = 'notification'
WHERE r.code = 'OWNER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'notification.read-own',
    'notification.mark-read-own',
    'notification.mark-all-read-own',
    'notification.dismiss-own',
    'notification.preferences.manage-own',
    'notification.send-specific',
    'notification.send-employee',
    'notification.broadcast-branch-employees',
    'notification.send-by-position',
    'notification.send-by-permission'
)
WHERE r.code = 'MANAGER';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
    'notification.read-own',
    'notification.mark-read-own',
    'notification.mark-all-read-own',
    'notification.dismiss-own',
    'notification.preferences.manage-own'
)
WHERE r.code = 'RECEPTIONIST';
