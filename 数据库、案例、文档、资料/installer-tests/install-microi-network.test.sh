#!/bin/bash
# 无宿主机写入的行为回归。Linux：bash installer-tests/install-microi-network.test.sh
set -euo pipefail
exec 3>&2
SOURCE=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/install-microi.sh
TEST_DIR=$(mktemp -d /tmp/microi-installer-network-test-XXXXXX)
trap 'status=$?; if [ "$status" -ne 0 ] && [ -f "${TEST_DIR}/output" ]; then cat "${TEST_DIR}/output" >&3; fi; rm -rf -- "${TEST_DIR}"' EXIT
bash -n "${SOURCE}"

# 执行安装器中的真实函数；Docker/firewalld 用有状态替身，禁止运行安装主流程。
load_function() {
  local body
  body=$(awk -v signature="$1() {" '$0 == signature {copy=1} copy {print} copy && /^}$/ {exit}' "${SOURCE}")
  [ -n "${body}" ] || { echo "Missing function: $1"; exit 1; }
  eval "${body}"
}
for fn in microi_firewalld_active ensure_microi_bridge_firewalld ensure_minio_mc_image \
  probe_minio_internal_network print_minio_network_diagnostics repair_microi_network \
  firewall_open_port firewall_persist_rules is_rhel_based prepare_docker_repository_compatibility; do
  load_function "${fn}"
done
sudo() { "$@"; }
sleep() { :; }
dnf() { printf 'dnf %s\n' "$*" >> "${TEST_DIR}/commands"; return "${DNF_RESULT}"; }
microi_local_bridge_exists() { [ "$1" = "${VALID_BRIDGE}" ]; }
docker() {
  printf 'docker %s\n' "$*" >> "${TEST_DIR}/commands"
  case "$1 ${2:-}" in
    'network inspect')
      [ "$3" != microi-ocr ] || return 1
      [ "${NETWORK_EXISTS}" = 1 ] || return 1
      printf '%s|%s|%s|%s\n' "${NETWORK_ID}" "${NETWORK_DRIVER}" "${NETWORK_BRIDGE}" "${NETWORK_ICC}"
      ;;
    'image inspect') return 0 ;;
    'inspect microi-install-minio') printf '%s\n' "${MINIO_RUNNING}" ;;
    'run --rm')
      if [[ " $* " == *' --entrypoint /usr/bin/timeout '* ]]; then return "${PROBE_RESULT}"
      else return "${MC_RESULT}"; fi ;;
    'info ') return 0 ;;
    *) echo "Unexpected docker command: $*" >&2; return 99 ;;
  esac
}
firewall-cmd() {
  printf 'firewall-cmd %s\n' "$*" >> "${TEST_DIR}/commands"
  local scope=runtime arg operation='' value=''
  for arg in "$@"; do
    case "$arg" in
      --permanent) scope=permanent ;;
      --zone=docker) ;;
      --state|--list-all) operation="$arg" ;;
      --query-interface=*|--change-interface=*|--query-port=*|--add-port=*)
        operation="${arg%%=*}"; value="${arg#*=}" ;;
      *) echo "Unexpected firewall command: $*" >&2; return 99 ;;
    esac
  done
  case "${operation}" in
    --state) [ "${FIREWALL_ACTIVE}" = 1 ] ;;
    --list-all)
      [ "${ZONE_EXISTS}" = 1 ] || return 112
      if [ "${scope}" = permanent ]; then printf 'docker\n  target: %s\n' "${PERMANENT_TARGET}"
      else printf 'docker\n  target: %s\n' "${RUNTIME_TARGET}"; fi ;;
    --query-interface|--query-port) [ -f "${TEST_DIR}/${scope}-${value}" ] ;;
    --change-interface|--add-port)
      [ "${WRITE_FAIL}" != "${scope}" ] || return 1
      printf '%s %s %s\n' "${operation}" "${scope}" "${value}" >> "${TEST_DIR}/mutations"
      [ "${READBACK_FAIL}" != 1 ] || return 0
      mkdir -p "$(dirname "${TEST_DIR}/${scope}-${value}")"
      : > "${TEST_DIR}/${scope}-${value}"
      ;;
    *) return 99 ;;
  esac
}
reset_case() {
  find "${TEST_DIR}" -mindepth 1 -delete
  : > "${TEST_DIR}/commands"; : > "${TEST_DIR}/mutations"
  NETWORK_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  NETWORK_DRIVER=bridge NETWORK_BRIDGE='<no value>' NETWORK_ICC='<no value>' NETWORK_EXISTS=1
  VALID_BRIDGE=br-aaaaaaaaaaaa FIREWALL_ACTIVE=1 ZONE_EXISTS=1
  RUNTIME_TARGET=ACCEPT PERMANENT_TARGET=ACCEPT WRITE_FAIL='' READBACK_FAIL=0
  MINIO_RUNNING=true PROBE_RESULT=0 MC_RESULT=0 MINIO_MC_IMAGE=fixture/minio-mc
  MINIO_SERVICE_MODE=managed MINIO_EXTERNAL_USE_HOST_GATEWAY=0
  MINIO_MC_ENDPOINT=http://microi-install-minio:9000
  MINIO_ACCESS_KEY=FixtureKey MINIO_SECRET_KEY=FixtureSecret
  MINIO_PRIVATE_BUCKET=mci-private MINIO_PUBLIC_BUCKET=mci-public
  SCRIPT_VERSION=test
  DNF_RESULT=0 OS_VERSION_ID=3
}
expect_failure() { if "$@"; then echo "Expected failure: $*" >&2; return 1; fi; }
no_mutations() { [ ! -s "${TEST_DIR}/mutations" ]; }

case_restore_and_rerun() {
  ensure_microi_bridge_firewalld microi
  [ "$(wc -l < "${TEST_DIR}/mutations")" -eq 2 ]
  ensure_microi_bridge_firewalld microi
  [ "$(wc -l < "${TEST_DIR}/mutations")" -eq 2 ]
  [ -f "${TEST_DIR}/runtime-${VALID_BRIDGE}" ] && [ -f "${TEST_DIR}/permanent-${VALID_BRIDGE}" ]
}
case_custom_bridge() {
  NETWORK_BRIDGE=mci-custom VALID_BRIDGE=mci-custom
  ensure_microi_bridge_firewalld microi
  [ -f "${TEST_DIR}/runtime-mci-custom" ]
}
case_missing_firewalld() {
  FIREWALL_ACTIVE=0
  ensure_microi_bridge_firewalld microi
  no_mutations
}
case_invalid_network() {
  NETWORK_DRIVER=overlay
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_disabled_icc() {
  NETWORK_ICC=false
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_unowned_network() {
  expect_failure ensure_microi_bridge_firewalld unrelated
  [ ! -s "${TEST_DIR}/commands" ]
}
case_non_bridge_interface() {
  NETWORK_BRIDGE=eth0
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_bad_network_id() {
  NETWORK_ID='unexpected/name'
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_missing_zone() {
  ZONE_EXISTS=0
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_reject_target() {
  RUNTIME_TARGET=REJECT
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_permanent_target_mismatch() {
  PERMANENT_TARGET=DROP
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_write_failure() {
  WRITE_FAIL=permanent
  expect_failure ensure_microi_bridge_firewalld microi
  no_mutations
}
case_readback_failure() {
  READBACK_FAIL=1
  expect_failure ensure_microi_bridge_firewalld microi
}
case_ports_without_reload() {
  firewall_open_port 61605
  firewall_persist_rules
  firewall_open_port 61605
  [ "$(wc -l < "${TEST_DIR}/mutations")" -eq 2 ]
  [ -f "${TEST_DIR}/runtime-61605/tcp" ] && [ -f "${TEST_DIR}/permanent-61605/tcp" ]
}
case_port_write_failure() {
  WRITE_FAIL=runtime
  expect_failure firewall_open_port 61605
}
case_port_readback_failure() {
  READBACK_FAIL=1
  expect_failure firewall_open_port 61605
}
case_repair_preserves_services() {
  repair_microi_network
  grep -q 'run --rm --network microi --entrypoint /usr/bin/timeout' "${TEST_DIR}/commands"
  ! grep -Eq 'docker (restart|rm|compose|stop|start)|--reload|--set-target|--zone=trusted' "${TEST_DIR}/commands"
}
case_repair_probe_failure() {
  PROBE_RESULT=124
  expect_failure repair_microi_network
}
case_repair_missing_minio() {
  MINIO_RUNNING=false
  expect_failure repair_microi_network
  ! grep -q 'docker run' "${TEST_DIR}/commands"
}
case_os_family() {
  OS_ID=alinux; is_rhel_based
  OS_ID=anolis; is_rhel_based
  OS_ID=centos; is_rhel_based
  OS_ID=ubuntu; expect_failure is_rhel_based
}
run_minio_initialization() (
  # 运行真实步骤 9 的初始化段；其 exit 和临时 mc 配置只影响本子进程。
  set -e
  trap 'if [[ "${MINIO_MC_CONFIG_DIR:-}" == /tmp/microi_minio_mc_* ]]; then rm -rf -- "${MINIO_MC_CONFIG_DIR}"; fi' EXIT
  eval "$(awk '/^# 使用吾码阿里云镜像中的官方 mc/ {copy=1} /^# 新装服务使用 Docker DNS/ {exit} copy {print}' "${SOURCE}")"
)
case_initialization_network_failure_blocks_alias() {
  PROBE_RESULT=1
  expect_failure run_minio_initialization
  ! grep -q -- '--config-dir /root/.mc alias set' "${TEST_DIR}/commands"
  ! grep -q -- '--config-dir /root/.mc mb' "${TEST_DIR}/commands"
}
case_external_minio_keeps_host_gateway() {
  MINIO_SERVICE_MODE=external MINIO_EXTERNAL_USE_HOST_GATEWAY=1
  MINIO_MC_ENDPOINT=https://host.docker.internal:9100
  run_minio_initialization
  ! grep -q -- '--entrypoint /usr/bin/timeout' "${TEST_DIR}/commands"
  grep -q -- '--add-host host.docker.internal:host-gateway' "${TEST_DIR}/commands"
  grep -q -- 'alias set microi-local https://host.docker.internal:9100' "${TEST_DIR}/commands"
  grep -q -- 'anonymous get microi-local/mci-private' "${TEST_DIR}/commands"
  grep -q -- 'anonymous get microi-local/mci-public' "${TEST_DIR}/commands"
}
case_auth_failure_blocks_bucket_creation() {
  MINIO_SERVICE_MODE=external MC_RESULT=1
  expect_failure run_minio_initialization
  ! grep -q -- '--config-dir /root/.mc mb' "${TEST_DIR}/commands"
}
case_alinux_repository_adapter() {
  OS_ID=alinux OS_VERSION_ID=3
  prepare_docker_repository_compatibility
  grep -q 'dnf install -y dnf-plugin-releasever-adapter --repo alinux3-plus' "${TEST_DIR}/commands"
}
case_other_os_repository_unchanged() {
  OS_ID=anolis OS_VERSION_ID=8
  prepare_docker_repository_compatibility
  [ ! -s "${TEST_DIR}/commands" ]
}
case_alinux_repository_failure() {
  OS_ID=alinux OS_VERSION_ID=3 DNF_RESULT=1
  expect_failure prepare_docker_repository_compatibility
}

count=0
for test_case in $(declare -F | awk '$3 ~ /^case_/ {print $3}'); do
  reset_case
  # 不以 if 调用整个测试函数，确保函数中每个断言仍受 set -e 约束。
  "${test_case}" > "${TEST_DIR}/output" 2>&1
  count=$((count + 1))
  echo "PASS ${test_case}"
done
echo "PASS ${count} installer network cases"
