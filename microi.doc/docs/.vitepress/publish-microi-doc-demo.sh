#!/bin/bash
# Microi 文档构建发布脚本示例
# 
# 使用说明：
# 1. 复制此文件为 publish-microi-doc.sh
# 2. 修改 Docker 仓库的用户名和密码
# 3. 添加执行权限：chmod +x publish-microi-doc.sh
# 4. 运行：./publish-microi-doc.sh
#
# Windows 用户：请将此文件改为 .bat 格式

set -e

echo "=========================================="
echo "  📦 Microi 文档构建发布系统"
echo "=========================================="
echo ""

# 询问版本号
echo "请输入本次要发布的版本号（例如：1.0.0）："
read version

if [ -z "$version" ]; then
    echo "❌ 错误：版本号不能为空"
    exit 1
fi

echo ""

# 1. 构建 VitePress 文档
echo "🔨 步骤 1/4: 构建 VitePress 文档..."
cd ../..
pnpm docs:build
echo "✅ VitePress 构建完成"
echo ""

# 2. 返回 .vitepress 目录
cd docs/.vitepress

# 3. 登录阿里云 Docker 仓库
echo "🔐 步骤 2/4: 登录阿里云 Docker 仓库..."
# 请将下面的用户名和密码替换为您自己的
docker login --username=your-username --password=your-password registry.cn-beijing.aliyuncs.com
echo ""

# 4. 构建 Docker 镜像
echo "🐋 步骤 3/4: 构建 Docker 镜像..."
docker build -t microi.doc .
echo "✅ Docker 镜像构建完成"
echo ""

# 5. 推送镜像（latest 和版本号）
echo "📤 步骤 4/4: 推送镜像到仓库..."
echo "  → 推送 latest 标签..."
docker tag microi.doc registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest
docker push registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest

echo "  → 推送版本标签: $version"
docker tag microi.doc registry.cn-beijing.aliyuncs.com/itdos/microi.doc:$version
docker push registry.cn-beijing.aliyuncs.com/itdos/microi.doc:$version

echo ""
echo "=========================================="
echo "  🎉 发布成功！"
echo "=========================================="
echo "  版本: $version"
echo "  镜像标签："
echo "  - registry.cn-beijing.aliyuncs.com/itdos/microi.doc:latest"
echo "  - registry.cn-beijing.aliyuncs.com/itdos/microi.doc:$version"
echo "=========================================="