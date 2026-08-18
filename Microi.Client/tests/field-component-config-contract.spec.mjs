import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, "..");
const componentRoot = path.join(clientRoot, "src/views/form-engine/diy-field-component");
const registryPath = path.join(clientRoot, "src/views/form-engine/field-component-config-registry.js");
const registrySource = fs.readFileSync(registryPath, "utf8");
const componentList = JSON.parse(fs.readFileSync(path.join(componentRoot, "diy-component-list.json"), "utf8"));

const extractFrozenArray = (name) => {
    const match = registrySource.match(new RegExp(`export const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`));
    assert.ok(match, `${name} must remain an explicit frozen array`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
};

const nativeControls = extractFrozenArray("NATIVE_FIELD_CONFIG_COMPONENTS");
const genericControls = extractFrozenArray("GENERIC_FIELD_CONFIG_COMPONENTS");

const componentFiles = {
    Alert: "diy-alert.vue",
    Address: "diy-address.vue",
    Autocomplete: "diy-autocomplete.vue",
    AutoNumber: "diy-autonumber.vue",
    Button: "diy-button.vue",
    Cascader: "diy-cascader.vue",
    Checkbox: "diy-checkbox.vue",
    CodeEditor: "diy-code-editor.vue",
    ColorPicker: "diy-colorpicker.vue",
    CollapseGroup: "diy-collapse-group.vue",
    DateTime: "diy-datetime.vue",
    Department: "diy-department.vue",
    DevComponent: "diy-devcomponent.vue",
    Divider: "diy-divider.vue",
    FileUpload: "diy-fileupload.vue",
    FontAwesome: "diy-fontawesome.vue",
    Guid: "diy-input.vue",
    Html: "diy-html.vue",
    ImgUpload: "diy-imgupload.vue",
    Input: "diy-input.vue",
    InputNumber: "diy-input-number.vue",
    JoinForm: "diy-joinform.vue",
    JoinTable: "diy-jointable.vue",
    JsonTable: "diy-jsontable.vue",
    Map: "diy-map.vue",
    MapArea: "diy-map.vue",
    MultipleSelect: "diy-select.vue",
    NumberText: "diy-input-number.vue",
    OpenTable: "diy-opentable.vue",
    Progress: "diy-progress.vue",
    Qrcode: "diy-qrcode.vue",
    Radio: "diy-radio.vue",
    Rate: "diy-rate.vue",
    RichText: "diy-richtext.vue",
    Select: "diy-select.vue",
    SelectTree: "diy-select-tree.vue",
    Slider: "diy-slider.vue",
    StaticText: "diy-statictext.vue",
    Switch: "diy-switch.vue",
    TableChild: "diy-tablechild.vue",
    Tabs: "diy-tabs.vue",
    TagInput: "diy-taginput.vue",
    Text: "diy-input.vue",
    Textarea: "diy-textarea.vue",
    Transfer: "diy-transfer.vue",
    TreeCheckbox: "diy-treecheckbox.vue"
};

test("every designer control has one explicit double-click configuration owner", () => {
    const declaredControls = componentList.map((item) => item.Control).sort();
    const ownedControls = [...nativeControls, ...genericControls]
        .filter((control) => declaredControls.includes(control))
        .sort();

    assert.deepEqual(ownedControls, declaredControls);
    assert.equal(new Set([...nativeControls, ...genericControls]).size, nativeControls.length + genericControls.length);
});

test("every native configuration owner exposes openConfig from its real component", () => {
    for (const control of nativeControls) {
        const fileName = componentFiles[control];
        assert.ok(fileName, `${control} must map to its actual renderer`);
        const source = fs.readFileSync(path.join(componentRoot, fileName), "utf8");
        assert.match(source, /openConfig\s*(?:=|\()/, `${control} (${fileName}) must expose openConfig`);
    }
});

test("async render timing cannot reroute a native control into the generic dialog", () => {
    const mixin = fs.readFileSync(path.join(clientRoot, "src/views/form-engine/mixins/diy-form-designer.mixin.js"), "utf8");
    assert.match(mixin, /hasNativeFieldConfig\(field\.Component\)/);
    assert.match(mixin, /attempts\s*<\s*30/);
    assert.match(mixin, /refComponent\.openConfig\(\)/);
    assert.doesNotMatch(mixin, /if\s*\(refComponent\s*&&\s*typeof refComponent\.openConfig[\s\S]{0,500}CallbackOpenFieldSettings/);
});

test("Switch owns only Switch settings and uses the unified rounded dialog", () => {
    const source = fs.readFileSync(path.join(componentRoot, "diy-switch.vue"), "utf8");
    assert.match(source, /title="开关控件配置"/);
    assert.match(source, /mci-unified-dialog mci-field-config-dialog/);
    assert.match(source, /DisplayMode/);
    assert.match(source, /VisualStyle/);
    assert.match(source, /ActiveText/);
    assert.match(source, /InactiveText/);
    assert.match(source, /this\.field\.Config\.Switch/);
    assert.doesNotMatch(source, /CollapseGroup|JsonTable|TableChild/);
});

test("native and generic field settings share the platform rounded overlay contract", () => {
    const designer = fs.readFileSync(path.join(clientRoot, "src/views/form-engine/diy-design.vue"), "utf8");
    const mixin = fs.readFileSync(path.join(clientRoot, "src/views/form-engine/mixins/diy-form-designer.mixin.js"), "utf8");
    const runtime = fs.readFileSync(path.join(clientRoot, "src/utils/mci-dialog-runtime.js"), "utf8");
    const main = fs.readFileSync(path.join(clientRoot, "src/main.js"), "utf8");
    const styles = fs.readFileSync(path.join(clientRoot, "src/styles/mci-design.scss"), "utf8");
    assert.match(designer, /mci-unified-dialog mci-field-config-dialog/);
    assert.match(designer, /mci-unified-overlay mci-field-config-overlay/);
    assert.match(mixin, /_mciPendingFieldDialogObserver/);
    assert.match(mixin, /new MutationObserver/);
    assert.match(mixin, /markLatestFieldConfigDialog\(field\);\s*refComponent\.openConfig\(\)/);
    assert.match(mixin, /visibleBeforeOpen/);
    assert.match(mixin, /enhanceMciDialog\(dialog,\s*buildDialogContext\(\)\)/);
    assert.match(runtime, /dialog\.classList\.add\("mci-unified-dialog",\s*"mci-native-title-dialog"\)/);
    assert.match(runtime, /dialog\.classList\.add\("mci-field-config-dialog"\)/);
    assert.match(runtime, /dialog\.dataset\.mciDialogContract\s*=\s*state\.context\?\.variant\s*\|\|\s*"dialog"/);
    assert.match(runtime, /overlay\.dataset\.mciDialogContract\s*=\s*state\.context\?\.variant\s*\|\|\s*"dialog"/);
    assert.match(runtime, /mci-field-config-heading/);
    assert.match(runtime, /node\.textContent\s*!==\s*value/);
    assert.match(runtime, /installFallbackDrag/);
    assert.match(runtime, /new MutationObserver/);
    assert.match(runtime, /attributes:\s*true/);
    assert.match(runtime, /attributeFilter:\s*\["class"\]/);
    assert.match(main, /installMciDialogRuntime\(\)/);
    assert.match(mixin, /requestAnimationFrame\(function\s*\(\)\s*\{[\s\S]*enhanceMciDialog\(dialog,\s*buildDialogContext\(\)\)/);
    assert.match(styles, /\.el-dialog\.mci-field-config-dialog/);
    assert.match(styles, /\.mci-field-config-heading/);
    assert.match(styles, /FIELD SETTINGS/);
    assert.match(styles, /&\.is-dragging/);
    assert.match(styles, /border-radius:\s*22px !important/);
    assert.match(styles, /data-mci-dialog-contract="field"/);
    assert.match(styles, /align-items:\s*center[\s\S]*?justify-content:\s*center/);
    assert.match(styles, /min-width:\s*96px[\s\S]*?height:\s*42px/);
    assert.match(styles, /\.mci-component-config-form[\s\S]*?border:\s*0[\s\S]*?background:\s*transparent/);
});
