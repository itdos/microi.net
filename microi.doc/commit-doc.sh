#!/bin/bash

# 提交 microi.doc 项目的脚本
# 只提交当前 microi.doc 目录下的所有变更文件

echo "========================================="
echo "开始提交 microi.doc 项目的变更..."
echo "========================================="

# 获取当前脚本所在目录（即 microi.doc 目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME=$(basename "$SCRIPT_DIR")
GIT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

echo "项目目录: $SCRIPT_DIR"
echo "项目名称: $PROJECT_NAME"
echo "Git 根目录: $GIT_ROOT"
echo ""

# 显示当前目录下的变更状态（只显示 microi.doc 目录下的文件）
echo "📋 当前变更文件："
echo "-----------------------------------------"
cd "$GIT_ROOT"
git status --short -- "$PROJECT_NAME/"
echo ""

# 询问是否继续
read -p "是否继续提交这些文件? (y/n): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "❌ 已取消提交"
    exit 1
fi

# 添加所有变更文件（只在 microi.doc 目录下）
echo "📦 添加变更文件..."
cd "$GIT_ROOT"
git add "$PROJECT_NAME/"

# 查看暂存的文件
echo ""
echo "✅ 已暂存的文件："
echo "-----------------------------------------"
git diff --cached --name-only -- "$PROJECT_NAME/"
echo ""

# 询问提交信息
read -p "请输入提交信息 (默认: 更新文档): " commit_message
commit_message=${commit_message:-"更新文档"}

# 提交
echo ""
echo "💾 提交变更..."
git commit -m "$commit_message"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 提交成功！"
    echo ""
    
    # 询问是否推送
    read -p "是否推送到远程仓库? (y/n): " push_confirm
    if [[ $push_confirm =~ ^[Yy]$ ]]; then
        echo "🚀 推送到远程仓库..."
        git push
        
        if [ $? -eq 0 ]; then
            echo "✅ 推送成功！"
        else
            echo "❌ 推送失败，请检查网络或权限"
        fi
    else
        echo "⏭️  跳过推送"
    fi
else
    echo "❌ 提交失败"
    exit 1
fi

echo ""
echo "========================================="
echo "完成！"
echo "========================================="
