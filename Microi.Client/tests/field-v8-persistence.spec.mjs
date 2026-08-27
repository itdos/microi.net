import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
    hydrateFieldValueChangeV8,
    persistFieldValueChangeV8,
    setFieldValueChangeV8
} from "../src/utils/diy-field-v8.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("field property changes update the real reactive field array entry", () => {
    const mixin = read("src/views/form-engine/mixins/diy-form-designer.mixin.js");
    assert.match(mixin, /findIndex\(\(element\)\s*=>\s*element\s*&&\s*element\.Id\s*==\s*field\.Id\)/);
    assert.match(mixin, /Object\.assign\(current,\s*field\)/);
    assert.match(mixin, /DiyFieldList\.splice\(index,\s*1,\s*current\)/);
    assert.doesNotMatch(mixin, /forEach\([^)]*=>\s*\{[\s\S]{0,180}element\s*=\s*field/);
});

test("save-all synchronizes the active V8 field before cloning and encoding", () => {
    const designer = read("src/views/form-engine/diy-design.vue");
    // Anchor to the method declaration. A preceding commented call is not the
    // save implementation and may contain unrelated clone operations after it.
    const saveAllIndex = designer.indexOf("        SaveAllDiyField() {");
    const syncIndex = designer.indexOf("self.$refs.fieldForm.UptDiyFieldArr(self.CurrentDiyFieldModel)", saveAllIndex);
    const cloneIndex = designer.indexOf("lodash.cloneDeep(self.DiyFieldList)", saveAllIndex);
    const encodeIndex = designer.indexOf("Base64EncodeDiyField(element)", saveAllIndex);
    assert.ok(saveAllIndex > -1, "save-all implementation must exist");
    assert.ok(syncIndex > -1, "active field must be synchronized");
    assert.ok(cloneIndex > syncIndex, "field list must be cloned only after synchronization");
    assert.ok(encodeIndex > cloneIndex, "V8 source must be encoded only after cloning the synchronized list");
});

test("value-change V8 alias round-trips through the physical Config JSON", () => {
    const field = {
        Id: "field-1",
        Name: "Autocomplete43",
        Component: "Autocomplete",
        Config: { DataSource: "Data", V8Code: "V8.Form.old = true;" }
    };

    hydrateFieldValueChangeV8(field);
    assert.equal(field.V8Code, "V8.Form.old = true;");

    setFieldValueChangeV8(field, "V8.Form.newValue = V8.ThisValue;");
    assert.equal(field.V8Code, "V8.Form.newValue = V8.ThisValue;");
    assert.equal(field.Config.V8Code, "V8.Form.newValue = V8.ThisValue;");

    field.V8Code = "";
    persistFieldValueChangeV8(field);
    assert.equal(field.Config.V8Code, "", "clearing the editor must also clear Config.V8Code");
});

test("server DTO empty V8Code placeholder cannot mask Config.V8Code", () => {
    const field = {
        Name: "Autocomplete43",
        V8Code: "",
        Config: { V8Code: "V8.Form.readback = V8.ThisValue;" }
    };

    hydrateFieldValueChangeV8(field);
    assert.equal(field.V8Code, "V8.Form.readback = V8.ThisValue;");
});

test("historical physical V8Code wins when Config.V8Code is empty", () => {
    const field = {
        Name: "MobileScanButton",
        Component: "Button",
        V8Code: "V8.ScanCode({ Type: 'barCode' });",
        Config: { V8Code: "" }
    };

    hydrateFieldValueChangeV8(field);

    assert.equal(field.V8Code, "V8.ScanCode({ Type: 'barCode' });");
    assert.equal(field.Config.V8Code, field.V8Code);
});

test("non-empty physical V8Code is not hidden by a divergent Config mirror", () => {
    const field = {
        Name: "LegacyButton",
        V8Code: "V8.FormSet('Source', 'physical');",
        Config: { V8Code: "V8.FormSet('Source', 'stale-config');" }
    };

    hydrateFieldValueChangeV8(field);

    assert.equal(field.V8Code, "V8.FormSet('Source', 'physical');");
    assert.equal(field.Config.V8Code, field.V8Code);
});

test("string Config is normalized before persisting the value-change handler", () => {
    const field = { Name: "Autocomplete43", V8Code: "return true;", Config: '{"Autocomplete":{"Limit":20}}' };
    persistFieldValueChangeV8(field);
    assert.equal(field.Config.Autocomplete.Limit, 20);
    assert.equal(field.Config.V8Code, "return true;");
});

test("shared code designer resets its preview from the current model instead of a template", () => {
    const designer = read("src/views/form-engine/diy-components/diy-code-design.vue");
    assert.match(designer, /if\s*\(options\.resetPreview\)\s*\{\s*previewCode\.value\s*=\s*currentModelCode\(\)/);
    assert.match(designer, /!previewCode\.value\s*&&\s*!options\.resetPreview/);
});
