import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = relativePath => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('image and file uploads share one compact drag-and-config surface', async () => {
    const [summary, imageUpload, fileUpload] = await Promise.all([
        read('../src/views/form-engine/diy-field-component/diy-upload-compact-summary.vue'),
        read('../src/views/form-engine/diy-field-component/diy-imgupload.vue'),
        read('../src/views/form-engine/diy-field-component/diy-fileupload.vue')
    ]);

    assert.match(imageUpload, /<el-upload[\s\S]*?class="mci-compact-upload"[\s\S]*?<DiyUploadCompactSummary[\s\S]*?kind="image"/);
    assert.match(fileUpload, /<el-upload[\s\S]*?class="mci-compact-upload"[\s\S]*?<DiyUploadCompactSummary[\s\S]*?kind="file"/);
    assert.match(summary, /UploadSummaryPrivate/);
    assert.match(summary, /UploadSummaryPublic/);
    assert.match(summary, /UploadSummaryMultipleImages/);
    assert.match(summary, /UploadSummaryMultipleFiles/);
    assert.match(summary, /UploadSummaryCompressed/);
    assert.match(summary, /UploadSummaryMaxSize/);
    assert.match(summary, /data-testid="image-crop-runtime-toggle"/);
    assert.match(summary, /@click\.stop/);
});
