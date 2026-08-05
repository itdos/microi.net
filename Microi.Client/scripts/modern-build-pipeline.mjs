export const modernBuildTargets = Object.freeze([
    'chrome107',
    'edge107',
    'firefox104',
    'safari16'
]);

// 现代产物在 Rollup 退出后逐文件压缩。该版本参与 chunk hash；
// 若压缩参数改变，必须同步升级版本，避免 CDN 继续命中旧文件名。
export const modernMinifyPipelineVersion = 'microi-modern-post-minify-v2';

export function createModernPostMinifyFingerprintPlugin() {
    return {
        name: 'microi:modern-post-minify-fingerprint',
        apply: 'build',
        augmentChunkHash() {
            return modernMinifyPipelineVersion;
        }
    };
}
