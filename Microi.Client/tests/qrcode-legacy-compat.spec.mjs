import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

import {
    installLegacyQrCodeDownload,
    normalizeLegacyQrCodePayload,
    sanitizeQrCodeFileName
} from "../src/utils/legacy-qrcode.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("legacy field and batch payloads normalize to one QR card contract", () => {
    const fieldPayload = normalizeLegacyQrCodePayload({
        title: "风险点编号",
        titleValue: "1785738969638",
        Code: 1785738969638,
        fields: [{ Label: "风险点名称：", Value: "医药箱" }]
    });
    const batchPayload = normalizeLegacyQrCodePayload({
        title: "风险点编号",
        titleValue: "1785738969638",
        Code: "1785738969638",
        DataConfig: [{ label: "风险点名称：", key: "医药箱" }]
    }, { Color: "black" });

    assert.equal(fieldPayload.titleText, "风险点编号:1785738969638");
    assert.equal(fieldPayload.code, "1785738969638");
    assert.deepEqual(fieldPayload.fields, batchPayload.fields);
    assert.equal(batchPayload.color, "#000000");
});

test("download bridge preserves an existing tenant implementation", () => {
    const existing = () => "tenant implementation";
    const target = { downloadQRCode: existing };

    assert.equal(installLegacyQrCodeDownload(target), existing);
    assert.equal(target.downloadQRCode, existing);
});

test("legacy black color is converted to a value accepted by the Vue 3 QR library", async () => {
    const payload = normalizeLegacyQrCodePayload({ Code: "1785738969638" }, { Color: "black" });
    const image = await QRCode.toDataURL(payload.code, {
        color: { dark: payload.color, light: "#ffffff" }
    });

    assert.equal(payload.color, "#000000");
    assert.match(image, /^data:image\/png;base64,/);
});

test("download bridge installs the historical global function when missing", () => {
    const target = {};
    const bridge = installLegacyQrCodeDownload(target);

    assert.equal(typeof bridge, "function");
    assert.equal(target.downloadQRCode, bridge);
    assert.equal(bridge.__microiQrCodeBridge, true);
});

test("QR downloads use filesystem-safe names", () => {
    assert.equal(sanitizeQrCodeFileName('医药箱:/\\*?"<>|'), "医药箱_________");
    assert.equal(sanitizeQrCodeFileName("   "), "qrcode");
});

test("Qrcode field is a real renderer and main installs the compatibility bridge", () => {
    const fieldComponent = read("src/views/form-engine/diy-field-component/diy-qrcode.vue");
    const main = read("src/main.js");

    assert.match(fieldComponent, /createLegacyQrCodeCardDataUrl/);
    assert.match(fieldComponent, /class="diy-qrcode__card"/);
    assert.doesNotMatch(fieldComponent, /QrCodeGenerator 组件已注释/);
    assert.match(main, /installLegacyQrCodeDownload\(window/);
});

test("official docs and form-engine skill explain the runtime QR payload", () => {
    const docs = read("../microi.doc/docs/doc/form-engine/all-form-component.md");
    const skill = read("../microi.skills/microi-form-engine/references/component-catalog.md");

    for (const source of [docs, skill]) {
        assert.match(source, /DataAppend\.Code/);
        assert.match(source, /V8\.FieldSet\('Qrcode116', 'DataAppend'/);
        assert.match(source, /IsVirtual=1/);
        assert.match(source, /V8\.LoadMode !== 'Design'/);
    }
});
