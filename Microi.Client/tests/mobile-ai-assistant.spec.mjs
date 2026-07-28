import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    clearMobileAiBootstrapCache,
    listMobileAiConversations,
    listMobileAiMessages,
    loadMobileAiBootstrap,
    mobileAiModelSupportsReasoning,
    newMobileAiConversation,
    normalizeMobileAiMessages,
    renameMobileAiConversation,
    sendMobileAiQuestion,
    setMobileAiConversationArchived
} from "../src/views/mobile/ai-assistant-api.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const pageSource = fs.readFileSync(path.resolve(testDir, "../src/views/mobile/ai-assistant.vue"), "utf8");
const routerSource = fs.readFileSync(path.resolve(testDir, "../src/router/index.js"), "utf8");
const e2eSource = fs.readFileSync(path.resolve(testDir, "./mobile-ai-assistant.e2e.spec.mjs"), "utf8");

function createApiHarness() {
    const calls = [];
    let osClient = "iTdos";
    const common = {
        GetOsClient: () => osClient,
        ApiEngine: {
            async Run(key, payload) {
                calls.push({ key, payload });
                return {
                    Code: 1,
                    Data: {
                        Code: 1,
                        Data: payload.Action === "History"
                            ? { Conversations: [] }
                            : payload.Action === "Conversation"
                                ? { Messages: [] }
                                : { ok: true }
                    }
                };
            }
        }
    };
    return { calls, common, setOsClient: (value) => { osClient = value; } };
}

test("mobile AI client maps all miniapp semantics to the official v1.1.2 actions", async () => {
    clearMobileAiBootstrapCache();
    const { calls, common } = createApiHarness();

    await loadMobileAiBootstrap(common, "user-1", true);
    await loadMobileAiBootstrap(common, "user-1");
    await listMobileAiConversations(common);
    await listMobileAiMessages(common, "conversation-1");
    await renameMobileAiConversation(common, "conversation-1", "月度分析");
    await setMobileAiConversationArchived(common, "conversation-1", true);
    await setMobileAiConversationArchived(common, "conversation-1", false);
    await sendMobileAiQuestion(common, {
        Question: "分析本月服务质量",
        AiModelId: "model-1",
        RelayModel: "relay-1",
        ReasoningEffort: "high",
        ConversationId: "conversation-1",
        RequestId: "request-1",
        Title: "月度分析"
    });

    assert.deepEqual(calls.map((item) => item.key), Array(7).fill("mci_ai_data_assistant"));
    assert.deepEqual(calls.map((item) => item.payload.Action), [
        "Bootstrap",
        "History",
        "Conversation",
        "Rename",
        "Archive",
        "Restore",
        "Chat"
    ]);
    assert.deepEqual(calls[2].payload, { Action: "Conversation", ConversationId: "conversation-1" });
    assert.deepEqual(calls[3].payload, {
        Action: "Rename",
        ConversationId: "conversation-1",
        Title: "月度分析"
    });
    assert.equal(calls[6].payload.ReasoningEffort, "high");
    assert.equal(calls[6].payload.RelayModel, "relay-1");
});

test("Bootstrap cache is isolated by OsClient as well as user", async () => {
    clearMobileAiBootstrapCache();
    const { calls, common, setOsClient } = createApiHarness();
    await loadMobileAiBootstrap(common, "same-user");
    await loadMobileAiBootstrap(common, "same-user");
    setOsClient("second-tenant");
    await loadMobileAiBootstrap(common, "same-user");
    assert.deepEqual(calls.map((item) => item.payload.Action), ["Bootstrap", "Bootstrap"]);
});

test("an older Bootstrap request cannot replace the latest identity cache", async () => {
    clearMobileAiBootstrapCache();
    const pending = [];
    const common = {
        GetOsClient: () => "iTdos",
        ApiEngine: {
            Run() {
                return new Promise((resolve) => pending.push(resolve));
            }
        }
    };
    const oldRequest = loadMobileAiBootstrap(common, "user-1", true);
    const latestRequest = loadMobileAiBootstrap(common, "user-1", true);
    pending[1]({ Code: 1, Data: { Code: 1, Data: { ScopeLabel: "latest" } } });
    assert.equal((await latestRequest).ScopeLabel, "latest");
    pending[0]({ Code: 1, Data: { Code: 1, Data: { ScopeLabel: "stale" } } });
    assert.equal((await oldRequest).ScopeLabel, "stale");
    assert.equal((await loadMobileAiBootstrap(common, "user-1")).ScopeLabel, "latest");
    assert.equal(pending.length, 2, "latest completed request remains the cached value");
});

test("new conversation is local reset and history messages retain thinking details", () => {
    assert.deepEqual(newMobileAiConversation(), {
        ConversationId: "",
        Title: "新对话",
        Messages: []
    });
    const rows = normalizeMobileAiMessages({
        Messages: [{ Id: "answer-1", Role: "assistant", Content: "结论", Thinking: ["权限已校验"] }]
    });
    assert.equal(rows[0].role, "assistant");
    assert.equal(rows[0].text, "结论");
    assert.deepEqual(rows[0].thinking, ["权限已校验"]);
    assert.equal(mobileAiModelSupportsReasoning({ AiModel: "gpt-5" }), true);
    assert.equal(mobileAiModelSupportsReasoning({ AiModel: "gpt-4.1" }), false);
});

test("dedicated page exposes stable automation hooks and persistent capability controls", () => {
    for (const testId of [
        "mobile-ai-assistant",
        "mobile-ai-model",
        "mobile-ai-relay-model",
        "mobile-ai-reasoning",
        "mobile-ai-new-conversation",
        "mobile-ai-history",
        "mobile-ai-input",
        "mobile-ai-send",
        "mobile-ai-current-rename",
        "mobile-ai-rename-input",
        "mobile-ai-rename-save"
    ]) {
        assert.match(pageSource, new RegExp(`data-testid=["\\x60].*${testId}`));
    }
    assert.match(pageSource, /:disabled="!supportsReasoning"/);
    assert.doesNotMatch(pageSource, /v-if="supportsReasoning"/);
    assert.match(pageSource, /内容由人工智能生成，请注意甄别/);
    assert.match(pageSource, /const assistantName = "AI助手"/);
    assert.doesNotMatch(pageSource, /吾码\s*AI\s*助手|吾码AI助手/);
    assert.match(routerSource, /path:\s*"\/mobile\/ai-assistant"/);
    assert.match(routerSource, /import\("@\/views\/mobile\/ai-assistant\.vue"\)/);
});

test("identity changes fence every asynchronous AI response and preserve checked privacy consent", () => {
    assert.match(pageSource, /let sessionGeneration = 0/);
    assert.match(pageSource, /diyStore\.OsClient[\s\S]*isAuthenticated\.value[\s\S]*currentUser\.value\.Id[\s\S]*featureEnabled\.value/);
    assert.ok(
        (pageSource.match(/if \(!isCurrentSession\(generation\)\) return;/g) || []).length >= 10,
        "Bootstrap, Chat, History, Conversation, Rename and Archive responses must all be fenced"
    );
    assert.match(pageSource, /if \(isCurrentSession\(generation\)\) historyLoading\.value = false/);
    assert.match(pageSource, /if \(isCurrentSession\(generation\)\) renameSaving\.value = false/);
    assert.match(pageSource, /if \(isCurrentSession\(generation\)\) historyActionId\.value = ""/);
    assert.match(e2eSource, /classList\.contains\("is-checked"\)/);
    assert.match(e2eSource, /querySelector\('input\[type="checkbox"\]'\)\?\.checked/);
    assert.match(e2eSource, /if \(!privacyChecked\) await privacy\.click\(\)/);
});
