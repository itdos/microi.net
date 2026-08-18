import assert from "node:assert/strict";
import test from "node:test";
import { Base64 } from "js-base64";
import {
    decodeLegacyDiyFieldSources,
    decodeLegacyFieldSource
} from "../src/utils/field-source-codec.js";

test("plain SQL and V8 source never become mojibake", () => {
    const sql = "SELECT 名称 FROM 客户 WHERE 状态 = '启用'";
    const v8 = "return { Code: 1, Msg: '保存成功' };";
    assert.equal(decodeLegacyFieldSource(sql), sql);
    assert.equal(decodeLegacyFieldSource(v8), v8);
    assert.equal(decodeLegacyFieldSource("test"), "test");
    assert.equal(decodeLegacyFieldSource("YWJjZA=="), "YWJjZA==");
});

test("historical Base64 SQL and V8 values remain readable", () => {
    const sql = "SELECT Id, 名称 FROM 客户 WHERE 名称 LIKE $Keyword$ LIMIT 20";
    const v8 = "return V8.FormEngine.GetTableData('客户', V8.Param);";
    assert.equal(decodeLegacyFieldSource(Base64.encode(sql)), sql);
    assert.equal(decodeLegacyFieldSource(Base64.encode(v8)), v8);
});

test("all historical field source slots use the safe decoder", () => {
    const model = {
        KeyupV8Code: Base64.encode("return true;"),
        Config: {
            Sql: "SELECT * FROM 客户",
            V8Code: Base64.encode("return { Code: 1 };"),
            OpenTable: { SubmitV8: Base64.encode("return V8.Form.Id;") }
        }
    };
    decodeLegacyDiyFieldSources(model);
    assert.equal(model.KeyupV8Code, "return true;");
    assert.equal(model.Config.Sql, "SELECT * FROM 客户");
    assert.equal(model.Config.V8Code, "return { Code: 1 };");
    assert.equal(model.Config.OpenTable.SubmitV8, "return V8.Form.Id;");
});
