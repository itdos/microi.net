// zhy：回归覆盖私有上传即时预览、服务端 Limit 优先级及临时 URL 不入库约束。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    getUploadPreviewUrl,
    resolveUploadLimit,
    sanitizeUploadMeta
} from "../src/utils/upload-response.js";

const fileUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-fileupload.vue", import.meta.url),
    "utf8"
);
const imgUploadSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-imgupload.vue", import.meta.url),
    "utf8"
);

function occurrenceCount(source, value) {
    return source.split(value).length - 1;
}

// zhy：锁定服务端实际私有策略高于字段历史配置。
test("server upload policy overrides stale field configuration", () => {
    assert.equal(resolveUploadLimit({ Limit: true }, false), true);
    assert.equal(resolveUploadLimit({ Limit: false }, true), false);
    assert.equal(resolveUploadLimit({ Limit: "true" }, false), true);
    assert.equal(resolveUploadLimit({}, "true"), true);
});

// zhy：锁定短期地址可用于预览，但不会进入持久化文件元数据。
test("upload preview URL is read without persisting transient response fields", () => {
    const responseData = {
        Id: "file-1",
        Name: "contract.pdf",
        Path: "/tenant/contract.pdf",
        Url: "/api/HDFS/PrivateFile?id=temporary",
        FullPath: "https://storage.example/temporary",
        Limit: true,
        Version: "v1.0.0"
    };

    assert.equal(
        getUploadPreviewUrl(responseData),
        "/api/HDFS/PrivateFile?id=temporary"
    );
    assert.deepEqual(sanitizeUploadMeta(responseData), {
        Id: "file-1",
        Name: "contract.pdf",
        Path: "/tenant/contract.pdf",
        Version: "v1.0.0"
    });
    assert.equal(responseData.Url, "/api/HDFS/PrivateFile?id=temporary");
});

// zhy：锁定图片和附件组件均在更新模型前消费本次上传的短期地址。
test("image and file upload callbacks consume the transient URL before model updates", () => {
    for (const source of [fileUploadSource, imgUploadSource]) {
        assert.match(source, /const uploadedPreviewUrl = getUploadPreviewUrl\(responseData\)/);
        assert.match(source, /const effectiveLimit = resolveUploadLimit\(responseData,/);
        assert.equal(
            occurrenceCount(source, "effectiveLimit, uploadedPreviewUrl"),
            2
        );
        assert.match(
            source,
            /if \(!DiyCommon\.IsNull\(uploadedPreviewUrl\)\) \{\s*props\.FormDiyTableModel\[pathKey\] = uploadedPreviewUrl;\s*return;/s
        );
    }

    assert.match(fileUploadSource, /\.\.\.sanitizeUploadMeta\(responseData\)/);
    assert.match(imgUploadSource, /\.\.\.sanitizeUploadMeta\(responseData\)/);
});
