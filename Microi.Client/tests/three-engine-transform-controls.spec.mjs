import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(
    testsDir,
    "../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/AI应用/microi-3d-engine/src/three-engine/core/Engine.js"
);

test("Three.js r182 TransformControls mounts its Object3D helper", async () => {
    const source = await readFile(enginePath, "utf8");
    assert.match(source, /transformControlsHelper\s*=\s*this\.transformControls\.getHelper\(\)/);
    assert.match(source, /this\.scene\.add\(this\.transformControlsHelper\)/);
    assert.doesNotMatch(source, /this\.scene\.add\(this\.transformControls\)/);
    assert.match(source, /this\.scene\.remove\(this\.transformControlsHelper\)/);
});
