import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';
import { modernBuildTargets } from './modern-build-pipeline.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const defaultDistDir = path.join(projectDir, 'bin', 'Release', 'dist');
const defaultPublicDir = path.join(projectDir, 'public');

function normalizeRelativePath(filePath) {
    return filePath.split(path.sep).join('/');
}

async function listModernJavaScriptFiles(rootDir, currentDir = rootDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.name === 'js-legacy') continue;
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listModernJavaScriptFiles(rootDir, entryPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(entryPath);
        }
    }

    return files;
}

async function listPublicJavaScriptPaths(publicDir) {
    let publicInfo;
    try {
        publicInfo = await stat(publicDir);
    } catch (error) {
        if (error?.code === 'ENOENT') return new Set();
        throw error;
    }
    if (!publicInfo.isDirectory()) return new Set();

    const files = await listModernJavaScriptFiles(publicDir);
    return new Set(files.map((filePath) => normalizeRelativePath(path.relative(publicDir, filePath))));
}

function assertClassicScriptSyntax(source, relativePath) {
    try {
        // 与浏览器普通 <script> 的解析模式一致：若输出含顶层 import/export，
        // Function 构造会立即失败，避免发布后才出现 Unexpected token 'export'。
        Function(source);
    } catch (error) {
        throw new Error(`public 经典脚本压缩后无法按普通 <script> 解析：${relativePath}；${error.message}`);
    }
}

export async function minifyModernOutput({
    distDir = defaultDistDir,
    publicDir = defaultPublicDir,
    onProgress = () => {}
} = {}) {
    const resolvedDistDir = path.resolve(distDir);
    const resolvedPublicDir = path.resolve(publicDir);
    const distInfo = await stat(resolvedDistDir);
    if (!distInfo.isDirectory()) throw new Error(`现代产物目录不是文件夹：${resolvedDistDir}`);

    const files = await listModernJavaScriptFiles(resolvedDistDir);
    const publicJavaScriptPaths = await listPublicJavaScriptPaths(resolvedPublicDir);
    let sourceBytes = 0;
    let outputBytes = 0;
    let moduleFileCount = 0;
    let classicScriptFileCount = 0;

    for (let index = 0; index < files.length; index += 1) {
        const filePath = files[index];
        const relativePath = normalizeRelativePath(path.relative(resolvedDistDir, filePath));
        const isClassicPublicScript = publicJavaScriptPaths.has(relativePath);
        const source = await readFile(filePath, 'utf8');
        sourceBytes += Buffer.byteLength(source);

        const transformOptions = {
            loader: 'js',
            target: modernBuildTargets,
            minify: true,
            treeShaking: !isClassicPublicScript,
            sourcemap: false,
            legalComments: 'none',
            charset: 'utf8',
            drop: ['console', 'debugger'],
            supported: {
                'dynamic-import': true,
                'import-meta': true
            }
        };
        // Rollup chunk 是 ESM；public 目录文件则会原样复制并由普通 <script> 加载。
        // 对后者指定 format=esm 会把 CommonJS 兼容探测改写成 export default，
        // 同时把 LoadRate 等全局函数封进模块作用域，导致首屏永久停在 0%。
        if (!isClassicPublicScript) transformOptions.format = 'esm';

        const result = await transformWithEsbuild(source, filePath, transformOptions);
        const output = result.code;
        if (isClassicPublicScript) {
            assertClassicScriptSyntax(output, relativePath);
            classicScriptFileCount += 1;
        } else {
            moduleFileCount += 1;
        }
        outputBytes += Buffer.byteLength(output);

        const temporaryPath = `${filePath}.${process.pid}.microi-minify.tmp`;
        try {
            await writeFile(temporaryPath, output, 'utf8');
            await rename(temporaryPath, filePath);
        } finally {
            await rm(temporaryPath, { force: true });
        }

        onProgress({
            current: index + 1,
            total: files.length,
            file: relativePath,
            format: isClassicPublicScript ? 'classic' : 'esm'
        });
        globalThis.gc?.();
    }

    return {
        fileCount: files.length,
        moduleFileCount,
        classicScriptFileCount,
        sourceBytes,
        outputBytes
    };
}

async function main() {
    console.log(`[Microi modern minify] 逐文件串行压缩现代产物，目标：${modernBuildTargets.join(', ')}。`);
    const result = await minifyModernOutput({
        onProgress({ current, total, file }) {
            if (current === 1 || current === total || current % 25 === 0) {
                console.log(`[Microi modern minify] ${current}/${total}：${file}`);
            }
        }
    });
    const ratio = result.sourceBytes > 0
        ? ((1 - result.outputBytes / result.sourceBytes) * 100).toFixed(1)
        : '0.0';
    console.log(
        `[Microi modern minify] 完成 ${result.fileCount} 个 JS 文件：` +
        `ESM ${result.moduleFileCount} 个，经典脚本 ${result.classicScriptFileCount} 个；` +
        `${(result.sourceBytes / 1024 / 1024).toFixed(1)} MB -> ` +
        `${(result.outputBytes / 1024 / 1024).toFixed(1)} MB，减少 ${ratio}%。`
    );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    main().catch((error) => {
        console.error(`[Microi modern minify] ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}
