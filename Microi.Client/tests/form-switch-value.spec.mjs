import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "@vue/compiler-sfc";
import { parse as parseJavaScript } from "@babel/parser";

import { hasSwitchNullValueEnabled, normalizeFormSwitchValue, prepareFormSwitchModelValue } from "../src/utils/form-switch-value.js";

test("FormEngine Switch strictly normalizes numeric, boolean and legacy string values", () => {
    for (const value of [1, true, "1", " true ", "TRUE"]) {
        assert.equal(normalizeFormSwitchValue(value), 1, `${JSON.stringify(value)} should be enabled`);
    }

    for (const value of [0, false, "0", " false ", "", null, undefined, 2, "yes"]) {
        assert.equal(normalizeFormSwitchValue(value), 0, `${JSON.stringify(value)} should be disabled`);
    }
});

const inheritEnabledField = {
    Name: "MqttEnable",
    Component: "Switch",
    Config: { Switch: { NullValue: 1, ActiveText: "已开启", InactiveText: "已关闭" } }
};

test("Switch NullValue opt-in projects only absent values, not explicit disabled values", () => {
    for (const value of [null, undefined, "", "  "]) {
        assert.equal(normalizeFormSwitchValue(value, inheritEnabledField), 1);
        assert.equal(prepareFormSwitchModelValue(value, inheritEnabledField), value,
            "loading must preserve the original empty value in the submitted form model");
        assert.equal(normalizeFormSwitchValue(value, { Component: "Switch" }), 0);
        assert.equal(prepareFormSwitchModelValue(value, { Component: "Switch" }), 0);
    }
    for (const value of [0, false, "0", " false "]) {
        assert.equal(normalizeFormSwitchValue(value, inheritEnabledField), 0);
    }
    assert.equal(normalizeFormSwitchValue(1, inheritEnabledField), 1);
    assert.equal(normalizeFormSwitchValue(null, { Config: { Switch: { NullValue: "yes" } } }), 0);
    assert.equal(hasSwitchNullValueEnabled({ Config: '{"Switch":{"NullValue":1}}' }), true);
});

test("Switch editor displays inherited enable without mutating NULL, then submits explicit 0/1", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, "../src/views/form-engine/diy-field-component/diy-switch.vue"), "utf8");
    const parsed = parse(source);
    assert.deepEqual(parsed.errors, []);
    const script = parsed.descriptor.script.content
        .replace(/^import .*;\s*$/gm, "")
        .replace("export default {", "module.exports = {");
    const context = {
        module: { exports: {} },
        defineAsyncComponent: () => ({}),
        isFormMaskBlurDisabled: () => false,
        normalizeFormSwitchValue
    };
    vm.runInNewContext(script, context, { filename: "diy-switch.vue" });
    const component = context.module.exports;
    const form = { MqttEnable: prepareFormSwitchModelValue(null, inheritEnabledField) };
    const emissions = [];
    const editor = {
        field: inheritEnabledField,
        FormDiyTableModel: form,
        ModelValue: 0,
        isInitializing: true,
        $nextTick(callback) { callback(); },
        $emit(event, value) {
            emissions.push(event);
            if (event === "update:modelValue") form.MqttEnable = value;
        }
    };
    Object.assign(editor, component.methods);
    Object.defineProperty(editor, "SwitchConfig", { get() { return component.computed.SwitchConfig.call(editor); } });

    editor.Init();
    assert.equal(editor.ModelValue, 1, "inherited NULL must display as enabled");
    assert.equal(component.computed.SwitchStateText.call(editor), "已开启");
    assert.equal(form.MqttEnable, null, "opening the editor must not persist a synthetic 1");
    assert.deepEqual(emissions, []);
    assert.equal({ ...form }.MqttEnable, null, "untouched form submission must preserve NULL");

    editor.ModelChangeMethods(0);
    assert.equal(form.MqttEnable, 0, "explicit off must submit 0");
    editor.ModelChangeMethods(1);
    assert.equal(form.MqttEnable, 1, "explicit on must submit 1");

    const ordinary = { ...editor, field: { Name: "OtherSwitch", Component: "Switch" }, FormDiyTableModel: { OtherSwitch: null } };
    ordinary.Init();
    assert.equal(ordinary.ModelValue, 0, "unconfigured Switch keeps legacy NULL=off behavior");
    assert.equal(ordinary.FormDiyTableModel.OtherSwitch, null);
});

test("shared field-value normalization also receives Switch field metadata", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, "../src/utils/diy.common.js"), "utf8");
    assert.ok(/prepareFormSwitchModelValue\(formData\s*&&\s*formData\[field\.Name\],\s*field\)/.test(source));
});

function readMixinMethod(relativePath, name) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.join(here, relativePath), "utf8");
    const ast = parseJavaScript(source, { sourceType: "module" });
    const component = ast.program.body.find((node) => node.type === "ExportDefaultDeclaration").declaration;
    const methods = component.properties.find((node) => node.key.name === "methods").value.properties;
    const method = methods.find((node) => node.key.name === name);
    assert.ok(method, `${name} should exist`);
    return vm.runInNewContext(`({${source.slice(method.start, method.end)}})`, {
        hasSwitchNullValueEnabled,
        normalizeFormSwitchValue
    })[name];
}

test("SaaS ViewSchema list and card show inherited enable instead of a blank or disabled tag", () => {
    const getColValue = readMixinMethod("../src/views/form-engine/mixins/diy-table-schema.mixin.js", "GetColValue");
    const hasPresentationFieldValue = readMixinMethod("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", "HasPresentationFieldValue");
    const getPresentationTone = readMixinMethod("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", "GetPresentationTone");
    const context = {
        DiyCommon: { IsNull: (value) => value === null || value === undefined || value === "" },
        _GetTableFieldRawValue: (scope, field) => scope.row[field.Name],
        _EnsureTableFieldConfig: (field) => typeof field.Config === "string" ? JSON.parse(field.Config) : field.Config,
        isMuban: () => false
    };
    const mqttField = { ...inheritEnabledField, Tone: "success", Config: '{"Switch":{"NullValue":1}}' };
    assert.equal(getColValue.call(context, { row: { MqttEnable: null } }, mqttField), "已开启");
    assert.equal(getColValue.call(context, { row: { MqttEnable: 0 } }, mqttField), "已关闭");
    assert.equal(hasPresentationFieldValue.call(context, { MqttEnable: null }, mqttField), true);
    assert.equal(hasPresentationFieldValue.call(context, { MqttEnable: 0 }, mqttField), true);
    assert.equal(hasPresentationFieldValue.call(context, { OtherSwitch: null }, { Name: "OtherSwitch", Component: "Switch" }), false);
    assert.equal(getPresentationTone.call(context, mqttField, { MqttEnable: null }), "success");
    assert.equal(getPresentationTone.call(context, mqttField, { MqttEnable: 0 }), "neutral");
});
