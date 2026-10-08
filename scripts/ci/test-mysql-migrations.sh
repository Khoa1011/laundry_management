#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/artifacts/ci/mysql-migrations"
FIXTURE_FILE="$ROOT_DIR/scripts/ci/fixtures/v23-legacy-order.sql"
FRESH_DATABASE="laundry_ci_fresh"
LEGACY_DATABASE="laundry_ci_legacy"
APP_PID=""

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${MYSQL_APP_USER:?MYSQL_APP_USER is required}"
: "${MYSQL_APP_PASSWORD:?MYSQL_APP_PASSWORD is required}"
: "${APP_JWT_SECRET:?APP_JWT_SECRET is required}"
: "${APP_EMPLOYEE_IDENTITY_KEY:?APP_EMPLOYEE_IDENTITY_KEY is required}"

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"

mkdir -p "$ARTIFACT_DIR"

JAR_FILE="$(find "$ROOT_DIR/backend/target" -maxdepth 1 -type f -name '*.jar' ! -name '*.original' -print -quit)"
if [[ -z "$JAR_FILE" ]]; then
  echo "No packaged backend JAR was found under backend/target." >&2
  exit 1
fi

stop_application() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  APP_PID=""
}

cleanup() {
  stop_application
}
trap cleanup EXIT

mysql_root() {
  if [[ -n "${MYSQL_CONTAINER_ID:-}" ]]; then
    docker exec -i \
      -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" \
      "$MYSQL_CONTAINER_ID" \
      mysql --protocol=socket --user=root --batch --skip-column-names "$@"
  else
    MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
      --protocol=tcp --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
      --user=root --batch --skip-column-names "$@"
  fi
}

mysql_app() {
  local database="$1"
  shift
  if [[ -n "${MYSQL_CONTAINER_ID:-}" ]]; then
    docker exec -i \
      -e MYSQL_PWD="$MYSQL_APP_PASSWORD" \
      "$MYSQL_CONTAINER_ID" \
      mysql --protocol=socket --user="$MYSQL_APP_USER" --database="$database" \
      --batch --skip-column-names "$@"
  else
    MYSQL_PWD="$MYSQL_APP_PASSWORD" mysql \
      --protocol=tcp --host="$MYSQL_HOST" --port="$MYSQL_PORT" \
      --user="$MYSQL_APP_USER" --database="$database" \
      --batch --skip-column-names "$@"
  fi
}

initialize_database() {
  local database="$1"
  mysql_root <<SQL
DROP DATABASE IF EXISTS \`$database\`;
CREATE DATABASE \`$database\` CHARACTER SET utf8mb4 COLLATE utf8mb4_vi_0900_ai_ci;
GRANT ALL PRIVILEGES ON \`$database\`.* TO '$MYSQL_APP_USER'@'%';
FLUSH PRIVILEGES;
SQL
}

wait_for_health() {
  local port="$1"
  local log_file="$2"
  local attempt

  for attempt in $(seq 1 120); do
    if curl --fail --silent "http://127.0.0.1:$port/actuator/health" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$APP_PID" 2>/dev/null; then
      echo "Application exited before becoming healthy. See $log_file." >&2
      tail -n 80 "$log_file" >&2 || true
      return 1
    fi
    sleep 1
  done

  echo "Application did not become healthy within 120 seconds. See $log_file." >&2
  tail -n 80 "$log_file" >&2 || true
  return 1
}

start_application() {
  local database="$1"
  local port="$2"
  local log_file="$3"
  local flyway_target="${4:-}"
  local ddl_auto="${5:-validate}"
  local -a extra_environment=()

  if [[ -n "$flyway_target" ]]; then
    extra_environment+=("SPRING_FLYWAY_TARGET=$flyway_target")
  fi

  stop_application
  env \
    "SPRING_PROFILES_ACTIVE=docker" \
    "DB_URL=jdbc:mysql://$MYSQL_HOST:$MYSQL_PORT/$database?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Ho_Chi_Minh&characterEncoding=UTF-8" \
    "DB_USERNAME=$MYSQL_APP_USER" \
    "DB_PASSWORD=$MYSQL_APP_PASSWORD" \
    "APP_JWT_SECRET=$APP_JWT_SECRET" \
    "APP_EMPLOYEE_IDENTITY_KEY=$APP_EMPLOYEE_IDENTITY_KEY" \
    "APP_BOOTSTRAP_ENABLED=false" \
    "APP_DEMO_SEED_ENABLED=false" \
    "SPRING_JPA_HIBERNATE_DDL_AUTO=$ddl_auto" \
    "${extra_environment[@]}" \
    java -jar "$JAR_FILE" --server.port="$port" >"$log_file" 2>&1 &
  APP_PID=$!
  wait_for_health "$port" "$log_file"
}

assert_scalar() {
  local actual="$1"
  local expected="$2"
  local description="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "Assertion failed: $description. Expected '$expected', got '$actual'." >&2
    exit 1
  fi
  echo "PASS: $description" | tee -a "$ARTIFACT_DIR/assertions.log"
}

assert_sql_rejected() {
  local database="$1"
  local sql="$2"
  local description="$3"
  if mysql_app "$database" --execute="$sql" >>"$ARTIFACT_DIR/constraint-errors.log" 2>&1; then
    echo "Assertion failed: $description was accepted unexpectedly." >&2
    exit 1
  fi
  echo "PASS: $description" | tee -a "$ARTIFACT_DIR/assertions.log"
}

echo "Testing a fresh database through Flyway, Hibernate validation, and application startup."
initialize_database "$FRESH_DATABASE"
start_application "$FRESH_DATABASE" 18080 "$ARTIFACT_DIR/fresh-startup.log"
assert_scalar \
  "$(mysql_app "$FRESH_DATABASE" --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")" \
  "26" \
  "fresh database reaches Flyway V26"
assert_scalar \
  "$(mysql_app "$FRESH_DATABASE" --execute="SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0;")" \
  "0" \
  "fresh database has no failed Flyway migration"
stop_application

echo "Creating a V23 database and seeding a representative historical order."
initialize_database "$LEGACY_DATABASE"
start_application "$LEGACY_DATABASE" 18081 "$ARTIFACT_DIR/v23-startup.log" "23" "none"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")" \
  "23" \
  "legacy database stops at Flyway V23"
stop_application

mysql_app "$LEGACY_DATABASE" < "$FIXTURE_FILE"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM orders WHERE order_code = 'GS-CI-LEGACY-0001';")" \
  "1" \
  "V23 fixture contains one historical order"

echo "Upgrading the seeded V23 database to V24."
start_application "$LEGACY_DATABASE" 18082 "$ARTIFACT_DIR/v24-upgrade-startup.log" "24" "none"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")" \
  "24" \
  "legacy database reaches Flyway V24"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM flyway_schema_history WHERE version = '24' AND success = 1;")" \
  "1" \
  "Flyway records V24 as successful"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM orders WHERE order_code = 'GS-CI-LEGACY-0001' AND status = 'COMPLETED' AND total_amount = 240000.00 AND version = 3;")" \
  "1" \
  "historical order data is preserved"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM order_bags bag JOIN orders legacy_order ON legacy_order.id = bag.order_id WHERE legacy_order.order_code = 'GS-CI-LEGACY-0001' AND bag.bag_code = 'GS-CI-LEGACY-0001-01' AND bag.sequence_number = 1 AND bag.status = 'LEGACY_UNVERIFIED';")" \
  "1" \
  "V24 creates the expected LEGACY_UNVERIFIED bag"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND constraint_type = 'UNIQUE' AND constraint_name IN ('uk_order_bags_code', 'uk_order_bags_order_sequence');")" \
  "2" \
  "order_bags unique constraints exist"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND constraint_name IN ('fk_order_bags_order', 'fk_order_bags_created_by', 'fk_order_bags_updated_by');")" \
  "3" \
  "order_bags foreign keys exist"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics WHERE table_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND index_name IN ('PRIMARY', 'uk_order_bags_code', 'uk_order_bags_order_sequence');")" \
  "3" \
  "order_bags primary and unique indexes exist"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND constraint_type = 'CHECK' AND constraint_name IN ('ck_order_bags_sequence', 'ck_order_bags_status', 'ck_order_bags_print_count');")" \
  "3" \
  "order_bags check constraints exist"

stop_application
echo "Upgrading the seeded V24 database to V25 with Hibernate validation."
start_application "$LEGACY_DATABASE" 18083 "$ARTIFACT_DIR/v25-upgrade-startup.log" "25" "none"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")" \
  "25" \
  "legacy database reaches Flyway V25"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM flyway_schema_history WHERE version = '25' AND success = 1;")" \
  "1" \
  "Flyway records V25 as successful"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM order_bags bag JOIN orders legacy_order ON legacy_order.id = bag.order_id WHERE legacy_order.order_code = 'GS-CI-LEGACY-0001' AND bag.status = 'LEGACY_UNVERIFIED' AND bag.voided_at IS NULL AND bag.voided_by IS NULL AND bag.void_reason IS NULL;")" \
  "1" \
  "V25 preserves the unverified legacy bag without void metadata"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND constraint_type = 'CHECK' AND constraint_name IN ('ck_order_bags_status', 'ck_order_bags_void_metadata');")" \
  "2" \
  "V25 bag status and void metadata checks exist"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = '$LEGACY_DATABASE' AND table_name = 'order_bags' AND constraint_name = 'fk_order_bags_voided_by';")" \
  "1" \
  "V25 voided-by foreign key exists"

LEGACY_ORDER_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM orders WHERE order_code = 'GS-CI-LEGACY-0001';")"
LEGACY_USER_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM users WHERE username = 'ci-legacy-user';")"

assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES ($LEGACY_ORDER_ID, 'GS-CI-LEGACY-0001-01', 2, 'RECEIVED', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "duplicate bag code is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES ($LEGACY_ORDER_ID, 'GS-CI-LEGACY-DUPLICATE-SEQUENCE', 1, 'RECEIVED', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "duplicate order sequence is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES (999999999, 'GS-CI-INVALID-FK', 2, 'RECEIVED', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "invalid order foreign key is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES ($LEGACY_ORDER_ID, 'GS-CI-INVALID-STATUS', 2, 'INVALID', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "invalid bag status is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES ($LEGACY_ORDER_ID, 'GS-CI-INVALID-VOID', 2, 'VOIDED', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "VOIDED bag without metadata is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by, voided_at, voided_by, void_reason) VALUES ($LEGACY_ORDER_ID, 'GS-CI-INVALID-RECEIVED', 2, 'RECEIVED', $LEGACY_USER_ID, $LEGACY_USER_ID, NOW(6), $LEGACY_USER_ID, 'Unexpected');" \
  "RECEIVED bag with void metadata is rejected"

stop_application
echo "Upgrading the seeded V25 database to V26 with Hibernate validation."
start_application "$LEGACY_DATABASE" 18084 "$ARTIFACT_DIR/v26-upgrade-startup.log"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1;")" \
  "26" \
  "legacy database reaches Flyway V26"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM flyway_schema_history WHERE version = '26' AND success = 1;")" \
  "1" \
  "Flyway records V26 as successful"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM processing_groups;")" \
  "0" \
  "V26 creates an empty processing group table"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = '$LEGACY_DATABASE' AND table_name = 'processing_groups' AND constraint_type = 'UNIQUE' AND constraint_name IN ('uk_processing_groups_code', 'uk_processing_groups_bag_sequence');")" \
  "2" \
  "V26 enforces immutable group and bag-sequence uniqueness"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = '$LEGACY_DATABASE' AND table_name = 'processing_groups' AND constraint_name IN ('fk_processing_groups_bag', 'fk_processing_groups_item', 'fk_processing_groups_created_by', 'fk_processing_groups_updated_by', 'fk_processing_groups_voided_by');")" \
  "5" \
  "V26 processing group foreign keys exist"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM permissions WHERE code IN ('sorting.read', 'sorting.process');")" \
  "2" \
  "V26 registers sorting permissions"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM order_bags bag JOIN orders o ON o.id = bag.order_id WHERE o.order_code = 'GS-CI-LEGACY-0001' AND bag.status = 'LEGACY_UNVERIFIED' AND bag.sorted_at IS NULL AND bag.sorted_by IS NULL;")" \
  "1" \
  "V26 preserves the historical unverified bag"
assert_sql_rejected "$LEGACY_DATABASE" \
  "UPDATE order_bags SET status = 'SORTED' WHERE order_id = $LEGACY_ORDER_ID;" \
  "SORTED bag without sorting metadata is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO processing_groups (order_bag_id, order_item_id, group_code, sequence_number, quantity, color_group, fabric_care, wash_mode, temperature_profile, detergent_profile, softener_profile, hygiene_level, separate_wash, drying_instruction, status, created_by, updated_by) VALUES (999999999, 999999999, 'BAD-G01', 1, 1, 'UNKNOWN', 'UNKNOWN', 'SERVICE_DEFAULT', 'SERVICE_DEFAULT', 'DEFAULT', 'DEFAULT', 'STANDARD', 0, 'TUMBLE_NORMAL', 'WAITING', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "processing group foreign keys are enforced"

mysql_app "$LEGACY_DATABASE" --execute="INSERT INTO laundry_services (code, name_vi, processing_type, default_unit_type, sharing_allowed, created_by, updated_by) VALUES ('CI-SORT', 'CI sorting service', 'WASH_DRY', 'KG', 1, $LEGACY_USER_ID, $LEGACY_USER_ID);"
LEGACY_SERVICE_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM laundry_services WHERE code = 'CI-SORT';")"
mysql_app "$LEGACY_DATABASE" --execute="INSERT INTO item_types (code, name_vi, default_unit_type, created_by, updated_by) VALUES ('CI-SORT-ITEM', 'CI sorting item', 'KG', $LEGACY_USER_ID, $LEGACY_USER_ID);"
LEGACY_ITEM_TYPE_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM item_types WHERE code = 'CI-SORT-ITEM';")"
mysql_app "$LEGACY_DATABASE" --execute="INSERT INTO order_items (order_id, service_id, item_type_id, service_code_snapshot, service_name_snapshot, item_type_code_snapshot, item_type_name_snapshot, pricing_method_snapshot, unit_type_snapshot, sharing_mode_snapshot, quantity, billable_quantity, line_amount, pricing_snapshot_json, quoted_at) VALUES ($LEGACY_ORDER_ID, $LEGACY_SERVICE_ID, $LEGACY_ITEM_TYPE_ID, 'CI-SORT', 'CI sorting service', 'CI-SORT-ITEM', 'CI sorting item', 'PER_KG', 'KG', 'ANY', 1.000, 1.000, 0, '{}', NOW(6));"
LEGACY_ITEM_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM order_items WHERE order_id = $LEGACY_ORDER_ID AND service_code_snapshot = 'CI-SORT';")"
mysql_app "$LEGACY_DATABASE" --execute="INSERT INTO order_bags (order_id, bag_code, sequence_number, status, created_by, updated_by) VALUES ($LEGACY_ORDER_ID, 'GS-CI-LEGACY-0001-02', 2, 'RECEIVED', $LEGACY_USER_ID, $LEGACY_USER_ID);"
SORTING_BAG_ID="$(mysql_app "$LEGACY_DATABASE" --execute="SELECT id FROM order_bags WHERE bag_code = 'GS-CI-LEGACY-0001-02';")"
assert_sql_rejected "$LEGACY_DATABASE" \
  "UPDATE order_bags SET sorted_at = NOW(6), sorted_by = $LEGACY_USER_ID WHERE id = $SORTING_BAG_ID;" \
  "RECEIVED bag cannot retain sorted metadata"
mysql_app "$LEGACY_DATABASE" --execute="INSERT INTO processing_groups (order_bag_id, order_item_id, group_code, sequence_number, quantity, color_group, fabric_care, wash_mode, temperature_profile, detergent_profile, softener_profile, hygiene_level, separate_wash, drying_instruction, status, created_by, updated_by) VALUES ($SORTING_BAG_ID, $LEGACY_ITEM_ID, 'GS-CI-LEGACY-0001-02-G01', 1, 1.000, 'DARK', 'STANDARD', 'NORMAL', 'T30', 'DEFAULT', 'DEFAULT', 'STANDARD', 0, 'HANG_DRY', 'WAITING', $LEGACY_USER_ID, $LEGACY_USER_ID);"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM processing_groups WHERE group_code = 'GS-CI-LEGACY-0001-02-G01' AND status = 'WAITING';")" \
  "1" \
  "V26 accepts a valid waiting group"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO processing_groups (order_bag_id, order_item_id, group_code, sequence_number, quantity, color_group, fabric_care, wash_mode, temperature_profile, detergent_profile, softener_profile, hygiene_level, separate_wash, drying_instruction, status, created_by, updated_by) VALUES ($SORTING_BAG_ID, $LEGACY_ITEM_ID, 'GS-CI-LEGACY-0001-02-G01', 2, 1.000, 'DARK', 'STANDARD', 'NORMAL', 'T30', 'DEFAULT', 'DEFAULT', 'STANDARD', 0, 'HANG_DRY', 'WAITING', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "duplicate group code is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO processing_groups (order_bag_id, order_item_id, group_code, sequence_number, quantity, color_group, fabric_care, wash_mode, temperature_profile, detergent_profile, softener_profile, hygiene_level, separate_wash, drying_instruction, status, created_by, updated_by) VALUES ($SORTING_BAG_ID, $LEGACY_ITEM_ID, 'GS-CI-LEGACY-0001-02-G02', 1, 1.000, 'DARK', 'STANDARD', 'NORMAL', 'T30', 'DEFAULT', 'DEFAULT', 'STANDARD', 0, 'HANG_DRY', 'WAITING', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "duplicate bag-group sequence is rejected"
assert_sql_rejected "$LEGACY_DATABASE" \
  "UPDATE processing_groups SET status = 'VOIDED' WHERE group_code = 'GS-CI-LEGACY-0001-02-G01';" \
  "VOIDED group without audit metadata is rejected"
mysql_app "$LEGACY_DATABASE" --execute="UPDATE processing_groups SET status = 'VOIDED', voided_at = NOW(6), voided_by = $LEGACY_USER_ID, void_reason = 'CI correction' WHERE group_code = 'GS-CI-LEGACY-0001-02-G01';"
assert_sql_rejected "$LEGACY_DATABASE" \
  "INSERT INTO processing_groups (order_bag_id, order_item_id, group_code, sequence_number, quantity, color_group, fabric_care, wash_mode, temperature_profile, detergent_profile, softener_profile, hygiene_level, separate_wash, drying_instruction, status, created_by, updated_by) VALUES ($SORTING_BAG_ID, $LEGACY_ITEM_ID, 'GS-CI-LEGACY-0001-02-G01', 2, 1.000, 'DARK', 'STANDARD', 'NORMAL', 'T30', 'DEFAULT', 'DEFAULT', 'STANDARD', 0, 'HANG_DRY', 'WAITING', $LEGACY_USER_ID, $LEGACY_USER_ID);" \
  "voided group code cannot be reused"
mysql_app "$LEGACY_DATABASE" --execute="UPDATE order_bags SET status = 'SORTED', sorted_at = NOW(6), sorted_by = $LEGACY_USER_ID WHERE id = $SORTING_BAG_ID;"
assert_scalar \
  "$(mysql_app "$LEGACY_DATABASE" --execute="SELECT COUNT(*) FROM order_bags WHERE id = $SORTING_BAG_ID AND status = 'SORTED' AND sorted_at IS NOT NULL AND sorted_by = $LEGACY_USER_ID;")" \
  "1" \
  "V26 accepts a sorted bag with actor and timestamp"

stop_application
echo "MySQL migration scenarios completed successfully." | tee -a "$ARTIFACT_DIR/assertions.log"
