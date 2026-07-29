import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getUploadErrorMessage,
    isUploadRequestTooLarge
} from '../src/utils/upload-error.js';

test('识别 Element Plus 上传返回的 413', () => {
    assert.equal(isUploadRequestTooLarge({ status: 413 }), true);
    const message = getUploadErrorMessage({ status: 413 }, { size: 240 * 1024 * 1024 });
    assert.match(message, /HTTP 413/);
    assert.match(message, /240\.0MB/);
    assert.match(message, /client_max_body_size/);
});

test('识别 nginx 原生错误文本', () => {
    assert.equal(isUploadRequestTooLarge({ message: '413 Content Too Large' }), true);
});

test('优先展示后端 DosResult 的详细 Msg', () => {
    const message = getUploadErrorMessage({
        status: 200,
        response: { data: { Code: 0, Msg: '服务端给出的详细解决方案' } }
    });
    assert.equal(message, '服务端给出的详细解决方案');
});

test('普通网络错误不误报为 413', () => {
    assert.equal(isUploadRequestTooLarge({ message: 'Network Error' }), false);
    assert.match(getUploadErrorMessage({ message: 'Network Error' }), /浏览器未能读取/);
});

