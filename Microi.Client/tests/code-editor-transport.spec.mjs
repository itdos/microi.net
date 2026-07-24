import assert from "node:assert/strict";
import test from "node:test";

import {
    codeEditorTransportMarker,
    prepareCodeEditorTransport
} from "../src/utils/code-editor-transport.js";

function decodeBase64Url(encoded) {
    const value = encoded.slice(codeEditorTransportMarker.length)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const padded = value + "=".repeat((4 - value.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), function (char) {
        return char.charCodeAt(0);
    });
    return new TextDecoder().decode(bytes);
}

test("only CodeEditor fields use the explicit UTF-8 Base64URL envelope", function () {
    const source = "var 名称 = '乐歌';\nreturn { Code: 1, Data: 名称 };";
    const formData = {
        ApiV8Code: source,
        Name: "明文名称"
    };

    const metadata = prepareCodeEditorTransport(formData, [
        { Name: "ApiV8Code", Component: "CodeEditor" },
        { Name: "Name", Component: "Text" }
    ]);

    assert.deepEqual(metadata, {
        Version: 1,
        Encoding: "base64url",
        Fields: ["ApiV8Code"]
    });
    assert.match(formData.ApiV8Code, /^MICROI_B64URL_V1:[A-Za-z0-9_-]+$/);
    assert.equal(decodeBase64Url(formData.ApiV8Code), source);
    assert.equal(formData.Name, "明文名称");
});

test("forms without string CodeEditor values remain plaintext and omit metadata", function () {
    const formData = { ApiV8Code: null, Name: "test" };
    const metadata = prepareCodeEditorTransport(formData, [
        { Name: "ApiV8Code", Component: "CodeEditor" }
    ]);

    assert.equal(metadata, null);
    assert.equal(formData.ApiV8Code, null);
});
