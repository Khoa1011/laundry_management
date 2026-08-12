ALTER TABLE roles ADD COLUMN display_name VARCHAR(150) NULL;
ALTER TABLE roles ADD COLUMN business_description VARCHAR(1000) NULL;

UPDATE roles
SET display_name = name,
    business_description = description
WHERE display_name IS NULL;

CREATE TABLE role_code_sequences (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id)
);

