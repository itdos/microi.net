import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';
import { modernBuildTargets } from './modern-build-pipeline.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const defaultDistDir = path.join(projectDir, 'bin', 'Release', 'dist');

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

export async function minifyModernOutput({
    distDir = defaultDistDir,
    onProgress = () => {}
} = {}) {
    const resolvedDistDir = path.resolve(distDir);
    const distInfo = await stat(resolvedDistDir);
    if (!distInfo.isDirectory()) throw new Error(`现代产物目录不是文件夹：${resolvedDistDir}`);

    const files = await listModernJavaScriptFiles(resolvedDistDir);
    let sourceBytes = 0;
    let outputBytes = 0;

    for (let index = 0; index < files.length; index += 1) {
        const filePath = files[index];
        const source = await readFile(filePath, 'utf8');
        sourceBytes += Buffer.byteLength(source);

        const result = await transformWithEsbuild(source, filePath, {
            loader: 'js',
            target: modernBuildTargets,
            format: 'esm',
            minify: true,
            treeShaking: true,
            sourcemap: false,
            legalComments: 'none',
            charset: 'utf8',
            drop: ['console', 'debugger'],
            supported: {
                'dynamic-import': true,
                'import-meta': true
            }
        });
        const output = result.code;
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
            file: path.relative(resolvedDistDir, filePath)
        });
        globalThis.gc?.();
    }

    return { fileCount: files.length, sourceBytes, outputBytes };
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
