import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import diyCommonMixin from "../src/views/form-engine/mixins/diy-common.mixin.js";
import tableUtilsMixin from "../src/views/form-engine/mixins/table-utils.mixin.js";

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

test("card grid defaults to four readable columns and preserves an explicit five-column layout", function () {
    const context = { SysMenuModel: {} };
    const getColumn = tableUtilsMixin.methods.GetTableCardCol.bind(context);
    const isFiveColumns = tableUtilsMixin.methods.IsCardFiveCol.bind(context);

    assert.equal(getColumn(), 6);
    assert.equal(isFiveColumns(), false);

    context.SysMenuModel.TableCardCol = "5";
    assert.equal(getColumn(), "five");
    assert.equal(isFiveColumns(), true);
});

test("card template and styles keep visible surfaces and no longer index rows by field Id", function () {
    const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const presentation = readFileSync(new URL("../src/views/form-engine/mixins/diy-table-presentation.mixin.js", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../src/styles/diy-table.scss", import.meta.url), "utf8");

    assert.match(component, /GetCardImageValue\(item, SysMenuModel\.TableCardImgField\)/);
    assert.doesNotMatch(component, /item\[SysMenuModel\.TableCardImgField\]/);
    assert.doesNotMatch(component, /class="preview card-image-fallback"/);
    assert.match(component, /class="card-avatar card-avatar--fallback"/);
    assert.match(component, /!GetCardImageValue\(item, SysMenuModel\.TableCardImgField\)/);
    assert.match(component, /@keydown\.enter\.prevent="CardItemClick\(item\)"/);
    assert.match(component, /@keydown\.space\.prevent="CardItemClick\(item\)"/);
    assert.match(component, /class="card-action-more-label">更多<\/span>/);
    assert.match(component, /class="card-mobile-detail"[\s\S]*?@click\.stop="CardItemClick\(item\)"/);
    assert.match(component, /PropsTableType !== 'OpenTable' && IsPermission\('NoDetail'\)/);
    assert.match(presentation, /device === "PC" \? "Mobile" : "PC"/);
    assert.match(presentation, /function withoutUsedFields\([\s\S]*?CardBottomFieldList\(\)[\s\S]*?withoutUsedFields/);
    assert.match(presentation, /const hasRawValue =[\s\S]*?return hasRawValue[\s\S]*?templateValue/);
    assert.doesNotMatch(styles, /\.card-image-fallback\s*\{/);
    assert.match(styles, /\.card-avatar--fallback\s*\{/);
    assert.match(styles, /\.card-action-btn-more\s*\{[\s\S]*?width:\s*34px;[\s\S]*?\.card-action-more-label/);
    assert.match(styles, /\.card-actions\s+:deep\(\.card-action-btn\s*>\s*span\)[\s\S]*?color:\s*inherit\s*!important/);
    assert.doesNotMatch(styles, /\.card-actions\s*\{\s*display:\s*grid/);
    assert.match(styles, /\.card-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?overflow-x:\s*auto;/);
    assert.match(styles, /\.card-mobile-detail\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?margin:\s*0 0 0 auto;/);
    assert.match(styles, /\.card-title-main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/);
    assert.match(styles, /\.card-field-row\s*\{[\s\S]*?min-height:\s*24px;[\s\S]*?padding:\s*2px 0;/);
    assert.match(styles, /\.card-field-value\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/);
    assert.match(styles, /\.card-actions\s*\{[\s\S]*?min-height:\s*52px;[\s\S]*?padding:\s*4px 8px;/);
    assert.match(styles, /\.box-card\.card-redesign\s*\{[\s\S]*?&:focus-visible/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.box-card\.card-data-animate/);
});
