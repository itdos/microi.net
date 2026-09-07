import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { loadClientModule } from "./helpers/load-client-module.mjs";
import {
    buildDiyFieldUniqueRules,
    DIY_FIELD_UNIQUE_MODE,
    ensureDiyFieldUniqueConfig,
    getDiyFieldUniqueMode,
    isDiyFieldUniqueEnabled
} from "../src/utils/diy-field-unique.js";

const { default: designerMixin } = await loadClientModule(
    new URL("../src/views/form-engine/mixins/diy-form-designer.mixin.js", import.meta.url)
);

function createDesignerContext(refs = {}) {
    const emitted = [];
    const tips = [];
    const context = {
        $refs: refs,
        $emit(...args) {
            emitted.push(args);
        },
        $nextTick(callback) {
            callback();
        },
        DiyCommon: {
            Tips(...args) {
                tips.push(args);
            }
        }
    };
    Object.keys(designerMixin.methods).forEach((name) => {
        context[name] = designerMixin.methods[name].bind(context);
    });
    return { context, emitted, tips };
}

test("Switch double-click selects the field without showing a false unsupported warning", () => {
    let opened = 0;
    const { context, emitted, tips } = createDesignerContext({
        ref_IsEnable: { openConfig() { opened += 1; } }
    });
    const field = { Id: "switch-1", Name: "IsEnable", Component: "Switch" };

    assert.equal(context.hasComponentConfig(field), true);
    context.openComponentConfig(field);

    assert.equal(context.CurrentDiyFieldModel, field);
    assert.deepEqual(emitted, [["CallbackSelectField", field]]);
    assert.deepEqual(tips, []);
    assert.equal(opened, 1);
});

test("components that expose openConfig still open their independent dialog", () => {
    let opened = 0;
    const field = { Id: "select-1", Name: "Category", Component: "Select" };
    const { context, tips } = createDesignerContext({
        ref_Category: {
            openConfig() {
                opened += 1;
            }
        }
    });

    assert.equal(context.hasComponentConfig(field), true);
    context.openComponentConfig(field);

    assert.equal(opened, 1);
    assert.deepEqual(tips, []);
});

test("legacy unique configuration is normalized without losing other field config", () => {
    const field = {
        Unique: 1,
        Config: '{"TextIcon":"search","Unique":{"Type":" all "}}'
    };

    assert.equal(isDiyFieldUniqueEnabled(field), true);
    const uniqueConfig = ensureDiyFieldUniqueConfig(field);

    assert.equal(uniqueConfig.Type, DIY_FIELD_UNIQUE_MODE.ALL);
    assert.equal(field.Config.TextIcon, "search");
});

test("missing unique mode safely defaults to standalone uniqueness", () => {
    const field = { Unique: true, Config: {} };

    const uniqueConfig = ensureDiyFieldUniqueConfig(field);

    assert.equal(uniqueConfig.Type, DIY_FIELD_UNIQUE_MODE.ALONE);
});

test("import duplicate rules preserve every standalone field and one composite group", () => {
    const fields = [
        { Name: "Code", Label: "编号", Unique: 1, Config: { Unique: { Type: "Alone" } } },
        { Name: "Phone", Label: "手机号", Unique: true, Config: "{}" },
        { Name: "TenantId", Label: "租户", Unique: 1, Config: { Unique: { Type: "All" } } },
        { Name: "ExternalCode", Label: "外部编号", Unique: "1", Config: '{"Unique":{"Type":"all"}}' },
        { Name: "Name", Label: "名称", Unique: 0, Config: {} }
    ];

    assert.equal(getDiyFieldUniqueMode(fields[3]), DIY_FIELD_UNIQUE_MODE.ALL);
    assert.deepEqual(buildDiyFieldUniqueRules(fields), [
        { Key: "Alone:Code", Type: "Alone", Fields: [{ Name: "Code", Label: "编号" }] },
        { Key: "Alone:Phone", Type: "Alone", Fields: [{ Name: "Phone", Label: "手机号" }] },
        {
            Key: "All:TenantId+ExternalCode",
            Type: "All",
            Fields: [
                { Name: "TenantId", Label: "租户" },
                { Name: "ExternalCode", Label: "外部编号" }
            ]
        }
    ]);
});

test("form designer SFC compiles and preserves the global Unique config block", () => {
    const filename = new URL("../src/views/form-engine/diy-design.vue", import.meta.url);
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);

    const script = compileScript(parsed.descriptor, { id: "form-designer-unique-config" });
    const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "form-designer-unique-config",
        compilerOptions: { bindingMetadata: script.bindings }
    });

    assert.deepEqual(template.errors, []);
    assert.match(source, /CallbackUniqueModeChange/);
    assert.doesNotMatch(source, /Unique\s*:\s*\[\s*["']Unique["']\s*\]/);
});
