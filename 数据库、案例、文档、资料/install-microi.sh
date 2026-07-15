#!/bin/bash

# ============================================================
# Microi吾码平台 Docker Compose 一键安装脚本
# 支持宝塔面板 Docker 编排模块可视化管理
# 兼容 CentOS 7/8/9、Ubuntu 20/22/24、Debian 10/11/12
# 版本：v2026-07-15
# ============================================================
# 编排列表（每个编排在宝塔面板中独立可见）：
#   microi-install-mysql      - MySQL 5.7 / 8.0 数据库（安装前选择）
#   microi-install-redis      - Redis 7.4.2 缓存
#   microi-install-mongodb    - MongoDB 数据库
#   microi-install-minio      - MinIO 对象存储
#   microi-install-app        - 平台应用（API + Web）
#   microi-install-watchtower - 自动更新服务
#   microi-install-ollama     - Ollama AI 服务（可选：在线 AI 引擎）
#   microi-install-qdrant     - Qdrant 向量数据库（可选：在线 AI 引擎）
# ============================================================
# 端口分配规则：
#   默认从 7000 开始顺序 +1 分配 7 个端口；如安装在线 AI 引擎则分配 10 个端口
#   若存在端口被占用，则自动从 7100 开始重新检测，以此类推
#   基础端口顺序: MySQL, Redis, MongoDB, MinIO-API, MinIO-Console, API, Web
#   在线 AI 端口顺序: MySQL, Redis, MongoDB, MinIO-API, MinIO-Console,
#                  Ollama, Qdrant-HTTP, Qdrant-gRPC, API, Web
# ============================================================

set -e

SCRIPT_VERSION="v2026-07-15"

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

# === MySQL 版本选择 ===
echo ''
echo 'Microi：请选择要安装的 MySQL 版本。'
echo 'Microi：输入 5 安装 MySQL 5.7，输入 8 安装 MySQL 8.0：'
read -r mysql_version_input

if [ "${mysql_version_input}" == "5" ]; then
  MYSQL_VERSION="5.7"
  MYSQL_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7"
  MYSQL_CONTAINER_NAME="microi-install-mysql57"
elif [ "${mysql_version_input}" == "8" ]; then
  MYSQL_VERSION="8.0"
  MYSQL_IMAGE="registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0"
  MYSQL_CONTAINER_NAME="microi-install-mysql80"
else
  echo 'Microi：错误：无效的 MySQL 版本，请输入 5 或 8，脚本退出。'
  exit 1
fi
echo "Microi：将安装 MySQL ${MYSQL_VERSION} ✓"

# === 可选的 Microi Docker 固定网段 ===
echo ''
echo 'Microi：是否创建并让所有编排使用指定网段的 microi Docker 网络？'
echo 'Microi：输入 1 配置，输入 0 使用 Docker Compose 默认网络：'
read -r install_microi_network

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

# === 在线 AI 引擎依赖安装选择 ===
echo ''
echo 'Microi：是否安装 Ollama、向量数据库以支持在线 AI 引擎？'
echo 'Microi：该能力用于在线 AI 数据分析、在线 AI 编程等功能，不影响本地 AI 编程。'
echo 'Microi：输入 1 安装，输入 0 不安装：'
read -r install_online_ai

if [ "${install_online_ai}" == "1" ]; then
  INSTALL_ONLINE_AI=1
  echo 'Microi：将安装 Ollama 与 Qdrant 向量数据库 ✓'
elif [ "${install_online_ai}" == "0" ]; then
  INSTALL_ONLINE_AI=0
  echo 'Microi：将跳过 Ollama 与 Qdrant 向量数据库安装 ✓'
else
  echo 'Microi：错误：无效的输入，脚本退出。'
  exit 1
fi

# === 数据库类型：固定安装空数据库 ===
echo ''
SQL_ZIP_URL="https://static.itdos.com/install/microi_empty_temp.sql.zip"
SQL_FILE_NAME="microi_empty_temp.sql"
echo 'Microi：将安装空数据库（干净数据库，适合正式项目）✓'

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

# === 创建或校验可选的 Microi 固定网段 ===
ensure_microi_network() {
  local existing_driver existing_subnet existing_gateway

  if [ "${INSTALL_MICROI_NETWORK}" != "1" ]; then
    COMPOSE_SERVICE_NETWORK=""
    COMPOSE_EXTERNAL_NETWORKS=""
    return 0
  fi

  if docker network inspect microi > /dev/null 2>&1; then
    existing_driver=$(docker network inspect microi --format '{{.Driver}}')
    existing_subnet=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Subnet}}{{end}}' | head -1)
    existing_gateway=$(docker network inspect microi --format '{{range .IPAM.Config}}{{println .Gateway}}{{end}}' | head -1)

    if [ "${existing_driver}" != "bridge" ] || [ "${existing_subnet}" != "${MICROI_NETWORK_SUBNET}" ] || [ "${existing_gateway}" != "${MICROI_NETWORK_GATEWAY}" ]; then
      echo 'Microi：错误：已存在名为 microi 的 Docker 网络，但配置与本次输入不一致。'
      echo "Microi：现有配置: driver=${existing_driver}, subnet=${existing_subnet}, gateway=${existing_gateway}"
      echo "Microi：本次配置: driver=bridge, subnet=${MICROI_NETWORK_SUBNET}, gateway=${MICROI_NETWORK_GATEWAY}"
      echo 'Microi：为避免影响现有容器，脚本不会自动删除或修改该网络。请确认网络配置后重试。'
      exit 1
    fi
    echo "Microi：已复用现有 microi 网络（${existing_subnet}, gateway ${existing_gateway}）✓"
  else
    echo 'Microi：正在创建 microi Docker 网络...'
    if docker network create \
      --driver bridge \
      --subnet "${MICROI_NETWORK_SUBNET}" \
      --gateway "${MICROI_NETWORK_GATEWAY}" \
      microi > /dev/null; then
      echo "Microi：microi 网络创建成功（${MICROI_NETWORK_SUBNET}, gateway ${MICROI_NETWORK_GATEWAY}）✓"
    else
      echo 'Microi：错误：microi 网络创建失败。请检查该网段是否与现有 Docker 网络重叠。'
      exit 1
    fi
  fi

  # 每个独立编排都连接到同一个预先创建的外部网络
  COMPOSE_SERVICE_NETWORK=$'    networks:\n      - microi'
  COMPOSE_EXTERNAL_NETWORKS=$'networks:\n  microi:\n    external: true\n    name: microi'
}

# === 检查已有容器/编排 ===
EXISTING_MICROI_CONTAINERS=$(docker ps -a --format '{{.Names}}' 2>/dev/null | grep '^microi-install-' || true)
if [ -n "${EXISTING_MICROI_CONTAINERS}" ]; then
  echo ''
  echo 'Microi：错误：检测到已有 microi-install 相关容器，请先清理后再运行此脚本。'
  echo 'Microi：已检测到以下容器：'
  echo "${EXISTING_MICROI_CONTAINERS}"
  echo 'Microi：清理方式一（推荐）：进入各编排目录执行 docker compose down'
  echo 'Microi：清理方式二：执行以下命令强制删除所有相关容器：'
  echo '  docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f'
  echo 'Microi：注意此操作将会影响数据库、MinIO文件等数据，请谨慎操作！'
  exit 1
fi

ensure_microi_network

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
  echo "Microi：MySQL初始化、Docker镜像拉取等操作需要较多磁盘空间。"
  echo "Microi：建议至少保留 5GB 以上可用空间。如空间不足可能导致安装失败。"
fi

# ============================================================
# 步骤3：端口分配与占用检测
# ============================================================
echo ''
echo '[步骤3/11] 端口分配与占用检测'
echo '------------------------------------------------------------------'

# 工具函数
generate_random_password() {
  openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c16
}

generate_random_data_dir() {
  local container_name="$1"
  local dir="/home/data-${container_name}-$(openssl rand -hex 4)"
  mkdir -p "${dir}"
  echo "${dir}"
}

# === 端口检测 ===
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  PORT_COUNT=10
  PORT_LABELS=("MySQL" "Redis" "MongoDB" "MinIO-API" "MinIO-Console" "Ollama" "Qdrant-HTTP" "Qdrant-gRPC" "API" "Web")
else
  PORT_COUNT=7
  PORT_LABELS=("MySQL" "Redis" "MongoDB" "MinIO-API" "MinIO-Console" "API" "Web")
fi

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

echo "Microi：开始按规则分配端口（从 7000 开始顺序 +1，共 ${PORT_COUNT} 个端口）"
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

# 分配端口
MYSQL_PORT=$((PORT_BASE + 0))
REDIS_PORT=$((PORT_BASE + 1))
MONGO_PORT=$((PORT_BASE + 2))
MINIO_PORT=$((PORT_BASE + 3))
MINIO_CONSOLE_PORT=$((PORT_BASE + 4))
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  OLLAMA_PORT=$((PORT_BASE + 5))
  QDRANT_HTTP_PORT=$((PORT_BASE + 6))
  QDRANT_GRPC_PORT=$((PORT_BASE + 7))
  API_PORT=$((PORT_BASE + 8))
  VUE_PORT=$((PORT_BASE + 9))
else
  OLLAMA_PORT=""
  QDRANT_HTTP_PORT=""
  QDRANT_GRPC_PORT=""
  API_PORT=$((PORT_BASE + 5))
  VUE_PORT=$((PORT_BASE + 6))
fi

echo ''
echo 'Microi：端口分配方案：'
echo '------------------------------------------------------------------'
printf '  %-18s %s\n' "MySQL:"         "${MYSQL_PORT}"
printf '  %-18s %s\n' "Redis:"         "${REDIS_PORT}"
printf '  %-18s %s\n' "MongoDB:"       "${MONGO_PORT}"
printf '  %-18s %s\n' "MinIO API:"     "${MINIO_PORT}"
printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  printf '  %-18s %s\n' "Ollama:"        "${OLLAMA_PORT}"
  printf '  %-18s %s\n' "Qdrant HTTP:"   "${QDRANT_HTTP_PORT}"
  printf '  %-18s %s\n' "Qdrant gRPC:"   "${QDRANT_GRPC_PORT}"
fi
printf '  %-18s %s\n' "API:"           "${API_PORT}"
printf '  %-18s %s\n' "Web:"           "${VUE_PORT}"
echo '------------------------------------------------------------------'

if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  ALL_PORTS="${MYSQL_PORT} ${REDIS_PORT} ${MONGO_PORT} ${MINIO_PORT} ${MINIO_CONSOLE_PORT} ${OLLAMA_PORT} ${QDRANT_HTTP_PORT} ${QDRANT_GRPC_PORT} ${API_PORT} ${VUE_PORT}"
else
  ALL_PORTS="${MYSQL_PORT} ${REDIS_PORT} ${MONGO_PORT} ${MINIO_PORT} ${MINIO_CONSOLE_PORT} ${API_PORT} ${VUE_PORT}"
fi

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
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  QDRANT_API_KEY=$(generate_random_password)
else
  QDRANT_API_KEY=""
fi

# 验证密码是否生成成功（bash <4.4 下 set -e 不会传播到 $() 中）
_REQUIRED_PW_VARS="MYSQL_ROOT_PASSWORD REDIS_PASSWORD MONGO_ROOT_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY"
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  _REQUIRED_PW_VARS="${_REQUIRED_PW_VARS} QDRANT_API_KEY"
fi
for _pw_var in ${_REQUIRED_PW_VARS}; do
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
# 自动检测服务器内存并生成MySQL配置
# ============================================================
generate_mysql_config() {
  # 获取服务器总内存（MB）
  local total_mem_kb
  total_mem_kb=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo "2097152")
  if [ -z "${total_mem_kb}" ]; then
    total_mem_kb=2097152
    echo "Microi：警告：无法读取 /proc/meminfo，使用默认 2GB 内存配置" >&2
  fi
  local total_mem_mb=$((total_mem_kb / 1024))
  echo "Microi：检测到服务器内存: ${total_mem_mb}MB" >&2

  # 根据内存分配MySQL参数
  local innodb_buffer_pool_size
  local innodb_log_buffer_size
  local key_buffer_size
  local tmp_table_size
  local max_heap_table_size
  local max_connections
  local thread_cache_size
  local table_open_cache
  local sort_buffer_size
  local read_buffer_size
  local join_buffer_size
  local innodb_log_file_size
  local innodb_buffer_pool_instances
  local innodb_io_capacity
  local innodb_io_capacity_max

  if [ ${total_mem_mb} -le 1024 ]; then
    echo "Microi：MySQL配置模式: 极低配(≤1GB内存)" >&2
    innodb_buffer_pool_size="128M"
    innodb_log_buffer_size="16M"
    innodb_log_file_size="48M"
    key_buffer_size="16M"
    tmp_table_size="16M"
    max_heap_table_size="16M"
    max_connections=100
    thread_cache_size=16
    table_open_cache=256
    sort_buffer_size="256K"
    read_buffer_size="256K"
    join_buffer_size="256K"
  elif [ ${total_mem_mb} -le 2048 ]; then
    echo "Microi：MySQL配置模式: 低配(2GB内存)" >&2
    innodb_buffer_pool_size="256M"
    innodb_log_buffer_size="32M"
    innodb_log_file_size="64M"
    key_buffer_size="32M"
    tmp_table_size="32M"
    max_heap_table_size="32M"
    max_connections=200
    thread_cache_size=32
    table_open_cache=512
    sort_buffer_size="512K"
    read_buffer_size="512K"
    join_buffer_size="512K"
  elif [ ${total_mem_mb} -le 4096 ]; then
    echo "Microi：MySQL配置模式: 标准(4GB内存)" >&2
    innodb_buffer_pool_size="512M"
    innodb_log_buffer_size="64M"
    innodb_log_file_size="128M"
    key_buffer_size="64M"
    tmp_table_size="64M"
    max_heap_table_size="64M"
    max_connections=300
    thread_cache_size=64
    table_open_cache=1024
    sort_buffer_size="1M"
    read_buffer_size="1M"
    join_buffer_size="1M"
  elif [ ${total_mem_mb} -le 8192 ]; then
    echo "Microi：MySQL配置模式: 中配(8GB内存)" >&2
    innodb_buffer_pool_size="1G"
    innodb_log_buffer_size="128M"
    innodb_log_file_size="256M"
    key_buffer_size="128M"
    tmp_table_size="128M"
    max_heap_table_size="128M"
    max_connections=500
    thread_cache_size=128
    table_open_cache=2048
    sort_buffer_size="2M"
    read_buffer_size="2M"
    join_buffer_size="2M"
  elif [ ${total_mem_mb} -le 16384 ]; then
    echo "Microi：MySQL配置模式: 高配(16GB内存)" >&2
    innodb_buffer_pool_size="3G"
    innodb_log_buffer_size="256M"
    innodb_log_file_size="256M"
    key_buffer_size="256M"
    tmp_table_size="256M"
    max_heap_table_size="256M"
    max_connections=800
    thread_cache_size=192
    table_open_cache=4096
    sort_buffer_size="4M"
    read_buffer_size="2M"
    join_buffer_size="4M"
  else
    echo "Microi：MySQL配置模式: 超高配(>16GB内存)" >&2
    innodb_buffer_pool_size="5G"
    innodb_log_buffer_size="256M"
    innodb_log_file_size="512M"
    key_buffer_size="256M"
    tmp_table_size="256M"
    max_heap_table_size="256M"
    max_connections=1000
    thread_cache_size=256
    table_open_cache=4096
    sort_buffer_size="4M"
    read_buffer_size="2M"
    join_buffer_size="4M"
  fi

  if [ ${total_mem_mb} -le 2048 ]; then
    innodb_buffer_pool_instances=1
    innodb_io_capacity=500
    innodb_io_capacity_max=1000
  elif [ ${total_mem_mb} -le 4096 ]; then
    innodb_buffer_pool_instances=2
    innodb_io_capacity=1000
    innodb_io_capacity_max=2000
  elif [ ${total_mem_mb} -le 8192 ]; then
    innodb_buffer_pool_instances=4
    innodb_io_capacity=4000
    innodb_io_capacity_max=8000
  else
    innodb_buffer_pool_instances=8
    innodb_io_capacity=4000
    innodb_io_capacity_max=8000
  fi

  if [ "${MYSQL_VERSION}" == "8.0" ]; then
    cat <<MYSQL8CNF
[mysqld]
# 基础配置（MySQL 8.0）
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
net_buffer_length = 16384
skip_name_resolve = ON
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

# 连接配置（根据${total_mem_mb}MB内存自动生成）
max_connections = ${max_connections}
max_connect_errors = 100000
thread_cache_size = ${thread_cache_size}
table_open_cache = ${table_open_cache}
table_open_cache_instances = 16

# 内存配置
innodb_buffer_pool_size = ${innodb_buffer_pool_size}
innodb_log_buffer_size = ${innodb_log_buffer_size}
key_buffer_size = ${key_buffer_size}
tmp_table_size = ${tmp_table_size}
max_heap_table_size = ${max_heap_table_size}

# InnoDB I/O 优化
innodb_io_capacity = ${innodb_io_capacity}
innodb_io_capacity_max = ${innodb_io_capacity_max}
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_log_file_size = ${innodb_log_file_size}
innodb_log_files_in_group = 2
innodb_buffer_pool_instances = ${innodb_buffer_pool_instances}
innodb_read_io_threads = 8
innodb_write_io_threads = 8
innodb_purge_threads = 4
innodb_adaptive_flushing = ON

# 缓冲配置
sort_buffer_size = ${sort_buffer_size}
read_buffer_size = ${read_buffer_size}
read_rnd_buffer_size = ${read_buffer_size}
join_buffer_size = ${join_buffer_size}
thread_stack = 512K
binlog_cache_size = 2M

# SSD 持久化优化
innodb_flush_log_at_trx_commit = 2
sync_binlog = 1000
innodb_doublewrite = 1

# MySQL 8.0 兼容与运行配置
default_authentication_plugin = mysql_native_password
innodb_dedicated_server = ON
log_bin_trust_function_creators = ON
performance_schema = ON
MYSQL8CNF
  else
    cat <<MYSQL57CNF
[mysqld]
# 基础配置（MySQL 5.7）
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
skip_name_resolve = ON
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION

# 连接配置（根据${total_mem_mb}MB内存自动生成）
max_connections = ${max_connections}
max_connect_errors = 100000
thread_cache_size = ${thread_cache_size}
table_open_cache = ${table_open_cache}

# 内存配置
innodb_buffer_pool_size = ${innodb_buffer_pool_size}
innodb_log_buffer_size = ${innodb_log_buffer_size}
key_buffer_size = ${key_buffer_size}
query_cache_type = 0
query_cache_size = 0
tmp_table_size = ${tmp_table_size}
max_heap_table_size = ${max_heap_table_size}

# InnoDB 优化
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_log_file_size = ${innodb_log_file_size}
innodb_log_files_in_group = 2
innodb_read_io_threads = 4
innodb_write_io_threads = 4
innodb_purge_threads = 2
innodb_adaptive_flushing = ON

# 缓冲配置
sort_buffer_size = ${sort_buffer_size}
read_buffer_size = ${read_buffer_size}
read_rnd_buffer_size = ${read_buffer_size}
join_buffer_size = ${join_buffer_size}
thread_stack = 512K
binlog_cache_size = 196608

# 持久化优化
innodb_flush_log_at_trx_commit = 2
sync_binlog = 1000
innodb_doublewrite = 1
MYSQL57CNF
  fi
}

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
# 步骤6：部署用户选择的 MySQL 编排
# ============================================================
echo ''
echo "[步骤6/11] 部署 MySQL ${MYSQL_VERSION}"
echo '------------------------------------------------------------------'

MYSQL_DIR="${COMPOSE_BASE_DIR}/microi-install-mysql"

# 检查磁盘可用空间（MySQL初始化至少需要1GB）
MYSQL_DATA_MOUNT=$(df -P "${MYSQL_DATA_DIR%/*}" 2>/dev/null | tail -1 | awk '{print $4}')
if [ -n "${MYSQL_DATA_MOUNT}" ]; then
  DISK_AVAIL_MB=$((MYSQL_DATA_MOUNT / 1024))
  echo "Microi：MySQL 数据目录所在磁盘可用空间: ${DISK_AVAIL_MB}MB"
  if [ ${DISK_AVAIL_MB} -lt 1024 ]; then
    echo "Microi：错误：磁盘可用空间不足 1GB（当前 ${DISK_AVAIL_MB}MB），MySQL初始化可能失败。"
    echo "Microi：请清理磁盘空间后重试，或更换数据目录至空间充足的磁盘。"
    exit 1
  fi
else
  echo "Microi：警告：无法检测磁盘可用空间，继续安装..."
fi

rm -rf "${MYSQL_DATA_DIR}"
mkdir -p "${MYSQL_DATA_DIR}"
sudo chown -R 999:999 "${MYSQL_DATA_DIR}"
sudo chmod 755 "${MYSQL_DATA_DIR}"
echo "Microi：MySQL 数据目录已初始化: ${MYSQL_DATA_DIR} ✓"

mkdir -p "${MYSQL_DIR}"

# 根据服务器内存和所选版本自动生成 MySQL 配置
generate_mysql_config > "${MYSQL_DIR}/my_microi.cnf"
echo "Microi：MySQL ${MYSQL_VERSION} 配置文件已生成 ✓"

echo "Microi：MySQL 端口: ${MYSQL_PORT}, Root密码: ${MYSQL_ROOT_PASSWORD}"

cat > "${MYSQL_DIR}/docker-compose.yml" <<EOF
version: '3.8'
services:
  ${MYSQL_CONTAINER_NAME}:
    image: ${MYSQL_IMAGE}
    container_name: ${MYSQL_CONTAINER_NAME}
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${MYSQL_PORT}:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_ROOT_HOST=%
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - ${MYSQL_DATA_DIR}:/var/lib/mysql
      - ./my_microi.cnf:/etc/mysql/conf.d/my_microi.cnf
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
echo "Microi：MySQL 编排文件已生成: ${MYSQL_DIR}/docker-compose.yml ✓"

compose_up "${MYSQL_DIR}"

# === 等待MySQL启动并初始化数据 ===
echo ''
echo 'Microi：等待MySQL容器启动...'
sleep 5

# 先检查容器是否还在运行（避免空等60秒）
if ! docker ps --format '{{.Names}}' | grep -qx "${MYSQL_CONTAINER_NAME}"; then
  echo 'Microi：错误：MySQL 容器启动后立即退出，以下是容器日志：'
  echo '------------------------------------------------------------------'
  docker logs "${MYSQL_CONTAINER_NAME}" 2>&1 | tail -50
  echo '------------------------------------------------------------------'
  echo 'Microi：正在清理失败的MySQL部署...'
  docker stop "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
  docker rm -f "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
  rm -rf "${MYSQL_DATA_DIR}"
  echo 'Microi：已停止容器并清理数据目录，请排查错误后重新运行脚本。'
  exit 1
fi

MYSQL_READY=false
for i in $(seq 1 30); do
  # 每轮检查容器是否仍在运行
  if ! docker ps --format '{{.Names}}' | grep -qx "${MYSQL_CONTAINER_NAME}"; then
    echo 'Microi：错误：MySQL 容器在等待过程中退出，以下是容器日志：'
    echo '------------------------------------------------------------------'
    docker logs "${MYSQL_CONTAINER_NAME}" 2>&1 | tail -50
    echo '------------------------------------------------------------------'
    echo 'Microi：正在清理失败的MySQL部署...'
    docker stop "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
    docker rm -f "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
    rm -rf "${MYSQL_DATA_DIR}"
    echo 'Microi：已停止容器并清理数据目录，请排查错误后重新运行脚本。'
    exit 1
  fi
  if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; then
    MYSQL_READY=true
    break
  fi
  echo "Microi：等待MySQL就绪中... (${i}/30)"
  sleep 2
done

if [ "${MYSQL_READY}" = false ]; then
  echo 'Microi：错误：MySQL 在 60 秒内未能启动就绪。以下是容器日志：'
  echo '------------------------------------------------------------------'
  docker logs "${MYSQL_CONTAINER_NAME}" 2>&1 | tail -50
  echo '------------------------------------------------------------------'
  echo 'Microi：正在清理失败的MySQL部署...'
  docker stop "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
  docker rm -f "${MYSQL_CONTAINER_NAME}" > /dev/null 2>&1 || true
  rm -rf "${MYSQL_DATA_DIR}"
  echo 'Microi：已停止容器并清理数据目录，请排查错误后重新运行脚本。'
  exit 1
fi
echo 'Microi：MySQL 容器已启动就绪 ✓'

echo 'Microi：配置MySQL远程访问权限...'
if [ "${MYSQL_VERSION}" == "8.0" ]; then
  MYSQL_GRANT_SQL="CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASSWORD}'; ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASSWORD}'; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;"
else
  MYSQL_GRANT_SQL="USE mysql; GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}' WITH GRANT OPTION;"
fi
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "${MYSQL_GRANT_SQL}"; then
  echo 'Microi：MySQL 远程访问权限已配置 ✓'
else
  echo 'Microi：警告：MySQL 远程访问权限配置失败，请稍后手动配置'
fi
docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;" > /dev/null 2>&1 || true

# 下载并还原数据库
SQL_ZIP_FILE="/tmp/mysql_backup.zip"
SQL_TMP_DIR="/tmp/mysql_backup"
SQL_FILE="${SQL_TMP_DIR}/${SQL_FILE_NAME}"

mkdir -p "${SQL_TMP_DIR}"
echo "Microi：下载数据库备份文件: ${SQL_ZIP_URL}"
if curl -fSL -o "${SQL_ZIP_FILE}" "${SQL_ZIP_URL}"; then
  echo 'Microi：数据库备份文件下载完成 ✓'
else
  echo 'Microi：错误：数据库备份文件下载失败，请检查网络连接。'
  exit 1
fi

echo 'Microi：解压数据库备份文件...'
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
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS microi_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
  echo 'Microi：数据库 microi_demo 已创建 ✓'
else
  echo 'Microi：错误：数据库创建失败。'
  exit 1
fi

echo 'Microi：还原MySQL数据库备份（可能需要几分钟）...'
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" microi_demo < "${SQL_FILE}"; then
  echo 'Microi：数据库还原完成 ✓'
else
  echo 'Microi：错误：数据库还原失败，请检查 SQL 文件。'
  exit 1
fi

echo "Microi：更新 SaaS 主租户为 ${OS_CLIENT}..."
OS_CLIENT_SQL="UPDATE sys_osclients SET OsClient='${OS_CLIENT}', ClientName='${OS_CLIENT}' WHERE IFNULL(IsDeleted, 0) = 0;"
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" microi_demo -e "${OS_CLIENT_SQL}"; then
  echo 'Microi：SaaS 主租户 OsClient、ClientName 更新完成 ✓'
else
  echo 'Microi：错误：SaaS 主租户配置更新失败。'
  exit 1
fi

# 清理临时文件
rm -f "${SQL_ZIP_FILE}"
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
version: '3.8'
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
version: '3.8'
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
echo "Microi：MinIO 编排文件已生成 ✓"

compose_up "${MINIO_DIR}"

echo 'Microi：等待 MinIO API 就绪...'
MINIO_READY=false
for _minio_wait in $(seq 1 60); do
  if curl -fsS --connect-timeout 2 "http://${LAN_IP}:${MINIO_PORT}/minio/health/live" > /dev/null 2>&1; then
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

# 使用官方 mc 客户端初始化桶；配置放在临时目录，避免污染安装用户的 ~/.mc。
case "$(uname -m)" in
  x86_64|amd64) MINIO_MC_ARCH="amd64" ;;
  aarch64|arm64) MINIO_MC_ARCH="arm64" ;;
  ppc64le) MINIO_MC_ARCH="ppc64le" ;;
  *)
    echo "Microi：错误：当前 CPU 架构 $(uname -m) 暂不支持自动下载 MinIO mc 客户端。"
    exit 1
    ;;
esac
MINIO_MC_BIN="/tmp/microi-minio-mc"
MINIO_MC_CONFIG_DIR="/tmp/microi-minio-mc-config"
rm -f "${MINIO_MC_BIN}"
rm -rf "${MINIO_MC_CONFIG_DIR}"
mkdir -p "${MINIO_MC_CONFIG_DIR}"
echo 'Microi：下载 MinIO 官方 mc 客户端并初始化存储桶...'
if ! curl -fSL -o "${MINIO_MC_BIN}" "https://dl.min.io/client/mc/release/linux-${MINIO_MC_ARCH}/mc"; then
  echo 'Microi：错误：MinIO mc 客户端下载失败。'
  exit 1
fi
chmod +x "${MINIO_MC_BIN}"

MINIO_MC_ALIAS="microi-local"
MINIO_PRIVATE_BUCKET="mci-private"
MINIO_PUBLIC_BUCKET="mci-public"
if ! "${MINIO_MC_BIN}" --config-dir "${MINIO_MC_CONFIG_DIR}" alias set "${MINIO_MC_ALIAS}" "http://${LAN_IP}:${MINIO_PORT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"; then
  echo 'Microi：错误：MinIO mc 无法连接已安装的 MinIO 服务。'
  exit 1
fi
if ! "${MINIO_MC_BIN}" --config-dir "${MINIO_MC_CONFIG_DIR}" mb --ignore-existing "${MINIO_MC_ALIAS}/${MINIO_PRIVATE_BUCKET}"; then
  echo "Microi：错误：MinIO 私有桶 ${MINIO_PRIVATE_BUCKET} 创建失败。"
  exit 1
fi
if ! "${MINIO_MC_BIN}" --config-dir "${MINIO_MC_CONFIG_DIR}" mb --ignore-existing "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"; then
  echo "Microi：错误：MinIO 公有桶 ${MINIO_PUBLIC_BUCKET} 创建失败。"
  exit 1
fi
if ! "${MINIO_MC_BIN}" --config-dir "${MINIO_MC_CONFIG_DIR}" anonymous set download "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"; then
  echo "Microi：错误：MinIO 公有桶 ${MINIO_PUBLIC_BUCKET} 的 public 下载权限设置失败。"
  exit 1
fi
"${MINIO_MC_BIN}" --config-dir "${MINIO_MC_CONFIG_DIR}" anonymous get "${MINIO_MC_ALIAS}/${MINIO_PUBLIC_BUCKET}"
rm -f "${MINIO_MC_BIN}"
rm -rf "${MINIO_MC_CONFIG_DIR}"
echo "Microi：MinIO 桶已初始化：${MINIO_PRIVATE_BUCKET}（私有）、${MINIO_PUBLIC_BUCKET}（public）✓"

if [ "${install_type}" == "g" ]; then
  MINIO_NETWORK_IS_INTERNET=1
else
  MINIO_NETWORK_IS_INTERNET=0
fi
MINIO_INTERNAL_ENDPOINT="${LAN_IP}:${MINIO_PORT}"
MINIO_INTERNET_ENDPOINT="${ACCESS_IP}:${MINIO_PORT}"
MINIO_CONFIG_SQL="UPDATE sys_osclients SET HDFS='MinIO', MinIOAccessKey='${MINIO_ACCESS_KEY}', MinIOSecretKey='${MINIO_SECRET_KEY}', MinIOEndPoint='${MINIO_INTERNAL_ENDPOINT}', MinIOEndPointInternet='${MINIO_INTERNET_ENDPOINT}', MinIOEndPointSSL=0, MinIOPrivateEndPointSSL=0, MinIOPrivateBucketName='${MINIO_PRIVATE_BUCKET}', MinIOPublicBucketName='${MINIO_PUBLIC_BUCKET}', MinIORegion='', NetworkIsInternet=${MINIO_NETWORK_IS_INTERNET} WHERE OsClient='${OS_CLIENT}' AND IFNULL(IsDeleted, 0) = 0;"
echo 'Microi：写入 SaaS 引擎 MinIO 配置...'
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" microi_demo -e "${MINIO_CONFIG_SQL}"; then
  echo 'Microi：SaaS 引擎 MinIO 配置更新完成 ✓'
else
  echo 'Microi：错误：SaaS 引擎 MinIO 配置更新失败。'
  exit 1
fi

SYS_CONFIG_API_BASE="http://${ACCESS_IP}:${API_PORT}"
SYS_CONFIG_FILE_SERVER="http://${ACCESS_IP}:${MINIO_PORT}/${MINIO_PUBLIC_BUCKET}"
SYS_CONFIG_SQL="UPDATE sys_config SET ApiBase='${SYS_CONFIG_API_BASE}', FileServer='${SYS_CONFIG_FILE_SERVER}' WHERE IFNULL(IsDeleted, 0) = 0;"
echo 'Microi：写入系统设置 API 与文件服务地址...'
if docker exec -i "${MYSQL_CONTAINER_NAME}" mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" microi_demo -e "${SYS_CONFIG_SQL}"; then
  echo "Microi：系统设置更新完成：ApiBase=${SYS_CONFIG_API_BASE}, FileServer=${SYS_CONFIG_FILE_SERVER} ✓"
else
  echo 'Microi：错误：系统设置 ApiBase、FileServer 更新失败。'
  exit 1
fi

echo ''
echo '[步骤9/11] MinIO 部署完成 ✓'


# ============================================================
# 步骤10：部署在线 AI 依赖与平台应用
# ============================================================
echo ''
echo '[步骤10/11] 部署在线 AI 依赖与平台应用'
echo '------------------------------------------------------------------'

if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  echo 'Microi：已选择安装在线 AI 引擎依赖，将部署 Ollama 与 Qdrant。'
  echo ''
  echo 'Microi：部署 Ollama AI 服务'
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
  echo 'Microi：已选择不安装在线 AI 引擎依赖，跳过 Ollama 与 Qdrant。'
fi

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
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    privileged: true
    ports:
      - "${API_PORT}:80"
    environment:
      - OsClient=${OS_CLIENT}
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
${COMPOSE_SERVICE_NETWORK}
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "${VUE_PORT}:80"
    environment:
      - OsClient=${OS_CLIENT}
      - ApiBase=http://${ACCESS_IP}:${API_PORT}
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
${COMPOSE_EXTERNAL_NETWORKS}
EOF
echo "Microi：平台应用编排文件已生成 ✓"

compose_up "${APP_DIR}"

echo ''
echo 'Microi：平台应用（API + Web）部署完成 ✓'

echo ''
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  echo '[步骤10/11] Ollama + Qdrant + 平台应用 部署完成 ✓'
else
  echo '[步骤10/11] 平台应用部署完成，已跳过在线 AI 依赖 ✓'
fi


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
version: '3.8'
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
    command: microi-install-api microi-install-client
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
echo ''
echo ''
echo '=================================================================='
echo 'Microi：所有服务已成功安装！'
echo '=================================================================='
echo ''
echo "编排文件目录: ${COMPOSE_BASE_DIR}"
echo '在宝塔面板 → Docker → 编排 中可查看和管理所有编排项目'
echo ''
echo '------------------------------------------------------------------'
echo '访问地址：'
echo '------------------------------------------------------------------'
echo "前端传统界面:  http://${ACCESS_IP}:${VUE_PORT}/?OsClient=${OS_CLIENT}    账号: admin  密码: demo123456"
echo "主租户:        OsClient=${OS_CLIENT}, ClientName=${OS_CLIENT}"
echo ''
echo '------------------------------------------------------------------'
echo "端口分配（从 ${PORT_BASE} 开始顺序分配）："
echo '------------------------------------------------------------------'
printf '  %-18s %s\n' "MySQL:"         "${MYSQL_PORT}"
printf '  %-18s %s\n' "Redis:"         "${REDIS_PORT}"
printf '  %-18s %s\n' "MongoDB:"       "${MONGO_PORT}"
printf '  %-18s %s\n' "MinIO API:"     "${MINIO_PORT}"
printf '  %-18s %s\n' "MinIO Console:" "${MINIO_CONSOLE_PORT}"
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
  printf '  %-18s %s\n' "Ollama:"        "${OLLAMA_PORT}"
  printf '  %-18s %s\n' "Qdrant HTTP:"   "${QDRANT_HTTP_PORT}"
  printf '  %-18s %s\n' "Qdrant gRPC:"   "${QDRANT_GRPC_PORT}"
fi
printf '  %-18s %s\n' "API:"           "${API_PORT}"
printf '  %-18s %s\n' "Web:"           "${VUE_PORT}"
echo ''
echo '------------------------------------------------------------------'
echo '服务信息：'
echo '------------------------------------------------------------------'
echo "MySQL ${MYSQL_VERSION}:  容器 ${MYSQL_CONTAINER_NAME},    端口 ${MYSQL_PORT},  Root密码: ${MYSQL_ROOT_PASSWORD}"
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
echo "             私有桶: ${MINIO_PRIVATE_BUCKET}, 公有桶: ${MINIO_PUBLIC_BUCKET}（public 下载）"
echo "             数据目录: ${MINIO_DATA_DIR}"
echo "             编排目录: ${COMPOSE_BASE_DIR}/microi-install-minio/"
echo ""
if [ "${INSTALL_ONLINE_AI}" == "1" ]; then
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
else
  echo "在线AI依赖: 已跳过 Ollama 与 Qdrant。后续如需在线AI数据分析/在线AI编程，请重新执行脚本并选择安装。"
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
  echo '             所有本次生成的编排均通过 external: true 引用该网络'
else
  echo 'Docker网络:  使用各 Docker Compose 项目的默认网络'
fi
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
echo '=================================================================='
