import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    collectDefaultExpandedKeys,
    normalizeDefaultExpandLevel
} from "../src/views/form-engine/left-right/left-tree-default-expand.js";

test("an unset or invalid level keeps the left tree collapsed", () => {
    for (const value of [undefined, null, "", 0, "0", -1, "invalid"]) {
        assert.equal(normalizeDefaultExpandLevel(value), 0);
    }
    assert.equal(normalizeDefaultExpandLevel("2.9"), 2);

    assert.deepEqual(
        collectDefaultExpandedKeys([{ Id: "root", _HasChild: true }], undefined),
        []
    );
});

test("a positive level expands only expandable nodes through that level", () => {
    const tree = [
        {
            Id: "root-a",
            _HasChild: true,
            _Child: [
                {
                    Id: "child-a",
                    _HasChild: true,
                    _Child: [{ Id: "leaf-a", _HasChild: false }]
                },
                { Id: "leaf-b", _HasChild: false }
            ]
        },
        { Id: "root-leaf", _HasChild: false }
    ];

    assert.deepEqual(collectDefaultExpandedKeys(tree, 1), ["root-a"]);
    assert.deepEqual(collectDefaultExpandedKeys(tree, "2"), ["root-a", "child-a"]);
    assert.deepEqual(collectDefaultExpandedKeys(tree, 3), ["root-a", "child-a"]);
});

test("the left-tree component applies the configured level after normalizing data", () => {
    const source = readFileSync(
        new URL("../src/views/form-engine/left-right/LeftView.vue", import.meta.url),
        "utf8"
    );

    assert.match(source, /collectDefaultExpandedKeys\(categories, this\.LeftTreeData\.DefaultExpandLevel\)/);
    assert.match(source, /:default-expanded-keys="TreeData\.ExpandedKeys"/);
});
