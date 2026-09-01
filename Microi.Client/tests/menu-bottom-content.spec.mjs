import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "@vue/compiler-sfc";

import {
    DEFAULT_MENU_BOTTOM_CONTENT,
    resolveMenuBottomContent
} from "../src/utils/menu-bottom-content.js";

const componentPath = new URL(
    "../src/layout/components/menu-bottom.vue",
    import.meta.url
);
const componentSource = await readFile(componentPath, "utf8");

test("empty configuration uses the framework version and dynamic year default", () => {
    assert.equal(
        DEFAULT_MENU_BOTTOM_CONTENT,
        `<div class="col-md-12">
     {{ OsVersion }}
</div>
<div class="col-md-12">
     Copyright © 2009 - {{ YYYY }}
</div>`
    );
    assert.equal(
        resolveMenuBottomContent({ content: "   ", osVersion: "v7.8.0", year: 2031 }),
        `<div class="col-md-12">
     v7.8.0
</div>
<div class="col-md-12">
     Copyright © 2009 - 2031
</div>`
    );
    assert.equal(
        resolveMenuBottomContent({ content: null, osVersion: "v7.8.0", year: 2031 }),
        resolveMenuBottomContent({ content: "", osVersion: "v7.8.0", year: 2031 })
    );
});

test("tenant content remains authoritative and supports both placeholder syntaxes", () => {
    assert.equal(
        resolveMenuBottomContent({
            content: "$OsVersion$ / {{ CompanyName }} / $SysTitle$ / $YYYY$ / {{ YYYY }}",
            osVersion: "v8.0.0",
            companyName: "吾码",
            sysTitle: "管理平台",
            year: 2032
        }),
        "v8.0.0 / 吾码 / 管理平台 / 2032 / 2032"
    );
});

test("menu footer renders for an initialized empty SysConfig", () => {
    const result = parse(componentSource, { filename: "menu-bottom.vue" });
    assert.deepEqual(result.errors, []);
    assert.match(componentSource, /v-if="SysConfig && MenuBottomContent"/);
    assert.doesNotMatch(componentSource, /v-if="SysConfig && SysConfig\.MenuBottomContent"/);
    assert.match(componentSource, /resolveMenuBottomContent/);
});
