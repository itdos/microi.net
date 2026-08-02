import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import navigationMixin from "../src/views/form-engine/mixins/diy-table-navigation.mixin.js";

const methods = navigationMixin.methods;

test("mobile OpenTable back requests its parent overlay to close without changing route", () => {
    const emitted = [];
    let routerBackCount = 0;
    const context = {
        PropsTableType: "OpenTable",
        $emit(eventName) {
            emitted.push(eventName);
        },
        $router: {
            back() {
                routerBackCount += 1;
            }
        }
    };

    methods.HandleMobileTableBack.call(context);

    assert.deepEqual(emitted, ["closeOpenAnyTable"]);
    assert.equal(routerBackCount, 0);
});

test("standalone mobile table back keeps the existing router navigation", () => {
    let routerBackCount = 0;
    const context = {
        PropsTableType: "",
        $emit() {},
        $router: {
            back() {
                routerBackCount += 1;
            }
        }
    };

    methods.HandleMobileTableBack.call(context);

    assert.equal(routerBackCount, 1);
});

test("OpenAnyTable close handler hides the owning dialog or drawer", () => {
    const context = { ShowAnyTable: true };

    methods.CloseOpenAnyTable.call(context);

    assert.equal(context.ShowAnyTable, false);
});

test("both OpenAnyTable containers wire the child close request to their owner", () => {
    const component = readFileSync(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");
    const closeBindings = component.match(/@closeOpenAnyTable="CloseOpenAnyTable"/g) || [];

    assert.equal(closeBindings.length, 2);
    assert.match(component, /class="back-icon"\s+@click="HandleMobileTableBack"/);
});
