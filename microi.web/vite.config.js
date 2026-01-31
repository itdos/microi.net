import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        createSvgIconsPlugin({
            iconDirs: [path.resolve(process.cwd(), 'src/icons/svg')],
            symbolId: 'icon-[name]'
        })
    ],
    resolve: {
        alias: {
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
                    return `@import "@/styles/variables.scss";\n${source}`;
                },
                // 添加 includePaths 以支持 ~ 开头的导入
                includePaths: [path.resolve(__dirname, 'node_modules')],
                // 静默弃用警告（可选）
                silenceDeprecations: ['legacy-js-api', 'import']
            }
        }
    },
    server: {
        port: 1988,
        open: true,
        host: 'localhost',
        proxy: {
            // 如果需要代理 API 请求，在这里配置
        },
        // 开发环境禁用 index.html 缓存
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    },
    build: {
        outDir: 'dist/itdos.os/dist',
        assetsDir: 'static',
        sourcemap: false,
        // 设置 chunk 大小警告阈值
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                chunkFileNames: 'static/js/[name]-[hash].js',
                entryFileNames: 'static/js/[name]-[hash].js',
                assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
                // 手动代码分割，优化首屏加载
                manualChunks(id) {
                    // node_modules 中的库按包分割
                    if (id.includes('node_modules')) {
                        // Element Plus - UI 框架（必须在 vue 之前检查，因为它依赖 vue）
                        if (id.includes('element-plus') && !id.includes('@element-plus/icons-vue')) {
                            return 'vendor-element';
                        }
                        // Element Plus 图标 - 延迟加载
                        if (id.includes('@element-plus/icons-vue')) {
                            return 'vendor-icons';
                        }
                        // 核心框架库 - 首屏必需（放在 element-plus 之后，避免循环依赖）
                        if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia') || id.includes('@vue')) {
                            return 'vendor-core';
                        }
                        // 富文本编辑器 - 很大，需要时才加载
                        if (id.includes('wangeditor') || id.includes('@wangeditor')) {
                            return 'vendor-editor';
                        }
                        // Monaco 编辑器 - 代码编辑器
                        if (id.includes('monaco-editor')) {
                            return 'vendor-monaco';
                        }
                        // 图表库
                        if (id.includes('echarts') || id.includes('zrender')) {
                            return 'vendor-charts';
                        }
                        // 工具库
                        if (id.includes('lodash') || id.includes('dayjs') || id.includes('moment') || id.includes('axios')) {
                            return 'vendor-utils';
                        }
                        // 其他第三方库
                        return 'vendor-other';
                    }
                    // 工作流模块 - 按需加载
                    if (id.includes('/views/workflow/')) {
                        return 'module-workflow';
                    }
                    // 聊天模块 - 按需加载
                    if (id.includes('/views/chat/')) {
                        return 'module-chat';
                    }
                    // 表单字段组件 - 按需加载
                    if (id.includes('/diy-field-component/')) {
                        return 'module-field-components';
                    }
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
            'qs',
            'monaco-editor/esm/vs/language/json/json.worker',
            'monaco-editor/esm/vs/language/css/css.worker',
            'monaco-editor/esm/vs/language/html/html.worker',
            'monaco-editor/esm/vs/language/typescript/ts.worker',
            'monaco-editor/esm/vs/editor/editor.worker'
        ]
    },
    define: {
        // 兼容 process.env
        'process.env': {},
        // 兼容 Node.js 的 global 变量
        'global': 'globalThis'
    }
});
