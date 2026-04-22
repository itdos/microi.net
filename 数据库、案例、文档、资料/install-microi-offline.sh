#!/bin/bash

# ============================================================
# Microi吾码平台 Docker Compose 离线安装脚本
# 功能与在线安装完全一致，但所有资源从本地加载
# 兼容 CentOS 7/8/9、Ubuntu 20/22/24、Debian 10/11/12
# 版本：2026-04-01
# ============================================================

set -e

# === 修复中文显示：确保终端使用 UTF-8 编码 ===
export LANG=en_US.UTF-8 2>/dev/null || export LANG=C.UTF-8 2>/dev/null || true
export LC_ALL=en_US.UTF-8 2>/dev/null || export LC_ALL=C.UTF-8 2>/dev/null || true

# 获取脚本所在目录（离线包解压目录）
OFFLINE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ''
echo '=================================================================='
echo 'Microi：Docker Compose 离线安装脚本 v2026-04-01'
echo '=================================================================='
echo ''

# ============================================================
# 预检：验证离线包完整性
# ============================================================
echo '[预检] 验证离线安装包完整性'
echo '------------------------------------------------------------------'

IMAGES_TAR="${OFFLINE_DIR}/images/images.tar"
SQL_DIR="${OFFLINE_DIR}/sql"

if [ ! -f "${IMAGES_TAR}" ]; then
  echo "Microi：错误：未找到镜像文件 ${IMAGES_TAR}"
  echo "Microi：请确保离线包已正确解压，且 images/images.tar 文件存在。"
  exit 1
fi
echo "Microi：镜像文件已找到 ✓"

# 检查 SQL 文件
HAS_DEMO_SQL=false
HAS_EMPTY_SQL=false
if [ -f "${SQL_DIR}/microi_demo_temp.sql.zip" ]; then
  HAS_DEMO_SQL=true
  echo "Microi：Demo 数据库文件已找到 ✓"
fi
if [ -f "${SQL_DIR}/microi_empty_temp.sql.zip" ]; then
  HAS_EMPTY_SQL=true
  echo "Microi：空数据库文件已找到 ✓"
fi
if [ "${HAS_DEMO_SQL}" = false ] && [ "${HAS_EMPTY_SQL}" = false ]; then
  echo "Microi：错误：未找到任何数据库文件（sql/ 目录下应有 .sql.zip 文件）"
  exit 1
fi

echo ''
echo '[预检] 离线包验证通过 ✓'

# ============================================================
# 步骤1：环境检测与系统准备
# ============================================================
echo ''
echo '[步骤1/11] 环境检测与系统准备'
echo '------------------------------------------------------------------'

# === 检测操作系统类型 ===
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

is_debian_based() {
  [[ "${OS_ID}" == "ubuntu" || "${OS_ID}" == "debian" ]]
}

is_rhel_based() {
  [[ "${OS_ID}" == "centos" || "${OS_ID}" == "rhel" || "${OS_ID}" == "rocky" || "${OS_ID}" == "almalinux" || "${OS_ID}" == "fedora" || "${OS_ID}" == "openEuler" || "${OS_ID}" == "centos-stream" || "${OS_ID}" == "amzn" ]]
}

# === 获取IP地址 ===
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [ -z "${LAN_IP}" ]; then
  echo 'Microi：错误：无法获取局域网IP地址，请检查网络配置。'
  exit 1
fi
echo "Microi：获取局域网IP: ${LAN_IP} ✓"

# 离线模式：尝试获取公网IP（可能失败）
PUBLIC_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || echo "")
if [ -n "${PUBLIC_IP}" ]; then
  echo "Microi：获取公网IP: ${PUBLIC_IP}"
else
  echo "Microi：无法获取公网IP（离线环境正常），将使用内网模式"
fi

# === 选择访问方式 ===
echo ''
if [ -n "${PUBLIC_IP}" ]; then
  echo 'Microi：您是想在公网访问系统还是内网访问？公网请做好端口开放。'
  echo 'Microi：输入 g 以公网IP安装，输入 n 以内网IP安装：'
  read -r install_type
else
  echo 'Microi：离线环境未检测到公网IP，将以内网IP安装。'
  install_type="n"
fi

if [ "$install_type" == "g" ]; then
  if [ -z "${PUBLIC_IP}" ]; then
    echo 'Microi：错误：无法获取公网IP，请检查网络后重试，或使用内网模式。'
    exit 1
  fi
  ACCESS_IP=$PUBLIC_IP
  echo 'Microi：将以公网IP安装 ✓'
elif [ "$install_type" == "n" ] || [ -z "$install_type" ]; then
  ACCESS_IP=$LAN_IP
  echo 'Microi：将以内网IP安装 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi

# === 选择数据库类型 ===
echo ''
if [ "${HAS_DEMO_SQL}" = true ] && [ "${HAS_EMPTY_SQL}" = true ]; then
  echo 'Microi：请选择要安装的数据库类型：'
  echo '  1) Demo示例数据库（包含示例数据，适合体验和学习）'
  echo '  2) 空数据库（干净数据库，适合正式项目）'
  echo 'Microi：请输入 1 或 2：'
  read -r db_type
  if [ "$db_type" == "1" ]; then
    SQL_ZIP_FILE="${SQL_DIR}/mysql5.6.50-demo.sql.zip"
    SQL_FILE_NAME="microi_demo_temp.sql"
    echo 'Microi：将安装Demo示例数据库 ✓'
  elif [ "$db_type" == "2" ]; then
    SQL_ZIP_FILE="${SQL_DIR}/mysql5.6.50-empty.sql.zip"
    SQL_FILE_NAME="microi_empty_temp.sql"
    echo 'Microi：将安装空数据库 ✓'
  else
    echo 'Microi：错误：无效的输入，脚本退出。'
    exit 1
  fi
elif [ "${HAS_DEMO_SQL}" = true ]; then
  SQL_ZIP_FILE="${SQL_DIR}/mysql5.6.50-demo.sql.zip"
  SQL_FILE_NAME="microi_demo_temp.sql"
  echo 'Microi：将安装Demo示例数据库 ✓'
else
  SQL_ZIP_FILE="${SQL_DIR}/mysql5.6.50-empty.sql.zip"
  SQL_FILE_NAME="microi_empty_temp.sql"
  echo 'Microi：将安装空数据库 ✓'
fi

echo ''
echo '[步骤1/11] 环境检测完成 ✓'

# ============================================================
# 步骤2：Docker 环境检查（离线模式不自动安装Docker）
# ============================================================
echo ''
echo '[步骤2/11] Docker 环境检查'
echo '------------------------------------------------------------------'

if ! command -v docker > /dev/null 2>&1; then
  echo 'Microi：错误：未检测到 Docker。'
  echo 'Microi：离线环境需要提前安装 Docker，请参考以下方式：'
  echo '  方式一：在有网络的机器上下载 Docker 离线安装包后传输到本机安装'
  echo '  方式二：临时连接网络执行 Docker 安装后断网'
  echo '  Docker 离线安装参考：https://docs.docker.com/engine/install/binaries/'
  exit 1
fi
echo "Microi：Docker 已安装: $(docker --version) ✓"

if docker compose version > /dev/null 2>&1; then
  echo "Microi：Docker Compose 版本: $(docker compose version --short 2>/dev/null || docker compose version) ✓"
else
  echo 'Microi：错误：未检测到 Docker Compose V2 插件。'
  echo 'Microi：离线环境需要提前安装 Docker Compose V2 插件。'
  echo 'Microi：安装方法：将 docker-compose 二进制文件放到 /usr/local/lib/docker/cli-plugins/ 并赋予执行权限'
  exit 1
fi

# === 检查已有容器/编排 ===
if docker ps -a --format '{{.Names}}' | grep -q '^microi-install-'; then
  echo ''
  echo 'Microi：错误：检测到已有 microi-install 相关容器，请先清理后再运行此脚本。'
  echo 'Microi：清理方式一（推荐）：进入各编排目录执行 docker compose down'
  echo 'Microi：清理方式二：执行以下命令强制删除所有相关容器：'
  echo '  docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f'
  echo 'Microi：注意此操作将会影响数据库、MinIO文件等数据，请谨慎操作！'
  exit 1
fi

# 检查 unzip 和 openssl
for cmd in unzip openssl; do
  if ! command -v ${cmd} > /dev/null 2>&1; then
    echo "Microi：错误：未检测到 ${cmd} 命令，请先安装。"
    if is_debian_based; then
      echo "  安装命令: sudo apt-get install -y ${cmd}"
    elif is_rhel_based; then
      echo "  安装命令: sudo yum install -y ${cmd}"
    fi
    exit 1
  fi
done
echo 'Microi：依赖工具已存在（unzip/openssl）✓'

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
  echo "Microi：警告：磁盘可用空间不足 2GB（当前 ${ROOT_AVAIL_MB}MB）。"
  echo "Microi：MySQL初始化、Docker镜像加载等操作需要较多磁盘空间。"
  echo "Microi：建议至少保留 5GB 以上可用空间。如空间不足可能导致安装失败。"
fi

# ============================================================
# 步骤3：端口分配与占用检测
# ============================================================
echo ''
echo '[步骤3/11] 端口分配与占用检测'
echo '------------------------------------------------------------------'

generate_random_password() {
  openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c16
}

generate_random_data_dir() {
  local container_name="$1"
  local dir="/home/data-${container_name}-$(openssl rand -hex 4)"
  mkdir -p "${dir}"
  echo "${dir}"
}

PORT_COUNT=10
PORT_LABELS=("MySQL" "Redis" "MongoDB" "MinIO-API" "MinIO-Console" "Ollama" "Qdrant-HTTP" "Qdrant-gRPC" "API" "Web")

check_port_in_use() {
  local port="$1"
  if command -v ss > /dev/null 2>&1; then
    if ss -tln 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
      return 0
    fi
    return 1
  fi
  if command -v netstat > /dev/null 2>&1; then
    if netstat -tln 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"; then
      return 0
    fi
    return 1
  fi
  return 1
}

echo 'Microi：开始按规则分配端口（从 7000 开始顺序 +1，共 10 个端口）'
echo ''

PORT_BASE=7000
PORT_ALLOCATED=false

while [ ${PORT_BASE} -le 65500 ]; do
  echo "Microi：检测端口段 ${PORT_BASE}-$((PORT_BASE + PORT_COUNT - 1))..."
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
    echo "Microi：端口段 ${PORT_BASE}-$((PORT_BASE + PORT_COUNT - 1)) 全部可用 ✓"
    break
  else
    echo "Microi：端口段存在被占用端口:${CONFLICT_PORTS}，尝试下一段 $((PORT_BASE + 100))..."
    PORT_BASE=$((PORT_BASE + 100))
    echo ''
  fi
done

if [ "${PORT_ALLOCATED}" = false ]; then
  echo "Microi：错误：无法找到连续 ${PORT_COUNT} 个可用端口（已尝试至端口段 ${PORT_BASE}），脚本退出。"
  exit 1
fi

MYSQL_PORT=$((PORT_BASE + 0))
REDIS_PORT=$((PORT_BASE + 1))
MONGO_PORT=$((PORT_BASE + 2))
MINIO_PORT=$((PORT_BASE + 3))
MINIO_CONSOLE_PORT=$((PORT_BASE + 4))
OLLAMA_PORT=$((PORT_BASE + 5))
QDRANT_HTTP_PORT=$((PORT_BASE + 6))
QDRANT_GRPC_PORT=$((PORT_BASE + 7))
API_PORT=$((PORT_BASE + 8))
VUE_PORT=$((PORT_BASE + 9))

echo ''
echo 'Microi：端口分配方案：'
echo '------------------------------------------------------------------'
printf '  %-18s %s\n' "MySQL:"         "${MYSQL_PORT}"
printf '  %-18s %s\n' "Redis:"         "${REDIS_PORT}"
printf '  %-18s %s\n' "MongoDB:"       "${MONGO_PORT}"
printf '  %-18s %s\n' "MinIO API:"     "${MINIO_PORT}"
printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
printf '  %-18s %s\n' "Ollama:"        "${OLLAMA_PORT}"
printf '  %-18s %s\n' "Qdrant HTTP:"   "${QDRANT_HTTP_PORT}"
printf '  %-18s %s\n' "Qdrant gRPC:"   "${QDRANT_GRPC_PORT}"
printf '  %-18s %s\n' "API:"           "${API_PORT}"
printf '  %-18s %s\n' "Web:"           "${VUE_PORT}"
echo '------------------------------------------------------------------'

ALL_PORTS="${MYSQL_PORT} ${REDIS_PORT} ${MONGO_PORT} ${MINIO_PORT} ${MINIO_CONSOLE_PORT} ${OLLAMA_PORT} ${QDRANT_HTTP_PORT} ${QDRANT_GRPC_PORT} ${API_PORT} ${VUE_PORT}"

echo ''
echo '[步骤3/11] 端口分配完成 ✓'

# ============================================================
# 步骤4：生成密码与数据目录
# ============================================================
echo ''
echo '[步骤4/11] 生成密码与数据目录'
echo '------------------------------------------------------------------'

MYSQL_ROOT_PASSWORD=$(generate_random_password)
REDIS_PASSWORD=$(generate_random_password)
MONGO_ROOT_PASSWORD=$(generate_random_password)
MINIO_ACCESS_KEY=$(generate_random_password)
MINIO_SECRET_KEY=$(generate_random_password)
QDRANT_API_KEY=$(generate_random_password)

for _pw_var in MYSQL_ROOT_PASSWORD REDIS_PASSWORD MONGO_ROOT_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY QDRANT_API_KEY; do
  eval _pw_val="\${${_pw_var}}"
  if [ -z "${_pw_val}" ]; then
    echo "Microi：错误：密码生成失败（${_pw_var}为空），请检查 openssl 是否安装正确。"
    exit 1
  fi
done
echo 'Microi：各服务密码/密钥已随机生成 ✓'

MYSQL_DATA_DIR=$(generate_random_data_dir "mysql")
REDIS_DATA_DIR=$(generate_random_data_dir "redis")
MONGO_DATA_DIR=$(generate_random_data_dir "mongodb")
MINIO_DATA_DIR=$(generate_random_data_dir "minio")
echo 'Microi：各服务数据目录已创建 ✓'

echo ''
echo '[步骤4/11] 密码与数据目录就绪 ✓'

# ============================================================
# MySQL 配置生成函数
# ============================================================
generate_mysql_config() {
  local total_mem_kb
  total_mem_kb=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "2097152")
  if [ -z "${total_mem_kb}" ]; then
    total_mem_kb=2097152
    echo "Microi：警告：无法读取 /proc/meminfo，使用默认 2GB 内存配置" >&2
  fi
  local total_mem_mb=$((total_mem_kb / 1024))
  echo "Microi：检测到服务器内存: ${total_mem_mb}MB" >&2

  local innodb_buffer_pool_size innodb_log_buffer_size key_buffer_size
  local tmp_table_size max_heap_table_size max_connections thread_cache_size
  local table_open_cache sort_buffer_size read_buffer_size join_buffer_size innodb_log_file_size

  if [ ${total_mem_mb} -le 1024 ]; then
    echo "Microi：MySQL配置模式: 极低配(≤1GB内存)" >&2
    innodb_buffer_pool_size="128M"; innodb_log_buffer_size="16M"; innodb_log_file_size="48M"
    key_buffer_size="16M"; tmp_table_size="16M"; max_heap_table_size="16M"
    max_connections=100; thread_cache_size=16; table_open_cache=256
    sort_buffer_size="256K"; read_buffer_size="256K"; join_buffer_size="256K"
  elif [ ${total_mem_mb} -le 2048 ]; then
    echo "Microi：MySQL配置模式: 低配(2GB内存)" >&2
    innodb_buffer_pool_size="256M"; innodb_log_buffer_size="32M"; innodb_log_file_size="64M"
    key_buffer_size="32M"; tmp_table_size="32M"; max_heap_table_size="32M"
    max_connections=200; thread_cache_size=32; table_open_cache=512
    sort_buffer_size="512K"; read_buffer_size="512K"; join_buffer_size="512K"
  elif [ ${total_mem_mb} -le 4096 ]; then
    echo "Microi：MySQL配置模式: 标准(4GB内存)" >&2
    innodb_buffer_pool_size="512M"; innodb_log_buffer_size="64M"; innodb_log_file_size="128M"
    key_buffer_size="64M"; tmp_table_size="64M"; max_heap_table_size="64M"
    max_connections=300; thread_cache_size=64; table_open_cache=1024
    sort_buffer_size="1M"; read_buffer_size="1M"; join_buffer_size="1M"
  elif [ ${total_mem_mb} -le 8192 ]; then
    echo "Microi：MySQL配置模式: 中配(8GB内存)" >&2
    innodb_buffer_pool_size="1G"; innodb_log_buffer_size="128M"; innodb_log_file_size="256M"
    key_buffer_size="128M"; tmp_table_size="128M"; max_heap_table_size="128M"
    max_connections=500; thread_cache_size=128; table_open_cache=2048
    sort_buffer_size="2M"; read_buffer_size="2M"; join_buffer_size="2M"
  elif [ ${total_mem_mb} -le 16384 ]; then
    echo "Microi：MySQL配置模式: 高配(16GB内存)" >&2
    innodb_buffer_pool_size="3G"; innodb_log_buffer_size="256M"; innodb_log_file_size="256M"
    key_buffer_size="256M"; tmp_table_size="256M"; max_heap_table_size="256M"
    max_connections=800; thread_cache_size=192; table_open_cache=4096
    sort_buffer_size="4M"; read_buffer_size="2M"; join_buffer_size="4M"
  else
    echo "Microi：MySQL配置模式: 超高配(>16GB内存)" >&2
    innodb_buffer_pool_size="5G"; innodb_log_buffer_size="256M"; innodb_log_file_size="512M"
    key_buffer_size="256M"; tmp_table_size="256M"; max_heap_table_size="256M"
    max_connections=1000; thread_cache_size=256; table_open_cache=4096
    sort_buffer_size="4M"; read_buffer_size="2M"; join_buffer_size="4M"
  fi

  cat <<MYSQLCNF
[mysqld]
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
skip_name_resolve = ON

max_connections = ${max_connections}
max_connect_errors = 100000
thread_cache_size = ${thread_cache_size}
table_open_cache = ${table_open_cache}

innodb_buffer_pool_size = ${innodb_buffer_pool_size}
innodb_log_buffer_size = ${innodb_log_buffer_size}
key_buffer_size = ${key_buffer_size}
query_cache_type = 0
query_cache_size = 0
tmp_table_size = ${tmp_table_size}
max_heap_table_size = ${max_heap_table_size}

innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_log_file_size = ${innodb_log_file_size}
innodb_log_files_in_group = 2
innodb_read_io_threads = 4
innodb_write_io_threads = 4
innodb_purge_threads = 2
innodb_adaptive_flushing = ON

sort_buffer_size = ${sort_buffer_size}
read_buffer_size = ${read_buffer_size}
read_rnd_buffer_size = ${read_buffer_size}
join_buffer_size = ${join_buffer_size}
thread_stack = 512K
binlog_cache_size = 196608

innodb_flush_log_at_trx_commit = 2
sync_binlog = 1000
innodb_doublewrite = 1

sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
MYSQLCNF
}

# ============================================================
# 防火墙函数
# ============================================================
firewall_open_port() {
  local port="$1"
  if command -v firewall-cmd > /dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
    sudo firewall-cmd --permanent --add-port=${port}/tcp > /dev/null 2>&1 || true
    return 0
  fi
  if command -v ufw > /dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -q "active"; then
    sudo ufw allow ${port}/tcp > /dev/null 2>&1 || true
    return 0
  fi
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

compose_up() {
  local project_dir="$1"
  local project_name
  project_name=$(basename "${project_dir}")
  echo ""
  echo "Microi：正在部署编排 [${project_name}]..."
  if (cd "${project_dir}" && docker compose up -d); then
    echo "Microi：编排 [${project_name}] 部署成功 ✓"
  else
    echo "Microi：错误：编排 [${project_name}] 部署失败 ✗"
    echo "Microi：请检查以上错误日志。常见原因：端口冲突、磁盘空间不足。"
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
# 步骤5：开放防火墙端口
# ============================================================
echo ''
echo '[步骤5/11] 开放防火墙端口'
echo '------------------------------------------------------------------'

echo 'Microi：在部署服务前，先开放所有端口...'
for port in ${ALL_PORTS}; do
  firewall_open_port "${port}"
  echo "Microi：  端口 ${port}/tcp 已开放 ✓"
done
firewall_reload
echo ''
echo 'Microi：提示：以上为服务器内部防火墙规则，若使用云服务器（阿里云/腾讯云等），'
echo '        还需在云控制台的安全组中开放相同端口。'

echo ''
echo '[步骤5/11] 防火墙配置完成 ✓'

# ============================================================
# 步骤5.5：加载离线 Docker 镜像
# ============================================================
echo ''
echo '[离线模式] 加载 Docker 镜像'
echo '------------------------------------------------------------------'
echo 'Microi：正在从离线包加载 Docker 镜像（这可能需要几分钟）...'

if docker load -i "${IMAGES_TAR}"; then
  echo 'Microi：所有 Docker 镜像加载完成 ✓'
else
  echo 'Microi：错误：Docker 镜像加载失败，请检查 images.tar 文件是否完整。'
  exit 1
fi

echo ''
echo 'Microi：已加载的镜像列表：'
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep microios || true
echo ''

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
# 步骤6：部署 MySQL 5.7 编排
# ============================================================
echo ''
echo '[步骤6/11] 部署 MySQL 5.7'
echo '------------------------------------------------------------------'

MYSQL_DIR="${COMPOSE_BASE_DIR}/microi-install-mysql"

MYSQL_DATA_MOUNT=$(df -P "${MYSQL_DATA_DIR%/*}" 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "${MYSQL_DATA_MOUNT}" ]; then
  DISK_AVAIL_MB=$((MYSQL_DATA_MOUNT / 1024))
  echo "Microi：MySQL 数据目录所在磁盘可用空间: ${DISK_AVAIL_MB}MB"
  if [ ${DISK_AVAIL_MB} -lt 1024 ]; then
    echo "Microi：错误：磁盘可用空间不足 1GB（当前 ${DISK_AVAIL_MB}MB），MySQL初始化可能失败。"
    exit 1
  fi
fi

rm -rf "${MYSQL_DATA_DIR}"
mkdir -p "${MYSQL_DATA_DIR}"
sudo chown -R 999:999 "${MYSQL_DATA_DIR}"
sudo chmod 755 "${MYSQL_DATA_DIR}"
echo "Microi：MySQL 数据目录已初始化: ${MYSQL_DATA_DIR} ✓"

mkdir -p "${MYSQL_DIR}"
generate_mysql_config > "${MYSQL_DIR}/my_microi.cnf"
echo "Microi：MySQL 配置文件已生成 ✓"
echo "Microi：MySQL 端口: ${MYSQL_PORT}, Root密码: ${MYSQL_ROOT_PASSWORD}"

cat > "${MYSQL_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  microi-install-mysql57:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7
    container_name: microi-install-mysql57
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${MYSQL_PORT}:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - ${MYSQL_DATA_DIR}:/var/lib/mysql
      - ./my_microi.cnf:/etc/mysql/conf.d/my_microi.cnf
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
EOF
echo "Microi：MySQL 编排文件已生成 ✓"

compose_up "${MYSQL_DIR}"

echo ''
echo 'Microi：等待MySQL容器启动...'
sleep 5

if ! docker ps --format '{{.Names}}' | grep -q 'microi-install-mysql57'; then
  echo 'Microi：错误：MySQL 容器启动后立即退出，以下是容器日志：'
  docker logs microi-install-mysql57 2>&1 | tail -50
  docker stop microi-install-mysql57 > /dev/null 2>&1 || true
  docker rm -f microi-install-mysql57 > /dev/null 2>&1 || true
  rm -rf "${MYSQL_DATA_DIR}"
  exit 1
fi

MYSQL_READY=false
for i in $(seq 1 30); do
  if ! docker ps --format '{{.Names}}' | grep -q 'microi-install-mysql57'; then
    echo 'Microi：错误：MySQL 容器在等待过程中退出'
    docker logs microi-install-mysql57 2>&1 | tail -50
    docker stop microi-install-mysql57 > /dev/null 2>&1 || true
    docker rm -f microi-install-mysql57 > /dev/null 2>&1 || true
    rm -rf "${MYSQL_DATA_DIR}"
    exit 1
  fi
  if docker exec -i microi-install-mysql57 mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; then
    MYSQL_READY=true
    break
  fi
  echo "Microi：等待MySQL就绪中... (${i}/30)"
  sleep 2
done

if [ "${MYSQL_READY}" = false ]; then
  echo 'Microi：错误：MySQL 在 60 秒内未能启动就绪。'
  docker logs microi-install-mysql57 2>&1 | tail -50
  docker stop microi-install-mysql57 > /dev/null 2>&1 || true
  docker rm -f microi-install-mysql57 > /dev/null 2>&1 || true
  rm -rf "${MYSQL_DATA_DIR}"
  exit 1
fi
echo 'Microi：MySQL 容器已启动就绪 ✓'

echo 'Microi：配置MySQL远程访问权限...'
if docker exec -i microi-install-mysql57 mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "USE mysql; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}' WITH GRANT OPTION;"; then
  echo 'Microi：MySQL 远程访问权限已配置 ✓'
else
  echo 'Microi：警告：MySQL 远程访问权限配置失败，请稍后手动配置'
fi
docker exec -i microi-install-mysql57 mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;" > /dev/null 2>&1 || true

# 还原数据库（使用离线包中的 SQL 文件）
SQL_TMP_DIR="/tmp/mysql_backup"
SQL_FILE="${SQL_TMP_DIR}/${SQL_FILE_NAME}"

mkdir -p "${SQL_TMP_DIR}"
echo "Microi：解压数据库备份文件..."
if unzip -o -d "${SQL_TMP_DIR}" "${SQL_ZIP_FILE}"; then
  echo 'Microi：解压完成 ✓'
else
  echo 'Microi：错误：数据库备份文件解压失败。'
  exit 1
fi

if [ ! -f "${SQL_FILE}" ]; then
  echo "Microi：错误：解压后未找到 SQL 文件: ${SQL_FILE_NAME}"
  echo "Microi：解压目录内容:"
  ls -la "${SQL_TMP_DIR}/"
  exit 1
fi

echo 'Microi：创建数据库 microi_demo...'
if docker exec -i microi-install-mysql57 mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS microi_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
  echo 'Microi：数据库 microi_demo 已创建 ✓'
else
  echo 'Microi：错误：数据库创建失败。'
  exit 1
fi

echo 'Microi：还原MySQL数据库备份（可能需要几分钟）...'
if docker exec -i microi-install-mysql57 mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" microi_demo < "${SQL_FILE}"; then
  echo 'Microi：数据库还原完成 ✓'
else
  echo 'Microi：错误：数据库还原失败，请检查 SQL 文件。'
  exit 1
fi

rm -rf "${SQL_TMP_DIR}"
echo 'Microi：临时文件已清理 ✓'

echo ''
echo '[步骤6/11] MySQL 部署完成 ✓'


# ============================================================
# 步骤7：部署 Redis 编排
# ============================================================
echo ''
echo '[步骤7/11] 部署 Redis'
echo '------------------------------------------------------------------'

REDIS_DIR="${COMPOSE_BASE_DIR}/microi-install-redis"

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
version: '3.8'
services:
  microi-install-redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: microi-install-redis
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
version: '3.8'
services:
  microi-install-mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: microi-install-mongodb
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
EOF
echo "Microi：MongoDB 编排文件已生成 ✓"

compose_up "${MONGO_DIR}"

echo ''
echo '[步骤8/11] MongoDB 部署完成 ✓'


# ============================================================
# 步骤9：部署 MinIO 编排
# ============================================================
echo ''
echo '[步骤9/11] 部署 MinIO'
echo '------------------------------------------------------------------'

MINIO_DIR="${COMPOSE_BASE_DIR}/microi-install-minio"
echo "Microi：MinIO API端口: ${MINIO_PORT}, Console端口: ${MINIO_CONSOLE_PORT}"

mkdir -p "${MINIO_DIR}"
cat > "${MINIO_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  microi-install-minio:
    image: registry.cn-hangzhou.aliyuncs.com/microios/minio:latest
    container_name: microi-install-minio
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
EOF
echo "Microi：MinIO 编排文件已生成 ✓"

compose_up "${MINIO_DIR}"

echo ''
echo '[步骤9/11] MinIO 部署完成 ✓'


# ============================================================
# 步骤10：部署 Ollama + Qdrant + 平台应用 + Watchtower
# ============================================================
echo ''
echo '[步骤10/11] 部署 Ollama AI 服务'
echo '------------------------------------------------------------------'

OLLAMA_DIR="${COMPOSE_BASE_DIR}/microi-install-ollama"
echo "Microi：Ollama 端口: ${OLLAMA_PORT}"

mkdir -p "${OLLAMA_DIR}"
cat > "${OLLAMA_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  microi-install-ollama:
    image: registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest
    container_name: microi-install-ollama
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
EOF
echo "Microi：Ollama 编排文件已生成 ✓"

compose_up "${OLLAMA_DIR}"

echo ''
echo 'Microi：Ollama 部署完成 ✓'

# --- Qdrant ---
echo ''
echo 'Microi：部署 Qdrant 向量数据库'
echo '------------------------------------------------------------------'

QDRANT_DIR="${COMPOSE_BASE_DIR}/microi-install-qdrant"
echo "Microi：Qdrant HTTP端口: ${QDRANT_HTTP_PORT}, gRPC端口: ${QDRANT_GRPC_PORT}, API Key: ${QDRANT_API_KEY}"

mkdir -p "${QDRANT_DIR}"
cat > "${QDRANT_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  microi-install-qdrant:
    image: registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest
    container_name: microi-install-qdrant
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
EOF
echo "Microi：Qdrant 编排文件已生成 ✓"

compose_up "${QDRANT_DIR}"

echo ''
echo 'Microi：Qdrant 部署完成 ✓'

# --- 平台应用（API + Web）---
echo ''
echo 'Microi：部署平台应用（API + Web）'
echo '------------------------------------------------------------------'

APP_DIR="${COMPOSE_BASE_DIR}/microi-install-app"

OS_CLIENT_DB_CONN="Data Source=${LAN_IP};Database=microi_demo;User Id=root;Password=${MYSQL_ROOT_PASSWORD};Port=${MYSQL_PORT};Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;"

echo "Microi：API端口: ${API_PORT}, Web端口: ${VUE_PORT}"

mkdir -p "${APP_DIR}"
cat > "${APP_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  microi-install-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    container_name: microi-install-api
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${API_PORT}:80"
    environment:
      - OsClient=iTdos
      - OsClientType=Product
      - OsClientNetwork=Internal
      - OsClientDbConn=${OS_CLIENT_DB_CONN}
      - OsClientRedisHost=${LAN_IP}
      - OsClientRedisPort=${REDIS_PORT}
      - OsClientRedisPwd=${REDIS_PASSWORD}
      - AuthServer=http://${LAN_IP}:${API_PORT}
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"

  microi-install-client:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-client-dev:latest
    container_name: microi-install-client
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "${VUE_PORT}:80"
    environment:
      - OsClient=iTdos
      - ApiBase=http://${ACCESS_IP}:${API_PORT}
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
EOF
echo "Microi：平台应用编排文件已生成 ✓"

compose_up "${APP_DIR}"

echo ''
echo 'Microi：平台应用（API + Web）部署完成 ✓'

echo ''
echo '[步骤10/11] Ollama + Qdrant + 平台应用 部署完成 ✓'


# ============================================================
# 步骤11：部署 Watchtower 自动更新
# ============================================================
echo ''
echo '[步骤11/11] 部署 Watchtower 自动更新'
echo '------------------------------------------------------------------'

WATCHTOWER_DIR="${COMPOSE_BASE_DIR}/microi-install-watchtower"
echo "Microi：Watchtower 监控容器: microi-install-api, microi-install-client"

mkdir -p "${WATCHTOWER_DIR}"
cat > "${WATCHTOWER_DIR}/docker-compose.yml" <<'EOF'
version: '3.8'
services:
  microi-install-watchtower:
    image: registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest
    container_name: microi-install-watchtower
    restart: always
    privileged: true
    tty: true
    stdin_open: true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: microi-install-api microi-install-client
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
EOF
echo "Microi：Watchtower 编排文件已生成 ✓"

compose_up "${WATCHTOWER_DIR}"

echo ''
echo '[步骤11/11] Watchtower 部署完成 ✓'


# ============================================================
# 输出所有服务信息
# ============================================================
echo ''
echo ''
echo '=================================================================='
echo 'Microi：所有服务已成功安装！（离线模式）'
echo '=================================================================='
echo ''
echo "编排文件目录: ${COMPOSE_BASE_DIR}"
echo '在宝塔面板 → Docker → 编排 中可查看和管理所有编排项目'
echo ''
echo '------------------------------------------------------------------'
echo '访问地址：'
echo '------------------------------------------------------------------'
echo "前端传统界面:  http://${ACCESS_IP}:${VUE_PORT}    账号: admin  密码: demo123456"
echo ''
echo '------------------------------------------------------------------'
echo "端口分配（从 ${PORT_BASE} 开始顺序分配）："
echo '------------------------------------------------------------------'
printf '  %-18s %s\n' "MySQL:"         "${MYSQL_PORT}"
printf '  %-18s %s\n' "Redis:"         "${REDIS_PORT}"
printf '  %-18s %s\n' "MongoDB:"       "${MONGO_PORT}"
printf '  %-18s %s\n' "MinIO API:"     "${MINIO_PORT}"
printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
printf '  %-18s %s\n' "Ollama:"        "${OLLAMA_PORT}"
printf '  %-18s %s\n' "Qdrant HTTP:"   "${QDRANT_HTTP_PORT}"
printf '  %-18s %s\n' "Qdrant gRPC:"   "${QDRANT_GRPC_PORT}"
printf '  %-18s %s\n' "API:"           "${API_PORT}"
printf '  %-18s %s\n' "Web:"           "${VUE_PORT}"
echo ''
echo '------------------------------------------------------------------'
echo '服务信息：'
echo '------------------------------------------------------------------'
echo "MySQL:       容器 microi-install-mysql57,    端口 ${MYSQL_PORT},  Root密码: ${MYSQL_ROOT_PASSWORD}"
echo "             数据目录: ${MYSQL_DATA_DIR}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-mysql/"
echo ""
echo "Redis:       容器 microi-install-redis,      端口 ${REDIS_PORT},  密码: ${REDIS_PASSWORD}"
echo "             数据目录: ${REDIS_DATA_DIR}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-redis/"
echo ""
echo "MongoDB:     容器 microi-install-mongodb,    端口 ${MONGO_PORT},  Root密码: ${MONGO_ROOT_PASSWORD}"
echo "             数据目录: ${MONGO_DATA_DIR}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-mongodb/"
echo ""
echo "MinIO:       容器 microi-install-minio,      API端口 ${MINIO_PORT},  控制台端口 ${MINIO_CONSOLE_PORT}"
echo "             Access Key: ${MINIO_ACCESS_KEY},  Secret Key: ${MINIO_SECRET_KEY}"
echo "             数据目录: ${MINIO_DATA_DIR}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-minio/"
echo ""
echo "Ollama:      容器 microi-install-ollama,    端口 ${OLLAMA_PORT}"
echo "             数据目录: /microi/ollama/data"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-ollama/"
echo "             下载模型: docker exec microi-install-ollama ollama pull deepseek-r1:1.5b"
echo ""
echo "Qdrant:      容器 microi-install-qdrant,    端口 ${QDRANT_HTTP_PORT}(HTTP) / ${QDRANT_GRPC_PORT}(gRPC)"
echo "             API Key: ${QDRANT_API_KEY}"
echo "             管理界面: http://${ACCESS_IP}:${QDRANT_HTTP_PORT}/dashboard"
echo "             数据目录: /microi/qdrant/storage"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-qdrant/"
echo ""
echo "API:         容器 microi-install-api,        端口 ${API_PORT}"
echo "Client:      容器 microi-install-client,        端口 ${VUE_PORT}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-app/"
echo ""
echo "Watchtower:  容器 microi-install-watchtower"
echo "             监控: microi-install-api, microi-install-client"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-watchtower/"
echo ''
echo '------------------------------------------------------------------'
echo '已开放的防火墙端口（服务器内部防火墙）：'
echo '------------------------------------------------------------------'
for port in ${ALL_PORTS}; do
  echo "  ${port}/tcp"
done
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
echo 'Microi：注意：Watchtower 需要联网才能实现自动更新。'
echo '=================================================================='
