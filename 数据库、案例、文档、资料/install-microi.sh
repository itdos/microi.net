#!/bin/bash

# ============================================================
# Microi吾码平台 Docker Compose 一键安装脚本
# 支持宝塔面板 Docker 编排模块可视化管理
# 兼容 CentOS 7/8/9、Ubuntu 20/22/24、Debian 10/11/12
# 版本：v2026-08-17 06:47:47
# 维护规则：每次修改本文件必须同步更新此版本时间（Asia/Shanghai，精确到秒）
# ============================================================
# 编排列表（每个编排在宝塔面板中独立可见）：
#   microi-install-database   - 主数据库（可选择复用已有 MySQL，此时不生成）
#   microi-install-redis      - Redis 7.4.2 缓存
#   microi-install-mongodb    - MongoDB 数据库
#   microi-install-minio      - MinIO 对象存储（可选择复用已有服务，此时不生成）
#   microi-install-ocr        - PaddleX/PaddleOCR CPU 文字识别服务（默认安装）
#   microi-install-app        - 平台应用（API + Web）
#   microi-install-watchtower - 自动更新服务
#   microi-install-libretranslate - LibreTranslate 翻译服务（默认安装基础套餐）
#   microi-install-ollama     - Ollama Embedding 服务（不推荐，默认不安装）
#   microi-install-qdrant     - Qdrant 向量数据库（不推荐，默认不安装）
# ============================================================
# 端口分配规则：
#   默认从 61600 开始寻找连续端口块，候选起点冲突时每次 +1，最多递增 100 次
#   61600 高于 Linux 默认临时端口上限 60999；实际临时端口范围仍以宿主机 ip_local_port_range 为准
#   第 1 个端口分配给 Web，第 2 个分配给 API；默认新装基础组件（含 OCR）占 8 个端口
#   默认顺序: Web, API, 主数据库, Redis, MongoDB, MinIO-API, MinIO-Console, OCR
#   复用已有 MySQL 时去掉主数据库端口；复用已有 MinIO 时去掉其 API/Console 两个端口
#   LibreTranslate（默认安装）排在 OCR 之后；已停用的 Ollama/Qdrant 端口保留在所有推荐组件之后
# ============================================================

set -e

SCRIPT_VERSION="v2026-08-17 06:47:47"
RUNTIME_OS_CLIENT_TYPE="Product"
RUNTIME_OS_CLIENT_NETWORK="Internal"
MINIMUM_PLATFORM_SERVER_VERSION="6.9.8.6"
API_IMAGE="${MICROI_INSTALL_API_IMAGE_OVERRIDE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest}"
CLIENT_IMAGE="${MICROI_INSTALL_CLIENT_IMAGE_OVERRIDE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-client-dev:latest}"
APP_API_PULL_POLICY="always"
APP_CLIENT_PULL_POLICY="always"
if [ -n "${MICROI_INSTALL_API_IMAGE_OVERRIDE:-}" ]; then
  APP_API_PULL_POLICY="never"
fi
if [ -n "${MICROI_INSTALL_CLIENT_IMAGE_OVERRIDE:-}" ]; then
  APP_CLIENT_PULL_POLICY="never"
fi
OCR_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/paddlex-ocr:3.6.1-paddle3.2.2-cpu"
OCR_CONTAINER_NAME="microi-install-ocr"
OCR_INTERNAL_PORT=8080
OCR_RUNTIME_NETWORK="microi-ocr"
OCR_SERVICE_ENDPOINT="http://${OCR_CONTAINER_NAME}:${OCR_INTERNAL_PORT}/ocr"
LIBRETRANSLATE_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6-microi1"
LIBRETRANSLATE_CONTAINER_NAME="microi-install-libretranslate"
LIBRETRANSLATE_INTERNAL_PORT=5000
LIBRETRANSLATE_SERVICE_ENDPOINT="http://${LIBRETRANSLATE_CONTAINER_NAME}:${LIBRETRANSLATE_INTERNAL_PORT}"
MYSQL_CLIENT_IMAGE="${MICROI_INSTALL_MYSQL_CLIENT_IMAGE_OVERRIDE:-registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0}"
MINIO_MC_IMAGE="${MICROI_INSTALL_MINIO_MC_IMAGE_OVERRIDE:-registry.cn-hangzhou.aliyuncs.com/microios/minio-mc:RELEASE.2025-08-13T08-35-41Z}"

# ============================================================
# 已安装环境的 API + Web 原地更新/修复
# ============================================================
# 该模式只接管 microi-install-api / microi-install-client 两个无状态应用容器。
# 它不会删除数据库、Redis、MongoDB、MinIO 容器、数据目录或 Docker volume。
REPAIR_TEMP_DIR=""
REPAIR_WATCHTOWER_WAS_RUNNING=0
REPAIR_CANDIDATES=()
REPAIR_LABEL_CANDIDATE_COUNT=0

repair_add_candidate() {
  local candidate="${1:-}"
  local resolved=""
  local existing=""
  [ -n "${candidate}" ] || return 0
  [ -f "${candidate}" ] || return 0
  resolved=$(readlink -f "${candidate}" 2>/dev/null || printf '%s' "${candidate}")
  for existing in "${REPAIR_CANDIDATES[@]:-}"; do
    [ "${existing}" = "${resolved}" ] && return 0
  done
  REPAIR_CANDIDATES+=("${resolved}")
}

repair_add_container_compose_candidate() {
  local container_name="$1"
  local config_files=""
  local working_dir=""
  local first_config=""
  local candidate_count_before=0
  docker inspect "${container_name}" > /dev/null 2>&1 || return 0
  config_files=$(docker inspect "${container_name}" \
    --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' 2>/dev/null || true)
  working_dir=$(docker inspect "${container_name}" \
    --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>/dev/null || true)
  [ "${config_files}" != "<no value>" ] || config_files=""
  [ "${working_dir}" != "<no value>" ] || working_dir=""
  if [[ "${config_files}" == *,* ]]; then
    echo "Microi：错误：容器 ${container_name} 使用了多层 Compose 文件：${config_files}"
    echo 'Microi：为避免丢失现场覆盖配置，自动修复已在删除任何容器前停止。'
    return 1
  fi
  first_config="${config_files}"
  if [ -n "${first_config}" ] && [[ "${first_config}" != /* ]] && [ -n "${working_dir}" ]; then
    first_config="${working_dir}/${first_config}"
  fi
  candidate_count_before=${#REPAIR_CANDIDATES[@]}
  repair_add_candidate "${first_config}"
  if [ "${#REPAIR_CANDIDATES[@]}" -gt "${candidate_count_before}" ]; then
    REPAIR_LABEL_CANDIDATE_COUNT=$((REPAIR_LABEL_CANDIDATE_COUNT + 1))
  fi
}

repair_config_has_app_services() {
  local compose_file="$1"
  local services=""
  services=$(docker compose -f "${compose_file}" config --services 2>/dev/null) || return 1
  printf '%s\n' "${services}" | grep -Fxq 'microi-install-api' \
    && printf '%s\n' "${services}" | grep -Fxq 'microi-install-client'
}

repair_hash_file() {
  local file_path="$1"
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "${file_path}" | awk '{print $1}'
  else
    openssl dgst -sha256 "${file_path}" | awk '{print $NF}'
  fi
}

repair_extract_api_block() {
  local canonical_file="$1"
  local output_file="$2"
  awk '
    /^  microi-install-api:$/ { in_service=1; print; next }
    in_service && /^  [A-Za-z0-9_.-]+:$/ { exit }
    in_service { print }
  ' "${canonical_file}" > "${output_file}"
}

repair_extract_api_environment_block() {
  local api_block="$1"
  local output_file="$2"
  awk '
    /^    environment:$/ { in_environment=1; next }
    in_environment && /^    [A-Za-z0-9_.-]+:/ { exit }
    in_environment { print }
  ' "${api_block}" > "${output_file}"
}

repair_validate_api_environment() {
  local canonical_file="$1"
  local api_block="${REPAIR_TEMP_DIR}/api-service.yml"
  local environment_block="${REPAIR_TEMP_DIR}/api-environment.yml"
  local required_key=""
  local value=""
  local actual_key=""
  local required_keys=(
    OsClient OsClientType OsClientNetwork OsClientDbType OsClientDbConn
    OsClientRedisHost OsClientRedisPort OsClientRedisPwd
    OsClientRedisDataBase OsClientDbMongoConn
  )
  repair_extract_api_block "${canonical_file}" "${api_block}"
  repair_extract_api_environment_block "${api_block}" "${environment_block}"
  for required_key in "${required_keys[@]}"; do
    value=$(sed -n -E "s/^[[:space:]]{6}${required_key}:[[:space:]]*//p" "${environment_block}" | head -1)
    value=$(printf '%s' "${value}" | sed -E "s/^[[:space:]]+//;s/[[:space:]]+$//")
    case "${value}" in
      ''|'""'|"''"|null|'~')
        echo "Microi：错误：应用编排中的 ${required_key} 缺失或为空。"
        echo 'Microi：自动修复已在删除任何容器前停止，请先恢复原安装生成的完整应用编排。'
        return 1
        ;;
    esac
  done
  while IFS= read -r actual_key; do
    case "${actual_key}" in
      OsClient|OsClientType|OsClientNetwork|OsClientDbType|OsClientDbConn|OsClientRedisHost|OsClientRedisPort|OsClientRedisPwd|OsClientRedisDataBase|OsClientDbMongoConn|ASPNETCORE_ENVIRONMENT|ASPNETCORE_URLS|DOTNET_ENVIRONMENT|DOTNET_RUNNING_IN_CONTAINER)
        ;;
      *)
        echo "Microi：错误：应用编排包含不在后端启动白名单中的环境变量 ${actual_key}。"
        echo 'Microi：为避免用旧配置覆盖 SaaS 引擎配置，自动修复已在删除任何容器前停止。'
        return 1
        ;;
    esac
  done < <(sed -n -E 's/^[[:space:]]{6}([A-Za-z][A-Za-z0-9_]*):.*/\1/p' "${environment_block}")
}

repair_read_api_environment_value() {
  local api_block="$1"
  local key="$2"
  local value=""
  # 较旧的 Docker Compose 会把长 plain scalar 折成多行 YAML，例如将
  # `...;User Id=root;...` 在 User 与 Id 之间换行。续行属于同一个值，
  # 必须先按 YAML 的折叠语义用空格拼回；否则完整连接串会被误判成以 User
  # 结尾的裸片段。这里只读取 docker compose config 生成的规范 environment
  # mapping，下一项固定恢复为 6 空格缩进，续行至少为 8 空格缩进。
  value=$(awk -v wanted_key="${key}" '
    index($0, "      " wanted_key ":") == 1 {
      line = substr($0, length("      " wanted_key ":") + 1)
      sub(/^[[:space:]]+/, "", line)
      value = line
      found = 1
      next
    }
    found && index($0, "        ") == 1 {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      value = value " " line
      next
    }
    found { exit }
    END { if (found) print value }
  ' "${api_block}")
  value=$(printf '%s' "${value}" | sed -E "s/^[[:space:]]+//;s/[[:space:]]+$//")
  if [[ "${value}" == \"*\" ]] || [[ "${value}" == \'*\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "${value}"
}

repair_read_container_environment_value() {
  local container_name="$1"
  local key="$2"
  docker inspect "${container_name}" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null \
    | awk -v prefix="${key}=" '
        index($0, prefix) == 1 {
          print substr($0, length(prefix) + 1)
          exit
        }
      '
}

microi_database_name_is_safe() {
  local database_name="${1:-}"
  [[ "${database_name}" =~ ^[A-Za-z0-9][A-Za-z0-9_\$-]{0,62}$ ]]
}

repair_read_container_database_label() {
  local container_name="$1"
  local database_name=""
  database_name=$(docker inspect "${container_name}" \
    --format '{{ index .Config.Labels "com.microi.database.name" }}' 2>/dev/null || true)
  [ "${database_name}" != '<no value>' ] || database_name=""
  printf '%s' "${database_name}"
}

repair_read_connection_database_name() {
  local db_conn="$1"
  printf '%s' "${db_conn}" | awk -F';' '
    {
      for (field_index = 1; field_index <= NF; field_index++) {
        segment = $field_index
        separator = index(segment, "=")
        if (separator <= 1) continue
        key = substr(segment, 1, separator - 1)
        value = substr(segment, separator + 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        normalized_key = tolower(key)
        if (normalized_key == "database" || normalized_key == "initial catalog") {
          if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") \
            || (substr(value, 1, 1) == "'" && substr(value, length(value), 1) == "'")) {
            value = substr(value, 2, length(value) - 2)
          }
          print value
          exit
        }
      }
    }
  '
}

repair_db_connection_has_value() {
  local db_conn="$1"
  local key_pattern="$2"
  printf '%s' "${db_conn}" \
    | grep -Eiq "(^|;)[[:space:]]*(${key_pattern})[[:space:]]*=[[:space:]]*[^;[:space:]][^;]*"
}

repair_db_connection_has_required_shape() {
  local db_type="$1"
  local db_conn="$2"
  case "${db_type}" in
    MySql)
      repair_db_connection_has_value "${db_conn}" 'Data[[:space:]]+Source|Server|Host' \
        && repair_db_connection_has_value "${db_conn}" 'Database' \
        && repair_db_connection_has_value "${db_conn}" 'User([[:space:]]+Id)?|Uid|Username' \
        && repair_db_connection_has_value "${db_conn}" 'Password|Pwd' \
        && repair_db_connection_has_value "${db_conn}" 'Port'
      ;;
    SqlServer)
      repair_db_connection_has_value "${db_conn}" 'Data[[:space:]]+Source|Server' \
        && repair_db_connection_has_value "${db_conn}" 'Initial[[:space:]]+Catalog|Database' \
        && repair_db_connection_has_value "${db_conn}" 'User([[:space:]]+Id)?|Uid' \
        && repair_db_connection_has_value "${db_conn}" 'Password|Pwd'
      ;;
    DaMeng)
      repair_db_connection_has_value "${db_conn}" 'Server' \
        && repair_db_connection_has_value "${db_conn}" 'Port' \
        && repair_db_connection_has_value "${db_conn}" 'User([[:space:]]+Id)?|Uid' \
        && repair_db_connection_has_value "${db_conn}" 'Password|Pwd' \
        && repair_db_connection_has_value "${db_conn}" 'Schema'
      ;;
    PostgreSql)
      repair_db_connection_has_value "${db_conn}" 'Host|Server' \
        && repair_db_connection_has_value "${db_conn}" 'Port' \
        && repair_db_connection_has_value "${db_conn}" 'Database' \
        && repair_db_connection_has_value "${db_conn}" 'Username|User[[:space:]]+Id|User' \
        && repair_db_connection_has_value "${db_conn}" 'Password|Pwd'
      ;;
    *)
      return 1
      ;;
  esac
}

repair_encode_connection_value() {
  local value="$1"
  local escaped=""
  case "${value}" in
    *$'\r'*|*$'\n'*)
      return 1
      ;;
  esac
  if [[ "${value}" == *';'* || "${value}" == *'"'* || "${value}" == *"'"* ]] \
    || printf '%s' "${value}" | grep -Eq '(^[[:space:]]|[[:space:]]$)'; then
    escaped=${value//\"/\"\"}
    printf '"%s"' "${escaped}"
  else
    printf '%s' "${value}"
  fi
}

repair_build_installer_db_connection() {
  local db_type="$1"
  local db_container="$2"
  local db_internal_port="$3"
  local database_name="$4"
  local password_key=""
  local password=""
  local encoded_password=""
  case "${db_type}" in
    MySql) password_key='MYSQL_ROOT_PASSWORD' ;;
    SqlServer) password_key='MSSQL_SA_PASSWORD' ;;
    DaMeng) password_key='SYSDBA_PWD' ;;
    PostgreSql) password_key='POSTGRES_PASSWORD' ;;
    *) return 1 ;;
  esac
  password=$(repair_read_container_environment_value "${db_container}" "${password_key}")
  [ -n "${password}" ] || return 1
  encoded_password=$(repair_encode_connection_value "${password}") || return 1
  case "${db_type}" in
    MySql)
      printf 'Data Source=%s;Database=%s;User Id=root;Password=%s;Port=%s;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;' \
        "${db_container}" "${database_name}" "${encoded_password}" "${db_internal_port}"
      ;;
    SqlServer)
      printf 'Data Source=%s,%s;Initial Catalog=%s;User ID=sa;Password=%s;Encrypt=False;TrustServerCertificate=True;Max Pool Size=500;' \
        "${db_container}" "${db_internal_port}" "${database_name}" "${encoded_password}"
      ;;
    DaMeng)
      printf 'Server=%s;Port=%s;User Id=SYSDBA;Password=%s;Schema=SYSDBA;' \
        "${db_container}" "${db_internal_port}" "${encoded_password}"
      ;;
    PostgreSql)
      printf 'Host=%s;Port=%s;Database=%s;Username=postgres;Password=%s;Pooling=true;Maximum Pool Size=500;' \
        "${db_container}" "${db_internal_port}" "${database_name}" "${encoded_password}"
      ;;
  esac
}

repair_validate_api_db_connection() {
  local canonical_file="$1"
  local api_block="${REPAIR_TEMP_DIR}/api-service-db-connection.yml"
  local environment_block="${REPAIR_TEMP_DIR}/api-environment-db-connection.yml"
  local db_type=""
  local db_conn=""
  repair_extract_api_block "${canonical_file}" "${api_block}"
  repair_extract_api_environment_block "${api_block}" "${environment_block}"
  db_type=$(repair_read_api_environment_value "${environment_block}" OsClientDbType)
  db_conn=$(repair_read_api_environment_value "${environment_block}" OsClientDbConn)
  if ! repair_db_connection_has_required_shape "${db_type}" "${db_conn}"; then
    echo "Microi：错误：${db_type} 启动连接串结构不完整，必须包含服务器、数据库、用户、密码及端口等完整键值。"
    echo 'Microi：连接串和密码不会输出；自动修复已在删除应用容器前停止。'
    return 1
  fi
}

repair_connect_container_to_microi_network() {
  local container_name="$1"
  local attached=""
  docker inspect "${container_name}" > /dev/null 2>&1 || return 1
  attached=$(docker inspect "${container_name}" \
    --format '{{if index .NetworkSettings.Networks "microi"}}yes{{end}}' 2>/dev/null || true)
  if [ "${attached}" != "yes" ]; then
    docker network connect microi "${container_name}"
    echo "Microi：已将 ${container_name} 接入 microi 内网 ✓"
  fi
}

repair_migrate_app_to_internal_network() {
  local compose_file="$1"
  local canonical_file="$2"
  local project_name="$3"
  local api_block="${REPAIR_TEMP_DIR}/api-service-before-network.yml"
  local environment_block="${REPAIR_TEMP_DIR}/api-environment-before-network.yml"
  local os_client=""
  local db_type=""
  local db_conn=""
  local database_name=""
  local mongo_conn=""
  local db_container=""
  local db_internal_port=""
  local db_candidates=()
  local candidate=""
  local existing_db_count=0
  local db_conn_recovered=0
  local external_db_connection=0
  local database_mode_label=""
  local minio_mode_label=""
  local network_driver=""
  local override_file="${REPAIR_TEMP_DIR}/internal-network.override.yml"
  local migrated_file="${REPAIR_TEMP_DIR}/internal-network.compose.yml"

  if docker network inspect microi > /dev/null 2>&1; then
    network_driver=$(docker network inspect microi --format '{{.Driver}}')
    if [ "${network_driver}" != "bridge" ]; then
      echo "Microi：错误：现有 microi 网络驱动为 ${network_driver}，不是 bridge。"
      return 1
    fi
  else
    docker network create --driver bridge microi > /dev/null
    echo 'Microi：已创建由 Docker 自动分配网段的 microi 共享内网 ✓'
  fi

  repair_extract_api_block "${canonical_file}" "${api_block}"
  repair_extract_api_environment_block "${api_block}" "${environment_block}"
  os_client=$(repair_read_api_environment_value "${environment_block}" OsClient)
  db_type=$(repair_read_api_environment_value "${environment_block}" OsClientDbType)
  db_conn=$(repair_read_api_environment_value "${environment_block}" OsClientDbConn)
  mongo_conn=$(repair_read_api_environment_value "${environment_block}" OsClientDbMongoConn)
  database_mode_label=$(docker inspect microi-install-api \
    --format '{{ index .Config.Labels "com.microi.database.mode" }}' 2>/dev/null || true)
  minio_mode_label=$(docker inspect microi-install-api \
    --format '{{ index .Config.Labels "com.microi.minio.mode" }}' 2>/dev/null || true)
  [ "${database_mode_label}" != '<no value>' ] || database_mode_label=""
  [ "${minio_mode_label}" != '<no value>' ] || minio_mode_label=""
  case "${db_type}" in
    MySql)
      db_candidates=(microi-install-mysql57 microi-install-mysql80)
      db_internal_port=3306
      ;;
    SqlServer)
      db_candidates=(microi-install-sqlserver2022)
      db_internal_port=1433
      ;;
    DaMeng)
      db_candidates=(microi-install-dm8)
      db_internal_port=5236
      ;;
    PostgreSql)
      db_candidates=(microi-install-postgresql17)
      db_internal_port=5432
      ;;
    *)
      echo "Microi：错误：修复器暂不支持自动迁移数据库类型 ${db_type} 的容器内网连接。"
      return 1
      ;;
  esac
  for candidate in "${db_candidates[@]}"; do
    if docker inspect "${candidate}" > /dev/null 2>&1; then
      db_container="${candidate}"
      existing_db_count=$((existing_db_count + 1))
    fi
  done
  if [ "${database_mode_label}" = 'external' ] && [ "${db_type}" = 'MySql' ]; then
    if ! repair_db_connection_has_required_shape "${db_type}" "${db_conn}"; then
      echo 'Microi：错误：已有 MySQL 模式的启动连接串不完整，且安装器没有数据库容器可用于恢复凭据。'
      echo 'Microi：未删除任何应用容器；请从安装备份恢复完整连接串后重试。'
      return 1
    fi
    external_db_connection=1
    echo 'Microi：检测到已有 MySQL 模式；修复器将保留外部地址、端口、帐号和密码，不改写为容器 DNS ✓'
  elif [ "${existing_db_count}" -ne 1 ]; then
    echo "Microi：错误：数据库类型 ${db_type} 应精确匹配一个安装器数据库容器，实际匹配 ${existing_db_count} 个。"
    return 1
  fi
  if [ "${external_db_connection}" != '1' ] \
    && ! repair_db_connection_has_required_shape "${db_type}" "${db_conn}"; then
    database_name=$(repair_read_container_database_label "${db_container}")
    if [ -z "${database_name}" ]; then
      case "${db_type}" in
        MySql) database_name=$(repair_read_container_environment_value "${db_container}" MYSQL_DATABASE) ;;
        PostgreSql) database_name=$(repair_read_container_environment_value "${db_container}" POSTGRES_DB) ;;
      esac
    fi
    [ -n "${database_name}" ] || database_name=$(repair_read_connection_database_name "${db_conn}")
    [ -n "${database_name}" ] || database_name="${os_client}"
    if [ "${db_type}" != 'DaMeng' ] && ! microi_database_name_is_safe "${database_name}"; then
      echo "Microi：错误：无法从数据库容器标签、原连接串或 OsClient 安全确定 ${db_type} 数据库名。"
      echo 'Microi：未输出任何密码，未删除任何容器；请先恢复合法数据库名后重试。'
      return 1
    fi
    if ! db_conn=$(repair_build_installer_db_connection \
      "${db_type}" "${db_container}" "${db_internal_port}" "${database_name}"); then
      echo "Microi：错误：现有 ${db_type} 启动连接串已损坏，且无法从 ${db_container} 的安装环境恢复数据库凭据。"
      echo 'Microi：未输出任何密码，未删除任何容器；请从安装备份恢复完整连接串后重试。'
      return 1
    fi
    db_conn_recovered=1
  fi
  if [ "${external_db_connection}" != '1' ]; then
    repair_connect_container_to_microi_network "${db_container}" || return 1
  fi
  repair_connect_container_to_microi_network microi-install-redis || return 1
  repair_connect_container_to_microi_network microi-install-mongodb || return 1
  if [ "${minio_mode_label}" = 'external' ]; then
    echo 'Microi：检测到已有 MinIO 模式；修复器不会查找或重建 MinIO 容器，存储配置继续由 SaaS 引擎提供 ✓'
  else
    repair_connect_container_to_microi_network microi-install-minio || return 1
  fi

  if [ "${external_db_connection}" != '1' ]; then
    case "${db_type}" in
    MySql)
      db_conn=$(printf '%s' "${db_conn}" | sed -E \
        "s/((Data Source|Server|Host)=)[^;]*/\\1${db_container}/I;s/(Port=)[0-9]+/\\1${db_internal_port}/I")
      ;;
    SqlServer)
      db_conn=$(printf '%s' "${db_conn}" | sed -E \
        "s/(Data Source=)[^;]*/\\1${db_container},${db_internal_port}/I")
      ;;
    DaMeng)
      db_conn=$(printf '%s' "${db_conn}" | sed -E \
        "s/(Server=)[^;]*/\\1${db_container}/I;s/(Port=)[0-9]+/\\1${db_internal_port}/I")
      ;;
    PostgreSql)
      db_conn=$(printf '%s' "${db_conn}" | sed -E \
        "s/(Host=)[^;]*/\\1${db_container}/I;s/(Port=)[0-9]+/\\1${db_internal_port}/I")
      ;;
    esac
  fi
  if ! repair_db_connection_has_required_shape "${db_type}" "${db_conn}"; then
    echo "Microi：错误：${db_type} 启动连接串在迁移 Docker DNS 后仍不完整。"
    echo 'Microi：未输出任何连接串或密码，未删除任何应用容器。'
    return 1
  fi
  mongo_conn=$(printf '%s' "${mongo_conn}" | sed -E \
    's#(mongodb://[^@]+@)[^/:]+:[0-9]+/#\1microi-install-mongodb:27017/#')

  cat > "${override_file}" <<'EOF'
services:
  microi-install-api:
    environment:
      OsClientDbConn: ${MICROI_REPAIR_DB_CONN}
      OsClientRedisHost: microi-install-redis
      OsClientRedisPort: "6379"
      OsClientDbMongoConn: ${MICROI_REPAIR_MONGO_CONN}
    networks:
      microi: null
  microi-install-client:
    networks:
      microi: null
networks:
  microi:
    external: true
    name: microi
EOF
  chmod 600 "${override_file}"
  if ! MICROI_REPAIR_DB_CONN="${db_conn}" MICROI_REPAIR_MONGO_CONN="${mongo_conn}" \
    docker compose -p "${project_name}" -f "${compose_file}" -f "${override_file}" \
    config > "${migrated_file}"; then
    echo 'Microi：错误：无法生成容器内网版应用编排。'
    return 1
  fi
  chmod 600 "${migrated_file}"
  repair_validate_api_environment "${migrated_file}" || return 1
  repair_validate_api_db_connection "${migrated_file}" || return 1
  cp "${migrated_file}" "${compose_file}"
  chmod 600 "${compose_file}"
  REPAIR_INTERNAL_CANONICAL="${migrated_file}"
  if [ "${db_conn_recovered}" -eq 1 ]; then
    echo "Microi：检测到原 API 数据库连接串被截断，已从 ${db_container} 的安装环境无明文输出地恢复完整凭据 ✓"
  fi
  if [ "${external_db_connection}" = '1' ]; then
    echo 'Microi：API 已保留已有 MySQL 连接；Redis、MongoDB 已迁移为容器 DNS/内部端口 ✓'
  else
    echo "Microi：API 启动连接已迁移为 Docker DNS：${db_container}:${db_internal_port}、microi-install-redis:6379、microi-install-mongodb:27017 ✓"
  fi
}

repair_validate_runtime_environment() {
  local env_file="${REPAIR_TEMP_DIR}/api-runtime-env.txt"
  local required_key=""
  local db_type=""
  local db_conn=""
  local database_mode_label=""
  local required_keys=(
    OsClient OsClientType OsClientNetwork OsClientDbType OsClientDbConn
    OsClientRedisHost OsClientRedisPort OsClientRedisPwd
    OsClientRedisDataBase OsClientDbMongoConn
  )
  docker inspect microi-install-api \
    --format '{{range .Config.Env}}{{println .}}{{end}}' > "${env_file}"
  chmod 600 "${env_file}"
  for required_key in "${required_keys[@]}"; do
    if ! grep -Eq "^${required_key}=.+$" "${env_file}"; then
      echo "Microi：错误：重建后的 API 容器仍缺少 ${required_key}。"
      return 1
    fi
  done
  db_type=$(sed -n -E 's/^OsClientDbType=//p' "${env_file}" | head -1)
  db_conn=$(sed -n -E 's/^OsClientDbConn=//p' "${env_file}" | head -1)
  database_mode_label=$(docker inspect microi-install-api \
    --format '{{ index .Config.Labels "com.microi.database.mode" }}' 2>/dev/null || true)
  [ "${database_mode_label}" != '<no value>' ] || database_mode_label=""
  if ! repair_db_connection_has_required_shape "${db_type}" "${db_conn}"; then
    echo 'Microi：错误：重建后的 API 容器数据库启动连接串结构仍不完整。'
    return 1
  fi
  if ! grep -Fxq 'OsClientRedisHost=microi-install-redis' "${env_file}" \
    || ! grep -Fxq 'OsClientRedisPort=6379' "${env_file}" \
    || ! grep -Eq '^OsClientDbMongoConn=.*@microi-install-mongodb:27017/' "${env_file}"; then
    echo 'Microi：错误：API 容器启动配置未完整切换到 Docker DNS/容器内部端口。'
    return 1
  fi
  if [ "${database_mode_label}" != 'external' ] \
    && ! grep -Eq '^OsClientDbConn=.*microi-install-' "${env_file}"; then
    echo 'Microi：错误：安装器管理的数据库连接未使用 Docker DNS/容器内部端口。'
    return 1
  fi
  if [ "$(docker inspect microi-install-api --format '{{if index .NetworkSettings.Networks "microi"}}yes{{end}}' 2>/dev/null || true)" != "yes" ]; then
    echo 'Microi：错误：API 容器未接入 microi 共享内网。'
    return 1
  fi
  echo 'Microi：API 十项启动配置及数据库/内部依赖连接已逐项回读通过 ✓'
}

repair_wait_for_api() {
  local api_port="$1"
  local probe_path="$2"
  local probe_name="$3"
  local max_seconds="$4"
  local started_at="${SECONDS}"
  local probe_url="http://127.0.0.1:${api_port}${probe_path}"
  while [ $((SECONDS - started_at)) -lt "${max_seconds}" ]; do
    if curl --fail --silent --show-error --max-time 5 "${probe_url}" > /dev/null 2>&1; then
      echo "Microi：API ${probe_name}检查通过：${probe_url} ✓"
      return 0
    fi
    sleep 2
  done
  echo "Microi：错误：API ${probe_name}检查在 ${max_seconds} 秒内未通过：${probe_url}"
  return 1
}

repair_restore_previous_app_images() {
  local compose_file="$1"
  local project_name="$2"
  local api_backup_image="$3"
  local client_backup_image="$4"
  local override_file="${REPAIR_TEMP_DIR}/rollback.override.yml"
  if ! docker image inspect "${api_backup_image}" > /dev/null 2>&1 \
    || ! docker image inspect "${client_backup_image}" > /dev/null 2>&1; then
    echo 'Microi：警告：旧 API/Web 镜像不完整，无法自动恢复旧镜像；现场备份仍已保留。'
    return 1
  fi
  cat > "${override_file}" <<EOF
services:
  microi-install-api:
    image: ${api_backup_image}
    pull_policy: never
  microi-install-client:
    image: ${client_backup_image}
    pull_policy: never
EOF
  chmod 600 "${override_file}"
  docker rm -f microi-install-api microi-install-client > /dev/null 2>&1 || true
  if docker compose -p "${project_name}" -f "${compose_file}" -f "${override_file}" \
    up -d --force-recreate --no-deps microi-install-api microi-install-client; then
    echo 'Microi：已使用修复前的 API/Web 镜像和原编排配置完成自动恢复。'
    return 0
  fi
  echo 'Microi：警告：自动恢复旧 API/Web 镜像失败，请使用备份目录中的现场信息人工恢复。'
  return 1
}

repair_mode_cleanup() {
  local exit_code="${1:-1}"
  trap - EXIT
  if [ "${REPAIR_WATCHTOWER_WAS_RUNNING:-0}" = "1" ]; then
    docker start microi-install-watchtower > /dev/null 2>&1 || true
  fi
  if [[ "${REPAIR_TEMP_DIR:-}" == /tmp/microi_app_repair_* ]] && [ -d "${REPAIR_TEMP_DIR}" ]; then
    rm -rf -- "${REPAIR_TEMP_DIR}"
  fi
  exit "${exit_code}"
}

repair_microi_app() {
  local candidate=""
  local canonical_file=""
  local canonical_hash=""
  local selected_file=""
  local selected_hash=""
  local selected_canonical=""
  local candidate_index=0
  local valid_count=0
  local panel_base='/www/dk_project/dk_compose'
  local default_base='/microi/compose'
  local panel_file="${panel_base}/microi-install-app/docker-compose.yml"
  local project_name='microi-install-app'
  local api_project=""
  local client_project=""
  local backup_stamp=""
  local backup_dir=""
  local api_image_id=""
  local client_image_id=""
  local api_backup_image=""
  local client_backup_image=""
  local api_port=""
  local repair_failed=0

  echo '=================================================================='
  echo "Microi：一键更新/修复 API 与 Web 前端（${SCRIPT_VERSION}）"
  echo 'Microi：本模式不会删除或重建数据库、Redis、MongoDB、MinIO 及其数据卷。'
  echo '=================================================================='
  command -v docker > /dev/null 2>&1 || { echo 'Microi：错误：未安装 Docker。'; return 1; }
  command -v curl > /dev/null 2>&1 || { echo 'Microi：错误：缺少 curl。'; return 1; }
  command -v openssl > /dev/null 2>&1 || { echo 'Microi：错误：缺少 openssl。'; return 1; }
  docker info > /dev/null 2>&1 || { echo 'Microi：错误：Docker daemon 当前不可访问。'; return 1; }
  docker compose version > /dev/null 2>&1 || { echo 'Microi：错误：需要 Docker Compose V2。'; return 1; }

  REPAIR_TEMP_DIR=$(mktemp -d /tmp/microi_app_repair_XXXXXX)
  chmod 700 "${REPAIR_TEMP_DIR}"
  trap 'repair_mode_cleanup "$?"' EXIT

  repair_add_container_compose_candidate microi-install-api || return 1
  repair_add_container_compose_candidate microi-install-client || return 1
  if [ "${REPAIR_LABEL_CANDIDATE_COUNT}" -eq 0 ]; then
    repair_add_candidate "${panel_file}"
    repair_add_candidate "${panel_base}/microi-install-app/compose.yml"
    repair_add_candidate "${default_base}/microi-install-app/docker-compose.yml"
    repair_add_candidate "${default_base}/microi-install-app/compose.yml"
  fi

  for candidate in "${REPAIR_CANDIDATES[@]:-}"; do
    [ -n "${candidate}" ] || continue
    if repair_config_has_app_services "${candidate}"; then
      candidate_index=$((candidate_index + 1))
      canonical_file="${REPAIR_TEMP_DIR}/candidate-${candidate_index}.yml"
      docker compose -f "${candidate}" config > "${canonical_file}"
      chmod 600 "${canonical_file}"
      canonical_hash=$(repair_hash_file "${canonical_file}")
      if [ -z "${selected_file}" ]; then
        selected_file="${candidate}"
        selected_hash="${canonical_hash}"
        selected_canonical="${canonical_file}"
      elif [ "${selected_hash}" != "${canonical_hash}" ]; then
        echo 'Microi：错误：发现多个内容不同的 API/Web 编排文件，无法安全猜测现场配置：'
        printf '  - %s\n' "${selected_file}" "${candidate}"
        echo 'Microi：未删除任何容器。请确认应保留的编排文件后再执行修复。'
        return 1
      elif [[ "${candidate}" == "${panel_base}/"* ]]; then
        selected_file="${candidate}"
        selected_canonical="${canonical_file}"
      fi
      valid_count=$((valid_count + 1))
    fi
  done
  if [ "${valid_count}" -eq 0 ]; then
    echo 'Microi：错误：没有找到同时包含 microi-install-api 和 microi-install-client 的有效 Compose 文件。'
    echo 'Microi：未删除任何容器；请先从安装备份恢复 microi-install-app/docker-compose.yml。'
    return 1
  fi

  api_project=$(docker inspect microi-install-api \
    --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)
  client_project=$(docker inspect microi-install-client \
    --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || true)
  [ "${api_project}" != "<no value>" ] || api_project=""
  [ "${client_project}" != "<no value>" ] || client_project=""
  if [ -n "${api_project}" ] && [ "${api_project}" = "${client_project}" ]; then
    project_name="${api_project}"
  else
    project_name=$(sed -n -E 's/^name:[[:space:]]+//p' "${selected_canonical}" | head -1 | tr -d "'\"")
    [ -n "${project_name}" ] || project_name='microi-install-app'
  fi
  if ! [[ "${project_name}" =~ ^[A-Za-z0-9_.-]+$ ]]; then
    echo "Microi：错误：Compose project 名称不安全：${project_name}"
    return 1
  fi

  # 宝塔标准编排目录存在但应用编排在默认目录时，将已经解析完整的现场配置
  # 原样落入宝塔目录。解析结果包含所有环境值，不依赖源目录中的相对 .env。
  if [ -d "${panel_base}" ] && [[ "${selected_file}" != "${panel_base}/"* ]]; then
    if [ -f "${panel_file}" ]; then
      echo "Microi：错误：宝塔应用编排 ${panel_file} 已存在但未通过一致性选择。"
      return 1
    fi
    mkdir -p "$(dirname "${panel_file}")"
    cp "${selected_canonical}" "${panel_file}"
    chmod 600 "${panel_file}"
    selected_file="${panel_file}"
    selected_canonical="${REPAIR_TEMP_DIR}/panel-canonical.yml"
    docker compose -p "${project_name}" -f "${selected_file}" config > "${selected_canonical}"
    chmod 600 "${selected_canonical}"
    echo "Microi：已将完整应用编排恢复到宝塔目录：${selected_file} ✓"
  fi

  repair_validate_api_environment "${selected_canonical}" || return 1
  echo "Microi：已锁定应用编排：${selected_file}"
  echo "Microi：Compose project：${project_name}"

  if [ "$(docker inspect microi-install-watchtower --format '{{.State.Running}}' 2>/dev/null || true)" = "true" ]; then
    docker stop microi-install-watchtower > /dev/null
    REPAIR_WATCHTOWER_WAS_RUNNING=1
    echo 'Microi：已临时停止 Watchtower，避免修复过程中并发替换应用容器。'
  fi

  backup_stamp=$(date '+%Y%m%d-%H%M%S')
  backup_dir="$(dirname "${selected_file}")/.repair-backups/${backup_stamp}"
  mkdir -p "${backup_dir}"
  chmod 700 "$(dirname "${selected_file}")/.repair-backups" "${backup_dir}"
  cp "${selected_file}" "${backup_dir}/docker-compose.before.yml"
  chmod 600 "${backup_dir}/docker-compose.before.yml"
  for candidate in microi-install-api microi-install-client; do
    if docker inspect "${candidate}" > /dev/null 2>&1; then
      docker inspect "${candidate}" > "${backup_dir}/${candidate}.inspect.json"
      chmod 600 "${backup_dir}/${candidate}.inspect.json"
    fi
  done

  if ! repair_migrate_app_to_internal_network \
    "${selected_file}" "${selected_canonical}" "${project_name}"; then
    echo 'Microi：错误：应用容器内网迁移失败，未删除任何应用容器。'
    return 1
  fi
  selected_canonical="${REPAIR_INTERNAL_CANONICAL}"

  api_image_id=$(docker inspect microi-install-api --format '{{.Image}}' 2>/dev/null || true)
  client_image_id=$(docker inspect microi-install-client --format '{{.Image}}' 2>/dev/null || true)
  api_backup_image="microi-local-backup/microi-install-api:${backup_stamp}"
  client_backup_image="microi-local-backup/microi-install-client:${backup_stamp}"
  [ -n "${api_image_id}" ] && docker image tag "${api_image_id}" "${api_backup_image}"
  [ -n "${client_image_id}" ] && docker image tag "${client_image_id}" "${client_backup_image}"
  echo "Microi：修复前配置、容器元数据和旧镜像恢复点已保存：${backup_dir} ✓"

  echo 'Microi：正在按现场 Compose 配置拉取 API/Web 镜像...'
  if ! docker compose -p "${project_name}" -f "${selected_file}" \
    pull microi-install-api microi-install-client; then
    echo 'Microi：错误：镜像拉取失败，未删除任何应用容器。'
    return 1
  fi

  echo 'Microi：正在移除并重建两个无状态应用容器（不会操作任何数据容器/数据卷）...'
  docker rm -f microi-install-api microi-install-client > /dev/null 2>&1 || true
  if ! docker compose -p "${project_name}" -f "${selected_file}" \
    up -d --force-recreate --no-deps microi-install-api microi-install-client; then
    echo 'Microi：错误：新 API/Web 容器创建失败，正在自动恢复修复前镜像...'
    repair_restore_previous_app_images "${selected_file}" "${project_name}" \
      "${api_backup_image}" "${client_backup_image}" || true
    return 1
  fi

  if ! repair_validate_runtime_environment; then
    repair_failed=1
  fi
  api_port=$(docker port microi-install-api 80/tcp 2>/dev/null | head -1 | sed -E 's/.*:([0-9]+)$/\1/' || true)
  if [ -z "${api_port}" ]; then
    echo 'Microi：错误：无法回读 API 宿主机端口。'
    repair_failed=1
  fi
  if [ "${repair_failed}" -eq 0 ] \
    && ! repair_wait_for_api "${api_port}" '/api/Diagnostics/liveness' 'liveness' 180; then
    repair_failed=1
  fi
  if [ "${repair_failed}" -eq 0 ] \
    && ! repair_wait_for_api "${api_port}" '/api/Diagnostics/health' 'readiness' 180; then
    repair_failed=1
  fi
  if [ "${repair_failed}" -ne 0 ]; then
    docker logs --tail 100 microi-install-api 2>&1 || true
    echo 'Microi：修复验收失败，正在自动恢复修复前镜像...'
    repair_restore_previous_app_images "${selected_file}" "${project_name}" \
      "${api_backup_image}" "${client_backup_image}" || true
    return 1
  fi

  echo '=================================================================='
  echo 'Microi：API 与 Web 前端更新/修复完成 ✓'
  echo 'Microi：API 的 liveness、readiness 和十项启动配置均已回读通过。'
  echo 'Microi：数据库、Redis、MongoDB、MinIO 容器及数据卷未被删除或重建。'
  echo "Microi：现场恢复点：${backup_dir}"
  echo '=================================================================='
}

if [ "${1:-}" = '--repair-app' ]; then
  repair_microi_app
  exit 0
fi

# 安装后半程的失败收尾状态。只有端口、密码和数据目录全部生成后才启用恢复汇总，
# 既保留真正的非零退出码，也避免早期输入/环境错误输出尚未生成的敏感配置。
INSTALL_RECOVERY_SUMMARY_ENABLED=0
INSTALL_SUMMARY_PRINTED=0
SQL_TMP_DIR=""
SQL_ZIP_IS_TEMP=0
SQL_ZIP_FILE=""
MYSQL_CLIENT_CONFIG_FILE=""
MINIO_MC_CONFIG_DIR=""
API_LIVENESS_READY=0
API_READINESS_READY=0
OCR_SAAS_CONFIG_READY=0
TRANSLATE_SAAS_CONFIG_READY=0

cleanup_database_import_temp() {
  if [[ "${SQL_TMP_DIR:-}" == /tmp/microi_database_* ]] && [ -d "${SQL_TMP_DIR}" ]; then
    rm -rf -- "${SQL_TMP_DIR}"
  fi
  if [ "${SQL_ZIP_IS_TEMP:-0}" = "1" ] \
    && [[ "${SQL_ZIP_FILE:-}" == /tmp/* ]] \
    && [ -f "${SQL_ZIP_FILE}" ]; then
    rm -f -- "${SQL_ZIP_FILE}"
  fi
  SQL_TMP_DIR=""
  SQL_ZIP_IS_TEMP=0
  SQL_ZIP_FILE=""
}

cleanup_external_service_temp() {
  if [[ "${MYSQL_CLIENT_CONFIG_FILE:-}" == /tmp/microi_mysql_client_*.cnf ]] \
    && [ -f "${MYSQL_CLIENT_CONFIG_FILE}" ]; then
    rm -f -- "${MYSQL_CLIENT_CONFIG_FILE}"
  fi
  if [[ "${MINIO_MC_CONFIG_DIR:-}" == /tmp/microi_minio_mc_* ]] \
    && [ -d "${MINIO_MC_CONFIG_DIR}" ]; then
    rm -rf -- "${MINIO_MC_CONFIG_DIR}"
  fi
  MYSQL_CLIENT_CONFIG_FILE=""
  MINIO_MC_CONFIG_DIR=""
}

print_generated_install_configuration() {
  local summary_mode="${1:-recovery}"
  local address_title="预分配访问地址（相关容器可能尚未就绪）"
  if [ "${summary_mode}" = "success" ]; then
    address_title="访问地址"
  fi

  echo "脚本版本: ${SCRIPT_VERSION}"
  echo "编排文件目录: ${COMPOSE_BASE_DIR:-尚未生成}"
  echo '在宝塔面板 → Docker → 编排 中可查看和管理已经生成的编排项目'
  echo ''
  echo '------------------------------------------------------------------'
  echo "${address_title}："
  echo '------------------------------------------------------------------'
  if [ -n "${ACCESS_IP:-}" ] && [ -n "${VUE_PORT:-}" ]; then
    echo "前端传统界面:  http://${ACCESS_IP}:${VUE_PORT}/?OsClient=${OS_CLIENT:-iTdos}    账号: admin  密码: demo123456"
  fi
  echo "主租户:        OsClient=${OS_CLIENT:-未生成}, ClientName=${OS_CLIENT:-未生成}"
  echo ''
  echo '------------------------------------------------------------------'
  echo "端口分配（从 ${PORT_BASE:-未生成} 开始顺序分配）："
  echo '------------------------------------------------------------------'
  [ -n "${VUE_PORT:-}" ] && printf '  %-18s %s\n' "Web:" "${VUE_PORT}"
  [ -n "${API_PORT:-}" ] && printf '  %-18s %s\n' "API:" "${API_PORT}"
  if [ "${DATABASE_SERVICE_MODE:-managed}" = 'external' ]; then
    printf '  %-18s %s\n' "MySQL(已有服务):" "${MYSQL_EXTERNAL_HOST_DISPLAY:-未生成}:${DATABASE_PORT:-未生成}（不占用本机分配端口）"
  elif [ -n "${DATABASE_PORT:-}" ]; then
    printf '  %-18s %s\n' "${DATABASE_PORT_NAME:-Database}:" "${DATABASE_PORT}"
  fi
  [ -n "${REDIS_PORT:-}" ] && printf '  %-18s %s\n' "Redis:" "${REDIS_PORT}"
  [ -n "${MONGO_PORT:-}" ] && printf '  %-18s %s\n' "MongoDB:" "${MONGO_PORT}"
  if [ "${MINIO_SERVICE_MODE:-managed}" = 'external' ]; then
    printf '  %-18s %s\n' "MinIO(已有服务):" "${MINIO_EXTERNAL_INTERNAL_URL:-未生成}（不占用本机分配端口）"
    [ -n "${MINIO_PUBLIC_BASE_URL:-}" ] \
      && printf '  %-18s %s\n' "MinIO公有地址:" "${MINIO_PUBLIC_BASE_URL}/${MINIO_PUBLIC_BUCKET:-mci-public}"
  else
    [ -n "${MINIO_PORT:-}" ] && printf '  %-18s %s\n' "MinIO API:" "${MINIO_PORT}"
    [ -n "${MINIO_CONSOLE_PORT:-}" ] && printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
  fi
  [ -n "${OCR_PORT:-}" ] && printf '  %-18s %s\n' "OCR:" "${OCR_PORT}（仅绑定 127.0.0.1）"
  if [ "${INSTALL_LIBRETRANSLATE:-0}" = "1" ] && [ -n "${LIBRETRANSLATE_PORT:-}" ]; then
    printf '  %-18s %s\n' "LibreTranslate:" "${LIBRETRANSLATE_PORT}（仅绑定 127.0.0.1）"
  fi
  if [ "${INSTALL_ONLINE_AI:-0}" = "1" ]; then
    [ -n "${OLLAMA_PORT:-}" ] && printf '  %-18s %s\n' "Ollama:" "${OLLAMA_PORT}"
    [ -n "${QDRANT_HTTP_PORT:-}" ] && printf '  %-18s %s\n' "Qdrant HTTP:" "${QDRANT_HTTP_PORT}"
    [ -n "${QDRANT_GRPC_PORT:-}" ] && printf '  %-18s %s\n' "Qdrant gRPC:" "${QDRANT_GRPC_PORT}"
  fi
  echo ''
  echo '------------------------------------------------------------------'
  echo '本次服务配置、凭据与数据目录：'
  echo '------------------------------------------------------------------'
  if [ -n "${DATABASE_PASSWORD:-}" ]; then
    if [ "${DATABASE_SERVICE_MODE:-managed}" = 'external' ]; then
      echo "MySQL:       已有服务 ${MYSQL_EXTERNAL_HOST_DISPLAY:-未生成}:${DATABASE_PORT:-未生成}, 帐号 ${DATABASE_USER:-未生成}"
      echo '             密码: 已读取并写入受限应用编排，不在终端回显'
      echo "             版本: ${MYSQL_DETECTED_SERVER_VERSION:-待连接校验}（要求与所选 ${MYSQL_VERSION:-5.7}.x 匹配）"
      echo "             业务数据库: ${DATABASE_NAME:-未生成}（来源：${DATABASE_NAME_SOURCE:-未生成}）"
      echo "             初始化包来源: ${SQL_SOURCE_DISPLAY:-未生成}"
      echo '             MySQL 容器、数据目录与数据库编排: 未创建'
    else
      echo "${DATABASE_DISPLAY_NAME:-主数据库}:  Dos.ORM类型 ${DATABASE_TYPE:-未生成}, 容器 ${DATABASE_CONTAINER_NAME:-未生成}, 端口 ${DATABASE_PORT:-未生成}, 管理员密码: ${DATABASE_PASSWORD}"
      echo "             业务数据库: ${DATABASE_NAME:-未生成}（来源：${DATABASE_NAME_SOURCE:-未生成}）"
      echo "             初始化包来源: ${SQL_SOURCE_DISPLAY:-未生成}"
      echo "             数据目录: ${DATABASE_DATA_DIR:-未生成}"
      echo "             编排目录: ${DATABASE_DIR:-${COMPOSE_BASE_DIR:-未生成}/microi-install-database}/"
    fi
    echo ''
  fi
  if [ -n "${REDIS_PASSWORD:-}" ]; then
    echo "Redis:       容器 microi-install-redis,      端口 ${REDIS_PORT:-未生成},  密码: ${REDIS_PASSWORD}"
    echo "             数据目录: ${REDIS_DATA_DIR:-未生成}"
    echo "             编排目录: ${COMPOSE_BASE_DIR:-未生成}/microi-install-redis/"
    echo ''
  fi
  if [ -n "${MONGO_ROOT_PASSWORD:-}" ]; then
    echo "MongoDB:     容器 microi-install-mongodb,    端口 ${MONGO_PORT:-未生成},  Root密码: ${MONGO_ROOT_PASSWORD}"
    echo "             数据目录: ${MONGO_DATA_DIR:-未生成}"
    echo "             编排目录: ${COMPOSE_BASE_DIR:-未生成}/microi-install-mongodb/"
    echo ''
  fi
  if [ -n "${MINIO_ACCESS_KEY:-}" ] && [ -n "${MINIO_SECRET_KEY:-}" ]; then
    if [ "${MINIO_SERVICE_MODE:-managed}" = 'external' ]; then
      echo "MinIO:       已有服务 ${MINIO_EXTERNAL_INTERNAL_URL:-未生成}"
      echo "             浏览器公有地址: ${MINIO_PUBLIC_BASE_URL:-未生成}/${MINIO_PUBLIC_BUCKET:-mci-public}"
      echo '             Access Key / Secret Key: 已读取并写入 SaaS 配置，不在终端回显'
      echo "             私有桶: ${MINIO_PRIVATE_BUCKET:-mci-private}, 公有桶: ${MINIO_PUBLIC_BUCKET:-mci-public}（public 下载）, Region: ${MINIO_REGION:-留空}"
      echo '             MinIO 容器、数据目录与 MinIO 编排: 未创建'
    else
      echo "MinIO:       容器 microi-install-minio,      API端口 ${MINIO_PORT:-未生成},  控制台端口 ${MINIO_CONSOLE_PORT:-未生成}"
      echo "             Access Key: ${MINIO_ACCESS_KEY},  Secret Key: ${MINIO_SECRET_KEY}"
      echo "             私有桶: ${MINIO_PRIVATE_BUCKET:-mci-private}, 公有桶: ${MINIO_PUBLIC_BUCKET:-mci-public}（public 下载）"
      echo "             数据目录: ${MINIO_DATA_DIR:-未生成}"
      echo "             编排目录: ${COMPOSE_BASE_DIR:-未生成}/microi-install-minio/"
    fi
    echo ''
  fi
  if [ "${summary_mode}" = "recovery" ] \
    && [ "${INSTALL_ONLINE_AI:-0}" = "1" ] \
    && [ -n "${QDRANT_API_KEY:-}" ]; then
    echo "Qdrant API Key: ${QDRANT_API_KEY}"
  fi
  if [ "${summary_mode}" = "recovery" ] && [ "${INSTALL_LIBRETRANSLATE:-0}" = "1" ]; then
    echo 'LibreTranslate API Key: 已随机生成；为避免密钥泄露，终端不输出明文。若初始化步骤已完成，密钥库位于 /microi/libretranslate/api-keys/api_keys.db。'
  fi
}

print_install_recovery_summary() {
  local exit_code="${1:-1}"
  echo ''
  echo '=================================================================='
  echo "Microi：安装未完成（退出码 ${exit_code}）"
  echo 'Microi：以下为本次已经生成的配置，便于排查和恢复；不代表所有服务均已安装或可用。'
  echo 'Microi：原始失败原因位于本汇总上方，脚本仍以非零状态退出。'
  echo '=================================================================='
  echo ''
  print_generated_install_configuration "recovery"
  echo '------------------------------------------------------------------'
  echo '后段门禁状态：'
  echo '------------------------------------------------------------------'
  echo "API liveness: $([ "${API_LIVENESS_READY:-0}" = "1" ] && echo '已通过' || echo '未确认')"
  echo "API readiness: $([ "${API_READINESS_READY:-0}" = "1" ] && echo '已通过' || echo '未确认')"
  if [ "${OCR_SAAS_CONFIG_READY:-0}" = "1" ]; then
    echo 'OCR SaaS 配置: 已写入并回读；最终 API readiness 仍以上一行状态为准。'
  else
    echo 'OCR SaaS 配置: 未完成，安装器未把 OCR 视为已启用，也没有绕过 Upgrade29。'
  fi
  if [ "${INSTALL_LIBRETRANSLATE:-0}" = "1" ]; then
    if [ "${TRANSLATE_SAAS_CONFIG_READY:-0}" = "1" ]; then
      echo 'LibreTranslate SaaS 配置: 已写入并回读；最终 API readiness 仍以上一行状态为准。'
    else
      echo 'LibreTranslate SaaS 配置: 未完成，安装器没有绕过 Upgrade31。'
    fi
  fi
  if command -v docker > /dev/null 2>&1; then
    local api_image_id=""
    local api_image_created=""
    api_image_id=$(docker inspect microi-install-api --format '{{.Image}}' 2>/dev/null || true)
    api_image_created=$(docker image inspect "${API_IMAGE:-}" --format '{{.Created}}' 2>/dev/null || true)
    [ -n "${api_image_id}" ] && echo "当前 API 容器 ImageId: ${api_image_id}"
    [ -n "${api_image_created}" ] && echo "当前 API 本地镜像创建时间: ${api_image_created}"
  fi
  echo ''
  echo 'Microi：建议先查看 docker logs --tail 200 microi-install-api，并核对上方 API 镜像与 Upgrade29/Upgrade31 日志。'
  echo 'Microi：不要删除脚本新装服务的数据目录，也不要执行 docker compose down -v。'
  if [ "${DATABASE_SERVICE_MODE:-managed}" = 'external' ] || [ "${MINIO_SERVICE_MODE:-managed}" = 'external' ]; then
    echo 'Microi：已有 MySQL/MinIO 属于客户外部服务；排障时不要删除、重建、清空或覆盖其中的数据。'
  fi
  echo ''
  echo '------------------------------------------------------------------'
  echo '当前容器状态（仅供排查，不等同 readiness）：'
  echo '------------------------------------------------------------------'
  docker ps --filter 'name=microi-install-' --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null || true
  echo '=================================================================='
}

on_install_exit() {
  local exit_code="${1:-1}"
  trap - EXIT
  cleanup_database_import_temp || true
  cleanup_external_service_temp || true
  if [ "${exit_code}" -ne 0 ] \
    && [ "${INSTALL_RECOVERY_SUMMARY_ENABLED:-0}" = "1" ] \
    && [ "${INSTALL_SUMMARY_PRINTED:-0}" != "1" ]; then
    print_install_recovery_summary "${exit_code}" || true
  fi
  exit "${exit_code}"
}

trap 'on_install_exit "$?"' EXIT

# ============================================================
# 数据库安装配置
# ============================================================
# 该配置层同时供交互安装与无副作用自动化检查使用。新增数据库时只在这里
# 维护名称、Dos.ORM 数据库类型和发布包名称，避免选择菜单与下载地址漂移。
configure_database_profile() {
  local choice="${1:-1}"

  DATABASE_CHOICE="${choice}"
  DATABASE_AUTO_INSTALL_SUPPORTED=0
  DATABASE_LICENSED_IMAGE_ENV=""
  DATABASE_BLOCK_REASON=""
  DATABASE_IMAGE=""
  DATABASE_INTERNAL_PORT=""
  DATABASE_CONTAINER_NAME=""
  DATABASE_USER=""
  DATABASE_DATA_OWNER=""
  SQL_ZIP_BASE_URL="https://static.itdos.com/install"

  case "${choice}" in
    1)
      DATABASE_DISPLAY_NAME="MySQL 5.7"
      DATABASE_TYPE="MySql"
      DATABASE_ENGINE_KEY="mysql57"
      DATABASE_PORT_NAME="MySQL"
      SQL_ZIP_FILE_NAME="microi_empty_mysql57.sql.zip"
      SQL_FILE_NAME="microi_empty_mysql57.sql"
      MYSQL_VERSION="5.7"
      MYSQL_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7"
      MYSQL_CONTAINER_NAME="microi-install-mysql57"
      DATABASE_IMAGE="${MYSQL_IMAGE}"
      DATABASE_INTERNAL_PORT="3306"
      DATABASE_CONTAINER_NAME="${MYSQL_CONTAINER_NAME}"
      DATABASE_USER="root"
      DATABASE_DATA_OWNER="999:999"
      DATABASE_AUTO_INSTALL_SUPPORTED=1
      ;;
    2)
      DATABASE_DISPLAY_NAME="MySQL 8.0"
      DATABASE_TYPE="MySql"
      DATABASE_ENGINE_KEY="mysql80"
      DATABASE_PORT_NAME="MySQL"
      # 内容保持 MySQL 5.7/8.0 双兼容，但发布为独立规范包，便于版本选择和校验。
      SQL_ZIP_FILE_NAME="microi_empty_mysql80.sql.zip"
      SQL_FILE_NAME="microi_empty_mysql80.sql"
      MYSQL_VERSION="8.0"
      MYSQL_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0"
      MYSQL_CONTAINER_NAME="microi-install-mysql80"
      DATABASE_IMAGE="${MYSQL_IMAGE}"
      DATABASE_INTERNAL_PORT="3306"
      DATABASE_CONTAINER_NAME="${MYSQL_CONTAINER_NAME}"
      DATABASE_USER="root"
      DATABASE_DATA_OWNER="999:999"
      DATABASE_AUTO_INSTALL_SUPPORTED=1
      ;;
    3)
      DATABASE_DISPLAY_NAME="SQL Server 2022"
      DATABASE_TYPE="SqlServer"
      DATABASE_ENGINE_KEY="sqlserver2022"
      DATABASE_PORT_NAME="SQL Server"
      SQL_ZIP_FILE_NAME="microi_empty_sqlserver2022.sql.zip"
      SQL_FILE_NAME="microi_empty_sqlserver2022.sql"
      DATABASE_IMAGE="${MICROI_SQLSERVER_IMAGE_REF:-mcr.microsoft.com/mssql/server:2022-CU20-ubuntu-22.04@sha256:7c29dfbac885ad7519e219c7fe4aee0e67283e21a10e9c252d13b0fbde1866f8}"
      DATABASE_INTERNAL_PORT="1433"
      DATABASE_CONTAINER_NAME="microi-install-sqlserver2022"
      DATABASE_USER="sa"
      DATABASE_DATA_OWNER="10001:0"
      DATABASE_AUTO_INSTALL_SUPPORTED=1
      ;;
    4)
      DATABASE_DISPLAY_NAME="Oracle 19c"
      DATABASE_TYPE="Oracle"
      DATABASE_ENGINE_KEY="oracle19c"
      DATABASE_PORT_NAME="Oracle"
      SQL_ZIP_FILE_NAME="microi_empty_oracle19c.sql.zip"
      SQL_FILE_NAME="microi_empty_oracle19c.sql"
      DATABASE_LICENSED_IMAGE_ENV="MICROI_ORACLE_IMAGE_REF"
      DATABASE_BLOCK_REASON="Oracle 19c 的 Dos.ORM NonEmptyEnvelopeV1 运行时参数编码和结果解码尚未完整接入，当前保持 fail-closed，避免安装出可导入但无法正常登录的系统。"
      ;;
    5)
      DATABASE_DISPLAY_NAME="达梦 DM8"
      DATABASE_TYPE="DaMeng"
      DATABASE_ENGINE_KEY="dm8"
      DATABASE_PORT_NAME="达梦 DM8"
      SQL_ZIP_FILE_NAME="microi_empty_dm8.sql.zip"
      SQL_FILE_NAME="microi_empty_dm8.sql"
      DATABASE_LICENSED_IMAGE_ENV="MICROI_DM8_IMAGE_REF"
      DATABASE_IMAGE="${MICROI_DM8_IMAGE_REF:-}"
      DATABASE_INTERNAL_PORT="5236"
      DATABASE_CONTAINER_NAME="microi-install-dm8"
      DATABASE_USER="SYSDBA"
      DATABASE_DATA_OWNER="1000:1000"
      DATABASE_AUTO_INSTALL_SUPPORTED=1
      ;;
    6)
      DATABASE_DISPLAY_NAME="PostgreSQL 17"
      DATABASE_TYPE="PostgreSql"
      DATABASE_ENGINE_KEY="postgresql17"
      DATABASE_PORT_NAME="PostgreSQL"
      SQL_ZIP_FILE_NAME="microi_empty_postgresql17.sql.zip"
      SQL_FILE_NAME="microi_empty_postgresql17.sql"
      DATABASE_IMAGE="${MICROI_POSTGRES_IMAGE_REF:-postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929}"
      DATABASE_INTERNAL_PORT="5432"
      DATABASE_CONTAINER_NAME="microi-install-postgresql17"
      DATABASE_USER="postgres"
      DATABASE_DATA_OWNER="999:999"
      DATABASE_AUTO_INSTALL_SUPPORTED=1
      ;;
    7)
      DATABASE_DISPLAY_NAME="人大金仓 KingbaseES V9"
      DATABASE_TYPE="KingBase"
      DATABASE_ENGINE_KEY="kingbasees"
      DATABASE_PORT_NAME="人大金仓"
      SQL_ZIP_FILE_NAME="microi_empty_kingbasees.sql.zip"
      SQL_FILE_NAME="microi_empty_kingbasees.sql"
      DATABASE_LICENSED_IMAGE_ENV="MICROI_KINGBASE_IMAGE_REF"
      DATABASE_BLOCK_REASON="人大金仓 KingbaseES V9 的 Docker 建库、还原和安装后配置链路尚未在本脚本中通过验收；本次不会修改 Docker。"
      ;;
    *)
      echo "Microi：错误：无效的数据库编号 ${choice}，请输入 1-7。" >&2
      return 1
      ;;
  esac

  SQL_ZIP_URL="${SQL_ZIP_BASE_URL}/${SQL_ZIP_FILE_NAME}"
}

external_service_host_is_safe() {
  local host="${1:-}"
  local octet
  local -a octets=()

  [ -n "${host}" ] && [ "${#host}" -le 253 ] || return 1
  if [[ "${host}" =~ ^[0-9.]+$ ]]; then
    [[ "${host}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
    IFS='.' read -r -a octets <<< "${host}"
    [ "${#octets[@]}" -eq 4 ] || return 1
    for octet in "${octets[@]}"; do
      [[ "${octet}" =~ ^[0-9]{1,3}$ ]] || return 1
      [ $((10#${octet})) -le 255 ] || return 1
    done
    [ "${host}" != '0.0.0.0' ] && [ "${host}" != '255.255.255.255' ]
    return
  fi

  [[ "${host}" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] \
    && [[ "${host}" != *..* ]] \
    && [[ "${host}" != *.-* ]] \
    && [[ "${host}" != *-.* ]]
}

configure_mysql_service_mode() {
  local service_mode_input=""
  local host_input=""
  local port_input=""
  local user_input=""
  local password_input=""

  DATABASE_SERVICE_MODE='managed'
  MYSQL_EXTERNAL_USE_HOST_GATEWAY=0
  MYSQL_EXTERNAL_CONNECTION_HOST=""
  MYSQL_EXTERNAL_HOST_DISPLAY=""
  MYSQL_EXTERNAL_PORT=""
  MYSQL_EXTERNAL_PASSWORD=""
  APP_API_EXTRA_HOSTS=""

  [ "${DATABASE_TYPE}" = 'MySql' ] || return 0

  echo ''
  echo 'Microi：请选择 MySQL 服务来源：'
  echo '  1. 由本脚本安装新的 MySQL 容器（默认）'
  echo '  2. 使用已有 MySQL 服务（不创建 MySQL 容器和数据目录）'
  echo 'Microi：请输入 1 或 2，直接按 Enter 默认选择 1：'
  if [ -n "${MICROI_MYSQL_SERVICE_MODE:-}" ]; then
    service_mode_input="${MICROI_MYSQL_SERVICE_MODE}"
    echo "Microi：使用环境变量 MICROI_MYSQL_SERVICE_MODE=${service_mode_input}"
  else
    read -r service_mode_input
  fi

  case "${service_mode_input:-1}" in
    1|managed|install)
      DATABASE_SERVICE_MODE='managed'
      echo "Microi：将安装新的 ${DATABASE_DISPLAY_NAME} 容器 ✓"
      return 0
      ;;
    2|external|existing)
      DATABASE_SERVICE_MODE='external'
      ;;
    *)
      echo 'Microi：错误：MySQL 服务来源只能是 1（新装）或 2（已有服务）。'
      return 1
      ;;
  esac

  echo 'Microi：请输入已有 MySQL 服务 IP 或 DNS 名；直接按 Enter 表示本机 MySQL：'
  if [ "${MICROI_EXTERNAL_MYSQL_HOST+x}" = x ]; then
    host_input="${MICROI_EXTERNAL_MYSQL_HOST}"
    if [ -n "${host_input}" ]; then
      echo "Microi：使用环境变量 MICROI_EXTERNAL_MYSQL_HOST=${host_input}"
    else
      echo 'Microi：MICROI_EXTERNAL_MYSQL_HOST 为空，按本机 MySQL 处理'
    fi
  else
    read -r host_input
  fi
  case "${host_input,,}" in
    ''|localhost|127.0.0.1|::1|host.docker.internal)
      MYSQL_EXTERNAL_CONNECTION_HOST='host.docker.internal'
      MYSQL_EXTERNAL_HOST_DISPLAY='本机（Docker host-gateway）'
      MYSQL_EXTERNAL_USE_HOST_GATEWAY=1
      APP_API_EXTRA_HOSTS=$'    extra_hosts:\n      - "host.docker.internal:host-gateway"'
      ;;
    *)
      if ! external_service_host_is_safe "${host_input}"; then
        echo 'Microi：错误：MySQL 地址必须是合法 IPv4 或 DNS 名，不能包含协议、端口、路径或空白。'
        return 1
      fi
      MYSQL_EXTERNAL_CONNECTION_HOST="${host_input}"
      MYSQL_EXTERNAL_HOST_DISPLAY="${host_input}"
      ;;
  esac

  echo 'Microi：请输入已有 MySQL 端口；直接按 Enter 使用 3306：'
  if [ -n "${MICROI_EXTERNAL_MYSQL_PORT:-}" ]; then
    port_input="${MICROI_EXTERNAL_MYSQL_PORT}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MYSQL_PORT=${port_input}"
  else
    read -r port_input
  fi
  port_input="${port_input:-3306}"
  if ! [[ "${port_input}" =~ ^[0-9]+$ ]] \
    || [ $((10#${port_input})) -lt 1 ] \
    || [ $((10#${port_input})) -gt 65535 ]; then
    echo 'Microi：错误：MySQL 端口必须是 1-65535 的整数。'
    return 1
  fi
  MYSQL_EXTERNAL_PORT=$((10#${port_input}))

  echo 'Microi：请输入已有 MySQL 帐号；直接按 Enter 使用 root：'
  if [ -n "${MICROI_EXTERNAL_MYSQL_USER:-}" ]; then
    user_input="${MICROI_EXTERNAL_MYSQL_USER}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MYSQL_USER=${user_input}"
  else
    read -r user_input
  fi
  user_input="${user_input:-root}"
  if [[ "${user_input}" == *$'\n'* || "${user_input}" == *$'\r'* ]]; then
    echo 'Microi：错误：MySQL 帐号不能包含换行符。'
    return 1
  fi

  if [ "${MICROI_EXTERNAL_MYSQL_PASSWORD+x}" = x ]; then
    password_input="${MICROI_EXTERNAL_MYSQL_PASSWORD}"
    echo 'Microi：已有 MySQL 密码已从环境变量读取（不会回显）'
  else
    echo 'Microi：请输入已有 MySQL 密码（输入时不会回显）：'
    read -r -s password_input
    echo ''
  fi
  unset MICROI_EXTERNAL_MYSQL_PASSWORD || true
  if [ -z "${password_input}" ]; then
    echo 'Microi：错误：已有 MySQL 密码不能为空。'
    return 1
  fi
  if [[ "${password_input}" == *$'\n'* || "${password_input}" == *$'\r'* ]]; then
    echo 'Microi：错误：MySQL 密码不能包含换行符。'
    return 1
  fi

  DATABASE_USER="${user_input}"
  MYSQL_EXTERNAL_PASSWORD="${password_input}"
  DATABASE_CONTAINER_NAME=""
  echo "Microi：将复用 ${MYSQL_EXTERNAL_HOST_DISPLAY}:${MYSQL_EXTERNAL_PORT}，帐号 ${DATABASE_USER}；不会安装 MySQL 服务 ✓"
}

minio_bucket_name_is_safe() {
  local bucket_name="${1:-}"
  # S3 本身允许 63 位，但 Microi 当前 SaaS 字段长度为 50，必须取更严格上限。
  [ "${#bucket_name}" -ge 3 ] && [ "${#bucket_name}" -le 50 ] \
    && [[ "${bucket_name}" =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ ]] \
    && [[ "${bucket_name}" != *..* ]] \
    && [[ "${bucket_name}" != *.-* ]] \
    && [[ "${bucket_name}" != *-.* ]] \
    && [[ ! "${bucket_name}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

normalize_minio_public_endpoint() {
  local endpoint="${1:-}"
  local default_scheme="${2:-http}"
  local scheme="${default_scheme}"
  local remainder=""
  local host=""
  local endpoint_port=""

  while [[ "${endpoint}" == */ ]]; do endpoint="${endpoint%/}"; done
  case "${endpoint,,}" in
    http://*)
      scheme='http'
      remainder="${endpoint#*://}"
      ;;
    https://*)
      scheme='https'
      remainder="${endpoint#*://}"
      ;;
    *)
      remainder="${endpoint}"
      ;;
  esac
  if [ -z "${remainder}" ] \
    || [[ "${remainder}" == */* ]] \
    || [[ "${remainder}" == *'@'* ]] \
    || [[ "${remainder}" == *'?'* ]] \
    || [[ "${remainder}" == *'#'* ]] \
    || [[ "${remainder}" =~ [[:space:]] ]]; then
    return 1
  fi
  if [[ "${remainder}" == *:* ]]; then
    [ "${remainder//[^:]/}" = ':' ] || return 1
    host="${remainder%:*}"
    endpoint_port="${remainder##*:}"
    [[ "${endpoint_port}" =~ ^[0-9]+$ ]] \
      && [ $((10#${endpoint_port})) -ge 1 ] \
      && [ $((10#${endpoint_port})) -le 65535 ] || return 1
    endpoint_port=$((10#${endpoint_port}))
  else
    host="${remainder}"
  fi
  external_service_host_is_safe "${host}" || return 1

  MINIO_PUBLIC_SSL_FLAG=0
  [ "${scheme}" = 'https' ] && MINIO_PUBLIC_SSL_FLAG=1
  if [ -n "${endpoint_port}" ]; then
    MINIO_PUBLIC_BASE_URL="${scheme}://${host}:${endpoint_port}"
    MINIO_INTERNET_ENDPOINT="${host}:${endpoint_port}"
  else
    MINIO_PUBLIC_BASE_URL="${scheme}://${host}"
    MINIO_INTERNET_ENDPOINT="${host}"
  fi
}

configure_minio_service_mode() {
  local service_mode_input=""
  local host_input=""
  local port_input=""
  local ssl_input=""
  local access_key_input=""
  local secret_key_input=""
  local private_bucket_input=""
  local public_bucket_input=""
  local public_endpoint_input=""
  local default_public_host=""
  local region_input=""
  local stored_internal_endpoint=""

  MINIO_SERVICE_MODE='managed'
  MINIO_EXTERNAL_USE_HOST_GATEWAY=0
  MINIO_EXTERNAL_CONNECTION_HOST=""
  MINIO_EXTERNAL_HOST_DISPLAY=""
  MINIO_EXTERNAL_PORT=""
  MINIO_PRIVATE_SSL_FLAG=0
  MINIO_PUBLIC_SSL_FLAG=0
  MINIO_PUBLIC_BASE_URL=""
  MINIO_INTERNET_ENDPOINT=""
  MINIO_REGION=""
  MINIO_PRIVATE_BUCKET='mci-private'
  MINIO_PUBLIC_BUCKET='mci-public'
  MINIO_EXTERNAL_ACCESS_KEY=""
  MINIO_EXTERNAL_SECRET_KEY=""

  echo ''
  echo 'Microi：请选择 MinIO 服务来源：'
  echo '  1. 由本脚本安装新的 MinIO 容器（默认）'
  echo '  2. 使用已有 MinIO 服务（不创建 MinIO 容器和数据目录）'
  echo 'Microi：请输入 1 或 2，直接按 Enter 默认选择 1：'
  if [ -n "${MICROI_MINIO_SERVICE_MODE:-}" ]; then
    service_mode_input="${MICROI_MINIO_SERVICE_MODE}"
    echo "Microi：使用环境变量 MICROI_MINIO_SERVICE_MODE=${service_mode_input}"
  else
    read -r service_mode_input
  fi
  case "${service_mode_input:-1}" in
    1|managed|install)
      echo 'Microi：将安装新的 MinIO 容器 ✓'
      return 0
      ;;
    2|external|existing)
      MINIO_SERVICE_MODE='external'
      ;;
    *)
      echo 'Microi：错误：MinIO 服务来源只能是 1（新装）或 2（已有服务）。'
      return 1
      ;;
  esac

  echo 'Microi：请输入已有 MinIO API 服务 IP 或 DNS 名；直接按 Enter 表示本机 MinIO：'
  if [ "${MICROI_EXTERNAL_MINIO_HOST+x}" = x ]; then
    host_input="${MICROI_EXTERNAL_MINIO_HOST}"
    if [ -n "${host_input}" ]; then
      echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_HOST=${host_input}"
    else
      echo 'Microi：MICROI_EXTERNAL_MINIO_HOST 为空，按本机 MinIO 处理'
    fi
  else
    read -r host_input
  fi
  case "${host_input,,}" in
    ''|localhost|127.0.0.1|::1|host.docker.internal)
      MINIO_EXTERNAL_CONNECTION_HOST='host.docker.internal'
      MINIO_EXTERNAL_HOST_DISPLAY='本机（Docker host-gateway）'
      MINIO_EXTERNAL_USE_HOST_GATEWAY=1
      APP_API_EXTRA_HOSTS=$'    extra_hosts:\n      - "host.docker.internal:host-gateway"'
      default_public_host="${ACCESS_IP:-127.0.0.1}"
      ;;
    *)
      if ! external_service_host_is_safe "${host_input}"; then
        echo 'Microi：错误：MinIO 地址必须是合法 IPv4 或 DNS 名，不能包含协议、端口、路径或空白。'
        return 1
      fi
      MINIO_EXTERNAL_CONNECTION_HOST="${host_input}"
      MINIO_EXTERNAL_HOST_DISPLAY="${host_input}"
      default_public_host="${host_input}"
      ;;
  esac

  echo 'Microi：请输入已有 MinIO API 端口；直接按 Enter 使用 9000：'
  if [ -n "${MICROI_EXTERNAL_MINIO_PORT:-}" ]; then
    port_input="${MICROI_EXTERNAL_MINIO_PORT}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_PORT=${port_input}"
  else
    read -r port_input
  fi
  port_input="${port_input:-9000}"
  if ! [[ "${port_input}" =~ ^[0-9]+$ ]] \
    || [ $((10#${port_input})) -lt 1 ] \
    || [ $((10#${port_input})) -gt 65535 ]; then
    echo 'Microi：错误：MinIO API 端口必须是 1-65535 的整数。'
    return 1
  fi
  MINIO_EXTERNAL_PORT=$((10#${port_input}))

  echo 'Microi：已有 MinIO API 是否使用 HTTPS？输入 1=HTTPS，0=HTTP；直接按 Enter 默认 0：'
  if [ -n "${MICROI_EXTERNAL_MINIO_USE_SSL:-}" ]; then
    ssl_input="${MICROI_EXTERNAL_MINIO_USE_SSL}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_USE_SSL=${ssl_input}"
  else
    read -r ssl_input
  fi
  case "${ssl_input:-0}" in
    0|http|no) MINIO_PRIVATE_SSL_FLAG=0 ;;
    1|https|yes) MINIO_PRIVATE_SSL_FLAG=1 ;;
    *)
      echo 'Microi：错误：MinIO HTTPS 选项只能是 0 或 1。'
      return 1
      ;;
  esac

  echo 'Microi：请输入已有 MinIO Access Key（输入时不会回显）：'
  if [ "${MICROI_EXTERNAL_MINIO_ACCESS_KEY+x}" = x ]; then
    access_key_input="${MICROI_EXTERNAL_MINIO_ACCESS_KEY}"
    echo 'Microi：MinIO Access Key 已从环境变量读取（不会回显）'
  else
    read -r -s access_key_input
    echo ''
  fi
  echo 'Microi：请输入已有 MinIO Secret Key（输入时不会回显）：'
  if [ "${MICROI_EXTERNAL_MINIO_SECRET_KEY+x}" = x ]; then
    secret_key_input="${MICROI_EXTERNAL_MINIO_SECRET_KEY}"
    echo 'Microi：MinIO Secret Key 已从环境变量读取（不会回显）'
  else
    read -r -s secret_key_input
    echo ''
  fi
  unset MICROI_EXTERNAL_MINIO_ACCESS_KEY MICROI_EXTERNAL_MINIO_SECRET_KEY || true
  if [ -z "${access_key_input}" ] || [ -z "${secret_key_input}" ]; then
    echo 'Microi：错误：已有 MinIO 的 Access Key 和 Secret Key 均不能为空。'
    return 1
  fi
  if [ "${#access_key_input}" -gt 50 ] || [ "${#secret_key_input}" -gt 50 ]; then
    echo 'Microi：错误：MinIO Access Key / Secret Key 不能超过平台 SaaS 字段上限 50 个字符。'
    return 1
  fi
  if [[ "${access_key_input}" == *$'\n'* || "${access_key_input}" == *$'\r'* \
    || "${secret_key_input}" == *$'\n'* || "${secret_key_input}" == *$'\r'* ]]; then
    echo 'Microi：错误：MinIO 凭据不能包含换行符。'
    return 1
  fi

  echo 'Microi：请输入私有桶名称；直接按 Enter 使用 mci-private：'
  if [ -n "${MICROI_EXTERNAL_MINIO_PRIVATE_BUCKET:-}" ]; then
    private_bucket_input="${MICROI_EXTERNAL_MINIO_PRIVATE_BUCKET}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_PRIVATE_BUCKET=${private_bucket_input}"
  else
    read -r private_bucket_input
  fi
  echo 'Microi：请输入公有桶名称；直接按 Enter 使用 mci-public：'
  if [ -n "${MICROI_EXTERNAL_MINIO_PUBLIC_BUCKET:-}" ]; then
    public_bucket_input="${MICROI_EXTERNAL_MINIO_PUBLIC_BUCKET}"
    echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_PUBLIC_BUCKET=${public_bucket_input}"
  else
    read -r public_bucket_input
  fi
  private_bucket_input="${private_bucket_input:-mci-private}"
  public_bucket_input="${public_bucket_input:-mci-public}"
  if ! minio_bucket_name_is_safe "${private_bucket_input}" \
    || ! minio_bucket_name_is_safe "${public_bucket_input}" \
    || [ "${private_bucket_input}" = "${public_bucket_input}" ]; then
    echo 'Microi：错误：MinIO 桶名必须是不同的 3-50 位小写 S3 桶名（受平台 SaaS 字段长度限制）。'
    return 1
  fi

  echo 'Microi：请输入浏览器可访问的 MinIO 地址（可含 http:// 或 https://，不含桶名）；'
  echo 'Microi：直接按 Enter 使用所填服务地址和端口：'
  if [ "${MICROI_EXTERNAL_MINIO_PUBLIC_ENDPOINT+x}" = x ]; then
    public_endpoint_input="${MICROI_EXTERNAL_MINIO_PUBLIC_ENDPOINT}"
    if [ -n "${public_endpoint_input}" ]; then
      echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_PUBLIC_ENDPOINT=${public_endpoint_input}"
    fi
  else
    read -r public_endpoint_input
  fi
  if [ -z "${public_endpoint_input}" ]; then
    public_endpoint_input="${default_public_host}:${MINIO_EXTERNAL_PORT}"
  fi
  if [ "${MINIO_PRIVATE_SSL_FLAG}" = '1' ]; then
    MINIO_EXTERNAL_INTERNAL_URL="https://${MINIO_EXTERNAL_CONNECTION_HOST}:${MINIO_EXTERNAL_PORT}"
    if ! normalize_minio_public_endpoint "${public_endpoint_input}" 'https'; then
      echo 'Microi：错误：MinIO 浏览器访问地址必须是无路径、无帐号信息的 HTTP(S) 主机地址。'
      return 1
    fi
  else
    MINIO_EXTERNAL_INTERNAL_URL="http://${MINIO_EXTERNAL_CONNECTION_HOST}:${MINIO_EXTERNAL_PORT}"
    if ! normalize_minio_public_endpoint "${public_endpoint_input}" 'http'; then
      echo 'Microi：错误：MinIO 浏览器访问地址必须是无路径、无帐号信息的 HTTP(S) 主机地址。'
      return 1
    fi
  fi

  echo 'Microi：请输入 MinIO Region；直接按 Enter 留空：'
  if [ "${MICROI_EXTERNAL_MINIO_REGION+x}" = x ]; then
    region_input="${MICROI_EXTERNAL_MINIO_REGION}"
    [ -z "${region_input}" ] || echo "Microi：使用环境变量 MICROI_EXTERNAL_MINIO_REGION=${region_input}"
  else
    read -r region_input
  fi
  if [ -n "${region_input}" ] && [[ ! "${region_input}" =~ ^[A-Za-z0-9._-]{1,50}$ ]]; then
    echo 'Microi：错误：MinIO Region 只能包含 1-50 位字母、数字、点、下划线和短横线。'
    return 1
  fi
  stored_internal_endpoint="${MINIO_EXTERNAL_CONNECTION_HOST}:${MINIO_EXTERNAL_PORT}"
  if [ "${#stored_internal_endpoint}" -gt 50 ]; then
    echo 'Microi：错误：MinIO 内部 Endpoint 超过平台 SaaS 字段上限 50 个字符。'
    return 1
  fi
  if [ "${#MINIO_INTERNET_ENDPOINT}" -gt 50 ]; then
    echo 'Microi：错误：MinIO 浏览器 Endpoint 超过平台 SaaS 字段上限 50 个字符。'
    return 1
  fi

  MINIO_EXTERNAL_ACCESS_KEY="${access_key_input}"
  MINIO_EXTERNAL_SECRET_KEY="${secret_key_input}"
  MINIO_PRIVATE_BUCKET="${private_bucket_input}"
  MINIO_PUBLIC_BUCKET="${public_bucket_input}"
  MINIO_REGION="${region_input}"
  echo "Microi：将复用 ${MINIO_EXTERNAL_INTERNAL_URL}，公有访问 ${MINIO_PUBLIC_BASE_URL}/${MINIO_PUBLIC_BUCKET}；不会安装 MinIO 服务 ✓"
}

print_database_profile() {
  echo "DATABASE_CHOICE=${DATABASE_CHOICE}"
  echo "DATABASE_DISPLAY_NAME=${DATABASE_DISPLAY_NAME}"
  echo "DATABASE_TYPE=${DATABASE_TYPE}"
  echo "DATABASE_ENGINE_KEY=${DATABASE_ENGINE_KEY}"
  echo "SQL_ZIP_FILE_NAME=${SQL_ZIP_FILE_NAME}"
  echo "SQL_FILE_NAME=${SQL_FILE_NAME}"
  echo "SQL_ZIP_URL=${SQL_ZIP_URL}"
  echo "AUTO_INSTALL_SUPPORTED=${DATABASE_AUTO_INSTALL_SUPPORTED}"
  echo "LICENSED_IMAGE_ENV=${DATABASE_LICENSED_IMAGE_ENV}"
  echo "DATABASE_IMAGE=${DATABASE_IMAGE}"
  echo "DATABASE_CONTAINER_NAME=${DATABASE_CONTAINER_NAME}"
  echo "DATABASE_INTERNAL_PORT=${DATABASE_INTERNAL_PORT}"
}

validate_database_install_preflight() {
  local image_ref=""

  if [ "${DATABASE_CHOICE}" = "3" ]; then
    case "$(uname -m)" in
      x86_64|amd64) ;;
      *)
        echo "Microi：错误：SQL Server 2022 Linux 容器当前只支持 x86_64/amd64，当前架构为 $(uname -m)。"
        return 1
        ;;
    esac
    local total_mem_kb
    total_mem_kb=$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
    if [ "${total_mem_kb:-0}" -lt 2097152 ]; then
      echo "Microi：错误：SQL Server 2022 至少需要约 2GB 可用主机内存，当前 MemTotal=${total_mem_kb:-0}KB。"
      return 1
    fi
  fi

  if [ -n "${DATABASE_LICENSED_IMAGE_ENV}" ]; then
    image_ref="${!DATABASE_LICENSED_IMAGE_ENV}"
    if [ -z "${image_ref}" ]; then
      echo "Microi：错误：${DATABASE_DISPLAY_NAME} 属于需授权的软件，必须先提供您有权使用的镜像：export ${DATABASE_LICENSED_IMAGE_ENV}=<合法镜像引用>。"
      echo 'Microi：未提供合法镜像，已在任何 Docker 变更前停止。'
      return 1
    fi
    if [[ ! "${image_ref}" =~ ^[A-Za-z0-9._/@:-]+$ ]]; then
      echo "Microi：错误：${DATABASE_LICENSED_IMAGE_ENV} 不是安全、有效的 Docker 镜像引用。"
      return 1
    fi
  fi

  if [ "${DATABASE_AUTO_INSTALL_SUPPORTED}" != "1" ]; then
    echo "Microi：错误：${DATABASE_BLOCK_REASON}"
    echo "Microi：对应空数据库包地址：${SQL_ZIP_URL}"
    return 1
  fi
}

# 校验数据库 ZIP：只允许一个普通 .sql 文件，拒绝目录穿越、绝对路径和加密/损坏压缩包。
# 校验结果通过 SQL_ARCHIVE_ENTRY、SQL_UNCOMPRESSED_BYTES 返回。
validate_sql_zip_archive() {
  local archive_path="$1"
  local entry=""
  local entry_count=0
  local part=""

  if [ ! -f "${archive_path}" ]; then
    echo "Microi：错误：数据库压缩包不存在或不是文件：${archive_path}" >&2
    return 1
  fi
  if ! command -v unzip >/dev/null 2>&1; then
    echo 'Microi：错误：缺少 unzip，无法校验数据库压缩包。' >&2
    return 1
  fi
  if ! unzip -tqq "${archive_path}" >/dev/null 2>&1; then
    echo 'Microi：错误：数据库压缩包已损坏、被加密或无法完整解压。' >&2
    return 1
  fi

  while IFS= read -r entry; do
    [ -z "${entry}" ] && continue
    if [[ "${entry}" == */ ]]; then
      echo "Microi：错误：ZIP 内不能包含目录，只能包含一个 .sql 文件：${entry}" >&2
      return 1
    fi
    entry_count=$((entry_count + 1))
    SQL_ARCHIVE_ENTRY="${entry}"
  done < <(unzip -Z1 "${archive_path}")

  if [ "${entry_count}" -ne 1 ]; then
    echo "Microi：错误：ZIP 内必须且只能有一个 .sql 文件，当前检测到 ${entry_count} 个文件。" >&2
    return 1
  fi
  if [[ ! "${SQL_ARCHIVE_ENTRY,,}" =~ \.sql$ ]]; then
    echo "Microi：错误：ZIP 内唯一文件不是 .sql：${SQL_ARCHIVE_ENTRY}" >&2
    return 1
  fi
  if [[ "${SQL_ARCHIVE_ENTRY}" == /* || "${SQL_ARCHIVE_ENTRY}" =~ ^[A-Za-z]: || "${SQL_ARCHIVE_ENTRY}" == *\\* ]]; then
    echo "Microi：错误：ZIP 内 SQL 文件名包含不安全路径：${SQL_ARCHIVE_ENTRY}" >&2
    return 1
  fi
  IFS='/' read -r -a _sql_path_parts <<< "${SQL_ARCHIVE_ENTRY}"
  for part in "${_sql_path_parts[@]}"; do
    if [ -z "${part}" ] || [ "${part}" = "." ] || [ "${part}" = ".." ]; then
      echo "Microi：错误：ZIP 内 SQL 文件名包含目录穿越片段：${SQL_ARCHIVE_ENTRY}" >&2
      return 1
    fi
  done

  SQL_UNCOMPRESSED_BYTES=$(unzip -Z -l "${archive_path}" | awk 'NR > 2 && $1 ~ /^-/ {print $4; exit}')
  if [[ ! "${SQL_UNCOMPRESSED_BYTES:-}" =~ ^[0-9]+$ ]] || [ "${SQL_UNCOMPRESSED_BYTES}" -le 0 ]; then
    echo 'Microi：错误：无法读取 SQL 解压后大小，或 SQL 文件为空。' >&2
    return 1
  fi
}

# 从成熟库 SQL 的显式切库/建库语句或常见导出头识别原数据库名。
# 仅接受各数据库共同可安全引用的短标识符；没有任何可靠候选时由调用方回退 OsClient，
# 多个不同候选则失败关闭，避免把同一包静默导入错误数据库。
detect_sql_database_name_from_archive() {
  local archive_path="$1"
  local archive_entry="$2"
  local database_type="$3"
  local candidates=""
  local candidate=""
  local candidate_count=0
  SQL_DETECTED_DATABASE_NAME=""

  case "${database_type}" in
    MySql)
      if ! candidates=$(set -o pipefail; unzip -p "${archive_path}" "${archive_entry}" \
          | tr -d '\r`"[]' \
          | sed -nE \
            -e 's/^[[:space:]]*USE[[:space:]]+([A-Za-z0-9_$-]+)[[:space:]]*;.*$/\1/Ip' \
            -e 's/^[[:space:]]*CREATE[[:space:]]+DATABASE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+([A-Za-z0-9_$-]+)([[:space:];].*)?$/\2/Ip' \
            -e 's/^[[:space:]]*(--|#|\/\*)?[[:space:]]*Source[[:space:]]+(Database|Schema)[[:space:]]*:[[:space:]]*([A-Za-z0-9_$-]+).*$/\3/Ip' \
            -e 's/^[[:space:]]*--.*Database[[:space:]]*:[[:space:]]*([A-Za-z0-9_$-]+).*$/\1/Ip' \
            -e 's/^[[:space:]]*--[[:space:]]*Dumping[[:space:]]+database[[:space:]]+structure[[:space:]]+for[[:space:]]+([A-Za-z0-9_$-]+).*$/\1/Ip'); then
        echo 'Microi：错误：无法读取 ZIP 内 SQL 以识别数据库名。' >&2
        return 1
      fi
      ;;
    SqlServer)
      if ! candidates=$(set -o pipefail; unzip -p "${archive_path}" "${archive_entry}" \
          | tr -d '\r`"[]' \
          | sed -nE \
            -e 's/^[[:space:]]*USE[[:space:]]+([A-Za-z0-9_$-]+)[[:space:]]*;?[[:space:]]*$/\1/Ip' \
            -e 's/^[[:space:]]*CREATE[[:space:]]+DATABASE[[:space:]]+([A-Za-z0-9_$-]+)([[:space:];].*)?$/\1/Ip' \
            -e 's/^[[:space:]]*--.*Database[[:space:]]*:[[:space:]]*([A-Za-z0-9_$-]+).*$/\1/Ip'); then
        echo 'Microi：错误：无法读取 ZIP 内 SQL 以识别数据库名。' >&2
        return 1
      fi
      ;;
    PostgreSql)
      if ! candidates=$(set -o pipefail; unzip -p "${archive_path}" "${archive_entry}" \
          | tr -d '\r`"[]' \
          | sed -nE \
            -e 's/^[[:space:]]*\\(connect|c)[[:space:]]+(-reuse-previous=on[[:space:]]+)?([A-Za-z0-9_$-]+).*$/\3/Ip' \
            -e 's/^[[:space:]]*CREATE[[:space:]]+DATABASE[[:space:]]+([A-Za-z0-9_$-]+)([[:space:];].*)?$/\1/Ip' \
            -e 's/^[[:space:]]*--.*Database[[:space:]]*:[[:space:]]*([A-Za-z0-9_$-]+).*$/\1/Ip'); then
        echo 'Microi：错误：无法读取 ZIP 内 SQL 以识别数据库名。' >&2
        return 1
      fi
      ;;
    *)
      return 0
      ;;
  esac

  candidates=$(printf '%s\n' "${candidates}" | awk -v database_type="${database_type}" '
    {
      name=$0
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
      if (name == "") next
      normalized=tolower(name)
      if (database_type == "MySql" \
        && (normalized == "mysql" || normalized == "information_schema" \
          || normalized == "performance_schema" || normalized == "sys")) next
      if (database_type == "SqlServer" \
        && (normalized == "master" || normalized == "tempdb" \
          || normalized == "model" || normalized == "msdb")) next
      if (database_type == "PostgreSql" \
        && (normalized == "postgres" || normalized == "template0" \
          || normalized == "template1")) next
      if (!seen[normalized]++) print name
    }
  ')

  while IFS= read -r candidate; do
    [ -n "${candidate}" ] || continue
    if ! microi_database_name_is_safe "${candidate}"; then
      echo "Microi：错误：SQL 中识别到不安全的数据库名，无法自动还原。" >&2
      return 1
    fi
    SQL_DETECTED_DATABASE_NAME="${candidate}"
    candidate_count=$((candidate_count + 1))
  done <<< "${candidates}"

  if [ "${candidate_count}" -gt 1 ]; then
    echo "Microi：错误：SQL 中识别到多个不同的业务数据库名，无法安全确定唯一还原目标：" >&2
    while IFS= read -r candidate; do
      [ -n "${candidate}" ] && printf '  - %s\n' "${candidate}" >&2
    done <<< "${candidates}"
    SQL_DETECTED_DATABASE_NAME=""
    return 1
  fi
}

detect_physical_cpu_cores() {
  local cores="${MICROI_HOST_PHYSICAL_CORES_OVERRIDE:-}"
  if [[ "${cores}" =~ ^[1-9][0-9]*$ ]]; then
    echo "${cores}"
    return
  fi
  cores=$(awk '
    /^physical id[[:space:]]*:/ { physical=$NF }
    /^core id[[:space:]]*:/ { if (physical != "") seen[physical ":" $NF]=1 }
    END { for (key in seen) count++; print count+0 }
  ' /proc/cpuinfo 2>/dev/null || echo 0)
  if [[ ! "${cores}" =~ ^[1-9][0-9]*$ ]] && command -v lscpu >/dev/null 2>&1; then
    cores=$(lscpu -p=CORE,SOCKET 2>/dev/null | awk -F, '!/^#/ { seen[$1 ":" $2]=1 } END { for (key in seen) count++; print count+0 }')
  fi
  if [[ ! "${cores}" =~ ^[1-9][0-9]*$ ]]; then
    cores=$(nproc 2>/dev/null || echo 1)
  fi
  echo "${cores}"
}

detect_storage_type() {
  local target_path="${1:-/}"
  local override="${MICROI_HOST_DISK_TYPE_OVERRIDE:-}"
  local source_device=""
  local rota_values=""
  local rota_count=0
  local rota_sum=0

  case "${override,,}" in
    ssd|nvme) echo 'ssd'; return ;;
    hdd) echo 'hdd'; return ;;
    unknown) echo 'unknown'; return ;;
  esac
  if command -v findmnt >/dev/null 2>&1 && command -v lsblk >/dev/null 2>&1; then
    source_device=$(findmnt -T "${target_path}" -n -o SOURCE 2>/dev/null | head -1)
    rota_values=$(lsblk -n -o ROTA "${source_device}" 2>/dev/null | awk '$1 == 0 || $1 == 1 { print $1 }')
    while IFS= read -r _rota; do
      [ -z "${_rota}" ] && continue
      rota_count=$((rota_count + 1))
      rota_sum=$((rota_sum + _rota))
    done <<< "${rota_values}"
    if [ "${rota_count}" -gt 0 ]; then
      if [ "${rota_sum}" -eq 0 ]; then echo 'ssd'; else echo 'hdd'; fi
      return
    fi
  fi
  echo 'unknown'
}

# MySQL 与整套 Microi 服务共机部署，缓冲池保留 Redis/Mongo/API/系统空间；
# CPU 决定连接及 I/O 线程，真实块设备 ROTA 决定 SSD/HDD I/O 参数。
generate_mysql_config() {
  local total_mem_mb="${MICROI_HOST_MEMORY_MB_OVERRIDE:-}"
  local logical_cpus="${MICROI_HOST_LOGICAL_CPUS_OVERRIDE:-}"
  local physical_cores
  local disk_type
  local buffer_pool_mb
  local buffer_pool_percent
  local innodb_log_buffer_size
  local innodb_log_file_mb
  local innodb_buffer_pool_instances
  local buffer_pool_alignment_mb
  local max_connections
  local memory_connection_cap
  local thread_cache_size
  local table_open_cache
  local io_threads
  local purge_threads
  local innodb_io_capacity
  local innodb_io_capacity_max
  local innodb_flush_neighbors
  local tmp_table_size
  local durability_mode="${MICROI_MYSQL_DURABILITY:-safe}"
  local flush_log_at_trx_commit=1
  local sync_binlog=1

  if [[ ! "${total_mem_mb}" =~ ^[1-9][0-9]*$ ]]; then
    total_mem_mb=$(awk '/MemTotal/ {print int($2 / 1024); exit}' /proc/meminfo 2>/dev/null || echo 2048)
  fi
  if [[ ! "${logical_cpus}" =~ ^[1-9][0-9]*$ ]]; then
    logical_cpus=$(nproc 2>/dev/null || echo 1)
  fi
  physical_cores=$(detect_physical_cpu_cores)
  disk_type=$(detect_storage_type "${DATABASE_DATA_DIR:-/}")

  if [ "${total_mem_mb}" -le 2048 ]; then buffer_pool_percent=20
  elif [ "${total_mem_mb}" -le 4096 ]; then buffer_pool_percent=25
  elif [ "${total_mem_mb}" -le 8192 ]; then buffer_pool_percent=30
  elif [ "${total_mem_mb}" -le 16384 ]; then buffer_pool_percent=35
  else buffer_pool_percent=45
  fi
  buffer_pool_mb=$((total_mem_mb * buffer_pool_percent / 100))
  [ "${buffer_pool_mb}" -lt 128 ] && buffer_pool_mb=128

  memory_connection_cap=$((total_mem_mb / 64))
  [ "${memory_connection_cap}" -lt 100 ] && memory_connection_cap=100
  max_connections=$((logical_cpus * 25))
  [ "${max_connections}" -lt 100 ] && max_connections=100
  [ "${max_connections}" -gt "${memory_connection_cap}" ] && max_connections="${memory_connection_cap}"
  [ "${max_connections}" -gt 800 ] && max_connections=800

  thread_cache_size=$((logical_cpus * 8))
  [ "${thread_cache_size}" -lt 32 ] && thread_cache_size=32
  [ "${thread_cache_size}" -gt 256 ] && thread_cache_size=256
  table_open_cache=$((physical_cores * 256))
  [ "${table_open_cache}" -lt 512 ] && table_open_cache=512
  [ "${table_open_cache}" -gt 8192 ] && table_open_cache=8192
  io_threads="${physical_cores}"
  [ "${io_threads}" -lt 4 ] && io_threads=4
  [ "${io_threads}" -gt 16 ] && io_threads=16
  purge_threads=$(((physical_cores + 1) / 2))
  [ "${purge_threads}" -lt 2 ] && purge_threads=2
  [ "${purge_threads}" -gt 8 ] && purge_threads=8

  innodb_buffer_pool_instances=$((buffer_pool_mb / 1024))
  [ "${innodb_buffer_pool_instances}" -lt 1 ] && innodb_buffer_pool_instances=1
  [ "${innodb_buffer_pool_instances}" -gt 16 ] && innodb_buffer_pool_instances=16
  # MySQL 8 会把 Buffer Pool 自动调整为 chunk(默认 128M) * instances 的整数倍。
  # 主动向下对齐，避免启动时被隐式向上扩容，导致实际内存超过脚本显示值。
  buffer_pool_alignment_mb=$((128 * innodb_buffer_pool_instances))
  buffer_pool_mb=$((buffer_pool_mb / buffer_pool_alignment_mb * buffer_pool_alignment_mb))
  [ "${buffer_pool_mb}" -lt 128 ] && buffer_pool_mb=128
  innodb_log_file_mb=$((buffer_pool_mb / 16))
  [ "${innodb_log_file_mb}" -lt 128 ] && innodb_log_file_mb=128
  [ "${innodb_log_file_mb}" -gt 4096 ] && innodb_log_file_mb=4096
  if [ "${total_mem_mb}" -le 4096 ]; then innodb_log_buffer_size='32M'; tmp_table_size='32M'
  elif [ "${total_mem_mb}" -le 16384 ]; then innodb_log_buffer_size='64M'; tmp_table_size='64M'
  else innodb_log_buffer_size='256M'; tmp_table_size='128M'
  fi

  case "${disk_type}" in
    ssd)
      innodb_io_capacity=$((physical_cores * 500))
      [ "${innodb_io_capacity}" -lt 2000 ] && innodb_io_capacity=2000
      [ "${innodb_io_capacity}" -gt 10000 ] && innodb_io_capacity=10000
      innodb_io_capacity_max=$((innodb_io_capacity * 2))
      innodb_flush_neighbors=0
      ;;
    hdd)
      innodb_io_capacity=400
      innodb_io_capacity_max=800
      innodb_flush_neighbors=1
      [ "${io_threads}" -gt 8 ] && io_threads=8
      ;;
    *)
      innodb_io_capacity=1000
      innodb_io_capacity_max=2000
      innodb_flush_neighbors=0
      ;;
  esac
  if [ "${durability_mode,,}" = 'performance' ]; then
    flush_log_at_trx_commit=2
    sync_binlog=100
  fi

  echo "Microi：MySQL 自适应配置：内存 ${total_mem_mb}MB，物理核 ${physical_cores}，逻辑核 ${logical_cpus}，磁盘 ${disk_type}，Buffer Pool ${buffer_pool_mb}MB，最大连接 ${max_connections}" >&2
  cat <<MYSQLCNF
[mysqld]
# Microi 自适应配置：RAM=${total_mem_mb}MB, physical=${physical_cores}, logical=${logical_cpus}, disk=${disk_type}
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
skip_name_resolve = ON
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

# 连接与表缓存（连接数同时受 CPU、内存上限约束）
max_connections = ${max_connections}
max_connect_errors = 100000
thread_cache_size = ${thread_cache_size}
table_open_cache = ${table_open_cache}

# 全局内存；每连接缓冲保持保守值，避免高并发 OOM
innodb_buffer_pool_size = ${buffer_pool_mb}M
innodb_log_buffer_size = ${innodb_log_buffer_size}
key_buffer_size = 64M
tmp_table_size = ${tmp_table_size}
max_heap_table_size = ${tmp_table_size}
sort_buffer_size = 512K
read_buffer_size = 512K
read_rnd_buffer_size = 512K
join_buffer_size = 512K
thread_stack = 512K

# 按物理核心与 SSD/HDD 自动调节的 InnoDB I/O
innodb_buffer_pool_instances = ${innodb_buffer_pool_instances}
innodb_log_file_size = ${innodb_log_file_mb}M
innodb_log_files_in_group = 2
innodb_io_capacity = ${innodb_io_capacity}
innodb_io_capacity_max = ${innodb_io_capacity_max}
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = ${innodb_flush_neighbors}
innodb_read_io_threads = ${io_threads}
innodb_write_io_threads = ${io_threads}
innodb_purge_threads = ${purge_threads}
innodb_adaptive_flushing = ON

# 默认 safe 保证事务/binlog 每次提交落盘；MICROI_MYSQL_DURABILITY=performance 可显式换取吞吐
innodb_flush_log_at_trx_commit = ${flush_log_at_trx_commit}
sync_binlog = ${sync_binlog}
innodb_doublewrite = 1
log_bin_trust_function_creators = ON
performance_schema = ON
MYSQLCNF
  if [ "${MYSQL_VERSION}" = '5.7' ]; then
    cat <<'MYSQL57ONLY'
query_cache_type = 0
query_cache_size = 0
MYSQL57ONLY
  else
    cat <<'MYSQL8ONLY'
default_authentication_plugin = mysql_native_password
MYSQL8ONLY
  fi
}

# 自动化验收入口：不读取交互、不访问网络、不修改 Docker。
if [ "${MICROI_INSTALL_VALIDATE_SQL_ZIP_ONLY:-0}" = "1" ]; then
  validate_sql_zip_archive "${MICROI_SQL_ZIP_PATH:?MICROI_SQL_ZIP_PATH is required}"
  echo "SQL_ARCHIVE_ENTRY=${SQL_ARCHIVE_ENTRY}"
  echo "SQL_UNCOMPRESSED_BYTES=${SQL_UNCOMPRESSED_BYTES}"
  if [ -n "${MICROI_SQL_DATABASE_TYPE:-}" ]; then
    detect_sql_database_name_from_archive \
      "${MICROI_SQL_ZIP_PATH}" "${SQL_ARCHIVE_ENTRY}" "${MICROI_SQL_DATABASE_TYPE}"
    echo "SQL_DETECTED_DATABASE_NAME=${SQL_DETECTED_DATABASE_NAME}"
  fi
  exit 0
fi
if [ "${MICROI_INSTALL_MYSQL_CONFIG_ONLY:-0}" = "1" ]; then
  configure_database_profile "${MICROI_DATABASE_CHOICE:-2}"
  DATABASE_DATA_DIR="${MICROI_DATABASE_DATA_DIR_FOR_DETECTION:-/}"
  generate_mysql_config
  exit 0
fi

# CI/维护人员可验证全部数据库映射，不探测网络、不读取输入、不修改 Docker。
if [ "${MICROI_INSTALL_PROFILE_ONLY:-0}" = "1" ]; then
  configure_database_profile "${MICROI_DATABASE_CHOICE:-1}"
  print_database_profile
  exit 0
fi

# 已有 MySQL / MinIO 的无副作用输入规划入口：只校验与归一化配置，不访问网络或 Docker。
if [ "${MICROI_INSTALL_EXTERNAL_MYSQL_PLAN_ONLY:-0}" = "1" ]; then
  configure_database_profile "${MICROI_DATABASE_CHOICE:-1}"
  if [ "${DATABASE_TYPE}" != 'MySql' ]; then
    echo 'Microi：错误：已有 MySQL 规划仅支持数据库选项 1 或 2。'
    exit 1
  fi
  MICROI_MYSQL_SERVICE_MODE="${MICROI_MYSQL_SERVICE_MODE:-external}"
  configure_mysql_service_mode
  if [ "${DATABASE_SERVICE_MODE}" != 'external' ]; then
    echo 'Microi：错误：已有 MySQL 规划入口必须使用 external 模式。'
    exit 1
  fi
  echo "DATABASE_SERVICE_MODE=${DATABASE_SERVICE_MODE}"
  echo "MYSQL_EXPECTED_VERSION=${MYSQL_VERSION}"
  echo "MYSQL_CONNECTION_HOST=${MYSQL_EXTERNAL_CONNECTION_HOST}"
  echo "MYSQL_CONNECTION_PORT=${MYSQL_EXTERNAL_PORT}"
  echo "MYSQL_CONNECTION_USER=${DATABASE_USER}"
  echo 'MYSQL_PASSWORD_CONFIGURED=1'
  echo 'MYSQL_CONTAINER_CREATED=0'
  exit 0
fi
if [ "${MICROI_INSTALL_EXTERNAL_MINIO_PLAN_ONLY:-0}" = "1" ]; then
  ACCESS_IP="${MICROI_PLAN_ACCESS_IP:-192.0.2.10}"
  APP_API_EXTRA_HOSTS=""
  MICROI_MINIO_SERVICE_MODE="${MICROI_MINIO_SERVICE_MODE:-external}"
  configure_minio_service_mode
  if [ "${MINIO_SERVICE_MODE}" != 'external' ]; then
    echo 'Microi：错误：已有 MinIO 规划入口必须使用 external 模式。'
    exit 1
  fi
  echo "MINIO_SERVICE_MODE=${MINIO_SERVICE_MODE}"
  echo "MINIO_INTERNAL_URL=${MINIO_EXTERNAL_INTERNAL_URL}"
  echo "MINIO_PUBLIC_BASE_URL=${MINIO_PUBLIC_BASE_URL}"
  echo "MINIO_PRIVATE_BUCKET=${MINIO_PRIVATE_BUCKET}"
  echo "MINIO_PUBLIC_BUCKET=${MINIO_PUBLIC_BUCKET}"
  echo "MINIO_REGION=${MINIO_REGION}"
  echo 'MINIO_CREDENTIALS_CONFIGURED=1'
  echo 'MINIO_CONTAINER_CREATED=0'
  exit 0
fi

# OCR 安装计划的无副作用验收入口：不读取交互、不访问网络、不修改 Docker。
if [ "${MICROI_INSTALL_OCR_PLAN_ONLY:-0}" = "1" ]; then
  echo "OCR_IMAGE=${OCR_IMAGE}"
  echo "OCR_CONTAINER_NAME=${OCR_CONTAINER_NAME}"
  echo "OCR_INTERNAL_PORT=${OCR_INTERNAL_PORT}"
  echo "OCR_RUNTIME_NETWORK=${OCR_RUNTIME_NETWORK}"
  echo "OCR_SERVICE_ENDPOINT=${OCR_SERVICE_ENDPOINT}"
  echo 'OCR_DEFAULT_INSTALL=1'
  echo 'OCR_FIREWALL_EXPOSED=0'
  exit 0
fi

# === 修复中文显示：确保终端使用 UTF-8 编码 ===
export LANG=en_US.UTF-8 2>/dev/null || export LANG=C.UTF-8 2>/dev/null || true
export LC_ALL=en_US.UTF-8 2>/dev/null || export LC_ALL=C.UTF-8 2>/dev/null || true

echo ''
echo '=================================================================='
echo "Microi：Docker Compose 一键安装脚本 ${SCRIPT_VERSION}"
echo '=================================================================='
echo ''

# ============================================================
# 步骤1：环境检测与系统准备
# ============================================================
echo '[步骤1/11] 环境检测与系统准备'
echo '------------------------------------------------------------------'

# === 检测操作系统类型（全局变量，后续防火墙等操作依赖此变量） ===
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID}"
    OS_VERSION_ID="${VERSION_ID}"
  elif [ -f /etc/redhat-release ]; then
    OS_ID="centos"
    OS_VERSION_ID=$(grep -oE '[0-9]+' /etc/redhat-release | head -1)
  else
    OS_ID="unknown"
    OS_VERSION_ID="0"
  fi
  echo "Microi：检测到操作系统: ${OS_ID} ${OS_VERSION_ID}"
}
detect_os

# 当前发布的 PaddlePaddle CPU 固定镜像只交付 linux/amd64。显式失败，避免在
# ARM 主机拉到错误架构后才于安装中途报 exec format error。
case "$(uname -m)" in
  x86_64|amd64)
    echo 'Microi：OCR 镜像架构检查通过（linux/amd64）✓'
    ;;
  *)
    echo "Microi：错误：当前一键安装 OCR 镜像仅支持 linux/amd64，检测到 $(uname -m)。"
    echo 'Microi：请使用 x86_64 服务器，或按官方文档单独构建与当前架构匹配的 OCR 镜像。'
    exit 1
    ;;
esac

# 判断包管理器类型
is_debian_based() {
  [[ "${OS_ID}" == "ubuntu" || "${OS_ID}" == "debian" ]]
}

is_rhel_based() {
  [[ "${OS_ID}" == "centos" || "${OS_ID}" == "rhel" || "${OS_ID}" == "rocky" || "${OS_ID}" == "almalinux" || "${OS_ID}" == "fedora" || "${OS_ID}" == "openEuler" || "${OS_ID}" == "centos-stream" || "${OS_ID}" == "amzn" ]]
}

# 校验 IPv4 地址及 Docker bridge 网络 CIDR，避免错误配置进入自动安装阶段
is_valid_ipv4() {
  local ip="$1"
  local octet
  local -a octets
  [[ "${ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  IFS='.' read -r -a octets <<< "${ip}"
  [ "${#octets[@]}" -eq 4 ] || return 1
  for octet in "${octets[@]}"; do
    [[ "${octet}" =~ ^[0-9]{1,3}$ ]] || return 1
    [ $((10#${octet})) -le 255 ] || return 1
  done
}

ipv4_to_int() {
  local ip="$1"
  local a b c d
  IFS='.' read -r a b c d <<< "${ip}"
  echo $(( (10#${a} << 24) + (10#${b} << 16) + (10#${c} << 8) + 10#${d} ))
}

validate_network_config() {
  local subnet="$1"
  local gateway="$2"
  local subnet_ip prefix subnet_int gateway_int mask network_int broadcast_int

  [[ "${subnet}" =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/([0-9]+)$ ]] || return 1
  subnet_ip="${BASH_REMATCH[1]}"
  prefix="${BASH_REMATCH[2]}"
  is_valid_ipv4 "${subnet_ip}" || return 1
  is_valid_ipv4 "${gateway}" || return 1
  [ $((10#${prefix})) -ge 1 ] && [ $((10#${prefix})) -le 30 ] || return 1

  subnet_int=$(ipv4_to_int "${subnet_ip}")
  gateway_int=$(ipv4_to_int "${gateway}")
  mask=$(( (0xFFFFFFFF << (32 - 10#${prefix})) & 0xFFFFFFFF ))
  network_int=$((subnet_int & mask))
  broadcast_int=$((network_int | (0xFFFFFFFF ^ mask)))

  # subnet 必须填写规范网络地址，gateway 必须位于可用主机地址范围内
  [ "${subnet_int}" -eq "${network_int}" ] || return 1
  [ "${gateway_int}" -gt "${network_int}" ] && [ "${gateway_int}" -lt "${broadcast_int}" ] || return 1
}

# === 获取IP地址 ===
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [ -z "${LAN_IP}" ]; then
  echo 'Microi：错误：无法获取局域网IP地址，请检查网络配置。'
  exit 1
fi
echo "Microi：获取局域网IP: ${LAN_IP} ✓"

PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "")
if [ -n "${PUBLIC_IP}" ]; then
  echo "Microi：获取公网IP: ${PUBLIC_IP}"
else
  echo "Microi：无法获取公网IP，将仅支持内网模式"
fi

# === 选择访问方式 ===
echo ''
echo 'Microi：您是想在公网访问系统还是内网访问？公网请做好端口开放。'
echo 'Microi：输入 g 以公网IP安装，输入 n 以内网IP安装：'
read -r install_type

if [ "$install_type" == "g" ]; then
  if [ -z "${PUBLIC_IP}" ]; then
    echo 'Microi：错误：无法获取公网IP，请检查网络后重试，或使用内网模式。'
    exit 1
  fi
  ACCESS_IP=$PUBLIC_IP
  echo 'Microi：将以公网IP安装 ✓'
elif [ "$install_type" == "n" ]; then
  ACCESS_IP=$LAN_IP
  echo 'Microi：将以内网IP安装 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi

# === 指定主租户 OsClient ===
echo ''
echo 'Microi：请指定主租户 OsClient（示例：microi、loctek）。'
echo 'Microi：直接按 Enter 使用默认值 iTdos：'
read -r os_client_input
OS_CLIENT="${os_client_input:-iTdos}"

if [[ ! "${OS_CLIENT}" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$ ]]; then
  echo 'Microi：错误：OsClient 只能包含字母、数字、下划线和短横线，长度为 1-50，且必须以字母或数字开头。'
  exit 1
fi
echo "Microi：主租户 OsClient/ClientName 将设置为 ${OS_CLIENT} ✓"

# === 主数据库选择 ===
echo ''
echo 'Microi：请选择主数据库类型（强烈推荐 MySQL 5.7 / MySQL 8.0）：'
echo 'Microi：说明：MySQL 正式系列是 5.7 和 8.0，没有 5.8；复用已有服务时还会自动校验实际版本。'
echo '  1. MySQL 5.7（默认，强烈推荐）'
echo '  2. MySQL 8.0（强烈推荐）'
echo '  3. SQL Server 2022'
echo '  4. Oracle 19c'
echo '  5. 达梦 DM8'
echo '  6. PostgreSQL 17'
echo '  7. 人大金仓 KingbaseES V9'
echo 'Microi：请输入 1-7，直接按 Enter 默认选择 1（MySQL 5.7）：'
if [ -n "${MICROI_DATABASE_CHOICE:-}" ]; then
  database_choice_input="${MICROI_DATABASE_CHOICE}"
  echo "Microi：使用环境变量 MICROI_DATABASE_CHOICE=${database_choice_input}"
else
  read -r database_choice_input
fi

configure_database_profile "${database_choice_input:-1}"
echo "Microi：已选择 ${DATABASE_DISPLAY_NAME}，Dos.ORM 类型 ${DATABASE_TYPE} ✓"
echo "Microi：对应标准空数据库包：${SQL_ZIP_URL}"
configure_mysql_service_mode

# 所有未完成的数据库适配都在 Docker 安装/网络创建之前失败，绝不以跳过冒充成功。
if ! validate_database_install_preflight; then
  exit 1
fi

# === 数据库初始化包选择（最后一个人工确认项之一，之后保持全自动） ===
echo ''
echo 'Microi：请选择数据库初始化包来源：'
echo "  1. 使用吾码最新的 ${DATABASE_DISPLAY_NAME} 标准空业务数据库（默认，从 CDN 下载）"
echo '  2. 使用服务器上已上传的数据库 .zip（ZIP 内必须且只能有一个 .sql，文件名不限）'
echo 'Microi：请输入 1 或 2，直接按 Enter 默认选择 1：'
if [ -n "${MICROI_SQL_ZIP_PATH:-}" ] && [ -z "${MICROI_SQL_SOURCE:-}" ]; then
  MICROI_SQL_SOURCE='custom'
fi
case "${MICROI_SQL_SOURCE:-}" in
  official|1)
    sql_source_input=1
    echo 'Microi：使用环境变量 MICROI_SQL_SOURCE=official'
    ;;
  custom|2)
    sql_source_input=2
    echo 'Microi：使用环境变量 MICROI_SQL_SOURCE=custom'
    ;;
  '') read -r sql_source_input ;;
  *)
    echo 'Microi：错误：MICROI_SQL_SOURCE 只能是 official 或 custom。'
    exit 1
    ;;
esac

if [ "${sql_source_input:-1}" = '1' ]; then
  SQL_SOURCE_MODE='official'
  SQL_SOURCE_DISPLAY="${SQL_ZIP_URL}"
  echo 'Microi：将使用吾码最新标准空业务数据库 ✓'
elif [ "${sql_source_input}" = '2' ]; then
  SQL_SOURCE_MODE='custom'
  if [ -n "${MICROI_SQL_ZIP_PATH:-}" ]; then
    sql_zip_path_input="${MICROI_SQL_ZIP_PATH}"
    echo "Microi：使用环境变量 MICROI_SQL_ZIP_PATH=${sql_zip_path_input}"
  else
    echo 'Microi：请输入数据库压缩包绝对路径（例如 /home/xxx.zip）：'
    read -r sql_zip_path_input
  fi
  if [[ "${sql_zip_path_input}" != /* ]] || [[ "${sql_zip_path_input,,}" != *.zip ]]; then
    echo 'Microi：错误：数据库压缩包必须是以 .zip 结尾的 Linux 绝对路径。'
    exit 1
  fi
  if [ ! -f "${sql_zip_path_input}" ]; then
    echo "Microi：错误：找不到数据库压缩包：${sql_zip_path_input}"
    exit 1
  fi
  SQL_CUSTOM_ZIP_PATH=$(readlink -f "${sql_zip_path_input}")
  SQL_SOURCE_DISPLAY="${SQL_CUSTOM_ZIP_PATH}"
  echo "Microi：将使用自定义数据库压缩包：${SQL_CUSTOM_ZIP_PATH} ✓"
else
  echo 'Microi：错误：无效的数据库初始化包来源，脚本退出。'
  exit 1
fi

configure_minio_service_mode

# === Microi Docker 共享内网（可选固定网段）===
echo ''
echo 'Microi：脚本生成的所有编排都会接入共享的 microi Docker bridge 网络；新装依赖使用容器名，已有 MySQL/MinIO 使用所填地址。'
echo 'Microi：是否为该网络手工指定固定 subnet/gateway？'
echo 'Microi：输入 1 手工指定，输入 0 由 Docker 自动分配网段：'
echo 'Microi：默认是0（自动分配），一般情况请直接按Enter。'
read -r install_microi_network
install_microi_network="${install_microi_network:-0}"

if [ "${install_microi_network}" == "1" ]; then
  INSTALL_MICROI_NETWORK=1
  echo 'Microi：请输入网络 subnet（例如 172.16.238.0/24）：'
  read -r MICROI_NETWORK_SUBNET
  echo 'Microi：请输入网络 gateway（例如 172.16.238.1）：'
  read -r MICROI_NETWORK_GATEWAY

  if ! validate_network_config "${MICROI_NETWORK_SUBNET}" "${MICROI_NETWORK_GATEWAY}"; then
    echo 'Microi：错误：subnet 或 gateway 无效。subnet 必须是 /1-/30 的规范 IPv4 网络地址，gateway 必须位于该网段可用地址范围内。'
    exit 1
  fi

  echo ''
  echo 'Microi：请确认 Docker 网络配置：'
  echo '------------------------------------------------------------------'
  echo '  网络名称: microi'
  echo "  subnet:  ${MICROI_NETWORK_SUBNET}"
  echo "  gateway: ${MICROI_NETWORK_GATEWAY}"
  echo '------------------------------------------------------------------'
  echo 'Microi：输入 1 确认并继续，输入其他内容退出：'
  read -r confirm_microi_network
  if [ "${confirm_microi_network}" != "1" ]; then
    echo 'Microi：已取消安装。'
    exit 1
  fi
  echo 'Microi：将创建或复用上述 microi Docker 网络 ✓'
elif [ "${install_microi_network}" == "0" ]; then
  INSTALL_MICROI_NETWORK=0
  MICROI_NETWORK_SUBNET=""
  MICROI_NETWORK_GATEWAY=""
  echo 'Microi：将使用各 Docker Compose 项目的默认网络 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi

# === 在线 AI 向量依赖固定停用 ===
INSTALL_ONLINE_AI=0
echo ''
echo 'Microi：平台使用内置 Skills + 权限感知 Schema 搜索，本次不安装 Ollama、nomic-embed-text 与 Qdrant。'

# 原在线 AI 向量依赖安装交互完整保留，但固定注释，不再提示用户是否安装。
: <<'MICROI_DISABLED_VECTOR_INSTALL_PROMPT'
# === 在线 AI 引擎依赖安装选择 ===
echo ''
echo '=================================================================='
echo 'Microi：AI Schema 检索说明（请先阅读）'
echo '=================================================================='
echo 'Microi：平台已内置“大模型关键词扩展 + 权限感知 Schema 搜索 + 精确字段回读”。'
echo 'Microi：不安装 Ollama、nomic-embed-text、Qdrant，也可使用在线 AI 数据分析和 AI 编程。'
echo 'Microi：默认轻量模式启动更快、资源占用更低，且不需要连接或同步向量数据库。'
echo 'Microi：向量模式仅作为高度模糊语义召回的可选增强，不建议默认安装。'
echo 'Microi：是否安装 Ollama + nomic-embed-text + Qdrant 向量检索组件？'
echo 'Microi：输入 1 安装；直接按 Enter 或输入 0 跳过（推荐）：'
read -r install_online_ai
install_online_ai="${install_online_ai:-0}"

if [ "${install_online_ai}" == "1" ]; then
  INSTALL_ONLINE_AI=1
  echo 'Microi：将安装 Ollama、nomic-embed-text 与 Qdrant 向量检索组件 ✓'
elif [ "${install_online_ai}" == "0" ]; then
  INSTALL_ONLINE_AI=0
  echo 'Microi：将使用平台内置轻量 Schema 搜索，跳过向量检索组件 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi
MICROI_DISABLED_VECTOR_INSTALL_PROMPT

# === LibreTranslate 翻译服务安装选择 ===
echo ''
echo 'Microi：是否安装开源 LibreTranslate 翻译服务？'
echo 'Microi：默认是 1（安装），一般情况请直接按 Enter 使用吾码官方推荐配置；输入 0 跳过：'
read -r install_libretranslate
install_libretranslate="${install_libretranslate:-1}"

LIBRETRANSLATE_SUPPORTED_LANGS="zh zt en ja ko vi th id ms tl hi ur ar ru de fr es pt it nl tr pl uk"
LIBRETRANSLATE_LANGS=""
LIBRETRANSLATE_LANGS_CSV=""

append_libretranslate_language() {
  local language_key="$1"
  case " ${LIBRETRANSLATE_LANGS} " in
    *" ${language_key} "*) ;;
    *) LIBRETRANSLATE_LANGS="${LIBRETRANSLATE_LANGS} ${language_key}" ;;
  esac
}

if [ "${install_libretranslate}" == "1" ]; then
  INSTALL_LIBRETRANSLATE=1
  echo ''
  echo 'Microi：LibreTranslate 支持的语言（中文名 / key）：'
  echo '  简体中文 zh    繁体中文 zt    英语 en        日语 ja'
  echo '  韩语 ko        越南语 vi      泰语 th        印度尼西亚语 id'
  echo '  马来语 ms      菲律宾语 tl    印地语 hi      乌尔都语 ur'
  echo '  阿拉伯语 ar    俄语 ru        德语 de        法语 fr'
  echo '  西班牙语 es    葡萄牙语 pt    意大利语 it    荷兰语 nl'
  echo '  土耳其语 tr    波兰语 pl      乌克兰语 uk'
  echo ''
  echo 'Microi：请选择预装语言套餐：'
  echo '  1 = 基础套餐：简体中文、繁体中文、英语（推荐，下载最快）'
  echo '  2 = 亚洲常用：套餐1 + 日语、韩语、越南语、泰语、印度尼西亚语、马来语、菲律宾语'
  echo '  3 = 全部语言：以上列出的全部 23 种语言（下载时间最长）'
  echo 'Microi：直接按 Enter 默认选择 1：'
  read -r libretranslate_language_package
  libretranslate_language_package="${libretranslate_language_package:-1}"

  case "${libretranslate_language_package}" in
    1)
      LIBRETRANSLATE_LANGS="zh zt en"
      ;;
    2)
      LIBRETRANSLATE_LANGS="zh zt en ja ko vi th id ms tl"
      ;;
    3)
      LIBRETRANSLATE_LANGS="${LIBRETRANSLATE_SUPPORTED_LANGS}"
      ;;
    *)
      echo 'Microi：错误：语言套餐只能输入 1、2 或 3，脚本退出。'
      exit 1
      ;;
  esac

  echo 'Microi：如需在套餐上额外添加语言，请输入上方语言 key（逗号或空格分隔）；直接 Enter 不添加：'
  read -r libretranslate_extra_languages
  libretranslate_extra_languages="${libretranslate_extra_languages//，/ }"
  libretranslate_extra_languages="${libretranslate_extra_languages//；/ }"
  libretranslate_extra_languages=$(printf '%s' "${libretranslate_extra_languages}" | tr ',;' '  ')
  for language_key in ${libretranslate_extra_languages}; do
    language_key="${language_key,,}"
    case " ${LIBRETRANSLATE_SUPPORTED_LANGS} " in
      *" ${language_key} "*)
        append_libretranslate_language "${language_key}"
        ;;
      *)
        echo "Microi：警告：忽略不支持的语言 key：${language_key}"
        ;;
    esac
  done

  LIBRETRANSLATE_LANGS="${LIBRETRANSLATE_LANGS# }"
  LIBRETRANSLATE_LANGS_CSV=$(printf '%s' "${LIBRETRANSLATE_LANGS}" | tr ' ' ',')
  echo "Microi：将安装 LibreTranslate，加载语言：${LIBRETRANSLATE_LANGS_CSV} ✓"
elif [ "${install_libretranslate}" == "0" ]; then
  INSTALL_LIBRETRANSLATE=0
  echo 'Microi：将跳过 LibreTranslate 翻译服务安装 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi

# === 数据库类型与初始化包最终确认 ===
echo ''
if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
  echo "Microi：将使用已有 ${DATABASE_DISPLAY_NAME} ${MYSQL_EXTERNAL_HOST_DISPLAY}:${MYSQL_EXTERNAL_PORT}，不安装 MySQL 容器；数据库初始化包：${SQL_SOURCE_DISPLAY} ✓"
else
  echo "Microi：将安装 ${DATABASE_DISPLAY_NAME}，数据库初始化包：${SQL_SOURCE_DISPLAY} ✓"
fi
if [ "${MINIO_SERVICE_MODE}" = 'external' ]; then
  echo "Microi：将使用已有 MinIO ${MINIO_EXTERNAL_INTERNAL_URL}，不安装 MinIO 容器；公有文件地址：${MINIO_PUBLIC_BASE_URL}/${MINIO_PUBLIC_BUCKET} ✓"
else
  echo 'Microi：将安装新的 MinIO 容器，并初始化 mci-private / mci-public 桶 ✓'
fi

echo ''
echo '[步骤1/11] 环境检测完成 ✓'

# ============================================================
# 步骤2：Docker 环境安装与检查
# ============================================================
echo ''
echo '[步骤2/11] Docker 环境安装与检查'
echo '------------------------------------------------------------------'

# === 自动安装Docker（无需确认） ===
install_docker() {
  echo 'Microi：未检测到Docker，正在自动安装...'
  if is_debian_based; then
    export DEBIAN_FRONTEND=noninteractive
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    # 兼容Ubuntu和Debian的GPG密钥
    if [ "${OS_ID}" == "ubuntu" ]; then
      DISTRO_URL="ubuntu"
    else
      DISTRO_URL="debian"
    fi
    sudo rm -f /etc/apt/keyrings/docker.gpg
    curl -fsSL "https://mirrors.aliyun.com/docker-ce/linux/${DISTRO_URL}/gpg" | sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    # 获取正确的发行代号
    CODENAME=""
    if [ -n "${VERSION_CODENAME}" ]; then
      CODENAME="${VERSION_CODENAME}"
    elif [ -n "${UBUNTU_CODENAME}" ]; then
      CODENAME="${UBUNTU_CODENAME}"
    else
      CODENAME=$(lsb_release -cs 2>/dev/null || echo "")
    fi
    if [ -z "${CODENAME}" ]; then
      echo "Microi：无法获取发行代号，尝试使用stable分支..."
      CODENAME="jammy"
    fi
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/${DISTRO_URL} ${CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif is_rhel_based; then
    # CentOS 7 特殊处理（注意：CentOS 7 已于2024年6月EOL，基础源可能不可用）
    if [[ "${OS_ID}" == "centos" && "${OS_VERSION_ID}" == "7" ]]; then
      sudo yum install -y yum-utils
      sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
      sudo yum makecache fast
      sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    else
      # CentOS 8/9, Rocky, AlmaLinux, Fedora 等
      if command -v dnf > /dev/null 2>&1; then
        sudo dnf install -y dnf-plugins-core
        sudo dnf config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
        sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      else
        sudo yum install -y yum-utils
        sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
        sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      fi
    fi
  else
    echo "Microi：错误：不支持的操作系统 ${OS_ID}，请手动安装Docker后重试。"
    exit 1
  fi
  if command -v systemctl > /dev/null 2>&1; then
    sudo systemctl daemon-reload > /dev/null 2>&1 || true
    sudo systemctl enable docker > /dev/null 2>&1 || true
    sudo systemctl start docker || true
  elif command -v service > /dev/null 2>&1; then
    sudo service docker start || true
  fi
  echo 'Microi：Docker 安装命令已执行，正在验证服务状态...'
}

ensure_docker_daemon() {
  if ! command -v docker > /dev/null 2>&1; then
    echo 'Microi：错误：Docker 安装后仍未检测到 docker 命令，请检查上方安装日志后重试。'
    exit 1
  fi

  echo 'Microi：正在检查 Docker daemon...'
  if docker info > /dev/null 2>&1; then
    echo 'Microi：Docker daemon 已运行 ✓'
    return 0
  fi

  echo 'Microi：Docker 命令已安装，但 daemon 未运行，正在尝试启动...'
  if command -v systemctl > /dev/null 2>&1; then
    sudo systemctl daemon-reload > /dev/null 2>&1 || true
    sudo systemctl enable docker > /dev/null 2>&1 || true
    sudo systemctl start containerd > /dev/null 2>&1 || true
    sudo systemctl start docker > /dev/null 2>&1 || true
  elif command -v service > /dev/null 2>&1; then
    sudo service docker start > /dev/null 2>&1 || true
  elif command -v dockerd > /dev/null 2>&1; then
    echo 'Microi：未检测到 systemctl/service，尝试后台启动 dockerd...'
    sudo nohup dockerd > /tmp/microi-dockerd.log 2>&1 &
  fi

  for i in $(seq 1 30); do
    if docker info > /dev/null 2>&1; then
      echo 'Microi：Docker daemon 启动成功 ✓'
      return 0
    fi
    echo "Microi：等待 Docker daemon 启动中... (${i}/30)"
    sleep 1
  done

  echo 'Microi：错误：无法连接 Docker daemon。Docker 命令已安装，但服务未能启动。'
  echo 'Microi：请在服务器上执行以下命令查看原因：'
  echo '  systemctl status docker -l'
  echo '  journalctl -u docker -n 100 --no-pager'
  echo 'Microi：如果不是 systemd 环境，请查看 /tmp/microi-dockerd.log。'
  echo 'Microi：常见原因：Docker 服务未启动、containerd 异常、内核/iptables 配置异常、磁盘空间不足。'
  exit 1
}
if ! command -v docker > /dev/null 2>&1; then
  install_docker
else
  echo "Microi：Docker 已安装: $(docker --version) ✓"
fi
ensure_docker_daemon

# === 检查并安装 Docker Compose V2 ===
if docker compose version > /dev/null 2>&1; then
  echo "Microi：Docker Compose 版本: $(docker compose version --short 2>/dev/null || docker compose version) ✓"
else
  echo 'Microi：未检测到 Docker Compose V2 插件，正在自动安装...'
  if is_debian_based; then
    sudo apt-get install -y -qq docker-compose-plugin 2>/dev/null
  elif is_rhel_based; then
    if command -v dnf > /dev/null 2>&1; then
      sudo dnf install -y docker-compose-plugin 2>/dev/null
    else
      sudo yum install -y docker-compose-plugin 2>/dev/null
    fi
  fi
  if ! docker compose version > /dev/null 2>&1; then
    # 手动安装 compose 插件
    echo 'Microi：包管理器安装失败，尝试手动安装 Docker Compose 插件...'
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/' || echo "2.27.0")
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose 2>/dev/null
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    if ! docker compose version > /dev/null 2>&1; then
      echo 'Microi：错误：Docker Compose V2 安装失败，请手动安装后重试。'
      exit 1
    fi
  fi
  echo "Microi：Docker Compose 安装成功: $(docker compose version --short 2>/dev/null || docker compose version) ✓"
fi

# === 创建或校验 Microi 共享内网；固定网段仅为可选项 ===
ensure_microi_network() {
  local existing_driver existing_subnet existing_gateway

  if docker network inspect microi > /dev/null 2>&1; then
    existing_driver=$(docker network inspect microi --format '{{.Driver}}')
    existing_subnet=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}' | head -1)
    existing_gateway=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' | head -1)

    if [ "${existing_driver}" != "bridge" ]; then
      echo "Microi：错误：已存在名为 microi 的 Docker 网络，但驱动为 ${existing_driver}，不是 bridge。"
      echo 'Microi：为避免影响现有容器，脚本不会自动删除或修改该网络。'
      exit 1
    fi
    if [ "${INSTALL_MICROI_NETWORK}" = "1" ] \
      && { [ "${existing_subnet}" != "${MICROI_NETWORK_SUBNET}" ] || [ "${existing_gateway}" != "${MICROI_NETWORK_GATEWAY}" ]; }; then
      echo 'Microi：错误：已存在名为 microi 的 Docker 网络，但配置与本次输入不一致。'
      echo "Microi：现有配置: driver=${existing_driver}, subnet=${existing_subnet}, gateway=${existing_gateway}"
      echo "Microi：本次配置: driver=bridge, subnet=${MICROI_NETWORK_SUBNET}, gateway=${MICROI_NETWORK_GATEWAY}"
      echo 'Microi：为避免影响现有容器，脚本不会自动删除或修改该网络。请确认网络配置后重试。'
      exit 1
    fi
    echo "Microi：已复用现有 microi 网络（${existing_subnet}, gateway ${existing_gateway}）✓"
  else
    echo 'Microi：正在创建 microi Docker 网络...'
    if [ "${INSTALL_MICROI_NETWORK}" = "1" ]; then
      if ! docker network create \
        --driver bridge \
        --subnet "${MICROI_NETWORK_SUBNET}" \
        --gateway "${MICROI_NETWORK_GATEWAY}" \
        microi > /dev/null; then
        echo 'Microi：错误：microi Docker 网络创建失败。请检查指定网段是否与现有网络重叠。'
        exit 1
      fi
      echo "Microi：microi 网络创建成功（${MICROI_NETWORK_SUBNET}, gateway ${MICROI_NETWORK_GATEWAY}）✓"
    else
      if ! docker network create --driver bridge microi > /dev/null; then
        echo 'Microi：错误：microi Docker 网络创建失败。'
        exit 1
      fi
      existing_subnet=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}' | head -1)
      existing_gateway=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' | head -1)
      echo "Microi：microi 网络创建成功，Docker 自动分配 ${existing_subnet}（gateway ${existing_gateway}）✓"
    fi
  fi

  # 每个独立编排都连接到同一个预先创建的外部网络
  COMPOSE_SERVICE_NETWORK=$'    networks:\n      - microi'
  COMPOSE_EXTERNAL_NETWORKS=$'networks:\n  microi:\n    external: true\n    name: microi'
}

# OCR、LibreTranslate 与 API 始终通过独立的内部 bridge 网络通信。服务的
# 宿主机诊断端口仅绑定 127.0.0.1；API 不依赖宿主机 LAN 地址访问这些服务。
ensure_ocr_runtime_network() {
  local existing_driver
  if docker network inspect "${OCR_RUNTIME_NETWORK}" > /dev/null 2>&1; then
    existing_driver=$(docker network inspect "${OCR_RUNTIME_NETWORK}" --format '{{.Driver}}')
    if [ "${existing_driver}" != "bridge" ]; then
      echo "Microi：错误：已存在 ${OCR_RUNTIME_NETWORK} 网络，但驱动为 ${existing_driver}，不是 bridge。"
      echo 'Microi：为避免影响现有容器，脚本不会自动删除或修改该网络。'
      exit 1
    fi
    echo "Microi：已复用 OCR 内部网络 ${OCR_RUNTIME_NETWORK} ✓"
  else
    echo "Microi：正在创建 OCR 内部网络 ${OCR_RUNTIME_NETWORK}..."
    if ! docker network create --driver bridge "${OCR_RUNTIME_NETWORK}" > /dev/null; then
      echo "Microi：错误：OCR 内部网络 ${OCR_RUNTIME_NETWORK} 创建失败。"
      exit 1
    fi
    echo "Microi：OCR 内部网络 ${OCR_RUNTIME_NETWORK} 创建成功 ✓"
  fi

  OCR_COMPOSE_SERVICE_NETWORK=$'    networks:\n      - microi-ocr'
  OCR_COMPOSE_EXTERNAL_NETWORKS=$'networks:\n  microi-ocr:\n    external: true\n    name: microi-ocr'
  APP_API_SERVICE_NETWORK=$'    networks:\n      - microi\n      - microi-ocr'
  APP_COMPOSE_EXTERNAL_NETWORKS=$'networks:\n  microi:\n    external: true\n    name: microi\n  microi-ocr:\n    external: true\n    name: microi-ocr'
}

# === 检查已有容器/编排 ===
EXISTING_MICROI_CONTAINERS=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep '^microi-install-' || true)
if [ -n "${EXISTING_MICROI_CONTAINERS}" ]; then
  echo ''
  echo 'Microi：错误：检测到已有 microi-install 相关容器。为避免重复导入数据库，脚本已安全停止。'
  echo 'Microi：已检测到以下容器：'
  echo "${EXISTING_MICROI_CONTAINERS}"
  echo 'Microi：如果这是刚刚中断、尚未投入使用的新安装，请先备份 /microi/compose 下现有编排文件并记录其中的数据目录。'
  echo 'Microi：然后只在对应 microi-install-* 编排目录执行 docker compose down（禁止使用 -v），再重新下载最新版脚本安装。'
  echo 'Microi：不要删除数据库、MinIO、MongoDB、Redis 数据目录；新安装验收通过前保留原目录作为恢复点。'
  exit 1
fi

ensure_microi_network
ensure_ocr_runtime_network

# === 安装依赖工具（unzip/curl/openssl） ===
install_deps() {
  local need_install=false
  for cmd in unzip curl openssl; do
    if ! command -v ${cmd} > /dev/null 2>&1; then
      need_install=true
      break
    fi
  done

  if [ "${need_install}" = true ]; then
    echo 'Microi：正在安装依赖工具（unzip/curl/openssl）...'
    if is_debian_based; then
      sudo apt-get install -y -qq unzip curl openssl
    elif is_rhel_based; then
      if command -v dnf > /dev/null 2>&1; then
        sudo dnf install -y unzip curl openssl
      else
        sudo yum install -y unzip curl openssl
      fi
    fi
    echo 'Microi：依赖工具安装完成 ✓'
  else
    echo 'Microi：依赖工具已存在（unzip/curl/openssl）✓'
  fi
}
install_deps

# 在开始拉取镜像和创建数据库前完成自定义包的完整安全校验。
SQL_REQUIRED_FREE_MB=2048
DATABASE_NAME="${OS_CLIENT}"
DATABASE_NAME_SOURCE='OsClient 回退'
if [ "${DATABASE_TYPE}" = 'DaMeng' ]; then
  DATABASE_NAME='SYSDBA'
  DATABASE_NAME_SOURCE='达梦固定 Schema'
fi
if [ "${SQL_SOURCE_MODE}" = 'custom' ]; then
  validate_sql_zip_archive "${SQL_CUSTOM_ZIP_PATH}"
  detect_sql_database_name_from_archive \
    "${SQL_CUSTOM_ZIP_PATH}" "${SQL_ARCHIVE_ENTRY}" "${DATABASE_TYPE}"
  if [ -n "${SQL_DETECTED_DATABASE_NAME}" ]; then
    DATABASE_NAME="${SQL_DETECTED_DATABASE_NAME}"
    DATABASE_NAME_SOURCE='SQL 显式建库/切库信息'
  fi
  SQL_REQUIRED_FREE_MB=$(((SQL_UNCOMPRESSED_BYTES * 3 + 1048575) / 1048576 + 1024))
  [ "${SQL_REQUIRED_FREE_MB}" -lt 2048 ] && SQL_REQUIRED_FREE_MB=2048
  echo "Microi：数据库包校验通过：${SQL_ARCHIVE_ENTRY}，解压后约 $(((SQL_UNCOMPRESSED_BYTES + 1048575) / 1048576))MB ✓"
fi
if ! microi_database_name_is_safe "${DATABASE_NAME}"; then
  echo "Microi：错误：最终数据库名不安全：${DATABASE_NAME}"
  exit 1
fi
echo "Microi：本次还原目标数据库：${DATABASE_NAME}（来源：${DATABASE_NAME_SOURCE}）✓"

echo ''
echo '[步骤2/11] Docker 环境就绪 ✓'

# === 磁盘空间预检 ===
echo ''
echo 'Microi：检查磁盘可用空间...'
ROOT_AVAIL_KB=$(df -P /home 2>/dev/null | tail -1 | awk '{print $4}' || echo "0")
if [ -z "${ROOT_AVAIL_KB}" ]; then
  ROOT_AVAIL_KB=0
fi
ROOT_AVAIL_MB=$((ROOT_AVAIL_KB / 1024))
echo "Microi：/home 分区可用空间: ${ROOT_AVAIL_MB}MB"
if [ ${ROOT_AVAIL_MB} -lt 2048 ]; then
  echo "Microi：错误：磁盘可用空间不足（当前 ${ROOT_AVAIL_MB}MB，至少需要 2048MB）。"
  exit 1
elif [ ${ROOT_AVAIL_MB} -lt ${SQL_REQUIRED_FREE_MB} ]; then
  echo "Microi：错误：自定义数据库包较大，当前可用 ${ROOT_AVAIL_MB}MB，至少需要 ${SQL_REQUIRED_FREE_MB}MB。"
  echo 'Microi：所需空间按 SQL 解压大小、导入膨胀和 1GB 安全余量计算。'
  exit 1
fi

# ============================================================
# 步骤3：端口分配与占用检测
# ============================================================
echo ''
echo '[步骤3/11] 端口分配与占用检测'
echo '------------------------------------------------------------------'

# 工具函数
generate_random_password() {
  local random_hex
  random_hex=$(openssl rand -hex 16)
  # 固定包含大写、小写、数字三类字符，兼容 SQL Server 密码复杂度要求。
  printf 'Aa1%s' "${random_hex:0:13}"
}

generate_random_auth_secret() {
  # sys_osclients.AuthSecret 的历史列通常为 varchar(50)，48 个十六进制字符
  # 同时满足 JWT 至少 32 字符与旧库列宽限制；不会写入 API 环境变量。
  openssl rand -hex 24
}

generate_uuid() {
  local random_hex
  random_hex=$(openssl rand -hex 16)
  printf '%s-%s-%s-%s-%s' \
    "${random_hex:0:8}" "${random_hex:8:4}" "${random_hex:12:4}" \
    "${random_hex:16:4}" "${random_hex:20:12}"
}

generate_random_data_dir() {
  local container_name="$1"
  local dir="/home/data-${container_name}-$(openssl rand -hex 4)"
  mkdir -p "${dir}"
  echo "${dir}"
}

# === 端口检测 ===
PORT_LABELS=("Web(microi-install-client)" "API(microi-install-api)")
if [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
  PORT_LABELS+=("${DATABASE_PORT_NAME}")
fi
PORT_LABELS+=("Redis" "MongoDB")
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  PORT_LABELS+=("MinIO-API" "MinIO-Console")
fi
PORT_LABELS+=("OCR")
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  PORT_LABELS+=("LibreTranslate")
fi
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  PORT_LABELS+=("Ollama" "Qdrant-HTTP" "Qdrant-gRPC")
fi
PORT_COUNT=${#PORT_LABELS[@]}

check_port_in_use() {
  local port="$1"
  # 使用 ss 检测 TCP 端口是否被监听
  if command -v ss > /dev/null 2>&1; then
    if ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
      return 0
    fi
    return 1
  fi
  # 降级到 netstat
  if command -v netstat > /dev/null 2>&1; then
    if netstat -tln 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
      return 0
    fi
    return 1
  fi
  # 都不可用时假设端口空闲
  return 1
}

PORT_START=61600
PORT_MAX_INCREMENT_ATTEMPTS=100

echo "Microi：开始按规则分配端口（共 ${PORT_COUNT} 个连续端口）"
echo "Microi：候选起点从 ${PORT_START} 开始；冲突时每次 +1，最多递增 ${PORT_MAX_INCREMENT_ATTEMPTS} 次。"
echo 'Microi：端口顺序固定为 Web、API、其余已选组件。'
echo ''

PORT_BASE=${PORT_START}
PORT_INCREMENT_ATTEMPTS=0
PORT_ALLOCATED=false

while [ ${PORT_INCREMENT_ATTEMPTS} -le ${PORT_MAX_INCREMENT_ATTEMPTS} ]; do
  PORT_END=$((PORT_BASE + PORT_COUNT - 1))
  if [ ${PORT_END} -gt 65535 ]; then
    echo "Microi：错误：候选端口段 ${PORT_BASE}-${PORT_END} 超出有效端口上限 65535。"
    break
  fi

  echo "Microi：检测端口段 ${PORT_BASE}-${PORT_END}..."
  ALL_FREE=true
  CONFLICT_PORTS=""
  for i in $(seq 0 $((PORT_COUNT - 1))); do
    port=$((PORT_BASE + i))
    if check_port_in_use ${port}; then
      echo "Microi：  ✗ 端口 ${port} (${PORT_LABELS[$i]}) 已被占用"
      ALL_FREE=false
      CONFLICT_PORTS="${CONFLICT_PORTS} ${port}"
    fi
  done

  if [ "${ALL_FREE}" = true ]; then
    PORT_ALLOCATED=true
    echo "Microi：端口段 ${PORT_BASE}-${PORT_END} 全部可用 ✓"
    break
  fi

  if [ ${PORT_INCREMENT_ATTEMPTS} -ge ${PORT_MAX_INCREMENT_ATTEMPTS} ]; then
    break
  fi

  PORT_INCREMENT_ATTEMPTS=$((PORT_INCREMENT_ATTEMPTS + 1))
  NEXT_PORT_BASE=$((PORT_BASE + 1))
  echo "Microi：端口段存在被占用端口:${CONFLICT_PORTS}，候选起点 +1，尝试 ${NEXT_PORT_BASE}-$((NEXT_PORT_BASE + PORT_COUNT - 1))..."
  PORT_BASE=${NEXT_PORT_BASE}
  echo ''
done

if [ "${PORT_ALLOCATED}" = false ]; then
  echo "Microi：错误：从 ${PORT_START} 开始、候选起点最多递增 ${PORT_MAX_INCREMENT_ATTEMPTS} 次后，仍无法找到连续 ${PORT_COUNT} 个可用端口。"
  echo 'Microi：端口搜索已按上限停止，脚本退出，不会无限循环。'
  exit 1
fi

# 只为本脚本实际创建的服务分配宿主机端口；已有服务使用用户填写的原端口。
NEXT_PORT_OFFSET=0
VUE_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
API_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
if [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
  MYSQL_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
  DATABASE_PORT=${MYSQL_PORT}
  NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
else
  MYSQL_PORT=""
  DATABASE_PORT="${MYSQL_EXTERNAL_PORT}"
fi
REDIS_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
MONGO_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  MINIO_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
  NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
  MINIO_CONSOLE_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
  NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
else
  MINIO_PORT="${MINIO_EXTERNAL_PORT}"
  MINIO_CONSOLE_PORT=""
fi
OCR_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  LIBRETRANSLATE_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
  NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 1))
else
  LIBRETRANSLATE_PORT=""
fi
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  OLLAMA_PORT=$((PORT_BASE + NEXT_PORT_OFFSET))
  QDRANT_HTTP_PORT=$((PORT_BASE + NEXT_PORT_OFFSET + 1))
  QDRANT_GRPC_PORT=$((PORT_BASE + NEXT_PORT_OFFSET + 2))
  NEXT_PORT_OFFSET=$((NEXT_PORT_OFFSET + 3))
else
  OLLAMA_PORT=""
  QDRANT_HTTP_PORT=""
  QDRANT_GRPC_PORT=""
fi

echo ''
echo 'Microi：端口分配方案：'
echo '------------------------------------------------------------------'
printf '  %-18s %s\n' "Web:"           "${VUE_PORT}"
printf '  %-18s %s\n' "API:"           "${API_PORT}"
if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
  printf '  %-18s %s\n' "MySQL(已有服务):" "${MYSQL_EXTERNAL_HOST_DISPLAY}:${DATABASE_PORT}（不占用本机分配端口）"
else
  printf '  %-18s %s\n' "${DATABASE_PORT_NAME}:" "${DATABASE_PORT}"
fi
printf '  %-18s %s\n' "Redis:"         "${REDIS_PORT}"
printf '  %-18s %s\n' "MongoDB:"       "${MONGO_PORT}"
if [ "${MINIO_SERVICE_MODE}" = 'external' ]; then
  printf '  %-18s %s\n' "MinIO(已有服务):" "${MINIO_EXTERNAL_INTERNAL_URL}（不占用本机分配端口）"
  printf '  %-18s %s\n' "MinIO公有地址:" "${MINIO_PUBLIC_BASE_URL}/${MINIO_PUBLIC_BUCKET}"
else
  printf '  %-18s %s\n' "MinIO API:"     "${MINIO_PORT}"
  printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
fi
printf '  %-18s %s\n' "OCR:"           "${OCR_PORT}（仅绑定 127.0.0.1）"
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  printf '  %-18s %s\n' "LibreTranslate:" "127.0.0.1:${LIBRETRANSLATE_PORT}（API 走 Docker 内网）"
fi
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  printf '  %-18s %s\n' "Ollama:"        "${OLLAMA_PORT}"
  printf '  %-18s %s\n' "Qdrant HTTP:"   "${QDRANT_HTTP_PORT}"
  printf '  %-18s %s\n' "Qdrant gRPC:"   "${QDRANT_GRPC_PORT}"
fi
echo '------------------------------------------------------------------'

ALL_PORTS="${VUE_PORT} ${API_PORT}"
FIREWALL_PORTS="${VUE_PORT} ${API_PORT}"
if [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
  ALL_PORTS="${ALL_PORTS} ${DATABASE_PORT}"
  FIREWALL_PORTS="${FIREWALL_PORTS} ${DATABASE_PORT}"
fi
ALL_PORTS="${ALL_PORTS} ${REDIS_PORT} ${MONGO_PORT}"
FIREWALL_PORTS="${FIREWALL_PORTS} ${REDIS_PORT} ${MONGO_PORT}"
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  ALL_PORTS="${ALL_PORTS} ${MINIO_PORT} ${MINIO_CONSOLE_PORT}"
  FIREWALL_PORTS="${FIREWALL_PORTS} ${MINIO_PORT} ${MINIO_CONSOLE_PORT}"
fi
ALL_PORTS="${ALL_PORTS} ${OCR_PORT}"
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  ALL_PORTS="${ALL_PORTS} ${LIBRETRANSLATE_PORT}"
fi
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  ALL_PORTS="${ALL_PORTS} ${OLLAMA_PORT} ${QDRANT_HTTP_PORT} ${QDRANT_GRPC_PORT}"
  FIREWALL_PORTS="${FIREWALL_PORTS} ${OLLAMA_PORT} ${QDRANT_HTTP_PORT} ${QDRANT_GRPC_PORT}"
fi
echo ''
echo '[步骤3/11] 端口分配完成 ✓'

# ============================================================
# 步骤4：生成密码与数据目录
# ============================================================
echo ''
echo '[步骤4/11] 生成密码与数据目录'
echo '------------------------------------------------------------------'

if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
  DATABASE_PASSWORD="${MYSQL_EXTERNAL_PASSWORD}"
  MYSQL_EXTERNAL_PASSWORD=""
  MYSQL_ROOT_PASSWORD=""
else
  DATABASE_PASSWORD=$(generate_random_password)
  # 保留旧变量名，避免 MySQL 5.7/8.0 既有安装路径发生兼容性回退。
  MYSQL_ROOT_PASSWORD="${DATABASE_PASSWORD}"
fi
REDIS_PASSWORD=$(generate_random_password)
MONGO_ROOT_PASSWORD=$(generate_random_password)
if [ "${MINIO_SERVICE_MODE}" = 'external' ]; then
  MINIO_ACCESS_KEY="${MINIO_EXTERNAL_ACCESS_KEY}"
  MINIO_SECRET_KEY="${MINIO_EXTERNAL_SECRET_KEY}"
  MINIO_EXTERNAL_ACCESS_KEY=""
  MINIO_EXTERNAL_SECRET_KEY=""
else
  MINIO_ACCESS_KEY=$(generate_random_password)
  MINIO_SECRET_KEY=$(generate_random_password)
fi
AUTH_SECRET=$(generate_random_auth_secret)
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  QDRANT_API_KEY=$(generate_random_password)
else
  QDRANT_API_KEY=""
fi
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  LIBRETRANSLATE_API_KEY=$(generate_random_password)
else
  LIBRETRANSLATE_API_KEY=""
fi

# 验证密码是否生成成功（bash <4.4 下 set -e 不会传播到 $() 中）
_REQUIRED_PW_VARS="DATABASE_PASSWORD REDIS_PASSWORD MONGO_ROOT_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY AUTH_SECRET"
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  _REQUIRED_PW_VARS="${_REQUIRED_PW_VARS} QDRANT_API_KEY"
fi
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  _REQUIRED_PW_VARS="${_REQUIRED_PW_VARS} LIBRETRANSLATE_API_KEY"
fi
for _pw_var in ${_REQUIRED_PW_VARS}; do
  eval _pw_val="\${${_pw_var}}"
  if [ -z "${_pw_val}" ]; then
    echo "Microi：错误：凭据准备失败（${_pw_var}为空），请检查输入或 openssl。"
    exit 1
  fi
done
echo 'Microi：已有服务凭据已安全读取，其余服务密码/密钥已随机生成 ✓'

if [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
  DATABASE_DATA_DIR=$(generate_random_data_dir "database-${DATABASE_ENGINE_KEY}")
  MYSQL_DATA_DIR="${DATABASE_DATA_DIR}"
else
  DATABASE_DATA_DIR=""
  MYSQL_DATA_DIR=""
fi
REDIS_DATA_DIR=$(generate_random_data_dir "redis")
MONGO_DATA_DIR=$(generate_random_data_dir "mongodb")
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  MINIO_DATA_DIR=$(generate_random_data_dir "minio")
else
  MINIO_DATA_DIR=""
fi
echo 'Microi：本次新装服务的数据目录已创建；已有 MySQL/MinIO 未创建数据目录 ✓'

echo ''
echo '[步骤4/11] 密码与数据目录就绪 ✓'

# 从这里开始，任何失败都必须在保持非零退出码的前提下输出已生成的端口、
# 凭据和数据目录，避免后段迁移/健康门禁失败后用户丢失恢复信息。
INSTALL_RECOVERY_SUMMARY_ENABLED=1


# ============================================================
# 防火墙端口开放函数
# ============================================================
# 注意：所有防火墙命令加 || true 防止 set -e 导致脚本退出（规则已存在时命令返回非0）
firewall_open_port() {
  local port="$1"
  # firewalld（CentOS 7/8/9, RHEL, Rocky 等）
  if command -v firewall-cmd > /dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
    sudo firewall-cmd --permanent --add-port=${port}/tcp > /dev/null 2>&1 || true
    return 0
  fi
  # ufw（Ubuntu, Debian）
  if command -v ufw > /dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "active"; then
    sudo ufw allow ${port}/tcp > /dev/null 2>&1 || true
    return 0
  fi
  # iptables 兜底（所有Linux）
  if command -v iptables > /dev/null 2>&1; then
    sudo iptables -C INPUT -p tcp --dport ${port} -j ACCEPT > /dev/null 2>&1 || \
    sudo iptables -I INPUT -p tcp --dport ${port} -j ACCEPT > /dev/null 2>&1 || true
    return 0
  fi
  return 0
}

firewall_reload() {
  if command -v firewall-cmd > /dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
    sudo firewall-cmd --reload > /dev/null 2>&1 || true
    echo "Microi：firewalld 防火墙规则已重新加载 ✓"
  fi
  if command -v ufw > /dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "active"; then
    echo "Microi：ufw 防火墙规则已生效 ✓"
  fi
  # 持久化iptables规则
  if command -v iptables-save > /dev/null 2>&1; then
    if is_debian_based; then
      if command -v netfilter-persistent > /dev/null 2>&1; then
        sudo netfilter-persistent save > /dev/null 2>&1 || true
      fi
    elif is_rhel_based; then
      if command -v service > /dev/null 2>&1; then
        sudo service iptables save > /dev/null 2>&1 || true
      fi
    fi
  fi
}

# 启动编排项目
compose_up() {
  local project_dir="$1"
  local project_name
  project_name=$(basename "${project_dir}")
  echo ""
  echo "Microi：正在部署编排 [${project_name}]..."
  # 使用 if 包裹避免 set -e 在子shell失败时直接退出脚本
  if (cd "${project_dir}" && docker compose up -d); then
    echo "Microi：编排 [${project_name}] 部署成功 ✓"
  else
    echo "Microi：错误：编排 [${project_name}] 部署失败 ✗"
    echo "Microi：请检查以上错误日志。常见原因：镜像拉取失败、端口冲突、磁盘空间不足。"
    # 自动输出容器日志帮助排查
    echo '------------------------------------------------------------------'
    echo 'Microi：尝试输出相关容器日志：'
    for cname in $(cd "${project_dir}" && docker compose ps -a --format '{{.Name}}' 2>/dev/null); do
      echo "--- 容器 ${cname} 日志 ---"
      docker logs "${cname}" 2>&1 | tail -30
    done
    echo '------------------------------------------------------------------'
    exit 1
  fi
}

# ============================================================
# 步骤5：开放防火墙端口（安装前先开放）
# ============================================================
echo ''
echo '[步骤5/11] 开放防火墙端口'
echo '------------------------------------------------------------------'

echo 'Microi：在部署服务前，先开放需要对外访问的端口...'
for port in ${FIREWALL_PORTS}; do
  firewall_open_port "${port}"
  echo "Microi：  端口 ${port}/tcp 已开放 ✓"
done
echo "Microi：  OCR ${OCR_PORT}/tcp 仅绑定 127.0.0.1，未自动开放到宿主机防火墙 ✓"
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  echo "Microi：  LibreTranslate ${LIBRETRANSLATE_PORT}/tcp 仅供平台内部调用，未自动开放到宿主机防火墙 ✓"
fi
firewall_reload
echo ''
echo 'Microi：提示：以上为服务器内部防火墙规则，若使用云服务器（阿里云/腾讯云等），'
echo '        还需在云控制台的安全组中开放相同端口。'

echo ''
echo '[步骤5/11] 防火墙配置完成 ✓'

# ============================================================
# 检测宝塔面板编排目录
# ============================================================
BT_COMPOSE_DIR="/www/dk_project/dk_compose"
DEFAULT_COMPOSE_DIR="/microi/compose"

if [ -d "${BT_COMPOSE_DIR}" ]; then
  COMPOSE_BASE_DIR="${BT_COMPOSE_DIR}"
  echo "Microi：检测到宝塔面板Docker编排目录: ${COMPOSE_BASE_DIR}"
else
  COMPOSE_BASE_DIR="${DEFAULT_COMPOSE_DIR}"
  echo "Microi：使用默认编排目录: ${COMPOSE_BASE_DIR}"
fi
mkdir -p "${COMPOSE_BASE_DIR}"

echo ''
echo '=================================================================='
echo 'Microi：开始部署所有编排项目...'
echo '=================================================================='


# ============================================================
# 步骤6：部署或连接用户选择的主数据库
# ============================================================
echo ''
echo "[步骤6/11] 部署或连接 ${DATABASE_DISPLAY_NAME}"
echo '------------------------------------------------------------------'

prepare_external_mysql_client_config() {
  local escaped_host=""
  local escaped_user=""
  local escaped_password=""
  MYSQL_CLIENT_CONFIG_FILE=$(mktemp '/tmp/microi_mysql_client_XXXXXX.cnf')
  escaped_host="${MYSQL_EXTERNAL_CONNECTION_HOST//\\/\\\\}"
  escaped_host="${escaped_host//\"/\\\"}"
  escaped_user="${DATABASE_USER//\\/\\\\}"
  escaped_user="${escaped_user//\"/\\\"}"
  escaped_password="${DATABASE_PASSWORD//\\/\\\\}"
  escaped_password="${escaped_password//\"/\\\"}"
  cat > "${MYSQL_CLIENT_CONFIG_FILE}" <<EOF
[client]
host="${escaped_host}"
port=${DATABASE_PORT}
user="${escaped_user}"
password="${escaped_password}"
protocol=TCP
ssl-mode=PREFERRED
EOF
  chmod 600 "${MYSQL_CLIENT_CONFIG_FILE}"
}

run_mysql_client() {
  local use_database="${1:-0}"
  shift
  local -a database_args=()
  local -a docker_args=()
  if [ "${use_database}" = '1' ]; then
    database_args+=("${DATABASE_NAME}")
  fi
  if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
    docker_args=(run --rm -i --network microi --user '0:0')
    if [ "${MYSQL_EXTERNAL_USE_HOST_GATEWAY}" = '1' ]; then
      docker_args+=(--add-host 'host.docker.internal:host-gateway')
    fi
    docker_args+=(
      -v "${MYSQL_CLIENT_CONFIG_FILE}:/tmp/microi-client.cnf:ro,Z"
      --entrypoint mysql
      "${MYSQL_CLIENT_IMAGE}"
    )
    docker "${docker_args[@]}" \
      --defaults-extra-file=/tmp/microi-client.cnf \
      --default-character-set=utf8mb4 \
      "${database_args[@]}" "$@"
  else
    docker exec -e MYSQL_PWD="${DATABASE_PASSWORD}" -i "${DATABASE_CONTAINER_NAME}" \
      mysql --default-character-set=utf8mb4 -u"${DATABASE_USER}" \
      "${database_args[@]}" "$@"
  fi
}

MYSQL_EXTERNAL_TARGET_DATABASE_EXISTS=0
MYSQL_DETECTED_SERVER_VERSION=""
if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
  DATABASE_DIR=""
  echo "Microi：已有 MySQL 模式不会创建数据库容器、数据目录、编排或宿主机端口。"
  echo "Microi：拉取/复用临时 MySQL 客户端镜像，仅用于连通性、版本校验和数据库导入；客户端容器每次执行后自动删除。"
  if ! docker image inspect "${MYSQL_CLIENT_IMAGE}" > /dev/null 2>&1; then
    docker pull "${MYSQL_CLIENT_IMAGE}"
  fi
  prepare_external_mysql_client_config
  if ! MYSQL_VERSION_READBACK=$(run_mysql_client 0 --batch --skip-column-names -e 'SELECT VERSION();' 2>&1); then
    echo "Microi：错误：无法从 microi Docker 网络连接已有 MySQL ${MYSQL_EXTERNAL_HOST_DISPLAY}:${DATABASE_PORT}。"
    echo 'Microi：请检查地址、端口、帐号、密码、防火墙、授权来源和 bind-address；本机服务不能只监听 127.0.0.1。'
    printf '%s\n' "${MYSQL_VERSION_READBACK}" | tail -10
    exit 1
  fi
  MYSQL_DETECTED_SERVER_VERSION=$(printf '%s\n' "${MYSQL_VERSION_READBACK}" | tr -d '\r' | awk 'NF {value=$0} END {print value}')
  if [[ "${MYSQL_DETECTED_SERVER_VERSION}" == *MariaDB* ]]; then
    echo "Microi：错误：检测到 ${MYSQL_DETECTED_SERVER_VERSION}，当前一键安装只验收 MySQL 5.7.x / 8.0.x，不把 MariaDB 冒充 MySQL。"
    exit 1
  fi
  if [ "${MYSQL_VERSION}" = '5.7' ] && [[ ! "${MYSQL_DETECTED_SERVER_VERSION}" =~ ^5\.7\. ]]; then
    echo "Microi：错误：已选择 MySQL 5.7，但已有服务实际版本为 ${MYSQL_DETECTED_SERVER_VERSION}。请重新运行并选择匹配版本。"
    exit 1
  fi
  if [ "${MYSQL_VERSION}" = '8.0' ] && [[ ! "${MYSQL_DETECTED_SERVER_VERSION}" =~ ^8\.0\. ]]; then
    echo "Microi：错误：已选择 MySQL 8.0，但已有服务实际版本为 ${MYSQL_DETECTED_SERVER_VERSION}。当前未把其它 8.x 系列视为已验收。"
    exit 1
  fi
  echo "Microi：已有 MySQL 连接及版本校验通过：${MYSQL_DETECTED_SERVER_VERSION} ✓"

  if ! MYSQL_SCHEMA_EXISTS=$(run_mysql_client 0 --batch --skip-column-names -e \
    "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${DATABASE_NAME}';" 2>&1); then
    echo 'Microi：错误：无法检查已有 MySQL 上的目标数据库状态。'
    printf '%s\n' "${MYSQL_SCHEMA_EXISTS}" | tail -10
    exit 1
  fi
  MYSQL_SCHEMA_EXISTS=$(printf '%s' "${MYSQL_SCHEMA_EXISTS}" | tr -d '[:space:]')
  if [ "${MYSQL_SCHEMA_EXISTS}" = '1' ]; then
    MYSQL_EXTERNAL_TARGET_DATABASE_EXISTS=1
    if ! MYSQL_TARGET_OBJECT_COUNT=$(run_mysql_client 0 --batch --skip-column-names -e \
      "SELECT (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DATABASE_NAME}') + (SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='${DATABASE_NAME}') + (SELECT COUNT(*) FROM information_schema.EVENTS WHERE EVENT_SCHEMA='${DATABASE_NAME}');" 2>&1); then
      echo 'Microi：错误：无法检查已有 MySQL 目标数据库中的对象数量。'
      printf '%s\n' "${MYSQL_TARGET_OBJECT_COUNT}" | tail -10
      exit 1
    fi
    MYSQL_TARGET_OBJECT_COUNT=$(printf '%s' "${MYSQL_TARGET_OBJECT_COUNT}" | tr -d '[:space:]')
    if ! [[ "${MYSQL_TARGET_OBJECT_COUNT}" =~ ^[0-9]+$ ]]; then
      echo 'Microi：错误：已有 MySQL 返回了无法识别的目标数据库对象数量。'
      exit 1
    fi
    if [ "${MYSQL_TARGET_OBJECT_COUNT}" -ne 0 ]; then
      echo "Microi：错误：已有 MySQL 的目标数据库 ${DATABASE_NAME} 已包含 ${MYSQL_TARGET_OBJECT_COUNT} 个对象。"
      echo 'Microi：为保护客户数据，安装器不会覆盖、合并或删除非空数据库；请改用未占用的 OsClient/目标库，或先由管理员准备空库。'
      exit 1
    fi
    echo "Microi：目标数据库 ${DATABASE_NAME} 已存在且为空，将直接导入 ✓"
  elif [ "${MYSQL_SCHEMA_EXISTS}" = '0' ]; then
    echo "Microi：目标数据库 ${DATABASE_NAME} 尚不存在，将使用所填帐号创建并导入 ✓"
  else
    echo 'Microi：错误：已有 MySQL 返回了无法识别的数据库存在性结果。'
    exit 1
  fi
  echo "Microi：已有 ${DATABASE_DISPLAY_NAME} 已连接就绪 ✓"
else
DATABASE_DIR="${COMPOSE_BASE_DIR}/microi-install-database"

# 检查数据库数据盘空间；大 SQL 包按解压大小动态提高门槛。
DATABASE_DATA_MOUNT=$(df -P "${DATABASE_DATA_DIR%/*}" 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "${DATABASE_DATA_MOUNT}" ]; then
  DISK_AVAIL_MB=$((DATABASE_DATA_MOUNT / 1024))
  echo "Microi：数据库数据目录所在磁盘可用空间: ${DISK_AVAIL_MB}MB"
  if [ ${DISK_AVAIL_MB} -lt ${SQL_REQUIRED_FREE_MB} ]; then
    echo "Microi：错误：数据库数据盘可用空间不足（当前 ${DISK_AVAIL_MB}MB，至少需要 ${SQL_REQUIRED_FREE_MB}MB）。"
    exit 1
  fi
else
  echo 'Microi：警告：无法检测磁盘可用空间，继续安装...'
fi

rm -rf "${DATABASE_DATA_DIR}"
mkdir -p "${DATABASE_DATA_DIR}"
sudo chown -R "${DATABASE_DATA_OWNER}" "${DATABASE_DATA_DIR}"
sudo chmod 770 "${DATABASE_DATA_DIR}"
mkdir -p "${DATABASE_DIR}"

case "${DATABASE_CHOICE}" in
  1|2)
    generate_mysql_config > "${DATABASE_DIR}/my_microi.cnf"
    cat > "${DATABASE_DIR}/docker-compose.yml" <<EOF
services:
  ${DATABASE_CONTAINER_NAME}:
    image: ${DATABASE_IMAGE}
    container_name: ${DATABASE_CONTAINER_NAME}
    labels:
      com.microi.database.name: ${DATABASE_NAME}
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${DATABASE_PORT}:${DATABASE_INTERNAL_PORT}"
    environment:
      - MYSQL_ROOT_PASSWORD=${DATABASE_PASSWORD}
      - MYSQL_DATABASE=${DATABASE_NAME}
      - MYSQL_ROOT_HOST=%
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - ${DATABASE_DATA_DIR}:/var/lib/mysql
      - ./my_microi.cnf:/etc/mysql/conf.d/my_microi.cnf
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
    ;;
  3)
    cat > "${DATABASE_DIR}/docker-compose.yml" <<EOF
services:
  ${DATABASE_CONTAINER_NAME}:
    image: ${DATABASE_IMAGE}
    container_name: ${DATABASE_CONTAINER_NAME}
    labels:
      com.microi.database.name: ${DATABASE_NAME}
${COMPOSE_SERVICE_NETWORK}
    restart: always
    ports:
      - "${DATABASE_PORT}:${DATABASE_INTERNAL_PORT}"
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=${DATABASE_PASSWORD}
      - MSSQL_PID=Developer
      - MSSQL_COLLATION=Chinese_PRC_CI_AS
    volumes:
      - ${DATABASE_DATA_DIR}:/var/opt/mssql
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
    ;;
  5)
    cat > "${DATABASE_DIR}/docker-compose.yml" <<EOF
services:
  ${DATABASE_CONTAINER_NAME}:
    image: ${DATABASE_IMAGE}
    container_name: ${DATABASE_CONTAINER_NAME}
    labels:
      com.microi.database.name: ${DATABASE_NAME}
${COMPOSE_SERVICE_NETWORK}
    restart: always
    privileged: true
    mem_limit: 3g
    shm_size: 1g
    ports:
      - "${DATABASE_PORT}:${DATABASE_INTERNAL_PORT}"
    environment:
      - MODE=dmsingle
      - INSTANCE_NAME=MICROI
      - SYSDBA_PWD=${DATABASE_PASSWORD}
      - DM_USER_PWD=${DATABASE_PASSWORD}
      - PAGE_SIZE=32
      - CASE_SENSITIVE=1
      - UNICODE_FLAG=1
      - EXTENT_SIZE=16
      - BLANK_PAD_MODE=0
      - LOG_SIZE=256
      - BUFFER=1000
    volumes:
      - ${DATABASE_DATA_DIR}:/opt/dmdbms/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
    ;;
  6)
    cat > "${DATABASE_DIR}/docker-compose.yml" <<EOF
services:
  ${DATABASE_CONTAINER_NAME}:
    image: ${DATABASE_IMAGE}
    container_name: ${DATABASE_CONTAINER_NAME}
    labels:
      com.microi.database.name: ${DATABASE_NAME}
${COMPOSE_SERVICE_NETWORK}
    restart: always
    ports:
      - "${DATABASE_PORT}:${DATABASE_INTERNAL_PORT}"
    environment:
      - POSTGRES_USER=${DATABASE_USER}
      - POSTGRES_PASSWORD=${DATABASE_PASSWORD}
      - POSTGRES_DB=${DATABASE_NAME}
      - POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=C.UTF-8
    volumes:
      - ${DATABASE_DATA_DIR}:/var/lib/postgresql/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
    ;;
  *)
    echo "Microi：错误：${DATABASE_DISPLAY_NAME} 未通过自动安装前置检查。"
    exit 1
    ;;
esac
chmod 600 "${DATABASE_DIR}/docker-compose.yml"
echo "Microi：数据库编排文件已生成: ${DATABASE_DIR}/docker-compose.yml ✓"

compose_up "${DATABASE_DIR}"

echo "Microi：等待 ${DATABASE_DISPLAY_NAME} 容器启动..."
sleep 5
if ! docker ps --format '{{.Names}}' | grep -qx "${DATABASE_CONTAINER_NAME}"; then
  echo "Microi：错误：${DATABASE_DISPLAY_NAME} 容器启动后立即退出，以下是容器日志："
  docker logs "${DATABASE_CONTAINER_NAME}" 2>&1 | tail -50
  exit 1
fi

SQLCMD_PATH=""
if [ "${DATABASE_CHOICE}" = "3" ]; then
  SQLCMD_PATH=$(docker exec "${DATABASE_CONTAINER_NAME}" sh -c 'for p in /opt/mssql-tools18/bin/sqlcmd /opt/mssql-tools/bin/sqlcmd; do if [ -x "$p" ]; then echo "$p"; exit 0; fi; done; exit 1' || true)
  if [ -z "${SQLCMD_PATH}" ]; then
    echo 'Microi：错误：SQL Server 镜像中未找到 sqlcmd，无法执行空数据库还原。'
    exit 1
  fi
fi

DATABASE_READY=false
for i in $(seq 1 60); do
  if ! docker ps --format '{{.Names}}' | grep -qx "${DATABASE_CONTAINER_NAME}"; then
    echo "Microi：错误：${DATABASE_DISPLAY_NAME} 容器在等待过程中退出。"
    docker logs "${DATABASE_CONTAINER_NAME}" 2>&1 | tail -50
    exit 1
  fi
  case "${DATABASE_CHOICE}" in
    1|2)
      run_mysql_client 0 -e 'SELECT 1' > /dev/null 2>&1 && DATABASE_READY=true
      ;;
    3)
      docker exec -i "${DATABASE_CONTAINER_NAME}" "${SQLCMD_PATH}" -S localhost -U sa -P "${DATABASE_PASSWORD}" -C -b -Q 'SELECT 1' > /dev/null 2>&1 && DATABASE_READY=true
      ;;
    5)
      printf 'SELECT 1 OK FROM DUAL;\nEXIT;\n' | docker exec -e LD_LIBRARY_PATH=/opt/dmdbms/bin -i "${DATABASE_CONTAINER_NAME}" /opt/dmdbms/bin/disql "${DATABASE_USER}/${DATABASE_PASSWORD}@127.0.0.1:${DATABASE_INTERNAL_PORT}" > /dev/null 2>&1 && DATABASE_READY=true
      ;;
    6)
      docker exec -i "${DATABASE_CONTAINER_NAME}" pg_isready -U "${DATABASE_USER}" -d "${DATABASE_NAME}" > /dev/null 2>&1 && DATABASE_READY=true
      ;;
  esac
  if [ "${DATABASE_READY}" = true ]; then
    break
  fi
  echo "Microi：等待 ${DATABASE_DISPLAY_NAME} 就绪中... (${i}/60)"
  sleep 2
done
if [ "${DATABASE_READY}" != true ]; then
  echo "Microi：错误：${DATABASE_DISPLAY_NAME} 在 120 秒内未能启动就绪。"
  docker logs "${DATABASE_CONTAINER_NAME}" 2>&1 | tail -50
  exit 1
fi
echo "Microi：${DATABASE_DISPLAY_NAME} 已启动就绪 ✓"
fi

# 后续安装阶段统一通过此函数执行数据库配置，不在业务服务层散落数据库方言。
database_exec_sql() {
  local sql="$1"
  case "${DATABASE_CHOICE}" in
    1|2)
      run_mysql_client 1 -e "${sql}"
      ;;
    3)
      docker exec -i "${DATABASE_CONTAINER_NAME}" "${SQLCMD_PATH}" -S localhost -U sa -P "${DATABASE_PASSWORD}" -C -b -d "${DATABASE_NAME}" -Q "${sql}"
      ;;
    5)
      printf 'WHENEVER SQLERROR EXIT SQL.SQLCODE;\n%s\nCOMMIT;\nEXIT;\n' "${sql}" | docker exec -e LD_LIBRARY_PATH=/opt/dmdbms/bin -i "${DATABASE_CONTAINER_NAME}" /opt/dmdbms/bin/disql "${DATABASE_USER}/${DATABASE_PASSWORD}@127.0.0.1:${DATABASE_INTERNAL_PORT}"
      ;;
    6)
      docker exec -e PGPASSWORD="${DATABASE_PASSWORD}" -i "${DATABASE_CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${DATABASE_USER}" -d "${DATABASE_NAME}" -c "${sql}"
      ;;
  esac
}

version_at_least() {
  local actual="$1"
  local required="$2"
  local -a actual_parts=()
  local -a required_parts=()
  local index actual_number required_number
  IFS='.' read -r -a actual_parts <<< "${actual}"
  IFS='.' read -r -a required_parts <<< "${required}"
  if [ "${#actual_parts[@]}" -ne 4 ] || [ "${#required_parts[@]}" -ne 4 ]; then
    return 1
  fi
  for index in 0 1 2 3; do
    if ! [[ "${actual_parts[$index]}" =~ ^[0-9]+$ ]] \
      || ! [[ "${required_parts[$index]}" =~ ^[0-9]+$ ]]; then
      return 1
    fi
    actual_number=$((10#${actual_parts[$index]}))
    required_number=$((10#${required_parts[$index]}))
    if [ "${actual_number}" -gt "${required_number}" ]; then
      return 0
    fi
    if [ "${actual_number}" -lt "${required_number}" ]; then
      return 1
    fi
  done
  return 0
}

# 只维护本次编排对应的精确主租户三元组。恢复包中的其它子租户、其它
# Product/Dev 或 Internal/Internet 记录必须原样保留，禁止按 OsClient 批量覆盖。
# 数据库、Redis、MongoDB 连接由 API 十项启动配置提供，不写回 sys_osclients。
ensure_runtime_auth_secret_schema() {
  local verify_sql=""
  local add_sql=""
  local readback=""
  case "${DATABASE_CHOICE}" in
    1|2)
      verify_sql="SELECT 'MICROI_AUTH_SECRET_SCHEMA_OK' AS Marker FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sys_osclients' AND column_name='AuthSecret';"
      add_sql="ALTER TABLE sys_osclients ADD COLUMN AuthSecret varchar(100) NULL;"
      ;;
    3)
      verify_sql="IF COL_LENGTH(N'dbo.sys_osclients',N'AuthSecret') IS NOT NULL SELECT N'MICROI_AUTH_SECRET_SCHEMA_OK' AS Marker;"
      add_sql="IF COL_LENGTH(N'dbo.sys_osclients',N'AuthSecret') IS NULL ALTER TABLE [dbo].[sys_osclients] ADD [AuthSecret] nvarchar(100) NULL;"
      ;;
    5)
      verify_sql="SELECT 'MICROI_AUTH_SECRET_SCHEMA_OK' AS Marker FROM USER_TAB_COLUMNS WHERE UPPER(TABLE_NAME)='SYS_OSCLIENTS' AND UPPER(COLUMN_NAME)='AUTHSECRET';"
      add_sql="ALTER TABLE \"sys_osclients\" ADD \"AuthSecret\" VARCHAR(100);"
      ;;
    6)
      verify_sql="SELECT 'MICROI_AUTH_SECRET_SCHEMA_OK' AS Marker FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='sys_osclients' AND column_name='AuthSecret';"
      add_sql="ALTER TABLE \"sys_osclients\" ADD COLUMN IF NOT EXISTS \"AuthSecret\" varchar(100) NULL;"
      ;;
  esac

  readback=$(database_exec_sql "${verify_sql}" 2>&1 || true)
  if ! printf '%s\n' "${readback}" | grep -q 'MICROI_AUTH_SECRET_SCHEMA_OK'; then
    echo 'Microi：旧恢复库缺少 sys_osclients.AuthSecret，正在补齐安全启动必需列...'
    if ! database_exec_sql "${add_sql}" > /dev/null; then
      echo 'Microi：错误：补齐 sys_osclients.AuthSecret 失败，API 不会以临时 JWT 密钥启动。'
      return 1
    fi
    readback=$(database_exec_sql "${verify_sql}" 2>&1 || true)
  fi
  if ! printf '%s\n' "${readback}" | grep -q 'MICROI_AUTH_SECRET_SCHEMA_OK'; then
    echo 'Microi：错误：sys_osclients.AuthSecret 建列后回读失败。'
    return 1
  fi
}

ensure_runtime_main_tenant() {
  local state_sql=""
  local insert_sql=""
  local update_sql=""
  local verify_sql=""
  local state_readback=""
  local tenant_id=""

  ensure_runtime_auth_secret_schema || return 1

  case "${DATABASE_CHOICE}" in
    1|2)
      state_sql="SELECT CASE COUNT(*) WHEN 0 THEN 'MICROI_MAIN_TENANT_MISSING' WHEN 1 THEN 'MICROI_MAIN_TENANT_UNIQUE' ELSE CONCAT('MICROI_MAIN_TENANT_DUPLICATE:', COUNT(*)) END AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0;"
      update_sql="UPDATE sys_osclients SET ClientName='${OS_CLIENT}', AuthSecret=CASE WHEN AuthSecret IS NULL OR CHAR_LENGTH(TRIM(AuthSecret))<32 OR LOWER(TRIM(AuthSecret))=LOWER('${OS_CLIENT}') THEN '${AUTH_SECRET}' ELSE AuthSecret END WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0;"
      verify_sql="SELECT 'MICROI_MAIN_TENANT_READY' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND ClientName='${OS_CLIENT}' AND CHAR_LENGTH(TRIM(AuthSecret))>=32 AND LOWER(TRIM(AuthSecret))<>LOWER('${OS_CLIENT}') AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,ClientName,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
      ;;
    3)
      state_sql="SELECT CASE COUNT(*) WHEN 0 THEN N'MICROI_MAIN_TENANT_MISSING' WHEN 1 THEN N'MICROI_MAIN_TENANT_UNIQUE' ELSE N'MICROI_MAIN_TENANT_DUPLICATE:' + CONVERT(nvarchar(20), COUNT(*)) END AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0;"
      update_sql="UPDATE [dbo].[sys_osclients] SET [ClientName]=N'${OS_CLIENT}', [AuthSecret]=CASE WHEN [AuthSecret] IS NULL OR LEN(LTRIM(RTRIM([AuthSecret])))<32 OR LOWER(LTRIM(RTRIM([AuthSecret])))=LOWER(N'${OS_CLIENT}') THEN N'${AUTH_SECRET}' ELSE [AuthSecret] END WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0;"
      verify_sql="SELECT N'MICROI_MAIN_TENANT_READY' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [ClientName]=N'${OS_CLIENT}' AND LEN(LTRIM(RTRIM([AuthSecret])))>=32 AND LOWER(LTRIM(RTRIM([AuthSecret])))<>LOWER(N'${OS_CLIENT}') AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[ClientName],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
      ;;
    5|6)
      state_sql="SELECT CASE COUNT(*) WHEN 0 THEN 'MICROI_MAIN_TENANT_MISSING' WHEN 1 THEN 'MICROI_MAIN_TENANT_UNIQUE' ELSE 'MICROI_MAIN_TENANT_DUPLICATE:' || CAST(COUNT(*) AS varchar(20)) END AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
      update_sql="UPDATE \"sys_osclients\" SET \"ClientName\"='${OS_CLIENT}', \"AuthSecret\"=CASE WHEN \"AuthSecret\" IS NULL OR LENGTH(TRIM(\"AuthSecret\"))<32 OR LOWER(TRIM(\"AuthSecret\"))=LOWER('${OS_CLIENT}') THEN '${AUTH_SECRET}' ELSE \"AuthSecret\" END WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
      verify_sql="SELECT 'MICROI_MAIN_TENANT_READY' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"ClientName\"='${OS_CLIENT}' AND LENGTH(TRIM(\"AuthSecret\"))>=32 AND LOWER(TRIM(\"AuthSecret\"))<>LOWER('${OS_CLIENT}') AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"ClientName\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
      ;;
  esac

  state_readback=$(database_exec_sql "${state_sql}" 2>&1 || true)
  if printf '%s\n' "${state_readback}" | grep -q 'MICROI_MAIN_TENANT_DUPLICATE:'; then
    echo "Microi：错误：活动主租户 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK} 存在多条，无法安全选择。"
    echo 'Microi：请先恢复原始数据库备份或人工合并重复主租户；安装器不会删除或覆盖不明确的数据。'
    return 1
  fi

  if printf '%s\n' "${state_readback}" | grep -q 'MICROI_MAIN_TENANT_MISSING'; then
    tenant_id=$(generate_uuid)
    case "${DATABASE_CHOICE}" in
      1|2)
        insert_sql="INSERT INTO sys_osclients (Id,OsClient,ClientName,OsClientType,OsClientNetwork,IsEnable,IsDeleted) SELECT '${tenant_id}','${OS_CLIENT}','${OS_CLIENT}','${RUNTIME_OS_CLIENT_TYPE}','${RUNTIME_OS_CLIENT_NETWORK}',1,0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0);"
        ;;
      3)
        insert_sql="IF NOT EXISTS (SELECT 1 FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0) INSERT INTO [dbo].[sys_osclients] ([Id],[OsClient],[ClientName],[OsClientType],[OsClientNetwork],[IsEnable],[IsDeleted]) VALUES ('${tenant_id}',N'${OS_CLIENT}',N'${OS_CLIENT}',N'${RUNTIME_OS_CLIENT_TYPE}',N'${RUNTIME_OS_CLIENT_NETWORK}',1,0);"
        ;;
      5)
        insert_sql="INSERT INTO \"sys_osclients\" (\"Id\",\"OsClient\",\"ClientName\",\"OsClientType\",\"OsClientNetwork\",\"IsEnable\",\"IsDeleted\") SELECT '${tenant_id}','${OS_CLIENT}','${OS_CLIENT}','${RUNTIME_OS_CLIENT_TYPE}','${RUNTIME_OS_CLIENT_NETWORK}',1,0 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0);"
        ;;
      6)
        insert_sql="INSERT INTO \"sys_osclients\" (\"Id\",\"OsClient\",\"ClientName\",\"OsClientType\",\"OsClientNetwork\",\"IsEnable\",\"IsDeleted\") SELECT '${tenant_id}','${OS_CLIENT}','${OS_CLIENT}','${RUNTIME_OS_CLIENT_TYPE}','${RUNTIME_OS_CLIENT_NETWORK}',1,0 WHERE NOT EXISTS (SELECT 1 FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0);"
        ;;
    esac
    if ! database_exec_sql "${insert_sql}" > /dev/null; then
      echo "Microi：错误：创建主租户 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK} 失败。"
      return 1
    fi
    echo "Microi：恢复库中不存在目标主租户，已创建 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK}；数据库与 Redis/MongoDB 连接继续由编排启动项提供 ✓"
  elif ! printf '%s\n' "${state_readback}" | grep -q 'MICROI_MAIN_TENANT_UNIQUE'; then
    echo 'Microi：错误：无法读取 sys_osclients 主租户状态，已停止以保护恢复库。'
    printf '%s\n' "${state_readback}" | tail -20
    return 1
  fi

  if ! database_exec_sql "${update_sql}" > /dev/null; then
    echo 'Microi：错误：规范化目标主租户 ClientName/AuthSecret 失败。'
    return 1
  fi
  state_readback=$(database_exec_sql "${verify_sql}" 2>&1 || true)
  if ! printf '%s\n' "${state_readback}" | grep -q 'MICROI_MAIN_TENANT_READY'; then
    echo 'Microi：错误：主租户创建/更新后回读不唯一，已停止后续安装。'
    return 1
  fi
  echo "Microi：主租户 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK} 已唯一就绪，JWT AuthSecret 已持久化且原有子租户保持不变 ✓"
}

if { [ "${DATABASE_CHOICE}" = "1" ] || [ "${DATABASE_CHOICE}" = "2" ]; } \
  && [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
  echo 'Microi：配置 MySQL 远程访问权限...'
  if [ "${MYSQL_VERSION}" = "8.0" ]; then
    MYSQL_GRANT_SQL="CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${DATABASE_PASSWORD}'; ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${DATABASE_PASSWORD}'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;"
  else
    MYSQL_GRANT_SQL="USE mysql; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '${DATABASE_PASSWORD}' WITH GRANT OPTION;"
  fi
  run_mysql_client 0 -e "${MYSQL_GRANT_SQL}"
  run_mysql_client 0 -e 'FLUSH PRIVILEGES;' > /dev/null 2>&1 || true
fi

# 获取、复核并安全展开数据库包。自定义原文件只读使用，清理时绝不删除。
SQL_ZIP_IS_TEMP=0
SQL_TMP_DIR=$(mktemp -d "/tmp/microi_database_${DATABASE_ENGINE_KEY}.XXXXXX")
SQL_FILE="${SQL_TMP_DIR}/microi-database-init.sql"

if [ "${SQL_SOURCE_MODE}" = 'custom' ]; then
  SQL_ZIP_FILE="${SQL_CUSTOM_ZIP_PATH}"
  echo "Microi：读取自定义数据库包：${SQL_ZIP_FILE}"
else
  SQL_ZIP_FILE=$(mktemp "/tmp/${SQL_ZIP_FILE_NAME}.XXXXXX")
  SQL_ZIP_IS_TEMP=1
  echo "Microi：下载数据库备份文件：${SQL_ZIP_URL}"
  curl --fail --location --retry 3 --retry-delay 2 --output "${SQL_ZIP_FILE}" "${SQL_ZIP_URL}"
fi

# 二次校验可防止预检后文件被替换；unzip -p 输出到固定文件名，不信任 ZIP 内路径。
validate_sql_zip_archive "${SQL_ZIP_FILE}"
if [ "${SQL_SOURCE_MODE}" = 'custom' ]; then
  detect_sql_database_name_from_archive \
    "${SQL_ZIP_FILE}" "${SQL_ARCHIVE_ENTRY}" "${DATABASE_TYPE}"
  SQL_RECHECK_DATABASE_NAME="${SQL_DETECTED_DATABASE_NAME:-${OS_CLIENT}}"
  if [ "${DATABASE_TYPE}" = 'DaMeng' ]; then
    SQL_RECHECK_DATABASE_NAME='SYSDBA'
  fi
  if [ "${SQL_RECHECK_DATABASE_NAME}" != "${DATABASE_NAME}" ]; then
    echo 'Microi：错误：数据库包在预检后发生变化，二次识别的数据库名不一致。'
    exit 1
  fi
fi
if ! unzip -p "${SQL_ZIP_FILE}" "${SQL_ARCHIVE_ENTRY}" > "${SQL_FILE}"; then
  echo 'Microi：错误：数据库 SQL 解压失败。'
  exit 1
fi
SQL_EXTRACTED_BYTES=$(wc -c < "${SQL_FILE}" | tr -d ' ')
if [ "${SQL_EXTRACTED_BYTES}" != "${SQL_UNCOMPRESSED_BYTES}" ]; then
  echo "Microi：错误：SQL 解压后大小不一致（期望 ${SQL_UNCOMPRESSED_BYTES}，实际 ${SQL_EXTRACTED_BYTES}）。"
  exit 1
fi

echo "Microi：还原 ${DATABASE_DISPLAY_NAME} 数据库（${SQL_ARCHIVE_ENTRY}，可能需要几分钟）..."
case "${DATABASE_CHOICE}" in
  1|2)
    if [ "${DATABASE_SERVICE_MODE}" = 'managed' ] \
      || [ "${MYSQL_EXTERNAL_TARGET_DATABASE_EXISTS}" != '1' ]; then
      run_mysql_client 0 -e "CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    fi
    # 仅本次恢复会话关闭 InnoDB 严格建表校验，兼容来源库中已存在的超宽 Dynamic 表；
    # 同时关闭本会话 binlog 并按事务批量提交，避免几十万条单行 INSERT 每条 fsync。
    # 不修改 global 配置，平台恢复完成后的所有新连接仍保持 MySQL 默认严格和安全落盘行为。
    emit_mysql_import_preamble() {
      if [ "${DATABASE_SERVICE_MODE}" = 'managed' ]; then
        printf "SET SESSION innodb_strict_mode=OFF; SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'; SET SESSION sql_log_bin=0; SET autocommit=0;\n"
      else
        printf "SET SESSION innodb_strict_mode=OFF; SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'; SET autocommit=0;\n"
      fi
    }
    run_mysql_import_stream() {
      run_mysql_client 1 --binary-mode=1
    }
    set +e
    if grep -q '^-- View structure' "${SQL_FILE}"; then
      # Navicat 可能把依赖视图排在被依赖视图之前。先严格导入表和数据，再用一次
      # --force 播种全部视图，最后严格重放视图段确认不存在真实 SQL 错误。
      {
        emit_mysql_import_preamble
        sed -e '/^-- View structure/,$d' -e '/^[[:space:]]*SET[[:space:]]\+AUTOCOMMIT[[:space:]]*=/Id' "${SQL_FILE}"
        printf '\nCOMMIT;\n'
      } | run_mysql_import_stream
      MYSQL_MAIN_PIPE_STATUSES=("${PIPESTATUS[@]}")

      {
        emit_mysql_import_preamble
        sed -n '/^-- View structure/,$p' "${SQL_FILE}"
        printf '\nCOMMIT;\n'
      } | run_mysql_client 1 --force --binary-mode=1 > "${SQL_TMP_DIR}/view-seed.log" 2>&1
      MYSQL_VIEW_SEED_PIPE_STATUSES=("${PIPESTATUS[@]}")

      {
        emit_mysql_import_preamble
        sed -n '/^-- View structure/,$p' "${SQL_FILE}"
        printf '\nCOMMIT;\n'
      } | run_mysql_import_stream
      MYSQL_VIEW_VERIFY_PIPE_STATUSES=("${PIPESTATUS[@]}")
      MYSQL_IMPORT_FAILED=0
      if [ "${MYSQL_MAIN_PIPE_STATUSES[0]:-1}" -ne 0 ] || [ "${MYSQL_MAIN_PIPE_STATUSES[1]:-1}" -ne 0 ] \
        || [ "${MYSQL_VIEW_SEED_PIPE_STATUSES[0]:-1}" -ne 0 ] || [ "${MYSQL_VIEW_SEED_PIPE_STATUSES[1]:-1}" -ne 0 ] \
        || [ "${MYSQL_VIEW_VERIFY_PIPE_STATUSES[0]:-1}" -ne 0 ] || [ "${MYSQL_VIEW_VERIFY_PIPE_STATUSES[1]:-1}" -ne 0 ]; then
        MYSQL_IMPORT_FAILED=1
      fi
    else
      {
        emit_mysql_import_preamble
        sed '/^[[:space:]]*SET[[:space:]]\+AUTOCOMMIT[[:space:]]*=/Id' "${SQL_FILE}"
        printf '\nCOMMIT;\n'
      } | run_mysql_import_stream
      MYSQL_IMPORT_PIPE_STATUSES=("${PIPESTATUS[@]}")
      MYSQL_IMPORT_FAILED=0
      if [ "${MYSQL_IMPORT_PIPE_STATUSES[0]:-1}" -ne 0 ] || [ "${MYSQL_IMPORT_PIPE_STATUSES[1]:-1}" -ne 0 ]; then
        MYSQL_IMPORT_FAILED=1
      fi
    fi
    set -e
    if [ "${MYSQL_IMPORT_FAILED:-1}" -ne 0 ]; then
      echo 'Microi：错误：MySQL 数据库导入失败，已停止后续安装。'
      if [ -s "${SQL_TMP_DIR}/view-seed.log" ]; then tail -n 30 "${SQL_TMP_DIR}/view-seed.log"; fi
      exit 1
    fi
    ;;
  3)
    docker exec -i "${DATABASE_CONTAINER_NAME}" "${SQLCMD_PATH}" -S localhost -U sa -P "${DATABASE_PASSWORD}" -C -b -Q "IF DB_ID(N'${DATABASE_NAME}') IS NULL CREATE DATABASE [${DATABASE_NAME}] COLLATE Chinese_PRC_CI_AS; ALTER DATABASE [${DATABASE_NAME}] SET COMPATIBILITY_LEVEL = 160;"
    docker exec -i "${DATABASE_CONTAINER_NAME}" "${SQLCMD_PATH}" -S localhost -U sa -P "${DATABASE_PASSWORD}" -C -b -d "${DATABASE_NAME}" < "${SQL_FILE}"
    ;;
  5)
    DM8_IMPORT_LOG="/tmp/microi_dm8_import.log"
    DM8_CONTAINER_SQL="/tmp/microi-database-init.sql"
    DM8_SCRIPT_ARG="$(printf '\140')${DM8_CONTAINER_SQL}"
    docker cp "${SQL_FILE}" "${DATABASE_CONTAINER_NAME}:${DM8_CONTAINER_SQL}"
    set +e
    docker exec -e LD_LIBRARY_PATH=/opt/dmdbms/bin -i "${DATABASE_CONTAINER_NAME}" /opt/dmdbms/bin/disql -S "${DATABASE_USER}/${DATABASE_PASSWORD}@127.0.0.1:${DATABASE_INTERNAL_PORT}" "${DM8_SCRIPT_ARG}" 2>&1 | tee "${DM8_IMPORT_LOG}"
    DM8_PIPE_STATUSES=("${PIPESTATUS[@]}")
    set -e
    if [ "${DM8_PIPE_STATUSES[0]:-1}" -ne 0 ] || [ "${DM8_PIPE_STATUSES[1]:-1}" -ne 0 ]; then
      echo 'Microi：错误：达梦 DM8 导入命令或日志写入失败。'
      exit 1
    fi
    if grep -Eiq '\[-[0-9]+\]|SQLSTATE|error|错误' "${DM8_IMPORT_LOG}"; then
      echo "Microi：错误：达梦 DM8 导入日志包含 SQL 错误，请检查 ${DM8_IMPORT_LOG}。"
      exit 1
    fi
    docker exec "${DATABASE_CONTAINER_NAME}" rm -f "${DM8_CONTAINER_SQL}" > /dev/null 2>&1 || true
    rm -f "${DM8_IMPORT_LOG}"
    ;;
  6)
    docker exec -e PGPASSWORD="${DATABASE_PASSWORD}" -i "${DATABASE_CONTAINER_NAME}" psql -v ON_ERROR_STOP=1 -U "${DATABASE_USER}" -d "${DATABASE_NAME}" < "${SQL_FILE}"
    ;;
esac
echo 'Microi：数据库还原完成 ✓'

# 客户库可能带有原环境的调度状态；必须在 API/Worker 启动前全部暂停，
# 避免刚恢复就执行旧环境任务。执行失败时终止安装，不带病启动平台。
echo 'Microi：暂停恢复库中的定时任务...'
case "${DATABASE_CHOICE}" in
  1|2)
    PAUSE_SCHEDULE_SQL="UPDATE diy_schedule_job SET Status='暂停'; UPDATE microi_job_triggers SET TRIGGER_STATE='PAUSED';"
    PAUSE_SCHEDULE_VERIFY_SQL="SELECT 'MICROI_SCHEDULES_PAUSED' AS Marker WHERE NOT EXISTS (SELECT 1 FROM diy_schedule_job WHERE IFNULL(Status,'')<>'暂停') AND NOT EXISTS (SELECT 1 FROM microi_job_triggers WHERE IFNULL(TRIGGER_STATE,'')<>'PAUSED');"
    ;;
  3)
    PAUSE_SCHEDULE_SQL="UPDATE [dbo].[diy_schedule_job] SET [Status]=N'暂停'; UPDATE [dbo].[microi_job_triggers] SET [TRIGGER_STATE]=N'PAUSED';"
    PAUSE_SCHEDULE_VERIFY_SQL="IF NOT EXISTS (SELECT 1 FROM [dbo].[diy_schedule_job] WHERE COALESCE([Status],N'')<>N'暂停') AND NOT EXISTS (SELECT 1 FROM [dbo].[microi_job_triggers] WHERE COALESCE([TRIGGER_STATE],N'')<>N'PAUSED') SELECT N'MICROI_SCHEDULES_PAUSED' AS Marker;"
    ;;
  5)
    PAUSE_SCHEDULE_SQL="UPDATE \"diy_schedule_job\" SET \"Status\"='暂停'; UPDATE \"microi_job_triggers\" SET \"TRIGGER_STATE\"='PAUSED';"
    PAUSE_SCHEDULE_VERIFY_SQL="SELECT 'MICROI_SCHEDULES_PAUSED' AS Marker FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM \"diy_schedule_job\" WHERE COALESCE(\"Status\",'')<>'暂停') AND NOT EXISTS (SELECT 1 FROM \"microi_job_triggers\" WHERE COALESCE(\"TRIGGER_STATE\",'')<>'PAUSED');"
    ;;
  6)
    PAUSE_SCHEDULE_SQL="UPDATE \"diy_schedule_job\" SET \"Status\"='暂停'; UPDATE \"microi_job_triggers\" SET \"TRIGGER_STATE\"='PAUSED';"
    PAUSE_SCHEDULE_VERIFY_SQL="SELECT 'MICROI_SCHEDULES_PAUSED' AS Marker WHERE NOT EXISTS (SELECT 1 FROM \"diy_schedule_job\" WHERE COALESCE(\"Status\",'')<>'暂停') AND NOT EXISTS (SELECT 1 FROM \"microi_job_triggers\" WHERE COALESCE(\"TRIGGER_STATE\",'')<>'PAUSED');"
    ;;
esac
database_exec_sql "${PAUSE_SCHEDULE_SQL}"
PAUSE_SCHEDULE_READBACK=$(database_exec_sql "${PAUSE_SCHEDULE_VERIFY_SQL}" 2>&1 || true)
if ! printf '%s\n' "${PAUSE_SCHEDULE_READBACK}" | grep -q 'MICROI_SCHEDULES_PAUSED'; then
  echo 'Microi：错误：恢复库的定时任务暂停状态回读不一致，已在 API/Worker 启动前停止。'
  exit 1
fi
echo 'Microi：定时任务已全部暂停并回读一致 ✓'

echo "Microi：核对并初始化 SaaS 主租户 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK}..."
ensure_runtime_main_tenant

cleanup_database_import_temp
echo 'Microi：数据库导入临时文件已清理；外部服务受限凭据将在整次安装退出时清理 ✓'

echo ''
echo "[步骤6/11] ${DATABASE_DISPLAY_NAME} 配置/部署完成 ✓"


# ============================================================
# 步骤7：部署 Redis 编排
# ============================================================
echo ''
echo '[步骤7/11] 部署 Redis'
echo '------------------------------------------------------------------'

REDIS_DIR="${COMPOSE_BASE_DIR}/microi-install-redis"

# 根据服务器内存动态设置Redis maxmemory（约占总内存的25%，最小128mb，最大8gb）
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
if [ -z "${TOTAL_MEM_KB}" ]; then TOTAL_MEM_KB=2097152; fi
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
if [ ${TOTAL_MEM_MB} -le 1024 ]; then
  REDIS_MAXMEMORY="128mb"
elif [ ${TOTAL_MEM_MB} -le 2048 ]; then
  REDIS_MAXMEMORY="256mb"
elif [ ${TOTAL_MEM_MB} -le 4096 ]; then
  REDIS_MAXMEMORY="512mb"
elif [ ${TOTAL_MEM_MB} -le 8192 ]; then
  REDIS_MAXMEMORY="1gb"
elif [ ${TOTAL_MEM_MB} -le 16384 ]; then
  REDIS_MAXMEMORY="2gb"
else
  REDIS_MAXMEMORY="4gb"
fi

echo "Microi：Redis 端口: ${REDIS_PORT}, 密码: ${REDIS_PASSWORD}, maxmemory: ${REDIS_MAXMEMORY}"

mkdir -p "${REDIS_DIR}"
cat > "${REDIS_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: microi-install-redis
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${REDIS_PORT}:6379"
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    command:
      - redis-server
      - "--requirepass"
      - "${REDIS_PASSWORD}"
      - "--maxmemory"
      - "${REDIS_MAXMEMORY}"
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--timeout"
      - "300"
      - "--tcp-keepalive"
      - "300"
      - "--tcp-backlog"
      - "511"
      - "--maxclients"
      - "10000"
      - "--databases"
      - "16"
      - "--save"
      - "900 1"
      - "--save"
      - "300 10"
      - "--save"
      - "60 10000"
      - "--appendonly"
      - "yes"
      - "--appendfsync"
      - "everysec"
      - "--aof-use-rdb-preamble"
      - "yes"
    volumes:
      - /etc/localtime:/etc/localtime
      - ${REDIS_DATA_DIR}:/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
echo "Microi：Redis 编排文件已生成 ✓"

compose_up "${REDIS_DIR}"

echo ''
echo '[步骤7/11] Redis 部署完成 ✓'


# ============================================================
# 步骤8：部署 MongoDB 编排
# ============================================================
echo ''
echo '[步骤8/11] 部署 MongoDB'
echo '------------------------------------------------------------------'

MONGO_DIR="${COMPOSE_BASE_DIR}/microi-install-mongodb"

echo "Microi：MongoDB 端口: ${MONGO_PORT}, Root密码: ${MONGO_ROOT_PASSWORD}"

mkdir -p "${MONGO_DIR}"
cat > "${MONGO_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: microi-install-mongodb
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${MONGO_PORT}:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
    volumes:
      - ${MONGO_DATA_DIR}:/data/db
      - /etc/localtime:/etc/localtime
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
echo "Microi：MongoDB 编排文件已生成 ✓"

compose_up "${MONGO_DIR}"

echo ''
echo '[步骤8/11] MongoDB 部署完成 ✓'


# ============================================================
# 步骤9：部署或连接 MinIO
# ============================================================
echo ''
echo '[步骤9/11] 部署或连接 MinIO'
echo '------------------------------------------------------------------'

# MinIO 配置写入发生在 API/Upgrade 启动前，只能依赖空库与存量库共同具备的
# 必需字段。NetworkIsInternet 是旧版可选字段，当前运行时由允许的启动项
# OsClientNetwork 决定内外网端点，安装器不再要求或写入该字段。
case "${DATABASE_CHOICE}" in
  1|2)
    MINIO_SCHEMA_VERIFY_SQL="SELECT 'MICROI_MINIO_SCHEMA_OK' AS Marker FROM information_schema.columns WHERE table_schema=DATABASE() AND LOWER(table_name)='sys_osclients' AND LOWER(column_name) IN ('hdfs','minioaccesskey','miniosecretkey','minioendpoint','minioendpointinternet','minioendpointssl','minioprivateendpointssl','minioprivatebucketname','miniopublicbucketname','minioregion','osclient','osclienttype','osclientnetwork','isenable','isdeleted') HAVING COUNT(DISTINCT LOWER(column_name))=15;"
    MINIO_TENANT_VERIFY_SQL="SELECT 'MICROI_MINIO_TENANT_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
    ;;
  3)
    MINIO_SCHEMA_VERIFY_SQL="IF (SELECT COUNT(DISTINCT LOWER(c.[name])) FROM sys.columns c INNER JOIN sys.objects o ON c.[object_id]=o.[object_id] WHERE LOWER(o.[name])=N'sys_osclients' AND SCHEMA_NAME(o.[schema_id])=N'dbo' AND LOWER(c.[name]) IN (N'hdfs',N'minioaccesskey',N'miniosecretkey',N'minioendpoint',N'minioendpointinternet',N'minioendpointssl',N'minioprivateendpointssl',N'minioprivatebucketname',N'miniopublicbucketname',N'minioregion',N'osclient',N'osclienttype',N'osclientnetwork',N'isenable',N'isdeleted'))=15 SELECT N'MICROI_MINIO_SCHEMA_OK' AS Marker;"
    MINIO_TENANT_VERIFY_SQL="SELECT N'MICROI_MINIO_TENANT_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
    ;;
  5)
    MINIO_SCHEMA_VERIFY_SQL="SELECT 'MICROI_MINIO_SCHEMA_OK' AS Marker FROM USER_TAB_COLUMNS WHERE UPPER(TABLE_NAME)='SYS_OSCLIENTS' AND UPPER(COLUMN_NAME) IN ('HDFS','MINIOACCESSKEY','MINIOSECRETKEY','MINIOENDPOINT','MINIOENDPOINTINTERNET','MINIOENDPOINTSSL','MINIOPRIVATEENDPOINTSSL','MINIOPRIVATEBUCKETNAME','MINIOPUBLICBUCKETNAME','MINIOREGION','OSCLIENT','OSCLIENTTYPE','OSCLIENTNETWORK','ISENABLE','ISDELETED') HAVING COUNT(DISTINCT UPPER(COLUMN_NAME))=15;"
    MINIO_TENANT_VERIFY_SQL="SELECT 'MICROI_MINIO_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    ;;
  6)
    MINIO_SCHEMA_VERIFY_SQL="SELECT 'MICROI_MINIO_SCHEMA_OK' AS Marker WHERE (SELECT COUNT(DISTINCT LOWER(column_name)) FROM information_schema.columns WHERE table_schema=current_schema() AND LOWER(table_name)='sys_osclients' AND LOWER(column_name) IN ('hdfs','minioaccesskey','miniosecretkey','minioendpoint','minioendpointinternet','minioendpointssl','minioprivateendpointssl','minioprivatebucketname','miniopublicbucketname','minioregion','osclient','osclienttype','osclientnetwork','isenable','isdeleted'))=15;"
    MINIO_TENANT_VERIFY_SQL="SELECT 'MICROI_MINIO_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    ;;
esac

MINIO_SCHEMA_READBACK=$(database_exec_sql "${MINIO_SCHEMA_VERIFY_SQL}" 2>&1 || true)
if ! printf '%s\n' "${MINIO_SCHEMA_READBACK}" | grep -q 'MICROI_MINIO_SCHEMA_OK'; then
  echo 'Microi：错误：sys_osclients 缺少 MinIO 安装所需的必需字段，已在创建 MinIO 编排前停止。'
  echo 'Microi：请使用当前官方空数据库包，或先通过正式平台升级补齐字段；脚本不会直接猜测并修改客户数据库结构。'
  exit 1
fi
MINIO_TENANT_READBACK=$(database_exec_sql "${MINIO_TENANT_VERIFY_SQL}" 2>&1 || true)
if ! printf '%s\n' "${MINIO_TENANT_READBACK}" | grep -q 'MICROI_MINIO_TENANT_OK'; then
  echo "Microi：错误：主租户初始化后仍未唯一匹配 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK}，已在创建 MinIO 编排前停止。"
  echo 'Microi：请检查恢复库是否存在重复目标三元组；脚本不会删除或批量覆盖其它租户。'
  exit 1
fi
echo "Microi：MinIO 配置前置检查通过：唯一主租户 ${OS_CLIENT}/${RUNTIME_OS_CLIENT_TYPE}/${RUNTIME_OS_CLIENT_NETWORK} ✓"

MINIO_DIR=""
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  MINIO_DIR="${COMPOSE_BASE_DIR}/microi-install-minio"
  echo "Microi：MinIO API端口: ${MINIO_PORT}, Console端口: ${MINIO_CONSOLE_PORT}"
  mkdir -p "${MINIO_DIR}"
  cat > "${MINIO_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-minio:
    image: registry.cn-hangzhou.aliyuncs.com/microios/minio:latest
    container_name: microi-install-minio
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${MINIO_PORT}:9000"
      - "${MINIO_CONSOLE_PORT}:9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - ${MINIO_DATA_DIR}:/data
      - ${MINIO_DATA_DIR}/config:/root/.minio
    command: server /data --console-address ":9001"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
  chmod 600 "${MINIO_DIR}/docker-compose.yml"
  echo "Microi：MinIO 编排文件已生成 ✓"

  compose_up "${MINIO_DIR}"

  echo 'Microi：等待 MinIO API 就绪...'
  MINIO_READY=false
  for _minio_wait in $(seq 1 60); do
    if curl -fsS --connect-timeout 2 "http://127.0.0.1:${MINIO_PORT}/minio/health/live" > /dev/null 2>&1; then
      MINIO_READY=true
      break
    fi
    sleep 2
  done
  if [ "${MINIO_READY}" != "true" ]; then
    echo 'Microi：错误：MinIO 在 120 秒内未就绪，请检查容器日志。'
    docker logs microi-install-minio 2>&1 | tail -50 || true
    exit 1
  fi
  echo 'Microi：MinIO API 已就绪 ✓'
  MINIO_MC_ENDPOINT='http://microi-install-minio:9000'
else
  echo "Microi：已有 MinIO 模式不会创建 MinIO 容器、数据目录、编排、API 端口或 Console 端口。"
  MINIO_MC_ENDPOINT="${MINIO_EXTERNAL_INTERNAL_URL}"
fi

# 使用吾码阿里云镜像中的官方 mc 客户端初始化桶，避免服务器直接访问海外下载站。
MINIO_MC_CONFIG_DIR=$(mktemp -d '/tmp/microi_minio_mc_XXXXXX')
chmod 700 "${MINIO_MC_CONFIG_DIR}"
if ! docker image inspect "${MINIO_MC_IMAGE}" > /dev/null 2>&1; then
  echo "Microi：拉取吾码 MinIO mc 镜像 ${MINIO_MC_IMAGE}..."
  if ! docker pull "${MINIO_MC_IMAGE}"; then
    echo 'Microi：错误：吾码 MinIO mc 镜像拉取失败。'
    exit 1
  fi
else
  echo "Microi：复用本机 MinIO mc 镜像 ${MINIO_MC_IMAGE} ✓"
fi

run_minio_mc() {
  local -a docker_args=(run --rm --network microi --user '0:0')
  if [ "${MINIO_EXTERNAL_USE_HOST_GATEWAY:-0}" = '1' ]; then
    docker_args+=(--add-host 'host.docker.internal:host-gateway')
  fi
  docker_args+=(
    -v "${MINIO_MC_CONFIG_DIR}:/root/.mc:Z"
    "${MINIO_MC_IMAGE}"
    --config-dir /root/.mc
  )
  docker "${docker_args[@]}" "$@"
}

MINIO_MC_ALIAS="microi-local"
if ! run_minio_mc alias set "${MINIO_MC_ALIAS}" "${MINIO_MC_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"; then
  echo 'Microi：错误：MinIO mc 无法使用所填端点和凭据连接 MinIO 服务。'
  exit 1
fi
if ! run_minio_mc mb --ignore-existing "${MINIO_MC_ALIAS}/${MINIO_PRIVATE_BUCKET}"; then
  echo "Microi：错误：MinIO 私有桶 ${MINIO_PRIVATE_BUCKET} 创建失败。"
  exit 1
fi
if ! run_minio_mc mb --ignore-existing "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"; then
  echo "Microi：错误：MinIO 公有桶 ${MINIO_PUBLIC_BUCKET} 创建失败。"
  exit 1
fi
if ! run_minio_mc anonymous set none "${MINIO_MC_ALIAS}/${MINIO_PRIVATE_BUCKET}"; then
  echo "Microi：错误：MinIO 私有桶 ${MINIO_PRIVATE_BUCKET} 的匿名权限清理失败。"
  exit 1
fi
if ! run_minio_mc anonymous set download "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"; then
  echo "Microi：错误：MinIO 公有桶 ${MINIO_PUBLIC_BUCKET} 的 public 下载权限设置失败。"
  exit 1
fi
if ! run_minio_mc anonymous get "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"; then
  echo "Microi：错误：MinIO 公有桶 ${MINIO_PUBLIC_BUCKET} 的匿名下载权限回读失败。"
  exit 1
fi
rm -rf -- "${MINIO_MC_CONFIG_DIR}"
MINIO_MC_CONFIG_DIR=""
echo "Microi：MinIO 桶已初始化：${MINIO_PRIVATE_BUCKET}（私有）、${MINIO_PUBLIC_BUCKET}（public）✓"

# 新装服务使用 Docker DNS；已有服务保留经 mc 实测的内部端点和单独填写的浏览器端点。
if [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  MINIO_INTERNAL_ENDPOINT="microi-install-minio:9000"
  MINIO_INTERNET_ENDPOINT="${ACCESS_IP}:${MINIO_PORT}"
  MINIO_PRIVATE_SSL_FLAG=0
  MINIO_PUBLIC_SSL_FLAG=0
  MINIO_PUBLIC_BASE_URL="http://${ACCESS_IP}:${MINIO_PORT}"
  MINIO_REGION=""
else
  MINIO_INTERNAL_ENDPOINT="${MINIO_EXTERNAL_CONNECTION_HOST}:${MINIO_EXTERNAL_PORT}"
fi

sql_escape_runtime_literal() {
  local value="$1"
  if [ "${DATABASE_TYPE}" = 'MySql' ]; then
    printf '%s' "${value}" | sed -e 's/\\/\\\\/g' -e "s/'/''/g"
  else
    printf '%s' "${value}" | sed -e "s/'/''/g"
  fi
}
MINIO_ACCESS_KEY_SQL=$(sql_escape_runtime_literal "${MINIO_ACCESS_KEY}")
MINIO_SECRET_KEY_SQL=$(sql_escape_runtime_literal "${MINIO_SECRET_KEY}")
MINIO_INTERNAL_ENDPOINT_SQL=$(sql_escape_runtime_literal "${MINIO_INTERNAL_ENDPOINT}")
MINIO_INTERNET_ENDPOINT_SQL=$(sql_escape_runtime_literal "${MINIO_INTERNET_ENDPOINT}")
MINIO_PRIVATE_BUCKET_SQL=$(sql_escape_runtime_literal "${MINIO_PRIVATE_BUCKET}")
MINIO_PUBLIC_BUCKET_SQL=$(sql_escape_runtime_literal "${MINIO_PUBLIC_BUCKET}")
MINIO_REGION_SQL=$(sql_escape_runtime_literal "${MINIO_REGION}")
case "${DATABASE_CHOICE}" in
  1|2)
    MINIO_CONFIG_SQL="UPDATE sys_osclients SET HDFS='MinIO', MinIOAccessKey='${MINIO_ACCESS_KEY_SQL}', MinIOSecretKey='${MINIO_SECRET_KEY_SQL}', MinIOEndPoint='${MINIO_INTERNAL_ENDPOINT_SQL}', MinIOEndPointInternet='${MINIO_INTERNET_ENDPOINT_SQL}', MinIOEndPointSSL=${MINIO_PUBLIC_SSL_FLAG}, MinIOPrivateEndPointSSL=${MINIO_PRIVATE_SSL_FLAG}, MinIOPrivateBucketName='${MINIO_PRIVATE_BUCKET_SQL}', MinIOPublicBucketName='${MINIO_PUBLIC_BUCKET_SQL}', MinIORegion='${MINIO_REGION_SQL}' WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0;"
    MINIO_CONFIG_VERIFY_SQL="SELECT 'MICROI_MINIO_CONFIG_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 AND HDFS='MinIO' AND MinIOAccessKey='${MINIO_ACCESS_KEY_SQL}' AND MinIOSecretKey='${MINIO_SECRET_KEY_SQL}' AND MinIOEndPoint='${MINIO_INTERNAL_ENDPOINT_SQL}' AND MinIOEndPointInternet='${MINIO_INTERNET_ENDPOINT_SQL}' AND MinIOEndPointSSL=${MINIO_PUBLIC_SSL_FLAG} AND MinIOPrivateEndPointSSL=${MINIO_PRIVATE_SSL_FLAG} AND MinIOPrivateBucketName='${MINIO_PRIVATE_BUCKET_SQL}' AND MinIOPublicBucketName='${MINIO_PUBLIC_BUCKET_SQL}' AND IFNULL(MinIORegion,'')='${MINIO_REGION_SQL}' GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
    ;;
  3)
    MINIO_CONFIG_SQL="UPDATE [dbo].[sys_osclients] SET [HDFS]=N'MinIO', [MinIOAccessKey]=N'${MINIO_ACCESS_KEY_SQL}', [MinIOSecretKey]=N'${MINIO_SECRET_KEY_SQL}', [MinIOEndPoint]=N'${MINIO_INTERNAL_ENDPOINT_SQL}', [MinIOEndPointInternet]=N'${MINIO_INTERNET_ENDPOINT_SQL}', [MinIOEndPointSSL]=${MINIO_PUBLIC_SSL_FLAG}, [MinIOPrivateEndPointSSL]=${MINIO_PRIVATE_SSL_FLAG}, [MinIOPrivateBucketName]=N'${MINIO_PRIVATE_BUCKET_SQL}', [MinIOPublicBucketName]=N'${MINIO_PUBLIC_BUCKET_SQL}', [MinIORegion]=N'${MINIO_REGION_SQL}' WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0;"
    MINIO_CONFIG_VERIFY_SQL="SELECT N'MICROI_MINIO_CONFIG_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 AND [HDFS]=N'MinIO' AND [MinIOAccessKey]=N'${MINIO_ACCESS_KEY_SQL}' AND [MinIOSecretKey]=N'${MINIO_SECRET_KEY_SQL}' AND [MinIOEndPoint]=N'${MINIO_INTERNAL_ENDPOINT_SQL}' AND [MinIOEndPointInternet]=N'${MINIO_INTERNET_ENDPOINT_SQL}' AND [MinIOEndPointSSL]=${MINIO_PUBLIC_SSL_FLAG} AND [MinIOPrivateEndPointSSL]=${MINIO_PRIVATE_SSL_FLAG} AND [MinIOPrivateBucketName]=N'${MINIO_PRIVATE_BUCKET_SQL}' AND [MinIOPublicBucketName]=N'${MINIO_PUBLIC_BUCKET_SQL}' AND COALESCE([MinIORegion],N'')=N'${MINIO_REGION_SQL}' GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
    ;;
  5|6)
    MINIO_CONFIG_SQL="UPDATE \"sys_osclients\" SET \"HDFS\"='MinIO', \"MinIOAccessKey\"='${MINIO_ACCESS_KEY_SQL}', \"MinIOSecretKey\"='${MINIO_SECRET_KEY_SQL}', \"MinIOEndPoint\"='${MINIO_INTERNAL_ENDPOINT_SQL}', \"MinIOEndPointInternet\"='${MINIO_INTERNET_ENDPOINT_SQL}', \"MinIOEndPointSSL\"=${MINIO_PUBLIC_SSL_FLAG}, \"MinIOPrivateEndPointSSL\"=${MINIO_PRIVATE_SSL_FLAG}, \"MinIOPrivateBucketName\"='${MINIO_PRIVATE_BUCKET_SQL}', \"MinIOPublicBucketName\"='${MINIO_PUBLIC_BUCKET_SQL}', \"MinIORegion\"='${MINIO_REGION_SQL}' WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
    MINIO_CONFIG_VERIFY_SQL="SELECT 'MICROI_MINIO_CONFIG_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 AND \"HDFS\"='MinIO' AND \"MinIOAccessKey\"='${MINIO_ACCESS_KEY_SQL}' AND \"MinIOSecretKey\"='${MINIO_SECRET_KEY_SQL}' AND \"MinIOEndPoint\"='${MINIO_INTERNAL_ENDPOINT_SQL}' AND \"MinIOEndPointInternet\"='${MINIO_INTERNET_ENDPOINT_SQL}' AND \"MinIOEndPointSSL\"=${MINIO_PUBLIC_SSL_FLAG} AND \"MinIOPrivateEndPointSSL\"=${MINIO_PRIVATE_SSL_FLAG} AND \"MinIOPrivateBucketName\"='${MINIO_PRIVATE_BUCKET_SQL}' AND \"MinIOPublicBucketName\"='${MINIO_PUBLIC_BUCKET_SQL}' AND COALESCE(\"MinIORegion\",'')='${MINIO_REGION_SQL}' GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    ;;
esac
echo 'Microi：写入 SaaS 引擎 MinIO 配置...'
if database_exec_sql "${MINIO_CONFIG_SQL}"; then
  MINIO_CONFIG_READBACK=$(database_exec_sql "${MINIO_CONFIG_VERIFY_SQL}" 2>&1 || true)
  if ! printf '%s\n' "${MINIO_CONFIG_READBACK}" | grep -q 'MICROI_MINIO_CONFIG_OK'; then
    echo 'Microi：错误：SaaS 引擎 MinIO 配置写入后回读不一致。'
    exit 1
  fi
  echo 'Microi：SaaS 引擎 MinIO 配置更新并回读一致 ✓'
else
  echo 'Microi：错误：SaaS 引擎 MinIO 配置更新失败。'
  exit 1
fi

SYS_CONFIG_API_BASE="http://${ACCESS_IP}:${API_PORT}"
SYS_CONFIG_FILE_SERVER="${MINIO_PUBLIC_BASE_URL}/${MINIO_PUBLIC_BUCKET}"
case "${DATABASE_CHOICE}" in
  1|2) SYS_CONFIG_SQL="UPDATE sys_config SET ApiBase='${SYS_CONFIG_API_BASE}', FileServer='${SYS_CONFIG_FILE_SERVER}' WHERE IFNULL(IsDeleted, 0) = 0;" ;;
  3) SYS_CONFIG_SQL="UPDATE [dbo].[sys_config] SET [ApiBase]=N'${SYS_CONFIG_API_BASE}', [FileServer]=N'${SYS_CONFIG_FILE_SERVER}' WHERE COALESCE([IsDeleted], 0) = 0;" ;;
  5|6) SYS_CONFIG_SQL="UPDATE \"sys_config\" SET \"ApiBase\"='${SYS_CONFIG_API_BASE}', \"FileServer\"='${SYS_CONFIG_FILE_SERVER}' WHERE COALESCE(\"IsDeleted\", 0) = 0;" ;;
esac
echo 'Microi：写入系统设置 API 与文件服务地址...'
if database_exec_sql "${SYS_CONFIG_SQL}"; then
  echo "Microi：系统设置更新完成：ApiBase=${SYS_CONFIG_API_BASE}, FileServer=${SYS_CONFIG_FILE_SERVER} ✓"
else
  echo 'Microi：错误：系统设置 ApiBase、FileServer 更新失败。'
  exit 1
fi

echo ''
echo '[步骤9/11] MinIO 配置/部署完成 ✓'


# ============================================================
# 步骤10：部署 OCR、可选服务与平台应用
# ============================================================
echo ''
echo '[步骤10/11] 部署 OCR、可选服务与平台应用'
echo '------------------------------------------------------------------'

# --- PaddleX / PaddleOCR ---
echo ''
echo 'Microi：部署 PaddleX/PaddleOCR CPU 文字识别服务（默认安装）'
echo '------------------------------------------------------------------'

OCR_DIR="${COMPOSE_BASE_DIR}/microi-install-ocr"
echo "Microi：OCR 国内镜像: ${OCR_IMAGE}"
echo "Microi：OCR 本机端口: 127.0.0.1:${OCR_PORT}，Docker 内网地址: ${OCR_SERVICE_ENDPOINT}"

echo 'Microi：从吾码杭州镜像源拉取固定版本 OCR 镜像...'
if ! docker pull "${OCR_IMAGE}"; then
  echo 'Microi：错误：OCR 国内镜像拉取失败，安装已停止，SaaS 引擎不会启用 OCR。'
  exit 1
fi
OCR_IMAGE_ARCH=$(docker image inspect "${OCR_IMAGE}" --format '{{.Architecture}}' 2>/dev/null || true)
if [ "${OCR_IMAGE_ARCH}" != "amd64" ]; then
  echo "Microi：错误：OCR 镜像架构应为 amd64，实际回读为 ${OCR_IMAGE_ARCH:-未知}。"
  exit 1
fi
echo 'Microi：OCR 国内镜像已拉取并回读为 linux/amd64 ✓'

mkdir -p "${OCR_DIR}"
cat > "${OCR_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-ocr:
    image: ${OCR_IMAGE}
    container_name: ${OCR_CONTAINER_NAME}
${OCR_COMPOSE_SERVICE_NETWORK}
    init: true
    restart: unless-stopped
    ports:
      - "127.0.0.1:${OCR_PORT}:${OCR_INTERNAL_PORT}"
    shm_size: "4gb"
    cpus: "4.0"
    mem_limit: "8g"
    stop_grace_period: 90s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - microi-ocr-models:/home/microi/.paddlex
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; s=socket.create_connection(('127.0.0.1',${OCR_INTERNAL_PORT}),3); s.close()"]
      interval: 30s
      timeout: 5s
      retries: 10
      start_period: 10m
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"
volumes:
  microi-ocr-models:
    name: microi-ocr-models
${OCR_COMPOSE_EXTERNAL_NETWORKS}
EOF
echo 'Microi：OCR 编排文件已生成 ✓'

compose_up "${OCR_DIR}"
echo 'Microi：等待 OCR 服务完成模型加载并进入 healthy（最长 20 分钟）...'
OCR_READY=0
for _ocr_wait in $(seq 1 120); do
  OCR_RUNNING=$(docker inspect "${OCR_CONTAINER_NAME}" --format '{{.State.Running}}' 2>/dev/null || true)
  OCR_HEALTH=$(docker inspect "${OCR_CONTAINER_NAME}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)
  if [ "${OCR_HEALTH}" = "healthy" ]; then
    OCR_READY=1
    break
  fi
  if [ "${OCR_RUNNING}" = "false" ]; then
    echo 'Microi：错误：OCR 容器在初始化期间退出。'
    docker logs "${OCR_CONTAINER_NAME}" 2>&1 | tail -100 || true
    exit 1
  fi
  if [ $((_ocr_wait % 6)) -eq 0 ]; then
    echo "Microi：OCR 模型加载中... ($((_ocr_wait * 10))/1200 秒，状态 ${OCR_HEALTH:-未知})"
  fi
  sleep 10
done
if [ "${OCR_READY}" != "1" ]; then
  echo 'Microi：错误：OCR 服务在 20 分钟内未进入 healthy，SaaS 引擎不会启用 OCR。'
  docker logs "${OCR_CONTAINER_NAME}" 2>&1 | tail -100 || true
  exit 1
fi
echo 'Microi：OCR 服务健康检查通过 ✓'

# 原 Ollama、nomic-embed-text、Qdrant 部署步骤完整保留，但固定注释，不参与一键安装。
: <<'MICROI_DISABLED_VECTOR_DEPLOYMENT'
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  echo 'Microi：已选择安装向量检索增强，将部署 Ollama、nomic-embed-text 与 Qdrant。'
  echo ''
  echo 'Microi：部署 Ollama AI 服务'
  echo '------------------------------------------------------------------'

  OLLAMA_DIR="${COMPOSE_BASE_DIR}/microi-install-ollama"

  echo "Microi：Ollama 端口: ${OLLAMA_PORT}"

  mkdir -p "${OLLAMA_DIR}"
  cat > "${OLLAMA_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-ollama:
    image: registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest
    container_name: microi-install-ollama
${COMPOSE_SERVICE_NETWORK}
    restart: always
    ports:
      - "${OLLAMA_PORT}:11434"
    volumes:
      - /microi/ollama/data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    healthcheck:
      test: ["CMD", "/bin/sh", "-c", "ollama list || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
  echo "Microi：Ollama 编排文件已生成 ✓"

  compose_up "${OLLAMA_DIR}"

  echo 'Microi：等待 Ollama 就绪并下载 nomic-embed-text 模型...'
  OLLAMA_READY=0
  for _ollama_wait in $(seq 1 30); do
    if docker exec microi-install-ollama ollama list > /dev/null 2>&1; then
      OLLAMA_READY=1
      break
    fi
    sleep 2
  done
  if [ "${OLLAMA_READY}" != "1" ]; then
    echo 'Microi：错误：Ollama 在 60 秒内未就绪，无法下载 nomic-embed-text。'
    docker logs microi-install-ollama 2>&1 | tail -50 || true
    exit 1
  fi
  if docker exec microi-install-ollama ollama pull nomic-embed-text; then
    echo 'Microi：nomic-embed-text 模型下载完成 ✓'
  else
    echo 'Microi：错误：nomic-embed-text 模型下载失败。'
    exit 1
  fi

  echo ''
  echo 'Microi：Ollama 与 nomic-embed-text 部署完成 ✓'

  # --- Qdrant ---
  echo ''
  echo 'Microi：部署 Qdrant 向量数据库'
  echo '------------------------------------------------------------------'

  QDRANT_DIR="${COMPOSE_BASE_DIR}/microi-install-qdrant"

  echo "Microi：Qdrant HTTP端口: ${QDRANT_HTTP_PORT}, gRPC端口: ${QDRANT_GRPC_PORT}, API Key: ${QDRANT_API_KEY}"

  mkdir -p "${QDRANT_DIR}"
  cat > "${QDRANT_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-qdrant:
    image: registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest
    container_name: microi-install-qdrant
${COMPOSE_SERVICE_NETWORK}
    restart: unless-stopped
    ports:
      - "${QDRANT_HTTP_PORT}:6333"
      - "${QDRANT_GRPC_PORT}:6334"
    volumes:
      - /microi/qdrant/storage:/qdrant/storage
      - /microi/qdrant/snapshots:/qdrant/snapshots
      - /microi/qdrant/config:/qdrant/config
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
      - QDRANT__SERVICE__ENABLE_TLS=false
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4
      - QDRANT__STORAGE__PERFORMANCE__MAX_OPTIMIZATION_THREADS=2
      - QDRANT__STORAGE__PERFORMANCE__UPDATE_QUEUE_SIZE=100
      - QDRANT__STORAGE__HNSW_INDEX__M=16
      - QDRANT__STORAGE__HNSW_INDEX__EF_CONSTRUCT=100
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true
      - QDRANT__STORAGE__MMAP_THRESHOLD_KB=102400
      - QDRANT__STORAGE__WAL__WAL_CAPACITY_MB=32
      - QDRANT__STORAGE__WAL__WAL_SEGMENTS_AHEAD=0
      - QDRANT__STORAGE__SNAPSHOT_PATH=/qdrant/snapshots
      - QDRANT__LOG_LEVEL=INFO
      - QDRANT__CLUSTER__ENABLED=false
      - QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB=102400
      - QDRANT__STORAGE__OPTIMIZERS__INDEXING_THRESHOLD_KB=20480
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "com.microi.service=qdrant"
      - "com.microi.description=Qdrant Vector Database for AI"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
  echo "Microi：Qdrant 编排文件已生成 ✓"

  compose_up "${QDRANT_DIR}"

  echo ''
  echo 'Microi：Qdrant 部署完成 ✓'
else
  echo 'Microi：使用平台内置轻量 Schema 搜索，跳过 Ollama、nomic-embed-text 与 Qdrant。'
fi
MICROI_DISABLED_VECTOR_DEPLOYMENT
echo 'Microi：已固定跳过 Ollama、nomic-embed-text 与 Qdrant。'

# --- LibreTranslate ---
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  echo ''
  echo 'Microi：部署 LibreTranslate 开源翻译服务'
  echo '------------------------------------------------------------------'

  LIBRETRANSLATE_DIR="${COMPOSE_BASE_DIR}/microi-install-libretranslate"
  echo "Microi：LibreTranslate 端口: ${LIBRETRANSLATE_PORT}"
  echo "Microi：LibreTranslate 加载语言: ${LIBRETRANSLATE_LANGS_CSV}"

  mkdir -p "${LIBRETRANSLATE_DIR}" /microi/libretranslate/models /microi/libretranslate/api-keys
  cat > "${LIBRETRANSLATE_DIR}/docker-compose.yml" <<EOF
services:
  microi-translate:
    image: ${LIBRETRANSLATE_IMAGE}
    container_name: ${LIBRETRANSLATE_CONTAINER_NAME}
${OCR_COMPOSE_SERVICE_NETWORK}
    user: "0:0"
    security_opt:
      - apparmor=unconfined
    volumes:
      - /microi/libretranslate/models:/home/libretranslate/.local
      - /microi/libretranslate/api-keys:/app/db
    environment:
      - LT_UPDATE_MODELS=true
      - LT_LOAD_ONLY=${LIBRETRANSLATE_LANGS_CSV}
      - LT_API_KEYS=true
      - LT_API_KEYS_DB_PATH=/app/db/api_keys.db
      - LT_WORKERS=1
      - LT_TIMEOUT=120
    ports:
      - "127.0.0.1:${LIBRETRANSLATE_PORT}:${LIBRETRANSLATE_INTERNAL_PORT}"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: unless-stopped
    tty: true
    stdin_open: true
${OCR_COMPOSE_EXTERNAL_NETWORKS}
EOF
  echo 'Microi：LibreTranslate 编排文件已生成 ✓'

  # 语言模型可能需要数小时下载，不能阻塞吾码主体安装。先独立创建 API Key
  # 数据库并写入随机 Key，正式容器启动后可直接复用；模型由容器后台初始化。
  echo 'Microi：初始化 LibreTranslate 随机 API Key...'
  if ! printf '%s' "${LIBRETRANSLATE_API_KEY}" | docker run --rm -i \
    --user '0:0' \
    -v /microi/libretranslate/api-keys:/app/db \
    --entrypoint ./venv/bin/python \
    "${LIBRETRANSLATE_IMAGE}" -c \
    'import sys; from libretranslate.api_keys import Database; key = sys.stdin.read(); assert key; db = Database("/app/db/api_keys.db"); db.add(1000000, key); assert db.lookup(key) is not None' \
    > /dev/null; then
    echo 'Microi：错误：LibreTranslate 随机 API Key 初始化失败。'
    exit 1
  fi
  if [ ! -s /microi/libretranslate/api-keys/api_keys.db ]; then
    echo 'Microi：错误：LibreTranslate API Key 数据库未生成。'
    exit 1
  fi
  echo 'Microi：LibreTranslate 随机 API Key 初始化完成 ✓'

  compose_up "${LIBRETRANSLATE_DIR}"
  if [ "$(docker inspect "${LIBRETRANSLATE_CONTAINER_NAME}" --format '{{.State.Running}}' 2>/dev/null)" != "true" ]; then
    echo 'Microi：错误：LibreTranslate 容器启动失败。'
    docker logs "${LIBRETRANSLATE_CONTAINER_NAME}" 2>&1 | tail -100 || true
    exit 1
  fi

  echo ''
  echo 'Microi：LibreTranslate 翻译服务已安装并启动 ✓'

  TRANSLATE_SERVICE_URL="${LIBRETRANSLATE_SERVICE_ENDPOINT}"
  echo 'Microi：LibreTranslate 配置将在 API 完成 Upgrade31 后写入并回读，旧数据库不会提前访问不存在的字段 ✓'
else
  echo 'Microi：已选择不安装 LibreTranslate，跳过翻译服务。'
fi

# --- 平台应用（API + Web）---
echo ''
echo 'Microi：部署平台应用（API + Web）'
echo '------------------------------------------------------------------'

APP_DIR="${COMPOSE_BASE_DIR}/microi-install-app"

case "${DATABASE_CHOICE}" in
  1|2)
    if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
      MYSQL_CONNECTION_USER=$(repair_encode_connection_value "${DATABASE_USER}")
      MYSQL_CONNECTION_PASSWORD=$(repair_encode_connection_value "${DATABASE_PASSWORD}")
      OS_CLIENT_DB_CONN="Data Source=${MYSQL_EXTERNAL_CONNECTION_HOST};Database=${DATABASE_NAME};User Id=${MYSQL_CONNECTION_USER};Password=${MYSQL_CONNECTION_PASSWORD};Port=${DATABASE_PORT};Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;SslMode=Preferred;"
    else
      OS_CLIENT_DB_CONN="Data Source=${DATABASE_CONTAINER_NAME};Database=${DATABASE_NAME};User Id=root;Password=${DATABASE_PASSWORD};Port=${DATABASE_INTERNAL_PORT};Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;"
    fi
    ;;
  3)
    OS_CLIENT_DB_CONN="Data Source=${DATABASE_CONTAINER_NAME},${DATABASE_INTERNAL_PORT};Initial Catalog=${DATABASE_NAME};User ID=sa;Password=${DATABASE_PASSWORD};Encrypt=False;TrustServerCertificate=True;Max Pool Size=500;"
    ;;
  5)
    OS_CLIENT_DB_CONN="Server=${DATABASE_CONTAINER_NAME};Port=${DATABASE_INTERNAL_PORT};User Id=SYSDBA;Password=${DATABASE_PASSWORD};Schema=SYSDBA;"
    ;;
  6)
    OS_CLIENT_DB_CONN="Host=${DATABASE_CONTAINER_NAME};Port=${DATABASE_INTERNAL_PORT};Database=${DATABASE_NAME};Username=postgres;Password=${DATABASE_PASSWORD};Pooling=true;Maximum Pool Size=500;"
    ;;
esac

compose_yaml_double_quote() {
  local value="$1"
  local escaped=""
  case "${value}" in
    *$'\r'*|*$'\n'*) return 1 ;;
  esac
  escaped="${value//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//\$/\$\$}"
  printf '"%s"' "${escaped}"
}
OS_CLIENT_DB_CONN_ENV_ENTRY=$(compose_yaml_double_quote "OsClientDbConn=${OS_CLIENT_DB_CONN}")

echo "Microi：Web端口: ${VUE_PORT}, API端口: ${API_PORT}"
if [ "${APP_API_PULL_POLICY}" = "always" ] || [ "${APP_CLIENT_PULL_POLICY}" = "always" ]; then
  echo 'Microi：API/Web 的官方浮动标签将强制回源拉取最新镜像，避免复用本机旧 latest。'
fi
if [ "${APP_API_PULL_POLICY}" = "never" ] || [ "${APP_CLIENT_PULL_POLICY}" = "never" ]; then
  echo 'Microi：检测到安装验收镜像覆盖；被覆盖的镜像仅使用本机指定版本，不访问远端仓库。'
fi

mkdir -p "${APP_DIR}"
cat > "${APP_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-api:
    image: ${API_IMAGE}
    pull_policy: ${APP_API_PULL_POLICY}
    container_name: microi-install-api
    labels:
      com.microi.database.mode: ${DATABASE_SERVICE_MODE}
      com.microi.minio.mode: ${MINIO_SERVICE_MODE}
${APP_API_SERVICE_NETWORK}
${APP_API_EXTRA_HOSTS}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${API_PORT}:80"
    environment:
      - OsClient=${OS_CLIENT}
      - OsClientType=${RUNTIME_OS_CLIENT_TYPE}
      - OsClientNetwork=${RUNTIME_OS_CLIENT_NETWORK}
      - OsClientDbType=${DATABASE_TYPE}
      - ${OS_CLIENT_DB_CONN_ENV_ENTRY}
      - OsClientRedisHost=microi-install-redis
      - OsClientRedisPort=6379
      - OsClientRedisPwd=${REDIS_PASSWORD}
      - OsClientRedisDataBase=5
      - OsClientDbMongoConn=mongodb://root:${MONGO_ROOT_PASSWORD}@microi-install-mongodb:27017/?authSource=admin
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"

  microi-install-client:
    image: ${CLIENT_IMAGE}
    pull_policy: ${APP_CLIENT_PULL_POLICY}
    container_name: microi-install-client
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "${VUE_PORT}:80"
    environment:
      - OsClient=
      - ApiBase=http://${ACCESS_IP}:${API_PORT}
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${APP_COMPOSE_EXTERNAL_NETWORKS}
EOF
chmod 600 "${APP_DIR}/docker-compose.yml"
echo "Microi：平台应用编排文件已生成 ✓"

compose_up "${APP_DIR}"

wait_for_microi_api() {
  local probe_path="$1"
  local probe_name="$2"
  local max_attempts="$3"
  local probe_url="http://127.0.0.1:${API_PORT}${probe_path}"
  local _api_wait
  for _api_wait in $(seq 1 "${max_attempts}"); do
    if curl --fail --silent --show-error --max-time 5 "${probe_url}" > /dev/null 2>&1; then
      echo "Microi：API ${probe_name}检查通过：${probe_url} ✓"
      return 0
    fi
    if [ "$(docker inspect microi-install-api --format '{{.State.Running}}' 2>/dev/null || true)" = "false" ]; then
      echo "Microi：错误：API 容器在等待 ${probe_name}期间退出。"
      docker logs microi-install-api 2>&1 | tail -100 || true
      return 1
    fi
    if [ $((_api_wait % 15)) -eq 0 ]; then
      echo "Microi：等待 API ${probe_name}中... ($((_api_wait * 2)) 秒)"
    fi
    sleep 2
  done
  echo "Microi：错误：API ${probe_name}在 $((max_attempts * 2)) 秒内未通过。"
  docker logs microi-install-api 2>&1 | tail -100 || true
  return 1
}

# Upgrade29 由 API 启动升级租约幂等创建 SaaS 引擎 OCR Tab 与 9 个字段。
# 先等进程存活，再从共享数据库回读物理字段，绝不依据日志文案猜测迁移成功。
if ! wait_for_microi_api '/api/Diagnostics/liveness' '存活' 180; then
  exit 1
fi
API_LIVENESS_READY=1

case "${DATABASE_CHOICE}" in
  1|2)
    OCR_SCHEMA_VERIFY_SQL="SELECT 'MICROI_OCR_SCHEMA_OK' AS Marker FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sys_osclients' AND column_name IN ('OcrEnabled','OcrProvider','OcrEndpoint','OcrApiKey','OcrHeadersJson','OcrTimeoutSeconds','OcrMaxFileMB','OcrMaxPages','OcrMinConfidence') HAVING COUNT(DISTINCT column_name)=9;"
    OCR_TENANT_VERIFY_SQL="SELECT 'MICROI_OCR_TENANT_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
    OCR_CONFIG_SQL="UPDATE sys_osclients SET OcrEnabled=1, OcrProvider='PaddleX', OcrEndpoint='${OCR_SERVICE_ENDPOINT}', OcrApiKey='', OcrHeadersJson='{}', OcrTimeoutSeconds=120, OcrMaxFileMB=20, OcrMaxPages=10, OcrMinConfidence=0 WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0;"
    OCR_CONFIG_VERIFY_SQL="SELECT 'MICROI_OCR_CONFIG_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND OcrEnabled=1 AND OcrProvider='PaddleX' AND OcrEndpoint='${OCR_SERVICE_ENDPOINT}' AND IFNULL(OcrApiKey,'')='' AND OcrHeadersJson='{}' AND OcrTimeoutSeconds=120 AND OcrMaxFileMB=20 AND OcrMaxPages=10 AND OcrMinConfidence=0 AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
    ;;
  3)
    OCR_SCHEMA_VERIFY_SQL="IF (SELECT COUNT(DISTINCT c.[name]) FROM sys.columns c INNER JOIN sys.objects o ON c.[object_id]=o.[object_id] WHERE o.[name]=N'sys_osclients' AND SCHEMA_NAME(o.[schema_id])=N'dbo' AND c.[name] IN (N'OcrEnabled',N'OcrProvider',N'OcrEndpoint',N'OcrApiKey',N'OcrHeadersJson',N'OcrTimeoutSeconds',N'OcrMaxFileMB',N'OcrMaxPages',N'OcrMinConfidence'))=9 SELECT N'MICROI_OCR_SCHEMA_OK' AS Marker;"
    OCR_TENANT_VERIFY_SQL="SELECT N'MICROI_OCR_TENANT_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
    OCR_CONFIG_SQL="UPDATE [dbo].[sys_osclients] SET [OcrEnabled]=1, [OcrProvider]=N'PaddleX', [OcrEndpoint]=N'${OCR_SERVICE_ENDPOINT}', [OcrApiKey]=N'', [OcrHeadersJson]=N'{}', [OcrTimeoutSeconds]=120, [OcrMaxFileMB]=20, [OcrMaxPages]=10, [OcrMinConfidence]=0 WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0;"
    OCR_CONFIG_VERIFY_SQL="SELECT N'MICROI_OCR_CONFIG_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND [OcrEnabled]=1 AND [OcrProvider]=N'PaddleX' AND [OcrEndpoint]=N'${OCR_SERVICE_ENDPOINT}' AND COALESCE([OcrApiKey],N'')=N'' AND [OcrHeadersJson]=N'{}' AND [OcrTimeoutSeconds]=120 AND [OcrMaxFileMB]=20 AND [OcrMaxPages]=10 AND [OcrMinConfidence]=0 AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
    ;;
  5)
    OCR_SCHEMA_VERIFY_SQL="SELECT 'MICROI_OCR_SCHEMA_OK' AS Marker FROM USER_TAB_COLUMNS WHERE UPPER(TABLE_NAME)='SYS_OSCLIENTS' AND UPPER(COLUMN_NAME) IN ('OCRENABLED','OCRPROVIDER','OCRENDPOINT','OCRAPIKEY','OCRHEADERSJSON','OCRTIMEOUTSECONDS','OCRMAXFILEMB','OCRMAXPAGES','OCRMINCONFIDENCE') HAVING COUNT(DISTINCT UPPER(COLUMN_NAME))=9;"
    OCR_TENANT_VERIFY_SQL="SELECT 'MICROI_OCR_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    OCR_CONFIG_SQL="UPDATE \"sys_osclients\" SET \"OcrEnabled\"=1, \"OcrProvider\"='PaddleX', \"OcrEndpoint\"='${OCR_SERVICE_ENDPOINT}', \"OcrApiKey\"='', \"OcrHeadersJson\"='{}', \"OcrTimeoutSeconds\"=120, \"OcrMaxFileMB\"=20, \"OcrMaxPages\"=10, \"OcrMinConfidence\"=0 WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
    OCR_CONFIG_VERIFY_SQL="SELECT 'MICROI_OCR_CONFIG_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND \"OcrEnabled\"=1 AND \"OcrProvider\"='PaddleX' AND \"OcrEndpoint\"='${OCR_SERVICE_ENDPOINT}' AND COALESCE(\"OcrApiKey\",'')='' AND \"OcrHeadersJson\"='{}' AND \"OcrTimeoutSeconds\"=120 AND \"OcrMaxFileMB\"=20 AND \"OcrMaxPages\"=10 AND \"OcrMinConfidence\"=0 AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    ;;
  6)
    OCR_SCHEMA_VERIFY_SQL="SELECT 'MICROI_OCR_SCHEMA_OK' AS Marker WHERE (SELECT COUNT(DISTINCT column_name) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='sys_osclients' AND column_name IN ('OcrEnabled','OcrProvider','OcrEndpoint','OcrApiKey','OcrHeadersJson','OcrTimeoutSeconds','OcrMaxFileMB','OcrMaxPages','OcrMinConfidence'))=9;"
    OCR_TENANT_VERIFY_SQL="SELECT 'MICROI_OCR_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    OCR_CONFIG_SQL="UPDATE \"sys_osclients\" SET \"OcrEnabled\"=1, \"OcrProvider\"='PaddleX', \"OcrEndpoint\"='${OCR_SERVICE_ENDPOINT}', \"OcrApiKey\"='', \"OcrHeadersJson\"='{}', \"OcrTimeoutSeconds\"=120, \"OcrMaxFileMB\"=20, \"OcrMaxPages\"=10, \"OcrMinConfidence\"=0 WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
    OCR_CONFIG_VERIFY_SQL="SELECT 'MICROI_OCR_CONFIG_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND \"OcrEnabled\"=1 AND \"OcrProvider\"='PaddleX' AND \"OcrEndpoint\"='${OCR_SERVICE_ENDPOINT}' AND COALESCE(\"OcrApiKey\",'')='' AND \"OcrHeadersJson\"='{}' AND \"OcrTimeoutSeconds\"=120 AND \"OcrMaxFileMB\"=20 AND \"OcrMaxPages\"=10 AND \"OcrMinConfidence\"=0 AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
    ;;
esac

echo 'Microi：等待 Upgrade29 创建 SaaS 引擎 OCR 字段（最长 15 秒）...'
OCR_SCHEMA_READY=0
for _ocr_schema_wait in $(seq 1 15); do
  OCR_SCHEMA_READBACK=$(database_exec_sql "${OCR_SCHEMA_VERIFY_SQL}" 2>&1 || true)
  if printf '%s\n' "${OCR_SCHEMA_READBACK}" | grep -q 'MICROI_OCR_SCHEMA_OK'; then
    OCR_SCHEMA_READY=1
    break
  fi
  if [ "${_ocr_schema_wait}" -lt 15 ]; then
    sleep 1
  fi
done
if [ "${OCR_SCHEMA_READY}" != "1" ]; then
  echo 'Microi：错误：API 已启动，但 15 秒内未能从数据库回读全部 9 个 OCR 字段。'
  echo "Microi：请确认当前 API 镜像 ${API_IMAGE} 已包含 Upgrade29；脚本不会直接绕过平台迁移修改元数据，也不会启用 OCR。"
  exit 1
fi
echo 'Microi：SaaS 引擎 OCR 物理字段回读通过 ✓'

OCR_TENANT_READBACK=$(database_exec_sql "${OCR_TENANT_VERIFY_SQL}" 2>&1 || true)
if ! printf '%s\n' "${OCR_TENANT_READBACK}" | grep -q 'MICROI_OCR_TENANT_OK'; then
  echo "Microi：错误：活动 OsClient=${OS_CLIENT} 记录不是唯一一条，已停止 OCR 配置，避免误改多个租户。"
  exit 1
fi

echo 'Microi：写入当前 SaaS 租户 OCR 配置...'
if ! database_exec_sql "${OCR_CONFIG_SQL}" > /dev/null; then
  echo 'Microi：错误：SaaS 引擎 OCR 配置更新失败。'
  exit 1
fi
OCR_CONFIG_READBACK=$(database_exec_sql "${OCR_CONFIG_VERIFY_SQL}" 2>&1 || true)
if ! printf '%s\n' "${OCR_CONFIG_READBACK}" | grep -q 'MICROI_OCR_CONFIG_OK'; then
  echo 'Microi：错误：SaaS 引擎 OCR 配置写入后回读不一致。'
  exit 1
fi
OCR_SAAS_CONFIG_READY=1
echo "Microi：SaaS 引擎 OCR 配置回读一致：Provider=PaddleX, Endpoint=${OCR_SERVICE_ENDPOINT} ✓"

if [ "${INSTALL_LIBRETRANSLATE}" = "1" ]; then
  case "${DATABASE_CHOICE}" in
    1|2)
      TRANSLATE_SCHEMA_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_SCHEMA_OK' AS Marker FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='sys_osclients' AND column_name IN ('TranslateProvider','TranslateUrl','TranslateApiKey','TranslateTimeout') HAVING COUNT(DISTINCT column_name)=4;"
      TRANSLATE_TENANT_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_TENANT_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
      TRANSLATE_CONFIG_SQL="UPDATE sys_osclients SET TranslateProvider='LibreTranslate', TranslateUrl='${TRANSLATE_SERVICE_URL}', TranslateApiKey='${LIBRETRANSLATE_API_KEY}', TranslateTimeout=120 WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0;"
      TRANSLATE_CONFIG_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_CONFIG_OK' AS Marker FROM sys_osclients WHERE OsClient='${OS_CLIENT}' AND OsClientType='${RUNTIME_OS_CLIENT_TYPE}' AND OsClientNetwork='${RUNTIME_OS_CLIENT_NETWORK}' AND TranslateProvider='LibreTranslate' AND TranslateUrl='${TRANSLATE_SERVICE_URL}' AND TranslateApiKey='${LIBRETRANSLATE_API_KEY}' AND TranslateTimeout=120 AND IFNULL(IsEnable,0)=1 AND IFNULL(IsDeleted,0)=0 GROUP BY OsClient,OsClientType,OsClientNetwork HAVING COUNT(*)=1;"
      ;;
    3)
      TRANSLATE_SCHEMA_VERIFY_SQL="IF (SELECT COUNT(DISTINCT c.[name]) FROM sys.columns c INNER JOIN sys.objects o ON c.[object_id]=o.[object_id] WHERE o.[name]=N'sys_osclients' AND SCHEMA_NAME(o.[schema_id])=N'dbo' AND c.[name] IN (N'TranslateProvider',N'TranslateUrl',N'TranslateApiKey',N'TranslateTimeout'))=4 SELECT N'MICROI_TRANSLATE_SCHEMA_OK' AS Marker;"
      TRANSLATE_TENANT_VERIFY_SQL="SELECT N'MICROI_TRANSLATE_TENANT_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
      TRANSLATE_CONFIG_SQL="UPDATE [dbo].[sys_osclients] SET [TranslateProvider]=N'LibreTranslate', [TranslateUrl]=N'${TRANSLATE_SERVICE_URL}', [TranslateApiKey]=N'${LIBRETRANSLATE_API_KEY}', [TranslateTimeout]=120 WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0;"
      TRANSLATE_CONFIG_VERIFY_SQL="SELECT N'MICROI_TRANSLATE_CONFIG_OK' AS Marker FROM [dbo].[sys_osclients] WHERE [OsClient]=N'${OS_CLIENT}' AND [OsClientType]=N'${RUNTIME_OS_CLIENT_TYPE}' AND [OsClientNetwork]=N'${RUNTIME_OS_CLIENT_NETWORK}' AND [TranslateProvider]=N'LibreTranslate' AND [TranslateUrl]=N'${TRANSLATE_SERVICE_URL}' AND [TranslateApiKey]=N'${LIBRETRANSLATE_API_KEY}' AND [TranslateTimeout]=120 AND COALESCE([IsEnable],0)=1 AND COALESCE([IsDeleted],0)=0 GROUP BY [OsClient],[OsClientType],[OsClientNetwork] HAVING COUNT(*)=1;"
      ;;
    5)
      TRANSLATE_SCHEMA_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_SCHEMA_OK' AS Marker FROM USER_TAB_COLUMNS WHERE UPPER(TABLE_NAME)='SYS_OSCLIENTS' AND UPPER(COLUMN_NAME) IN ('TRANSLATEPROVIDER','TRANSLATEURL','TRANSLATEAPIKEY','TRANSLATETIMEOUT') HAVING COUNT(DISTINCT UPPER(COLUMN_NAME))=4;"
      TRANSLATE_TENANT_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
      TRANSLATE_CONFIG_SQL="UPDATE \"sys_osclients\" SET \"TranslateProvider\"='LibreTranslate', \"TranslateUrl\"='${TRANSLATE_SERVICE_URL}', \"TranslateApiKey\"='${LIBRETRANSLATE_API_KEY}', \"TranslateTimeout\"=120 WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
      TRANSLATE_CONFIG_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_CONFIG_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND \"TranslateProvider\"='LibreTranslate' AND \"TranslateUrl\"='${TRANSLATE_SERVICE_URL}' AND \"TranslateApiKey\"='${LIBRETRANSLATE_API_KEY}' AND \"TranslateTimeout\"=120 AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
      ;;
    6)
      TRANSLATE_SCHEMA_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_SCHEMA_OK' AS Marker WHERE (SELECT COUNT(DISTINCT column_name) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='sys_osclients' AND column_name IN ('TranslateProvider','TranslateUrl','TranslateApiKey','TranslateTimeout'))=4;"
      TRANSLATE_TENANT_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_TENANT_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
      TRANSLATE_CONFIG_SQL="UPDATE \"sys_osclients\" SET \"TranslateProvider\"='LibreTranslate', \"TranslateUrl\"='${TRANSLATE_SERVICE_URL}', \"TranslateApiKey\"='${LIBRETRANSLATE_API_KEY}', \"TranslateTimeout\"=120 WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0;"
      TRANSLATE_CONFIG_VERIFY_SQL="SELECT 'MICROI_TRANSLATE_CONFIG_OK' AS Marker FROM \"sys_osclients\" WHERE \"OsClient\"='${OS_CLIENT}' AND \"OsClientType\"='${RUNTIME_OS_CLIENT_TYPE}' AND \"OsClientNetwork\"='${RUNTIME_OS_CLIENT_NETWORK}' AND \"TranslateProvider\"='LibreTranslate' AND \"TranslateUrl\"='${TRANSLATE_SERVICE_URL}' AND \"TranslateApiKey\"='${LIBRETRANSLATE_API_KEY}' AND \"TranslateTimeout\"=120 AND COALESCE(\"IsEnable\",0)=1 AND COALESCE(\"IsDeleted\",0)=0 GROUP BY \"OsClient\",\"OsClientType\",\"OsClientNetwork\" HAVING COUNT(*)=1;"
      ;;
  esac

  echo 'Microi：等待 Upgrade31 创建 SaaS 引擎翻译字段（最长 15 秒）...'
  TRANSLATE_SCHEMA_READY=0
  for _translate_schema_wait in $(seq 1 15); do
    TRANSLATE_SCHEMA_READBACK=$(database_exec_sql "${TRANSLATE_SCHEMA_VERIFY_SQL}" 2>&1 || true)
    if printf '%s\n' "${TRANSLATE_SCHEMA_READBACK}" | grep -q 'MICROI_TRANSLATE_SCHEMA_OK'; then
      TRANSLATE_SCHEMA_READY=1
      break
    fi
    if [ "${_translate_schema_wait}" -lt 15 ]; then
      sleep 1
    fi
  done
  if [ "${TRANSLATE_SCHEMA_READY}" != "1" ]; then
    echo 'Microi：错误：API 已启动，但 15 秒内未能从数据库回读全部 4 个 LibreTranslate 配置字段。'
    echo 'Microi：请确认当前 microi-api 镜像已包含 Upgrade31；脚本不会绕过平台迁移直接伪造 diy_field 元数据。'
    exit 1
  fi

  TRANSLATE_TENANT_READBACK=$(database_exec_sql "${TRANSLATE_TENANT_VERIFY_SQL}" 2>&1 || true)
  if ! printf '%s\n' "${TRANSLATE_TENANT_READBACK}" | grep -q 'MICROI_TRANSLATE_TENANT_OK'; then
    echo 'Microi：错误：当前活动主租户不唯一，已停止 LibreTranslate 配置写入。'
    exit 1
  fi
  echo 'Microi：写入 SaaS 引擎 LibreTranslate 配置...'
  if ! database_exec_sql "${TRANSLATE_CONFIG_SQL}" > /dev/null; then
    echo 'Microi：错误：SaaS 引擎 LibreTranslate 配置更新失败。'
    exit 1
  fi
  TRANSLATE_CONFIG_READBACK=$(database_exec_sql "${TRANSLATE_CONFIG_VERIFY_SQL}" 2>&1 || true)
  if ! printf '%s\n' "${TRANSLATE_CONFIG_READBACK}" | grep -q 'MICROI_TRANSLATE_CONFIG_OK'; then
    echo 'Microi：错误：SaaS 引擎 LibreTranslate 配置写入后回读不一致。'
    exit 1
  fi
  TRANSLATE_SAAS_CONFIG_READY=1
  echo "Microi：SaaS 引擎翻译配置回读一致：Provider=LibreTranslate, Url=${TRANSLATE_SERVICE_URL} ✓"
fi

# Upgrade29/31 是启动前置不变量，字段先出现并不代表完整平台升级链已经成功。
# 必须等待 ServerVersion 推进到本脚本要求的最低版本，避免应用商城等中间迁移
# 失败时仍把安装误报为成功，也避免紧接着重启 API 打断尚未完成的升级事务。
case "${DATABASE_CHOICE}" in
  1|2)
    PLATFORM_VERSION_READ_SQL="SELECT ServerVersion FROM sys_config WHERE IsEnable=1 ORDER BY Id LIMIT 1;"
    ;;
  3)
    PLATFORM_VERSION_READ_SQL="SELECT TOP 1 [ServerVersion] FROM [dbo].[sys_config] WHERE [IsEnable]=1 ORDER BY [Id];"
    ;;
  5)
    PLATFORM_VERSION_READ_SQL='SELECT "ServerVersion" FROM "sys_config" WHERE "IsEnable"=1 ORDER BY "Id" FETCH FIRST 1 ROWS ONLY;'
    ;;
  6)
    PLATFORM_VERSION_READ_SQL='SELECT "ServerVersion" FROM "sys_config" WHERE "IsEnable"=1 ORDER BY "Id" LIMIT 1;'
    ;;
esac

echo "Microi：等待平台完整升级链推进到 ServerVersion>=${MINIMUM_PLATFORM_SERVER_VERSION}（最长 10 分钟）..."
PLATFORM_UPGRADE_READY=0
PLATFORM_SERVER_VERSION=''
for _platform_upgrade_wait in $(seq 1 120); do
  PLATFORM_VERSION_READBACK=$(database_exec_sql "${PLATFORM_VERSION_READ_SQL}" 2>&1 || true)
  PLATFORM_SERVER_VERSION=$(printf '%s\n' "${PLATFORM_VERSION_READBACK}" \
    | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
    | tail -n 1 || true)
  if version_at_least "${PLATFORM_SERVER_VERSION}" "${MINIMUM_PLATFORM_SERVER_VERSION}"; then
    PLATFORM_UPGRADE_READY=1
    break
  fi
  if [ $((_platform_upgrade_wait % 6)) -eq 0 ]; then
    echo "Microi：平台升级仍在进行，当前 ServerVersion=${PLATFORM_SERVER_VERSION:-未回读}..."
  fi
  sleep 5
done
if [ "${PLATFORM_UPGRADE_READY}" != "1" ]; then
  echo "Microi：错误：10 分钟内平台 ServerVersion 未达到 ${MINIMUM_PLATFORM_SERVER_VERSION}，当前=${PLATFORM_SERVER_VERSION:-未回读}。"
  echo 'Microi：平台自动升级链可能在中间迁移失败；脚本已停止，禁止把部分完成状态误报为安装成功。请查看 API 容器日志及系统错误日志。'
  exit 1
fi
echo "Microi：平台完整升级链回读通过：ServerVersion=${PLATFORM_SERVER_VERSION} ✓"

# SaaS 租户配置在 API 启动时加载。安全重启单个新安装节点使 OCR/翻译设置立即生效，
# 不影响 OCR 服务；多节点既有环境仍应按官方滚动发布流程逐节点刷新。
echo 'Microi：重启新安装 API，使已回读的 OCR/翻译租户配置立即生效...'
if ! docker restart microi-install-api > /dev/null; then
  echo 'Microi：错误：API 重启失败。'
  exit 1
fi
if ! wait_for_microi_api '/api/Diagnostics/health' '就绪' 180; then
  exit 1
fi
API_READINESS_READY=1

echo ''
echo 'Microi：平台应用（API + Web）部署完成 ✓'

echo ''
echo '[步骤10/11] OCR、可选服务与平台应用部署完成 ✓'


# ============================================================
# 步骤11：部署 Watchtower 自动更新
# ============================================================
echo ''
echo '[步骤11/11] 部署 Watchtower 自动更新'
echo '------------------------------------------------------------------'

WATCHTOWER_DIR="${COMPOSE_BASE_DIR}/microi-install-watchtower"

echo "Microi：Watchtower 监控容器: microi-install-api, microi-install-client"

mkdir -p "${WATCHTOWER_DIR}"
cat > "${WATCHTOWER_DIR}/docker-compose.yml" <<EOF
services:
  microi-install-watchtower:
    image: registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest
    container_name: microi-install-watchtower
${COMPOSE_SERVICE_NETWORK}
    restart: always
    privileged: true
    tty: true
    stdin_open: true
    environment:
      - DOCKER_API_VERSION=1.40
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    # The upstream default is 86400 seconds. A five-minute poll keeps patch
    # releases timely while rolling-restart avoids taking both monitored
    # services down together.
    command: --interval 300 --rolling-restart microi-install-api microi-install-client
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
echo "Microi：Watchtower 编排文件已生成 ✓"

compose_up "${WATCHTOWER_DIR}"

echo ''
echo '[步骤11/11] Watchtower 部署完成 ✓'


# ============================================================
# 输出所有服务信息
# ============================================================
INSTALL_SUMMARY_PRINTED=1
echo ''
echo ''
echo '=================================================================='
echo 'Microi：所有服务已成功安装或接入！'
echo '=================================================================='
echo ''
print_generated_install_configuration "success"
echo "OCR:         容器 ${OCR_CONTAINER_NAME}, 本机端口 127.0.0.1:${OCR_PORT}"
echo "             国内镜像: ${OCR_IMAGE}"
echo "             Docker内网: ${OCR_SERVICE_ENDPOINT}"
echo "             模型卷: microi-ocr-models"
echo "             SaaS配置: OsClient=${OS_CLIENT}, OcrEnabled=1, OcrProvider=PaddleX"
echo "             编排目录: ${OCR_DIR}/"
echo ""
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  echo "Ollama:      容器 microi-install-ollama,    端口 ${OLLAMA_PORT}"
  echo "             数据目录: /microi/ollama/data"
  echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-ollama/"
  echo "             Embedding模型: nomic-embed-text（安装时已下载）"
  echo "             下载模型: docker exec microi-install-ollama ollama pull deepseek-r1:1.5b"
  echo ""
  echo "Qdrant:      容器 microi-install-qdrant,    端口 ${QDRANT_HTTP_PORT}(HTTP) / ${QDRANT_GRPC_PORT}(gRPC)"
  echo "             API Key: ${QDRANT_API_KEY}"
  echo "             管理界面: http://${ACCESS_IP}:${QDRANT_HTTP_PORT}/dashboard"
  echo "             数据目录: /microi/qdrant/storage"
  echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-qdrant/"
  echo "向量开关:    安装程序不会自动修改任何租户的 mic_ai，当前仍保持默认关键词检索。"
  echo "             如需启用，请在 AI 引擎“向量数据库（可选）”Tab 设置："
  echo "             EnableVectorDatabase=1"
  echo '             EmbeddingApiUrl=http://microi-install-ollama:11434/v1/embeddings'
  echo '             QdrantHost=microi-install-qdrant'
  echo '             QdrantPort=6333'
  echo "             QdrantApiKey=${QDRANT_API_KEY}"
  echo "             nomic-embed-text 当前 Microi Ollama HTTP 链路维度：768"
  echo ""
else
  echo '在线AI能力:  默认 NL2SQL/NL2V8 已由平台内置“大模型关键词扩展 + 权限感知 Schema/Skill 搜索 + 精确字段回读”完整承接。'
  echo '             Ollama、nomic-embed-text 与 Qdrant 已固定跳过，不再推荐默认安装。'
  echo ""
fi
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  echo "LibreTranslate: 容器 ${LIBRETRANSLATE_CONTAINER_NAME}, 本机端口 127.0.0.1:${LIBRETRANSLATE_PORT}"
  echo "             国内镜像: ${LIBRETRANSLATE_IMAGE}"
  echo "             Docker内网: ${LIBRETRANSLATE_SERVICE_ENDPOINT}"
  echo "             加载语言: ${LIBRETRANSLATE_LANGS_CSV}"
  echo "             API Key: 已随机生成并写入 SaaS 租户配置（终端不输出明文）"
  echo "             数据目录: /microi/libretranslate/"
  echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-libretranslate/"
  echo ""
else
  echo 'LibreTranslate: 已跳过；如需动态内容翻译，可重新执行脚本并选择安装。'
  echo ""
fi
echo "API:         容器 microi-install-api,        端口 ${API_PORT}"
echo "Client:      容器 microi-install-client,        端口 ${VUE_PORT}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-app/"
echo ""
echo "Watchtower:  容器 microi-install-watchtower"
echo "             监控: microi-install-api, microi-install-client"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-watchtower/"
echo ''
if [ "${INSTALL_MICROI_NETWORK}" == "1" ]; then
  echo "Docker网络:  microi（bridge，subnet ${MICROI_NETWORK_SUBNET}，gateway ${MICROI_NETWORK_GATEWAY}）"
else
  MICROI_ACTUAL_SUBNET=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}' 2>/dev/null | head -1 || true)
  MICROI_ACTUAL_GATEWAY=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' 2>/dev/null | head -1 || true)
  echo "Docker网络:  microi（bridge，Docker自动分配 subnet ${MICROI_ACTUAL_SUBNET:-未知}，gateway ${MICROI_ACTUAL_GATEWAY:-未知}）"
fi
if [ "${DATABASE_SERVICE_MODE}" = 'managed' ] && [ "${MINIO_SERVICE_MODE}" = 'managed' ]; then
  echo '             数据库、Redis、MongoDB、MinIO 与 API 通过容器 DNS/内部端口通信'
else
  echo '             Redis、MongoDB 与 API 通过容器 DNS/内部端口通信'
  if [ "${DATABASE_SERVICE_MODE}" = 'external' ]; then
    echo "             MySQL 使用已有服务 ${MYSQL_EXTERNAL_HOST_DISPLAY}:${DATABASE_PORT}"
  else
    echo "             ${DATABASE_DISPLAY_NAME} 使用容器 DNS ${DATABASE_CONTAINER_NAME}:${DATABASE_INTERNAL_PORT}"
  fi
  if [ "${MINIO_SERVICE_MODE}" = 'external' ]; then
    echo "             MinIO 使用已有服务 ${MINIO_EXTERNAL_INTERNAL_URL}"
  else
    echo '             MinIO 使用容器 DNS microi-install-minio:9000'
  fi
fi
echo "             API 同时接入 OCR/翻译内部网络 ${OCR_RUNTIME_NETWORK}"
echo ''
echo '------------------------------------------------------------------'
echo '已开放的防火墙端口（服务器内部防火墙）：'
echo '------------------------------------------------------------------'
for port in ${FIREWALL_PORTS}; do
  echo "  ${port}/tcp"
done
echo "  OCR ${OCR_PORT}/tcp 未自动开放（仅绑定 127.0.0.1，API 走 ${OCR_RUNTIME_NETWORK} 内网）"
if [ "${INSTALL_LIBRETRANSLATE}" == "1" ]; then
  echo "  LibreTranslate ${LIBRETRANSLATE_PORT}/tcp 未自动开放（仅绑定 127.0.0.1，API 走 ${OCR_RUNTIME_NETWORK} 内网）"
fi
echo ''
echo '------------------------------------------------------------------'
echo '编排项目列表：'
echo '------------------------------------------------------------------'
docker compose ls 2>/dev/null | grep 'microi-install' || docker compose ls 2>/dev/null || true
echo ''
echo '------------------------------------------------------------------'
echo '容器运行状态：'
echo '------------------------------------------------------------------'
docker ps --filter "name=microi-install-" --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
echo ''
echo '=================================================================='
echo 'Microi：安装完成！如需管理编排，可进入对应编排目录执行 docker compose 命令。'
echo 'Microi：提示：请及时修改默认管理员密码（admin / demo123456）。'
echo '=================================================================='
