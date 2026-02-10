import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        createSvgIconsPlugin({
            iconDirs: [path.resolve(process.cwd(), 'src/icons/svg')],
            symbolId: 'icon-[name]'
        }),
        // 构建分析插件 - 生成可视化报告
        visualizer({
            open: false, // 构建后不自动打开
            gzipSize: true, // 显示 gzip 压缩后的大小
            brotliSize: true, // 显示 brotli 压缩后的大小
            filename: 'dist/stats.html' // 输出文件路径
        }),
        // 🔥 Brotli压缩 - 比gzip效果更好
        compression({
            algorithm: 'brotliCompress',
            ext: '.br',
            threshold: 10240, // 大于10KB才压缩
            deleteOriginFile: false,
            compressionOptions: { level: 11 } // 最高压缩级别
        }),
        // 🔥 Gzip压缩 - 兼容旧浏览器
        compression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 10240,
            deleteOriginFile: false
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
        },
        // 开发和生产保持一致的 devSourcemap
        devSourcemap: true
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
        chunkSizeWarningLimit: 800, // 降低到 800KB，促使更好的代码分割
        // CSS 代码分割
        cssCodeSplit: true,
        // CSS 压缩配置 - 使用更温和的压缩选项以保持样式一致性
        cssMinify: 'esbuild',
        // 确保 CSS 导入顺序一致
        assetsInlineLimit: 4096,
        // 🔥 压缩优化
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true, // 生产环境移除console
                drop_debugger: true, // 移除debugger
                pure_funcs: ['console.log', 'console.info', 'console.debug'], // 移除特定函数调用
                passes: 2 // 多次压缩以获得更好的结果
            },
            format: {
                comments: false // 移除所有注释
            }
        },
        rollupOptions: {
            // 🔥 确保依赖加载顺序：Vue -> Element Plus -> 其他
            output: {
                chunkFileNames: 'static/js/[name]-[hash].js',
                entryFileNames: 'static/js/[name]-[hash].js',
                assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
                // 🎯 极简分割策略 - 只分割100%独立的大型库
                // Vue生态全部合并避免循环依赖
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // ========== 完全独立的大型库 ==========
                        
                        // Monaco编辑器 - 完全独立
                        if (id.includes('monaco-editor')) {
                            return 'vendor-monaco';
                        }
                        
                        // Echarts - 完全独立
                        if (id.includes('echarts') || id.includes('zrender')) {
                            return 'vendor-echarts';
                        }
                        
                        // Three.js - 完全独立
                        if (id.includes('three')) {
                            return 'vendor-three';
                        }
                        
                        // ========== 其余全部合并 ==========
                        // 包括Vue生态、所有UI库、工具库等
                        // 避免任何可能的循环依赖
                        return 'vendor-libs';
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
