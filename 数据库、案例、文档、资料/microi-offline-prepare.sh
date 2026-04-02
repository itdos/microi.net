#!/bin/bash

# ============================================================
# Microi吾码平台 离线安装包制作脚本
# 在有互联网的机器上运行此脚本，生成离线安装包
# 版本：2026-04-01
# ============================================================

set -e

export LANG=en_US.UTF-8 2>/dev/null || export LANG=C.UTF-8 2>/dev/null || true
export LC_ALL=en_US.UTF-8 2>/dev/null || export LC_ALL=C.UTF-8 2>/dev/null || true

echo ''
echo '=================================================================='
echo 'Microi：离线安装包制作工具 v2026-04-01'
echo '=================================================================='
echo ''
echo '此脚本将在当前目录生成 microi-offline.zip 离线安装包。'
echo '请确保当前机器已安装 Docker 且可以访问互联网。'
echo ''

# 检查 Docker
if ! command -v docker > /dev/null 2>&1; then
  echo 'Microi：错误：未检测到 Docker，请先安装 Docker。'
  exit 1
fi

# 检查磁盘空间（至少需要 15GB）
AVAIL_KB=$(df -P . 2>/dev/null | tail -1 | awk '{print $4}')
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
echo "Microi：当前目录可用磁盘空间: ${AVAIL_GB}GB"
if [ ${AVAIL_GB} -lt 10 ]; then
  echo "Microi：警告：磁盘空间可能不足，建议至少 15GB 可用空间。"
  echo "Microi：继续？(y/n)"
  read -r confirm
  if [ "$confirm" != "y" ]; then
    exit 0
  fi
fi

# 选择数据库类型
echo ''
echo 'Microi：请选择要打包的数据库类型：'
echo '  1) Demo示例数据库（包含示例数据，适合体验和学习）'
echo '  2) 空数据库（干净数据库，适合正式项目）'
echo '  3) 打包两个数据库（用户安装时可选择）'
echo 'Microi：请输入 1、2 或 3（默认3）：'
read -r db_choice
if [ -z "$db_choice" ]; then
  db_choice="3"
fi

WORK_DIR=$(mktemp -d)
IMAGES_DIR="${WORK_DIR}/images"
SQL_DIR="${WORK_DIR}/sql"
mkdir -p "${IMAGES_DIR}" "${SQL_DIR}"

echo ''
echo 'Microi：[步骤1/4] 拉取 Docker 镜像...'
echo '------------------------------------------------------------------'

IMAGES=(
  "registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7"
  "registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2"
  "registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/minio:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/microi-client-dev:latest"
  "registry.cn-hangzhou.aliyuncs.com/microios/watchtower:latest"
)

for img in "${IMAGES[@]}"; do
  echo "Microi：拉取镜像 ${img}..."
  docker pull "${img}"
  echo "Microi：镜像 ${img} 拉取完成 ✓"
done

echo ''
echo 'Microi：[步骤2/4] 导出 Docker 镜像为 tar 文件...'
echo '------------------------------------------------------------------'

# 将所有镜像导出为一个tar文件（更高效）
echo "Microi：正在导出所有镜像到 images.tar（这可能需要几分钟）..."
docker save -o "${IMAGES_DIR}/images.tar" "${IMAGES[@]}"
echo "Microi：镜像导出完成 ✓"
TAR_SIZE=$(du -h "${IMAGES_DIR}/images.tar" | awk '{print $1}')
echo "Microi：镜像文件大小: ${TAR_SIZE}"

echo ''
echo 'Microi：[步骤3/4] 下载数据库备份文件...'
echo '------------------------------------------------------------------'

if [ "$db_choice" == "1" ] || [ "$db_choice" == "3" ]; then
  echo "Microi：下载 Demo 示例数据库..."
  curl -fSL -o "${SQL_DIR}/mysql5.6.50-demo.sql.zip" "https://static.itdos.com/install/mysql5.6.50-demo.sql.zip"
  echo "Microi：Demo 数据库下载完成 ✓"
fi

if [ "$db_choice" == "2" ] || [ "$db_choice" == "3" ]; then
  echo "Microi：下载空数据库..."
  curl -fSL -o "${SQL_DIR}/mysql5.6.50-empty.sql.zip" "https://static.itdos.com/install/mysql5.6.50-empty.sql.zip"
  echo "Microi：空数据库下载完成 ✓"
fi

echo ''
echo 'Microi：[步骤4/4] 打包离线安装包...'
echo '------------------------------------------------------------------'

# 复制离线安装脚本到工作目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "${SCRIPT_DIR}/install-microi.sh" "${WORK_DIR}/install-microi.sh"
cp "${SCRIPT_DIR}/install-microi-offline.sh" "${WORK_DIR}/install-microi-offline.sh"
chmod +x "${WORK_DIR}/install-microi.sh"
chmod +x "${WORK_DIR}/install-microi-offline.sh"

# 创建 README
cat > "${WORK_DIR}/README.txt" <<'READMEEOF'
================================================================
  Microi吾码平台 离线安装包
  https://microi.net
================================================================

使用方法：
  1. 将此离线安装包（microi-offline.zip）上传到目标 Linux 服务器
  2. 解压：unzip microi-offline.zip -d microi-offline
  3. 进入目录：cd microi-offline
  4. 执行安装：bash install-microi-offline.sh

前置要求：
  - Linux 系统（CentOS 7/8/9、Ubuntu 20/22/24、Debian 10/11/12）
  - 已安装 Docker 和 Docker Compose V2 插件
    （离线环境需提前安装 Docker，可参考 Docker 离线安装文档）
  - 已安装 unzip 命令（用于解压数据库文件）

包含内容：
  images/images.tar    - 所有 Docker 镜像
  sql/                 - 数据库备份文件
  install-microi-offline.sh - 离线安装脚本（主入口）
  install-microi.sh    - 原始在线安装脚本（参考）

注意事项：
  - 离线安装脚本与在线安装脚本功能完全一致
  - 镜像文件较大，首次加载需要几分钟
  - 安装完成后可使用 Watchtower 实现后续自动更新（需联网）
================================================================
READMEEOF

# 打包为 zip
OUTPUT_FILE="${SCRIPT_DIR}/microi-offline.zip"
echo "Microi：正在打包..."
cd "${WORK_DIR}"
zip -r "${OUTPUT_FILE}" . -x "*.DS_Store"
cd -

# 清理临时目录
rm -rf "${WORK_DIR}"

ZIP_SIZE=$(du -h "${OUTPUT_FILE}" | awk '{print $1}')
echo ''
echo '=================================================================='
echo "Microi：离线安装包已生成: ${OUTPUT_FILE}"
echo "Microi：文件大小: ${ZIP_SIZE}"
echo '=================================================================='
echo ''
echo '使用方法（在目标离线服务器上执行）：'
echo '  1. 上传 microi-offline.zip 到服务器'
echo '  2. unzip microi-offline.zip -d microi-offline'
echo '  3. cd microi-offline'
echo '  4. bash install-microi-offline.sh'
echo ''
