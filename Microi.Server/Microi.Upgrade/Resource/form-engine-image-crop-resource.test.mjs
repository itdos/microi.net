import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(resourceRoot, 'app.microi.form-engine.json');
const appPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

test('form engine package declares image crop and rich text upload contracts', () => {
    const capabilities = appPackage.PackageInfo.RequiredPlatformCapabilities || [];
    assert.ok(capabilities.includes('ClientFeature:ImgUploadCropStudio'));
    assert.ok(capabilities.includes('ClientFeature:ImgUploadCropRuntimeChoice'));
    assert.ok(capabilities.includes('ClientFeature:DialogMaskBlurPolicy'));
    assert.ok(capabilities.includes('ClientFeature:UploadCompactConfigSummary'));
    assert.ok(capabilities.includes('ServerFeature:ImgUploadCropOriginal'));
    assert.ok(capabilities.includes('ClientFeature:RichTextUploadPolicy'));
    assert.ok(capabilities.includes('ServerFeature:RichTextPrivateAssetAuthorization'));
    assert.equal(appPackage.PackageInfo.Version, 'v7.6.1');
    assert.ok(capabilities.includes('ClientFeature:SmartExcelImportPreview'));
    assert.ok(capabilities.includes('ServerFeature:ExcelImportConfirmedRange'));
    assert.match(appPackage.PackageInfo.ChangeHistory, /v7\.6\.1[\s\S]*自动识别[\s\S]*每页 15 条预览/);
    assert.match(appPackage.PackageInfo.ChangeHistory, /v7\.6\.0[\s\S]*RichText[\s\S]*临时 Token 不落库/);
});

test('all packaged field defaults keep cropping opt-in and expose every supported mode setting', () => {
    const configuredFields = (appPackage.DiyFields || [])
        .filter(field => typeof field.Config === 'string' && field.Config.includes('"ImgUpload"'))
        .map(field => ({ field, config: JSON.parse(field.Config) }))
        .filter(item => item.config?.ImgUpload);

    assert.ok(configuredFields.length > 0);
    for (const { field, config } of configuredFields) {
        assert.deepEqual(config.ImgUpload.Crop, {
            Enabled: false,
            Mode: 'free',
            Ratio: '1:1',
            CustomWidth: 1,
            CustomHeight: 1,
            AllowRotate: true,
            AllowFlip: true,
            AllowZoom: true
        }, `${field.TableName}.${field.Name} must carry the complete legacy-safe crop default`);
    }
});
