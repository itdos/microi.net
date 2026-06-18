import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag === 'iconify-icon' || tag === 'micro-app'
                }
            }
        }),
        createSvgIconsPlugin({
            iconDirs: [path.resolve(process.cwd(), 'src/icons/svg')],
            symbolId: 'icon-[name]'
        }),
        // 构建分析插件 - 生成可视化报告
        visualizer({
            open: false, // 构建后不自动打开
            gzipSize: false, // 关闭 gzip 计算以加速构建（需要时可手动开启）
            brotliSize: false, // 关闭 brotli 计算以加速构建
            filename: 'bin/Release/dist/stats.html' // 输出文件路径
        }),
        // 🔥 Brotli/Gzip 压缩已禁用（由服务端 nginx 负责，本地开发无需生成 .br/.gz）
        // compression({ algorithm: 'brotliCompress', ext: '.br', ... }),
        // compression({ algorithm: 'gzip', ext: '.gz', ... }),
        // HTTPS 自签名证书（仅开发环境）
        // basicSsl()
    ],
    resolve: {
        alias: {
            '@goview': path.resolve(__dirname, 'src/views/go-view/src'),
            '@/webos': path.resolve(__dirname, 'src/views/webos'),
            '@': path.resolve(__dirname, 'src'),
            // 兼容 SCSS 中 ~@ 的导入
            '~@': path.resolve(__dirname, 'src'),
            '~': path.resolve(__dirname, 'node_modules'),
            // 兼容旧代码中的 vue 引入
            'vue': 'vue'
        },
        extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    css: {
        modules: {
            // 确保开启 localsConvention 配置
            localsConvention: 'camelCase'
        },
        preprocessorOptions: {
            scss: {
                // 全局注入变量文件，让所有 scss 文件都能访问变量
                // 使用函数形式，避免在包含 @use 内置模块的文件中注入
                additionalData: (source, filename) => {
                    // 如果文件包含 @use "sass: 内置模块，将 @import 放到 @use 之后
                    if (source.includes('@use "sass:')) {
                        return source;
                    }
                    // go-view 文件注入 go-view 自己的全局样式
                    if (filename.includes('views/go-view/src/')) {
                        return `@import "@goview/styles/common/style.scss";\n${source}`;
                    }
                    return `@import "@/styles/variables.scss";\n${source}`;
                },
                // 添加 includePaths 以支持 ~ 开头的导入
                includePaths: [path.resolve(__dirname, 'node_modules')],
                // 静默弃用警告（可选）
                silenceDeprecations: ['legacy-js-api', 'import']
            }
        },
        // 开发和生产保持一致的 devSourcemap
        devSourcemap: true
    },
    server: {
        port: 1988,
        open: true,
        host: '0.0.0.0',
        https: false,
        proxy: {
            // 如果需要代理 API 请求，在这里配置
        },
        // 开发环境禁用 index.html 缓存
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    },
    build: {
        outDir: 'bin/Release/dist',
        assetsDir: 'static',
        sourcemap: false,
        // 设置 chunk 大小警告阈值
        chunkSizeWarningLimit: 800, // 降低到 800KB，促使更好的代码分割
        // CSS 代码分割
        cssCodeSplit: true,
        // CSS 压缩配置 - 使用更温和的压缩选项以保持样式一致性
        cssMinify: 'esbuild',
        // 确保 CSS 导入顺序一致
        assetsInlineLimit: 4096,
        // 🔥 压缩优化 - esbuild 比 terser 快 20-40 倍，体积差异仅 1-2%
        minify: 'esbuild',
        rollupOptions: {
            // 🔥 确保依赖加载顺序：Vue -> Element Plus -> 其他
            output: {
                chunkFileNames: 'static/js/[name]-[hash].js',
                entryFileNames: 'static/js/[name]-[hash].js',
                assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
                // 优化：手动划分重量级依赖到独立 chunk，以提高浏览器缓存命中率、
                // 避免所有重包集中进入主包。
                manualChunks(id) {
                    if (!id.includes('node_modules')) return
                    if (id.includes('monaco-editor')) return 'monaco'
                    if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
                    if (id.includes('@visactor')) return 'vchart'
                    if (id.includes('three')) return 'three'
                    if (id.includes('fullcalendar') || id.includes('@fullcalendar')) return 'fullcalendar'
                    if (id.includes('@wangeditor') || id.includes('@codemirror') || id.includes('codemirror')) return 'editors'
                    if (id.includes('element-plus')) return 'element-plus'
                    if (id.includes('@element-plus/icons-vue')) return 'element-icons'
                    if (id.includes('@fortawesome')) return 'fontawesome'
                    if (id.includes('dhtmlx-gantt')) return 'gantt'
                    if (id.includes('@vue-office') || id.includes('xlsx')) return 'office'
                    if (id.includes('html2canvas') || id.includes('jspdf')) return 'export'
                    if (id.includes('lodash') || id.includes('underscore')) return 'utils'
                }
            }
        }
    },
    optimizeDeps: {
        include: [
            'vue',
            'vue-router',
            'pinia',
            'axios',
            'element-plus',
            'echarts',
            'dayjs',
            'js-cookie',
            'qs'
            // 修复：monaco worker 通过 ?worker 后缀走 Vite 专用流水线，不应加入 optimizeDeps。
            // 以前加入后会被预构建为常规 ES 模块，导致重复包与 MonacoEnvironment 状态变脱。
        ]
    },
    esbuild: {
        drop: ['console', 'debugger'] // 生产环境移除 console 和 debugger
    },
    define: {
        // 兼容 process.env
        'process.env': {},
        // 兼容 Node.js 的 global 变量
        'global': 'globalThis'
    }
});
