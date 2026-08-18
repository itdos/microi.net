import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const clientRoot = path.resolve(import.meta.dirname, "..");

test("sidebar menu hover does not move menu text horizontally", () => {
    const sources = [
        "src/layout/components/Sidebar/index.vue",
        "src/layout/components/Sidebar/Item.vue",
        "src/styles/sidebar.scss"
    ].map((file) => fs.readFileSync(path.join(clientRoot, file), "utf8"));

    for (const source of sources) {
        const hoverBlocks = source.match(/&:hover\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs) || [];
        for (const hoverBlock of hoverBlocks) {
            assert.doesNotMatch(
                hoverBlock,
                /transform\s*:\s*translate(?:X|3d)\s*\(\s*[1-9-]/i,
                "sidebar hover states must not shift menu items or labels"
            );
        }
    }
});
