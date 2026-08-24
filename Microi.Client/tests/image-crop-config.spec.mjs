import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    isCropSupportedImage,
    normalizeImageCropConfig,
    resolveCropAspectRatio
} from '../src/views/form-engine/diy-field-component/image-crop-config.js';

test('legacy image fields keep cropping disabled with safe editing defaults', () => {
    assert.deepEqual(normalizeImageCropConfig(), {
        Enabled: false,
        Mode: 'free',
        Ratio: 'free',
        CustomWidth: 1,
        CustomHeight: 1,
        AllowRotate: true,
        AllowFlip: true,
        AllowZoom: true
    });
});

test('fixed and selectable crop modes resolve preset and custom ratios', () => {
    const fixed = normalizeImageCropConfig({ Enabled: true, Mode: 'fixed', Ratio: '16:9' });
    const custom = normalizeImageCropConfig({
        Enabled: 'true',
        Mode: 'select',
        Ratio: 'custom',
        CustomWidth: 7,
        CustomHeight: 5
    });

    assert.equal(resolveCropAspectRatio(fixed), 16 / 9);
    assert.equal(resolveCropAspectRatio(custom), 7 / 5);
    assert.ok(Number.isNaN(resolveCropAspectRatio(custom, 'free')));
});

test('crop mode accepts only canvas-safe still image formats', () => {
    assert.equal(isCropSupportedImage({ type: 'image/jpeg' }), true);
    assert.equal(isCropSupportedImage({ type: 'image/png' }), true);
    assert.equal(isCropSupportedImage({ type: 'image/webp' }), true);
    assert.equal(isCropSupportedImage({ type: 'image/gif' }), false);
    assert.equal(isCropSupportedImage({ type: 'image/svg+xml' }), false);
});

test('ImgUpload exposes a per-form crop choice and the crop studio can bypass without cancelling upload', async () => {
    const upload = await readFile(
        new URL('../src/views/form-engine/diy-field-component/diy-imgupload.vue', import.meta.url),
        'utf8'
    );
    const dialog = await readFile(
        new URL('../src/views/form-engine/diy-field-component/diy-image-crop-dialog.vue', import.meta.url),
        'utf8'
    );
    const summary = await readFile(
        new URL('../src/views/form-engine/diy-field-component/diy-upload-compact-summary.vue', import.meta.url),
        'utf8'
    );

    assert.match(summary, /data-testid="image-crop-runtime-toggle"/);
    assert.match(upload, /v-model:crop-enabled="runtimeCropEnabled"/);
    assert.match(upload, /label="默认开启裁剪"/);
    assert.match(upload, /if \(!cropResult\.bypass\) pendingCropUploads\.set/);
    assert.match(upload, /normalizeUploadResponseItem\(file\.response\?\.Data \?\? result\.Data\)/);
    assert.match(dialog, /ImageCropBypassUpload/);
    assert.match(dialog, /emit\('bypass', props\.file\)/);
});
