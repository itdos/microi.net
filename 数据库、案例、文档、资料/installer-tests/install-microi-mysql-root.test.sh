#!/bin/bash
# 从安装器提取真实函数，覆盖输入、同源凭据、容器参数与权限失败关闭；不连接真实数据库。
set -euo pipefail
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/install-microi.sh
TEST_DIR=$(mktemp -d /tmp/microi-installer-root-test-XXXXXX)
trap 'rm -rf -- "${TEST_DIR}"' EXIT
bash -n "${SOURCE}"
load_function() {
  local body
  body=$(awk -v signature="$1() {" '$0 == signature {copy=1} copy {print} copy && /^}$/ {exit}' "${SOURCE}")
  [ -n "${body}" ] || { echo "Missing function: $1"; exit 1; }
  eval "${body}"
}
for fn in configure_database_profile configure_mysql_service_mode external_service_host_is_safe \
  repair_encode_connection_value configure_mysql_admin_connection prepare_external_mysql_client_config \
  run_mysql_api_client run_mysql_client verify_mysql_admin_permissions compose_yaml_double_quote; do
  load_function "${fn}"
done
# 保留真实 Docker 调用封装供参数检查，其余权限分支只替换外部 SQL 返回值。
eval "$(declare -f run_mysql_api_client | sed '1s/run_mysql_api_client/real_run_mysql_api_client/')"
run_mysql_api_client() {
  printf '%s\n' "$1" > "${TEST_DIR}/use-database"
  printf '%s\n' "${READBACK}"
  return "${QUERY_STATUS}"
}
docker() { printf '%s\n' "$@" > "${TEST_DIR}/docker-args"; }
reset_case() {
  DATABASE_TYPE=MySql DATABASE_SERVICE_MODE=managed DATABASE_USER=root
  DATABASE_PASSWORD='fixture-password' DATABASE_NAME=fixture_main
  DATABASE_CONTAINER_NAME=fixture_mysql DATABASE_INTERNAL_PORT=3306 DATABASE_PORT=61602
  MYSQL_EXTERNAL_CONNECTION_HOST=fixture.external MYSQL_EXTERNAL_USE_HOST_GATEWAY=0
  MYSQL_CLIENT_IMAGE=fixture/mysql MYSQL_CLIENT_CONFIG_FILE="${TEST_DIR}/client.cnf"
  READBACK=$'MICROI_MYSQL_ADMIN_PRIVILEGES_OK\nMICROI_MYSQL_WRITABLE_OK\nGRANT ALL PRIVILEGES ON *.* TO root@% WITH GRANT OPTION'
  QUERY_STATUS=0
  unset MICROI_MYSQL_SERVICE_MODE MICROI_EXTERNAL_MYSQL_HOST MICROI_EXTERNAL_MYSQL_PORT \
    MICROI_EXTERNAL_MYSQL_USER MICROI_EXTERNAL_MYSQL_PASSWORD
}
COUNT=0
pass() { COUNT=$((COUNT + 1)); printf 'PASS %02d %s\n' "${COUNT}" "$1"; }
expect_failure() {
  if "$@" > "${TEST_DIR}/output" 2>&1; then
    echo "Expected failure: $*" >&2; exit 1
  fi
}

reset_case
configure_mysql_admin_connection
[[ "${OS_CLIENT_DB_CONN}" == 'Data Source=fixture_mysql;Database=fixture_main;User Id=root;Password=fixture-password;Port=3306;'* ]]
[[ "${OS_CLIENT_DB_CONN}" == *'SslMode=None;' ]]
pass 'managed API uses the generated root password and internal port'

reset_case
DATABASE_SERVICE_MODE=external DATABASE_PORT=3307
configure_mysql_admin_connection
[[ "${OS_CLIENT_DB_CONN}" == 'Data Source=fixture.external;Database=fixture_main;User Id=root;Password=fixture-password;Port=3307;'* ]]
[[ "${OS_CLIENT_DB_CONN}" == *'SslMode=Preferred;' ]]
pass 'external API uses the supplied root password and external port'

reset_case
DATABASE_USER=business
expect_failure configure_mysql_admin_connection
pass 'a non-root account cannot generate an API connection'

reset_case
DATABASE_PASSWORD=''
expect_failure configure_mysql_admin_connection
pass 'missing root password stops configuration'

reset_case
DATABASE_PASSWORD=$'line\nbreak'
expect_failure configure_mysql_admin_connection
pass 'multiline password is rejected before YAML generation'

reset_case
DATABASE_PASSWORD=' fixture;"$pass\word '
configure_mysql_admin_connection
[[ "${OS_CLIENT_DB_CONN}" == *'Password=" fixture;""$pass\word ";Port=3306;'* ]]
quoted=$(compose_yaml_double_quote "OsClientDbConn=${OS_CLIENT_DB_CONN}")
[[ "${quoted}" == *'$$pass\\word '* ]]
pass 'special root password is quoted for ADO.NET and Compose'

reset_case
prepare_external_mysql_client_config
grep -qx 'host="fixture_mysql"' "${MYSQL_CLIENT_CONFIG_FILE}"
grep -qx 'user=root' "${MYSQL_CLIENT_CONFIG_FILE}"
grep -qx 'port=3306' "${MYSQL_CLIENT_CONFIG_FILE}"
grep -qx 'ssl-mode=DISABLED' "${MYSQL_CLIENT_CONFIG_FILE}"
pass 'managed SQL probe uses the same root endpoint as API'

reset_case
DATABASE_SERVICE_MODE=external DATABASE_PORT=3307
DATABASE_PASSWORD='quote"slash\dollar$semicolon;'
prepare_external_mysql_client_config
grep -qx 'host="fixture.external"' "${MYSQL_CLIENT_CONFIG_FILE}"
grep -qx 'ssl-mode=PREFERRED' "${MYSQL_CLIENT_CONFIG_FILE}"
grep -Fqx 'password="quote\"slash\\dollar$semicolon;"' "${MYSQL_CLIENT_CONFIG_FILE}"
pass 'external SQL config retains exact special password bytes'

reset_case
real_run_mysql_api_client 1 --batch -e 'SELECT 1;'
grep -A1 -x -- '--network' "${TEST_DIR}/docker-args" | grep -qx microi
grep -qx fixture_main "${TEST_DIR}/docker-args"
! grep -q fixture-password "${TEST_DIR}/docker-args"
! grep -q host-gateway "${TEST_DIR}/docker-args"
pass 'managed root is probed from API network with no password argument'

reset_case
DATABASE_SERVICE_MODE=external MYSQL_EXTERNAL_USE_HOST_GATEWAY=1
real_run_mysql_api_client 0 --batch -e 'SELECT 1;'
grep -qx 'host.docker.internal:host-gateway' "${TEST_DIR}/docker-args"
! grep -qx fixture_main "${TEST_DIR}/docker-args"
pass 'external localhost preserves host-gateway and no-database preflight'

reset_case
verify_mysql_admin_permissions > "${TEST_DIR}/output"
grep -qx 0 "${TEST_DIR}/use-database"
pass 'complete root privileges pass before import'
verify_mysql_admin_permissions 1 > "${TEST_DIR}/output"
grep -qx 1 "${TEST_DIR}/use-database"
pass 'post-import gate opens the actual primary tenant database'

reset_case
READBACK='MICROI_MYSQL_WRITABLE_OK'
expect_failure verify_mysql_admin_permissions
pass 'missing root or any required global privilege stops installation'

reset_case
READBACK+=$'\nREVOKE SELECT ON `restricted_db`.* FROM `root`@`%`'
expect_failure verify_mysql_admin_permissions
pass 'MySQL 8 partial revokes cannot masquerade as unrestricted root'

reset_case
READBACK=$'MICROI_MYSQL_ADMIN_PRIVILEGES_OK\nMICROI_MYSQL_READ_ONLY'
expect_failure verify_mysql_admin_permissions
pass 'read-only primary database stops installation'

reset_case
READBACK='hidden-password-or-authentication-hash' QUERY_STATUS=1
expect_failure verify_mysql_admin_permissions
! grep -q hidden-password-or-authentication-hash "${TEST_DIR}/output"
pass 'failed authentication or mysql.user query never prints grants or secrets'

reset_case
READBACK=$'MICROI_MYSQL_ADMIN_PRIVILEGES_OK\r\nMICROI_MYSQL_WRITABLE_OK\r\n'
verify_mysql_admin_permissions > "${TEST_DIR}/output"
pass 'CRLF SQL output remains compatible'

reset_case
configure_database_profile 1
[ "${DATABASE_USER}" = root ]
configure_database_profile 2
[ "${DATABASE_USER}" = root ]
pass 'both MySQL versions select root'

reset_case
configure_database_profile 3
[ "${DATABASE_USER}" = sa ]
configure_database_profile 5
[ "${DATABASE_USER}" = SYSDBA ]
configure_database_profile 6
[ "${DATABASE_USER}" = postgres ]
pass 'other database administrator names remain unchanged'

reset_case
configure_database_profile 2
MICROI_MYSQL_SERVICE_MODE=external MICROI_EXTERNAL_MYSQL_HOST=localhost MICROI_EXTERNAL_MYSQL_PORT=3306
MICROI_EXTERNAL_MYSQL_USER=business MICROI_EXTERNAL_MYSQL_PASSWORD=fixture-password
expect_failure configure_mysql_service_mode
pass 'non-root input is rejected before external service writes'

reset_case
configure_database_profile 2
MICROI_MYSQL_SERVICE_MODE=external MICROI_EXTERNAL_MYSQL_HOST=localhost MICROI_EXTERNAL_MYSQL_PORT=3306
MICROI_EXTERNAL_MYSQL_USER=root MICROI_EXTERNAL_MYSQL_PASSWORD=fixture-password
configure_mysql_service_mode > "${TEST_DIR}/output"
[ "${DATABASE_USER}" = root ] && [ "${MYSQL_EXTERNAL_PASSWORD}" = fixture-password ]
[ "${MYSQL_EXTERNAL_CONNECTION_HOST}" = host.docker.internal ]
! grep -q fixture-password "${TEST_DIR}/output"
pass 'explicit root retains supplied password without echoing it'

reset_case
configure_database_profile 2
MICROI_MYSQL_SERVICE_MODE=external MICROI_EXTERNAL_MYSQL_HOST=localhost MICROI_EXTERNAL_MYSQL_PORT=3306
MICROI_EXTERNAL_MYSQL_PASSWORD=fixture-password
configure_mysql_service_mode <<< '' > "${TEST_DIR}/output"
[ "${DATABASE_USER}" = root ]
pass 'Enter defaults to root'

# 执行真实步骤片段，锁定权限检查发生在已有服务状态检查/后续写入之前，而不是一个未调用的帮助函数。
preflight=$(awk '/^MYSQL_EXTERNAL_TARGET_DATABASE_EXISTS=0$/ {copy=1} copy && /^else$/ {exit} copy {print}' "${SOURCE}")$'\nfi'
run_mysql_client() {
  printf '%s\n' "$*" >> "${TEST_DIR}/sql-commands"
  case "$*" in
    *'SELECT VERSION();'*) echo '8.0.46' ;;
    *'SELECT COUNT(*) FROM information_schema.SCHEMATA'*) echo 0 ;;
    *) return 99 ;;
  esac
}
reset_case
DATABASE_SERVICE_MODE=external MYSQL_VERSION=8.0 DATABASE_DISPLAY_NAME='MySQL 8.0'
MYSQL_EXTERNAL_HOST_DISPLAY='fixture.external'
READBACK='MICROI_MYSQL_WRITABLE_OK'
if (eval "${preflight}"; : > "${TEST_DIR}/import-reached") > "${TEST_DIR}/output" 2>&1; then
  echo 'Preflight should stop without root privileges' >&2; exit 1
fi
[ ! -f "${TEST_DIR}/import-reached" ]
! grep -q information_schema.SCHEMATA "${TEST_DIR}/sql-commands"
pass 'actual external preflight stops before database processing when privileges fail'

reset_case
DATABASE_SERVICE_MODE=external MYSQL_VERSION=8.0 DATABASE_DISPLAY_NAME='MySQL 8.0'
MYSQL_EXTERNAL_HOST_DISPLAY='fixture.external'
(eval "${preflight}"; : > "${TEST_DIR}/import-reached") > "${TEST_DIR}/output" 2>&1
[ -f "${TEST_DIR}/import-reached" ]
pass 'actual external preflight allows initialized root through'

api_connection_block=$(awk '/^APP_DIR="\$\{COMPOSE_BASE_DIR\}\/microi-install-app"$/ {copy=1} copy {print} copy && /^esac$/ {exit}' "${SOURCE}")
[ -n "${api_connection_block}" ]
reset_case
DATABASE_CHOICE=2 COMPOSE_BASE_DIR="${TEST_DIR}"
READBACK='MICROI_MYSQL_WRITABLE_OK'
if (eval "${api_connection_block}"; : > "${TEST_DIR}/api-reached") > "${TEST_DIR}/output" 2>&1; then
  echo 'API deployment should stop when privileges were changed by import' >&2; exit 1
fi
[ ! -f "${TEST_DIR}/api-reached" ]
grep -qx 1 "${TEST_DIR}/use-database"
pass 'actual API deployment rechecks root against the initialized primary database'

printf 'MYSQL_ROOT_BEHAVIOR_CASES=%s\n' "${COUNT}"
