import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    getTableChildFieldRelations,
    normalizeTableChildFieldRelations
} from "../src/utils/table-child-relations.js";

test("legacy TableChild callback, import match and backfill settings merge once", function () {
    const config = {
        TableChildCallbackField: JSON.stringify([
            { Father: "Code", Child: "XiangmuBM" },
            { Father: "Name", Child: "XiangmuMC" }
        ]),
        TableChild: {
            ImportRelations: [{ Parent: "Code", Child: "XiangmuBM" }],
            ImportBackfillFields: [
                { Parent: "Code", Child: "XiangmuBM" },
                { Parent: "Name", Child: "XiangmuMC" }
            ],
            ImportParentMatchFieldName: "Code",
            ImportChildMatchFieldName: "XiangmuBM"
        }
    };

    normalizeTableChildFieldRelations(config);

    assert.deepEqual(config.TableChild.FieldRelations, [
        ["Code", "XiangmuBM", true],
        ["Name", "XiangmuMC"]
    ]);
    assert.equal(Object.hasOwn(config, "TableChildCallbackField"), false);
    assert.equal(Object.hasOwn(config.TableChild, "ImportRelations"), false);
    assert.equal(Object.hasOwn(config.TableChild, "ImportBackfillFields"), false);
    assert.equal(Object.hasOwn(config.TableChild, "ImportParentMatchFieldName"), false);
    assert.equal(Object.hasOwn(config.TableChild, "ImportChildMatchFieldName"), false);

    normalizeTableChildFieldRelations(config);
    assert.deepEqual(config.TableChild.FieldRelations, [
        ["Code", "XiangmuBM", true],
        ["Name", "XiangmuMC"]
    ]);
});

test("compact relations keep import matching as a subset of add and backfill relations", function () {
    const relations = getTableChildFieldRelations({
        FieldRelations: [
            ["Code", "XiangmuBM", true],
            ["Name", "XiangmuMC"]
        ]
    });

    assert.deepEqual(relations.map((item) => ({
        parent: item.ParentField,
        child: item.ChildField,
        match: item.ImportMatch
    })), [
        { parent: "Code", child: "XiangmuBM", match: true },
        { parent: "Name", child: "XiangmuMC", match: false }
    ]);
});

test("tree table receives the selected parent and the server-authorized TableChild relation", function () {
    const component = readFileSync(
        new URL("../src/views/form-engine/left-right/LeftTreeJoinRightForm.vue", import.meta.url),
        "utf8"
    );

    assert.match(component, /:TableChildConfig="tableChildRelation\.TableChildConfig \|\| null"/);
    assert.match(component, /:TableChildFkFieldName="tableChildRelation\.ChildFieldName/);
    assert.match(component, /:TableChildTableRowId="selectedParentValue"/);
    assert.match(component, /:FatherFormModel="selectedParentRow"/);
});

test("form designer route is registered before dynamic menu routes and survives router reset", function () {
    const routerSource = readFileSync(new URL("../src/router/index.js", import.meta.url), "utf8");
    const constantEnd = routerSource.indexOf("const constantRouteNames");
    const asyncStart = routerSource.indexOf("export const asyncRoutes");
    const designRoute = routerSource.indexOf('name: "diy_field"');

    assert.ok(designRoute > 0 && designRoute < constantEnd);
    assert.ok(constantEnd < asyncStart);
    assert.equal(routerSource.match(/name:\s*"diy_field"/g)?.length, 1);
    assert.match(routerSource.slice(0, constantEnd), /path:\s*"\/diy\/diy-design\/:Id"[\s\S]*?children:[\s\S]*?path:\s*""[\s\S]*?meta:\s*\{\s*keepAlive:\s*false\s*\}/);
});
