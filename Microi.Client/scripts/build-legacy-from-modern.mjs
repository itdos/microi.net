import { transformAsync } from '@babel/core';
import { parse as parseModule } from '@babel/parser';
import transformDynamicImport from '@babel/plugin-transform-dynamic-import';
import transformModulesSystemjs from '@babel/plugin-transform-modules-systemjs';
import presetEnv from '@babel/preset-env';
import * as esbuild from 'esbuild';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const distDir = path.join(projectDir, 'bin', 'Release', 'dist');
const modernJsDir = path.join(distDir, 'static', 'js');
const legacyJsDir = path.join(distDir, 'static', 'js-legacy');
const indexPath = path.join(distDir, 'index.html');
const targetBrowsers = ['Chrome >= 49'];
const legacyStartMarker = '<!-- microi-legacy-start -->';
const legacyEndMarker = '<!-- microi-legacy-end -->';

function assertInside(parent, target) {
    const relative = path.relative(parent, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`拒绝操作目标目录之外的路径：${target}`);
    }
}

function normalizeChunkPath(specifier, importer) {
    const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
    if (cleanSpecifier.startsWith('./') || cleanSpecifier.startsWith('../')) {
        return path.resolve(path.dirname(importer), cleanSpecifier);
    }
    if (cleanSpecifier.startsWith('/static/js/')) {
        return path.join(distDir, cleanSpecifier.slice(1));
    }
    return null;
}

async function discoverChunks(entryPath) {
    const discovered = new Set();
    const queue = [entryPath];

    while (queue.length > 0) {
        const file = queue.shift();
        const resolvedFile = path.resolve(file);
        if (discovered.has(resolvedFile)) continue;
        assertInside(modernJsDir, resolvedFile);
        if (!existsSync(resolvedFile)) {
            throw new Error(`入口依赖不存在：${path.relative(distDir, resolvedFile)}`);
        }
        discovered.add(resolvedFile);

        const code = readFileSync(resolvedFile, 'utf8');
        const ast = parseModule(code, {
            sourceType: 'module',
            attachComment: false,
            plugins: ['dynamicImport', 'importMeta', 'topLevelAwait']
        });
        const specifiers = new Set();
        const nodes = [ast.program];
        while (nodes.length > 0) {
            const node = nodes.pop();
            if (!node || typeof node !== 'object') continue;
            if (
                (node.type === 'ImportDeclaration' ||
                    node.type === 'ExportNamedDeclaration' ||
                    node.type === 'ExportAllDeclaration') &&
                node.source?.type === 'StringLiteral'
            ) {
                specifiers.add(node.source.value);
            } else if (
                node.type === 'CallExpression' &&
                node.callee?.type === 'Import' &&
                node.arguments?.[0]?.type === 'StringLiteral'
            ) {
                specifiers.add(node.arguments[0].value);
            } else if (node.type === 'ImportExpression' && node.source?.type === 'StringLiteral') {
                specifiers.add(node.source.value);
            }
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) {
                    for (const child of value) {
                        if (child && typeof child === 'object') nodes.push(child);
                    }
                } else if (value && typeof value === 'object' && typeof value.type === 'string') {
                    nodes.push(value);
                }
            }
        }
        globalThis.gc?.();

        for (const specifier of specifiers) {
            const dependency = normalizeChunkPath(specifier, resolvedFile);
            if (!dependency || !dependency.endsWith('.js')) continue;
            const relative = path.relative(modernJsDir, dependency);
            if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
            if (!discovered.has(dependency)) queue.push(dependency);
        }
    }

    return [...discovered];
}

async function transpileToLegacySystemJs(sourceCode, filename) {
    let moduleResult = await transformAsync(sourceCode, {
        babelrc: false,
        configFile: false,
        sourceType: 'module',
        sourceMaps: false,
        compact: false,
        comments: false,
        filename,
        plugins: [
            transformDynamicImport,
            [transformModulesSystemjs, { allowTopLevelThis: true }]
        ]
    });
    if (!moduleResult?.code) throw new Error(`Babel 未生成 SystemJS：${filename}`);

    const systemCode = moduleResult.code;
    moduleResult = null;
    globalThis.gc?.();

    let targetResult = await transformAsync(systemCode, {
        babelrc: false,
        configFile: false,
        sourceType: 'script',
        sourceMaps: false,
        compact: false,
        comments: false,
        filename,
        targets: targetBrowsers,
        browserslistConfigFile: false,
        presets: [[presetEnv, {
            bugfixes: true,
            modules: false,
            useBuiltIns: false,
            shippedProposals: true
        }]]
    });
    if (!targetResult?.code) throw new Error(`Babel 未生成 Chrome 49 代码：${filename}`);

    const targetCode = `;(function(){${targetResult.code}\n})();`;
    targetResult = null;
    globalThis.gc?.();
    return targetCode;
}

async function minifyLegacyCode(code, filename) {
    const result = await minify(code, {
        ecma: 5,
        compress: { passes: 1 },
        mangle: true,
        format: { comments: false, ascii_only: true }
    });
    if (!result.code) throw new Error(`Terser 未生成压缩结果：${filename}`);
    return result.code;
}

async function buildPolyfills() {
    const outfile = path.join(legacyJsDir, 'polyfills.js');
    await esbuild.build({
        stdin: {
            contents: [
                'import "core-js/stable";',
                'import "regenerator-runtime/runtime.js";',
                'import "abortcontroller-polyfill/dist/abortcontroller-polyfill-only";',
                'import "systemjs/dist/s.min.js";'
            ].join('\n'),
            resolveDir: projectDir,
            sourcefile: 'microi-legacy-polyfills.js'
        },
        outfile,
        bundle: true,
        platform: 'browser',
        format: 'iife',
        target: ['chrome49'],
        minify: true,
        legalComments: 'none',
        sourcemap: false,
        logLevel: 'warning'
    });
}

function mergeLegacyHtml(entryUrl) {
    let html = readFileSync(indexPath, 'utf8');
    const previousBlock = new RegExp(`${legacyStartMarker}[\\s\\S]*?${legacyEndMarker}\\s*`, 'g');
    html = html.replace(previousBlock, '');

    const safariNoModuleFix = '!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",(function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()}),!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();';
    const detectModernBrowser = 'import.meta.url;import("_").catch(()=>1);(async function*(){})().next();window.__vite_is_modern_browser=true';
    const dynamicFallback = '!function(){if(window.__vite_is_modern_browser)return;console.warn("vite: loading legacy chunks, syntax error above and the same error below should be ignored");var e=document.getElementById("vite-legacy-polyfill"),n=document.createElement("script");n.src=e.src,n.onload=function(){System.import(document.getElementById(\'vite-legacy-entry\').getAttribute(\'data-src\'))},document.body.appendChild(n)}();';
    const legacyEntryUrl = entryUrl.replace('/static/js/', '/static/js-legacy/');
    const headBlock = [
        legacyStartMarker,
        `<script type="module">${detectModernBrowser}</script>`,
        `<script type="module">${dynamicFallback}</script>`,
        legacyEndMarker
    ].join('\n    ');
    const bodyBlock = [
        legacyStartMarker,
        `<script nomodule>${safariNoModuleFix}</script>`,
        '<script nomodule crossorigin id="vite-legacy-polyfill" src="/static/js-legacy/polyfills.js"></script>',
        `<script nomodule crossorigin id="vite-legacy-entry" data-src="${legacyEntryUrl}">System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))</script>`,
        legacyEndMarker
    ].join('\n    ');

    if (!html.includes('</head>') || !html.includes('</body>')) {
        throw new Error('index.html 缺少 head/body 结束标签，无法注入 legacy 入口。');
    }
    html = html
        .replace('</head>', `    ${headBlock}\n</head>`)
        .replace('</body>', `    ${bodyBlock}\n</body>`);
    writeFileSync(indexPath, html, 'utf8');
}

function validateLegacyOutput(chunks) {
    let dependencyCount = 0;
    for (const sourcePath of chunks) {
        const relative = path.relative(modernJsDir, sourcePath);
        const legacyPath = path.join(legacyJsDir, relative);
        if (!existsSync(legacyPath)) {
            throw new Error(`legacy chunk 缺失：${relative}`);
        }
        const code = readFileSync(legacyPath, 'utf8');
        const registerMatch = code.match(/System\.register\((\[[^\]]*\])/);
        if (!registerMatch) {
            throw new Error(`legacy chunk 未生成 System.register：${relative}`);
        }
        let dependencies;
        try {
            dependencies = JSON.parse(registerMatch[1]);
        } catch {
            throw new Error(`legacy chunk 依赖列表无法解析：${relative}`);
        }
        for (const dependency of dependencies) {
            if (typeof dependency !== 'string' || !dependency.endsWith('.js')) continue;
            dependencyCount += 1;
            let dependencyPath = null;
            if (dependency.startsWith('./') || dependency.startsWith('../')) {
                dependencyPath = path.resolve(path.dirname(legacyPath), dependency);
            } else if (dependency.startsWith('/static/js-legacy/')) {
                dependencyPath = path.join(distDir, dependency.slice(1));
            }
            if (dependencyPath && !existsSync(dependencyPath)) {
                throw new Error(`legacy 依赖缺失：${relative} -> ${dependency}`);
            }
        }
    }

    const polyfillPath = path.join(legacyJsDir, 'polyfills.js');
    if (!existsSync(polyfillPath) || statSync(polyfillPath).size === 0) {
        throw new Error('legacy polyfills.js 未生成或为空。');
    }
    const html = readFileSync(indexPath, 'utf8');
    const polyfillTagCount = (html.match(/id=["']vite-legacy-polyfill["']/g) || []).length;
    const entryTagCount = (html.match(/id=["']vite-legacy-entry["']/g) || []).length;
    if (polyfillTagCount !== 1 || entryTagCount !== 1) {
        throw new Error(`legacy HTML 入口数量异常：polyfill=${polyfillTagCount}, entry=${entryTagCount}`);
    }
    console.log(`[Microi legacy] 校验通过：${chunks.length} 个 SystemJS chunk，${dependencyCount} 条 JS 依赖。`);
}

if (!existsSync(indexPath) || !existsSync(modernJsDir)) {
    throw new Error('缺少现代浏览器构建产物，无法生成 legacy 包。');
}

const html = readFileSync(indexPath, 'utf8');
const entryMatch = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
if (!entryMatch) throw new Error('index.html 中未找到现代浏览器入口。');
const entryUrl = entryMatch[1].split(/[?#]/, 1)[0];
const entryPath = path.join(distDir, entryUrl.replace(/^\//, ''));

assertInside(distDir, legacyJsDir);
rmSync(legacyJsDir, { recursive: true, force: true });
mkdirSync(legacyJsDir, { recursive: true });

const chunks = await discoverChunks(entryPath);
chunks.sort((left, right) => statSync(left).size - statSync(right).size);
console.log(`[Microi legacy] 发现 ${chunks.length} 个真实 ESM chunk，开始逐文件转换...`);

for (let index = 0; index < chunks.length; index += 1) {
    const sourcePath = chunks[index];
    const relative = path.relative(modernJsDir, sourcePath);
    const targetPath = path.join(legacyJsDir, relative);
    mkdirSync(path.dirname(targetPath), { recursive: true });

    let sourceCode = readFileSync(sourcePath, 'utf8')
        .replaceAll('/static/js/', '/static/js-legacy/')
        .replaceAll('static/js/', 'static/js-legacy/');
    let legacyCode = await transpileToLegacySystemJs(sourceCode, relative);
    sourceCode = null;
    globalThis.gc?.();
    const minifiedCode = await minifyLegacyCode(legacyCode, relative);
    legacyCode = null;
    writeFileSync(targetPath, minifiedCode, 'utf8');
    globalThis.gc?.();

    if ((index + 1) % 25 === 0 || index + 1 === chunks.length) {
        console.log(`[Microi legacy] 转换进度 ${index + 1}/${chunks.length}`);
    }
}

await buildPolyfills();
mergeLegacyHtml(entryUrl);
validateLegacyOutput(chunks);
console.log(`[Microi legacy] Chrome 49 SystemJS 产物生成完成，共 ${chunks.length} 个 chunk。`);
