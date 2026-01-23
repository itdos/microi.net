// Vue 3: 组件注册移到 main.js 或 microi.net.import.js 中
import SvgIcon from "@/components/SvgIcon"; // svg component

// 导出 SvgIcon 供外部注册
export { SvgIcon };

// Vite: 使用 import.meta.glob 替代 require.context
// 自动导入所有 SVG 文件
const svgModules = import.meta.glob("./svg/*.svg", { eager: true });
