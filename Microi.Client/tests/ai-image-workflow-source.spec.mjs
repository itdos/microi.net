import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const aiEnginePath = new URL("../src/views/ai-engine/index.vue", import.meta.url);
const diyTablePath = new URL("../src/views/form-engine/diy-table.vue", import.meta.url);
const mixinIndexPath = new URL("../src/views/form-engine/mixins/index.js", import.meta.url);
const workflowMixinPath = new URL("../src/views/form-engine/mixins/diy-table-workflow-record.mixin.js", import.meta.url);

test("unified AI page previews FileServer images and plays generated music inline", async () => {
    const source = await readFile(aiEnginePath, "utf8");

    assert.match(source, /\{ label: "AI绘图", value: "image" \}/);
    assert.match(source, /AI音乐/);
    assert.match(source, /mode === "image"[\s\S]*sendImageQuestion/);
    assert.match(source, /mode === "music"[\s\S]*sendMusicQuestion/);
    assert.match(source, /\/api\/Ai\/GenerateMiniMaxImage/);
    assert.match(source, /\/api\/Ai\/GenerateMiniMaxMusic/);
    assert.match(source, /Model: "image-01"/);
    assert.match(source, /Model: "music-2\.6"/);
    assert.match(source, /Storage: item\?\.Storage \|\| "Microi\.HDFS"/);
    assert.match(source, /class="generated-image-card"/);
    assert.match(source, /<el-image[\s\S]*:preview-src-list="imagePreviewList\(file\)"/);
    assert.doesNotMatch(source, /class="generated-image-card"[\s\S]{0,180}target="_blank"/);
    assert.match(source, /DiyCommon\.GetFileServer/);
    assert.match(source, /class="generated-audio-card"/);
    assert.match(source, /<audio[\s\S]*controls[\s\S]*preload="metadata"/);
    assert.match(source, /v-safe-html="renderAiMarkdown\(message\.content\)"/);
});

test("new ordinary conversation does not inherit secure-data mode", async () => {
    const source = await readFile(aiEnginePath, "utf8");
    const newConversation = source.match(/function newConversation\(\) \{[\s\S]*?\n\}/)?.[0] || "";

    assert.match(newConversation, /semanticMode\.value = "auto"/);
    assert.match(newConversation, /currentConversationSource\.value = SOURCE/);
    assert.doesNotMatch(newConversation, /SECURE_DATA_SOURCE/);
});

test("module engine exposes reusable workflow record operations to menu V8", async () => {
    const [tableSource, indexSource, mixinSource] = await Promise.all([
        readFile(diyTablePath, "utf8"),
        readFile(mixinIndexPath, "utf8"),
        readFile(workflowMixinPath, "utf8")
    ]);

    assert.match(indexSource, /diyTableWorkflowRecordMixin/);
    assert.match(tableSource, /V8\.OpenWorkflowRecord = self\.OpenWorkflowRecord/);
    assert.match(tableSource, /V8\.BatchApproveWorkflowRecords = self\.BatchApproveWorkflowRecords/);
    assert.match(mixinSource, /async OpenWorkflowRecord\(record, options = \{\}\)/);
    assert.match(mixinSource, /WarmupDiyFormDialog/);
    assert.match(mixinSource, /maxRetries = 100/);
    assert.match(mixinSource, /openFormDialogToken !== self\._openFormDialogToken/);
    assert.match(mixinSource, /async BatchApproveWorkflowRecords\(records\)/);
    assert.match(mixinSource, /String\(row\?\.FlowState \|\| ""\) !== "Done"/);
    assert.match(mixinSource, /\/api\/WorkFlow\/sendWork/);
});
