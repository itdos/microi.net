import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import diyCommonMixin from "../src/views/form-engine/mixins/diy-common.mixin.js";

function createContext(overrides = {}) {
    const context = {
        DiyCommon: {
            IsNull(value) {
                return value === undefined || value === null || value === "";
            }
        },
        DiyFieldList: [],
        CardShowDiyFieldList: [],
        MobileShowFieldList: [],
        SysConfig: { FileServer: "https://files.example.com/" },
        SysMenuModel: {},
        ...overrides
    };
    Object.entries(diyCommonMixin.methods).forEach(([name, method]) => {
        context[name] = method.bind(context);
    });
    return context;
}

test("card image configuration accepts diy_field Id and resolves the row field name", function () {
    const avatar = {
        Id: "avatar-field-id",
        Name: "Avatar",
        AsName: "",
        Component: "ImgUpload",
        Config: JSON.stringify({ ImgUpload: { Limit: true } })
    };
    const context = createContext({
        DiyFieldList: [avatar],
        CurrentDiyTableModel: { Name: "sys_user" }
    });
    const row = { Id: "user-1", Avatar: "/tenant/avatar/user.png" };

    assert.equal(context.GetCardImageFieldName("avatar-field-id"), "Avatar");
    assert.equal(context.GetCardImageValue(row, "avatar-field-id"), row.Avatar);
    assert.equal(context.IsPrivateCardImageField("avatar-field-id"), true);
});

test("public card image Id resolves to a usable file server URL", function () {
    const context = createContext({
        DiyFieldList: [{ Id: "icon-field-id", Name: "Icon", Config: "" }]
    });
    context.GetFileServerUrl = (value) => `https://files.example.com${value}`;
    const row = { Id: "icon-1", Icon: "/itdos/img/icon.png" };

    assert.equal(
        context.GetCardImageUrl(row, "icon-field-id"),
        "https://files.example.com/itdos/img/icon.png"
    );
});

test("full-width legacy card images use a vertical layout and empty images use initials", function () {
    const title = { Id: "name-id", Name: "Name" };
    const context = createContext({
        CardPrimaryField: title,
        SysMenuModel: {
            TableCardImgField: "icon-id",
            TableCardImgPosition: "Left",
            TableCardImgStyle: "height:100px;width:100%;object-fit:contain;padding:10px;"
        }
    });

    assert.equal(context.GetCardContentLayoutClass(), "card-content-vertical");
    assert.equal(context.GetCardImageFallbackText({ Name: "吾码" }), "吾");

    context.SysMenuModel.TableCardImgStyle = "";
    assert.equal(context.GetCardContentLayoutClass(), "card-content-horizontal");
});

test("card template and styles keep visible surfaces and no longer index rows by field Id", function () {
    const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const presentation = readFileSync(new URL("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

    assert.match(component, /GetCardImageValue\(item, SysMenuModel\.TableCardImgField\)/);
    assert.doesNotMatch(component, /item\[SysMenuModel\.TableCardImgField\]/);
    assert.match(component, /class="preview card-image-fallback"/);
    assert.match(component, /v-if="!SysMenuModel\.TableCardImgField"/);
    assert.match(presentation, /device === "PC" \? "Mobile" : "PC"/);
    assert.match(presentation, /function withoutUsedFields\([\s\S]*?CardBottomFieldList\(\)[\s\S]*?withoutUsedFields/);
    assert.match(presentation, /const hasRawValue =[\s\S]*?return hasRawValue[\s\S]*?templateValue/);
    assert.match(styles, /\.card-image-fallback\s*\{[\s\S]*?radial-gradient[\s\S]*?font-size:\s*27px;/);
    assert.match(styles, /\.card-wrapper-desktop\s*\{[\s\S]*?&::before\s*\{[\s\S]*?linear-gradient/);
    assert.match(styles, /\.card-wrapper-desktop\s*\{[\s\S]*?&::after\s*\{[\s\S]*?transition:\s*opacity/);
});
