import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import diyCommonMixin from "../src/views/form-engine/mixins/diy-common.mixin.js";
import diyTableStateMixin from "../src/views/form-engine/mixins/diy-table-state.mixin.js";
import diyTableUiMixin from "../src/views/form-engine/mixins/diy-table-ui.mixin.js";
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
    context.GetColValue = ({ row }, field) => row[field.AsName || field.Name];
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

test("mobile summary prioritizes total records and one business aggregate", function () {
    const context = {
        ModuleMetricItems: [
            { Id: "amount", Key: "AutoAggregate:Amount", Label: "预期交易金额合计", Value: 126252327 },
            { Id: "count", Key: "AutoDataCount", Label: "筛选结果", Value: 3368 },
            { Id: "page", Key: "AutoPageCount", Label: "本页展示", Value: 15 }
        ],
        secondaryTableReportItems: [
            { Id: "other", Label: "订单数量合计", Value: 308 }
        ]
    };
    const result = diyTableStateMixin.computed.MobileSummaryItems.call(context);

    assert.deepEqual(result.map((item) => item.Label), ["筛选结果", "预期交易金额合计"]);
    assert.equal(result[1].Prefix, "¥");
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

test("mobile card more menu remains available for outside, inside, edit, workflow, restore and delete actions", function () {
    const context = {
        diyStore: { IsPhoneView: true },
        IsTrashMode: false,
        IsWorkFlowMenu() { return false; },
        TableChildField: { Readonly: false },
        TableChildFormMode: "Edit",
        _LimitEdit: true,
        _LimitDel: true
    };
    const shouldShow = diyTableUiMixin.methods.ShouldShowMobileCardMoreAction.bind(context);

    assert.equal(shouldShow({ _RowMoreBtnsOut: [{ IsVisible: true }] }), true);
    assert.equal(shouldShow({ _RowMoreBtnsIn: [{ IsVisible: true }] }), true);
    assert.equal(shouldShow({ IsVisibleEdit: true }), true);
    assert.equal(shouldShow({ IsVisibleDel: true }), true);

    context.IsWorkFlowMenu = () => true;
    assert.equal(shouldShow({ _IsInTableAdd: false }), true);

    context.IsTrashMode = true;
    assert.equal(shouldShow({ _IsInTableAdd: false }), true);
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
    assert.match(component, /class="mobile-card-select-toggle"[\s\S]*?toggleCardSelection\(item\)/);
    assert.match(component, /v-if="!diyStore\.IsPhoneView" class="card-actions"/);
    assert.match(component, /class="card-mobile-footer-actions"[\s\S]*?showMoreMenu\(\$event, item\)/);
    assert.match(component, /class="card-mobile-detail"[\s\S]*?@click\.stop="CardItemClick\(item\)"/);
    assert.match(component, /class="card-mobile-detail"[\s\S]*?<ArrowRight\s*\/>/);
    assert.match(component, /class="mobile-list-summary"[\s\S]*?MobileSummaryItems/);
    assert.match(component, /class="card-mobile-footer-meta__item"/);
    assert.match(component, /PropsTableType !== 'OpenTable' && IsPermission\('NoDetail'\)/);
    assert.match(component, /_moreMenuRow\._RowMoreBtnsOut[\s\S]*?handleMoreMenuAction\('custom', btn\)/);
    assert.match(component, /_moreMenuRow\._RowMoreBtnsIn[\s\S]*?handleMoreMenuAction\('custom', btn\)/);
    assert.match(component, /handleMoreMenuAction\('workflow'\)/);
    assert.match(component, /handleMoreMenuAction\('restore'\)/);
    assert.match(presentation, /device === "PC" \? "Mobile" : "PC"/);
    assert.match(presentation, /function withoutUsedFields\([\s\S]*?CardBottomFieldList\(\)[\s\S]*?withoutUsedFields/);
    assert.match(presentation, /const hasRawValue =[\s\S]*?return hasRawValue[\s\S]*?templateValue/);
    assert.match(presentation, /if \(!value\.trim\(\) && this\.CardPrimaryField\)[\s\S]*?this\.GetPresentationFieldValue\(row, this\.CardPrimaryField\)/);
    assert.doesNotMatch(styles, /\.card-image-fallback\s*\{/);
    assert.match(styles, /\.card-avatar--fallback\s*\{/);
    assert.match(styles, /\.card-action-btn-more\s*\{[\s\S]*?width:\s*34px;[\s\S]*?\.card-action-more-label/);
    assert.match(styles, /\.card-actions\s+:deep\(\.card-action-btn\s*>\s*span\)[\s\S]*?color:\s*inherit\s*!important/);
    assert.doesNotMatch(styles, /\.card-actions\s*\{\s*display:\s*grid/);
    assert.match(styles, /\.mobile-card-select-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/);
    assert.match(styles, /\.card-mobile-more,\s*\.card-mobile-detail\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?align-items:\s*center;/);
    assert.match(styles, /\.card-bottom-row\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?padding:\s*1px 0 0;/);
    assert.match(styles, /\.global-more-menu\.is-mobile-card-menu\s*\{[\s\S]*?bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom\)\);/);
    assert.match(styles, /\.card-title-main\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/);
    assert.match(styles, /\.mobile-list-summary\s*\{[\s\S]*?min-height:\s*86px;[\s\S]*?linear-gradient\(110deg/);
    assert.match(styles, /\.card-title-text\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
    assert.match(styles, /\.card-title-tags\s*\{[\s\S]*?>\s*:not\(:first-child\)/);
    assert.match(styles, /\.card-field-row\s*\{[\s\S]*?min-height:\s*27px;[\s\S]*?padding:\s*1px 0;/);
    assert.match(styles, /\.card-field-value\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
    assert.doesNotMatch(styles, /\.card-actions\s*\{[\s\S]{0,240}?min-height:\s*52px;[\s\S]{0,120}?height:\s*52px;/);
    assert.match(styles, /\.box-card\.card-redesign\s*\{[\s\S]*?&:focus-visible/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.box-card\.card-data-animate/);
});
