#!/bin/bash
# ============================================
# Microi吾码 - APK 打包准备脚本
# 
# 用途：构建 microi.web 并复制到 hbuilder-app/dist/ 目录
#       适用于本地模式（离线包）打包
#
# 使用方法：
#   chmod +x build-apk.sh
#   ./build-apk.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/bin/Release/dist"
APP_DIST_DIR="$SCRIPT_DIR/dist"

echo "============================================"
echo "  Microi吾码 - APK 打包准备"
echo "============================================"
echo ""

# Step 1: 构建 microi.web
echo "[1/3] 正在构建 microi.web ..."
cd "$PROJECT_DIR"
npm run build
echo "  ✅ 构建完成：$DIST_DIR"

# Step 2: 清理旧的 dist
echo "[2/3] 清理旧文件 ..."
rm -rf "$APP_DIST_DIR"
echo "  ✅ 已清理"

# Step 3: 复制构建产物
echo "[3/3] 复制构建产物到 hbuilder-app/dist/ ..."
cp -r "$DIST_DIR" "$APP_DIST_DIR"
echo "  ✅ 已复制"

echo ""
echo "============================================"
echo "  准备完成！"
echo ""
echo "  接下来请："
echo "  1. 打开 HBuilderX"
echo "  2. 导入项目：$SCRIPT_DIR"
echo "  3. 选择 manifest.json，配置 App 信息"
echo "  4. 发行 → 原生App-云打包"
echo "============================================"
