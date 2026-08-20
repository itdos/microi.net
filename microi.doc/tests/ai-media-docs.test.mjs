import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [guide, skill] = await Promise.all([
    readFile(new URL("../docs/doc/system-engine/ai-engine.md", import.meta.url), "utf8"),
    readFile(new URL("../../microi.skills/ai-engine/SKILL.md", import.meta.url), "utf8")
]);

test("AI 引擎官网文档覆盖 MiniMax 图片、音乐和视频完整媒体链路", () => {
    for (const route of [
        "/api/Ai/GenerateMiniMaxImage",
        "/api/Ai/GenerateMiniMaxMusic",
        "/api/Ai/CreateMiniMaxVideo",
        "/api/Ai/GetMiniMaxVideoTask",
        "/api/Ai/PersistMiniMaxVideoFile",
        "/api/Ai/GetMiniMaxVideoFile"
    ]) {
        assert.match(guide, new RegExp(route.replaceAll("/", "\\/")));
    }
    assert.match(guide, /image-01/);
    assert.match(guide, /music-2\.6/);
    assert.match(guide, /MiniMax-Hailuo-2\.3/);
    assert.match(guide, /FileServer\s*\+\s*FilePath/);
    assert.match(guide, /<el-image[^>]+preview-src-list/);
    assert.match(guide, /<audio controls preload="metadata">/);
    assert.match(guide, /<video controls preload="metadata">/);
    assert.match(guide, /下载按钮/);
});

test("AI Skill 固化同一媒体模型、安全和原页预览边界", () => {
    assert.match(skill, /GenerateMiniMaxImage\s*\+\s*image-01/);
    assert.match(skill, /GenerateMiniMaxMusic\s*\+\s*music-2\.6/);
    assert.match(skill, /FileServer\s*\+\s*FilePath/);
    assert.match(skill, /Element Plus `el-image`/);
    assert.match(skill, /<audio controls preload="metadata">/);
    assert.match(skill, /<video controls preload="metadata">/);
    assert.match(skill, /优先转存 HDFS/);
    assert.match(skill, /明确下载按钮/);
});
