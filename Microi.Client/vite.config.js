import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';
import basicSsl from '@vitejs/plugin-basic-ssl';

const isAnalyzeBuild = process.env.MICROI_BUILD_ANALYZE === 'true';
const buildOutDir = process.env.MICROI_BUILD_OUT_DIR || 'bin/Release/dist';

function monacoLegacySpreadCompat() {
    const monacoGpuActionsPath = '/monaco-editor/esm/vs/editor/contrib/gpu/browser/gpuActions.js';
    const monacoDocumentColorsPath = '/monaco-editor/esm/vs/editor/common/languages/defaultDocumentColorsComputer.js';
    const regexLookbehind = "(?<=['\"\\s])";
    const legacyUnsafeCode = `promises.push(...[
                                fileService.writeFile(URI.joinPath(folders[0].uri, \`textureAtlasPage\${layerIndex}_actual.png\`), VSBuffer.wrap(new Uint8Array(await (await page.source.convertToBlob()).arrayBuffer()))),
                                fileService.writeFile(URI.joinPath(folders[0].uri, \`textureAtlasPage\${layerIndex}_usage.png\`), VSBuffer.wrap(new Uint8Array(await (await page.getUsagePreview()).arrayBuffer()))),
                            ]);`;
    const legacySafeCode = `promises.push(
                                fileService.writeFile(URI.joinPath(folders[0].uri, \`textureAtlasPage\${layerIndex}_actual.png\`), VSBuffer.wrap(new Uint8Array(await (await page.source.convertToBlob()).arrayBuffer())))
                            );
                            promises.push(
                                fileService.writeFile(URI.joinPath(folders[0].uri, \`textureAtlasPage\${layerIndex}_usage.png\`), VSBuffer.wrap(new Uint8Array(await (await page.getUsagePreview()).arrayBuffer())))
                            );`;

    return {
        name: 'microi:monaco-legacy-spread-compat',
        enforce: 'pre',
        transform(code, id) {
            const normalizedId = id.split('?')[0].replace(/\\/g, '/');
            if (normalizedId.endsWith(monacoGpuActionsPath)) {
                if (!code.includes(legacyUnsafeCode)) {
                    throw new Error('Monaco GPU legacy compatibility patch no longer matches the installed monaco-editor source.');
                }
                return {
                    code: code.replace(legacyUnsafeCode, legacySafeCode),
                    map: null
                };
            }
            if (normalizedId.endsWith(monacoDocumentColorsPath)) {
                if (!code.includes(regexLookbehind)) {
                    throw new Error('Monaco color regex legacy compatibility patch no longer matches the installed monaco-editor source.');
                }
                return {
                    // “#”本身已是明确分隔符，去掉后行断言不改变颜色文本的匹配范围。
                    code: code.split(regexLookbehind).join(''),
                    map: null
                };
            }
            return null;
        }
    };
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        // 处理 Monaco 中 legacy 转换不支持的 spread-await 与正则后行断言。
        monacoLegacySpreadCompat(),
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
        // 构建分析只在 npm run build:analyze 时启用，避免日常发布额外保留整份 bundle 元数据。
        isAnalyzeBuild && visualizer({
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
    ].filter(Boolean),
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
                    const normalizedFilename = filename.replace(/\\/g, '/');
                    // go-view 组件只注入变量/函数/mixin。全局 CSS 由 setup.js 单次加载，
                    // 避免把 style.scss 的实体规则重复编译进数百个 Vue 组件。
                    if (normalizedFilename.includes('/views/go-view/src/')) {
                        if (normalizedFilename.includes('/views/go-view/src/styles/common/')) {
                            return source;
                        }
                        return `@import "@goview/styles/common/resources.scss";\n${source}`;
                    }
                    return `@import "@/styles/variables.scss";\n${source}`;
                },
                // 添加 includePaths 以支持 ~ 开头的导入
                includePaths: [path.resolve(__dirname, 'node_modules')],
                // 静默弃用警告（可选）
                silenceDeprecations: ['legacy-js-api', 'import', 'slash-div', 'global-builtin', 'color-functions']
            }
        },
        // 开发和生产保持一致的 devSourcemap
        devSourcemap: true
    },
    server: {
        port: 61500,
        // 后端固定使用 61501；前端端口被占用时直接提示，禁止自动顺延并抢占 API 端口。
        strictPort: true,
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
        outDir: buildOutDir,
        assetsDir: 'static',
        sourcemap: false,
        // 发布时不再额外计算 gzip 体积；压缩由 nginx 完成，可显著降低大包构建末段的内存峰值。
        reportCompressedSize: false,
        // 设置 chunk 大小警告阈值
        chunkSizeWarningLimit: 800, // 降低到 800KB，促使更好的代码分割
        // CSS 代码分割
        cssCodeSplit: true,
        // CSS 压缩配置 - 使用更温和的压缩选项以保持样式一致性
        cssMinify: 'esbuild',
        // 确保 CSS 导入顺序一致
        assetsInlineLimit: 4096,
        // 🔥 压缩优化 - esbuild 比 terser 快 20-40 倍，体积差异仅 1-2%
        // Chrome 49 产物由构建保护脚本基于现代 chunk 逐文件串行转换，
        // 避免完整 Rollup 图与全部 Babel AST 同时驻留。
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
                    const normalizedId = id.replace(/\\/g, '/')
                    if (!normalizedId.includes('node_modules')) return
                    if (normalizedId.includes('monaco-editor')) return 'monaco'
                    if (normalizedId.includes('echarts') || normalizedId.includes('zrender')) return 'echarts'
                    if (normalizedId.includes('@visactor')) return 'vchart'
                    if (normalizedId.includes('three')) return 'three'
                    if (normalizedId.includes('fullcalendar') || normalizedId.includes('@fullcalendar')) return 'fullcalendar'
                    if (normalizedId.includes('@wangeditor') || normalizedId.includes('@codemirror') || normalizedId.includes('codemirror')) return 'editors'
                    // Element Plus 依赖 lodash-unified；lodash 不再强制拆成 utils，
                    // 交由 Rollup 自动放置，避免 legacy SystemJS 循环分片。
                    if (normalizedId.includes('element-plus')) return 'element-plus'
                    if (normalizedId.includes('@element-plus/icons-vue')) return 'element-icons'
                    if (normalizedId.includes('@fortawesome')) return 'fontawesome'
                    if (normalizedId.includes('dhtmlx-gantt')) return 'gantt'
                    if (normalizedId.includes('@vue-office') || normalizedId.includes('xlsx')) return 'office'
                    if (normalizedId.includes('html2canvas') || normalizedId.includes('jspdf')) return 'export'
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
