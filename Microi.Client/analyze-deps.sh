#!/bin/bash

# 项目依赖分析脚本
# 用于找出大型依赖和未使用的包

echo "🔍 开始分析项目依赖..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 检查是否安装了必要的工具
echo "📦 检查分析工具..."

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi

# 安装 depcheck (检查未使用的依赖)
if ! command -v depcheck &> /dev/null; then
    echo -e "${YELLOW}⚙️  安装 depcheck...${NC}"
    npm install -g depcheck
fi

# 2. 分析包大小
echo ""
echo -e "${BLUE}📊 分析各依赖包大小...${NC}"
echo ""

# 列出最大的10个依赖
npm ls --depth=0 --parseable | \
while read line; do
    if [ -d "$line" ]; then
        size=$(du -sh "$line" 2>/dev/null | cut -f1)
        name=$(basename "$line")
        if [ ! -z "$size" ]; then
            echo "$size	$name"
        fi
    fi
done | sort -hr | head -20

echo ""
echo -e "${BLUE}🔍 检查未使用的依赖...${NC}"
echo ""

# 3. 运行 depcheck
depcheck --ignores="@vitejs/plugin-vue,vite,sass,autoprefixer,rollup-plugin-visualizer,fast-glob,svgo"

echo ""
echo -e "${BLUE}📈 生成详细分析报告...${NC}"

# 4. 分析 package.json 中的大型库
echo ""
echo "⚠️  以下是可能需要优化的大型库:"
echo ""

cat package.json | grep -E "monaco-editor|echarts|three|dhtmlx-gantt|@vue-office|xlsx|fullcalendar|element-plus" | while read line; do
    echo -e "${YELLOW}  • $line${NC}"
done

echo ""
echo -e "${GREEN}✅ 分析完成!${NC}"
echo ""
echo "💡 优化建议:"
echo "  1. 查看上述'未使用的依赖',考虑移除"
echo "  2. 对于大型库,考虑:"
echo "     - 懒加载 (defineAsyncComponent)"
echo "     - CDN 外链"
echo "     - 按需导入"
echo "  3. 运行 'npm run build' 并查看 bin/Release/dist/stats.html 获取详细打包分析"
echo ""
