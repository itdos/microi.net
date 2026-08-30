import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const licensePath = new URL("../src/views/system/license.vue", import.meta.url);

test("license page renders captcha only when the official policy requires it", async () => {
    const source = await readFile(licensePath, "utf8");

    assert.match(source, /v-if="captchaPolicyResolved && captchaRequired"/);
    assert.match(source, /captchaRequired: false/);
    assert.match(source, /captchaPolicyResolved: false/);
    assert.match(source, /result\.Data\.CaptchaRequired !== false/);
    assert.match(source, /fetch\(LICENSE_API_BASE[\s\S]*cache: "no-store"/);
});

test("license page remains fail-closed and sends captcha only when required", async () => {
    const source = await readFile(licensePath, "utf8");

    assert.match(source, /if \(!self\.captchaPolicyResolved\)[\s\S]*self\.loadCaptcha\(\);[\s\S]*return;/);
    assert.match(source, /catch\(\(\) => \{[\s\S]*self\.captchaRequired = true;[\s\S]*self\.captchaPolicyResolved = true;/);
    assert.match(source, /if \(self\.captchaRequired\) \{[\s\S]*param\.CaptchaId = self\.captchaId;[\s\S]*param\.CaptchaValue = self\.applyForm\.CaptchaValue\.trim\(\);/);
    assert.doesNotMatch(source, /const param = \{[\s\S]{0,500}CaptchaId:/);
});
