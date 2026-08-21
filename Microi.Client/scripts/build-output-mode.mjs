import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const legacyStartMarker = '<!-- microi-legacy-start -->';

const internalBuildFlags = new Set([
    '--dry-run',
    '--legacy-only',
    '--preflight-only',
    '--with-legacy'
]);

export function resolveBuildOutputMode(rawArgs = []) {
    const legacyOnly = rawArgs.includes('--legacy-only');
    const includeLegacy = legacyOnly || rawArgs.includes('--with-legacy');
    const runModern = !legacyOnly;

    return {
        dryRun: rawArgs.includes('--dry-run'),
        includeLegacy,
        legacyOnly,
        mode: legacyOnly ? 'legacy-only' : includeLegacy ? 'modern-and-legacy' : 'modern-only',
        modeLabel: legacyOnly
            ? '仅生成 Chrome 49 legacy（复用现有现代产物）'
            : includeLegacy
                ? '现代版 + Chrome 49 legacy'
                : '仅现代版',
        preflightOnly: rawArgs.includes('--preflight-only'),
        runModern,
        viteArgs: [
            'build',
            ...rawArgs.filter((arg) => !internalBuildFlags.has(arg))
        ]
    };
}

export function validateBuildOutputMode({ distDir, includeLegacy }) {
    const indexPath = path.join(distDir, 'index.html');
    if (!existsSync(indexPath)) {
        throw new Error(`构建产物缺少 index.html：${indexPath}`);
    }

    const html = readFileSync(indexPath, 'utf8');
    const legacyJsDir = path.join(distDir, 'static', 'js-legacy');
    const hasLegacyDirectory = existsSync(legacyJsDir);
    const hasLegacyMarker = html.includes(legacyStartMarker);

    if (includeLegacy) {
        if (!hasLegacyDirectory || !hasLegacyMarker) {
            throw new Error(
                '已请求 Chrome 49 legacy，但 js-legacy 目录或 HTML legacy 入口缺失。'
            );
        }
    } else if (hasLegacyDirectory || hasLegacyMarker) {
        throw new Error(
            '现代版产物中检测到残留的 Chrome 49 legacy 文件；已阻止混合产物发布。'
        );
    }

    return {
        hasLegacyDirectory,
        hasLegacyMarker
    };
}
