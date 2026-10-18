import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse, compileScript } from "../node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js";
import { normalizeHiddenFrameworkFunctions } from "../src/utils/framework-appearance.js";
import { isMobileAiAssistantEnabled } from "../src/components/MobileTabBar/mobile-ai-entry.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const desktopSource = fs.readFileSync(
    path.resolve(testDir, "../src/components/DesktopAiAssistant/index.vue"),
    "utf8"
);
const navbarSource = fs.readFileSync(
    path.resolve(testDir, "../src/layout/components/Navbar.vue"),
    "utf8"
);
const aiEngineSource = fs.readFileSync(
    path.resolve(testDir, "../src/views/ai-engine/index.vue"),
    "utf8"
);
const aiIconSource = fs.readFileSync(
    path.resolve(testDir, "../src/components/MciAiIcon.vue"),
    "utf8"
);

function frameworkAiMount(source) {
    const { descriptor, errors } = parse(source, { filename: "Navbar.vue" });
    assert.deepEqual(errors, []);
    const mounted = [];
    const visit = (node) => {
        if (node.type === 1 && node.tag === "DesktopAiAssistant") mounted.push(node);
        for (const child of node.children || []) visit(child);
    };
    visit(descriptor.template.ast);
    assert.equal(mounted.length, 1, "必须保留唯一真实 AI 组件，注释或同名字符串不能代替挂载");
    const entry = mounted[0];
    assert.equal(entry.props.find(prop => prop.type === 7 && prop.name === "if")?.exp?.content, "showFrameworkFunction('AI')");
    assert.equal(entry.props.find(prop => prop.type === 6 && prop.name === "data-framework-function")?.value?.content, "AI");
    const ast = compileScript(descriptor, { id: "navbar-ai-mount" }).scriptAst;
    const options = ast.find(node => node.type === "ExportDefaultDeclaration")?.declaration;
    const components = options?.properties.find(prop => prop.key?.name === "components")?.value;
    assert.equal(components?.properties.find(prop => prop.key?.name === "DesktopAiAssistant")?.value?.name, "DesktopAiAssistant");
    const methods = options?.properties.find(prop => prop.key?.name === "methods")?.value;
    const guard = methods?.properties.find(prop => prop.type === "ObjectMethod" && prop.key?.name === "showFrameworkFunction");
    assert.ok(guard, "显隐必须调用实际 Navbar 方法");
    // 运行已解析的真实方法，验证复选字段不会被全局 AI 开关替代或反向控制移动端。
    return new Function("normalizeHiddenFrameworkFunctions", `return ({${descriptor.script.content.slice(guard.start, guard.end)}}).showFrameworkFunction;`)(normalizeHiddenFrameworkFunctions);
}

test("PC navbar exposes the feature-gated circular AI letter entry", () => {
    const showFrameworkFunction = frameworkAiMount(navbarSource);
    assert.equal(showFrameworkFunction.call({ SysConfig: { HideFrameworkFunctions: ["AI"], DisableAiAssistant: 0 } }, "AI"), false);
    assert.equal(showFrameworkFunction.call({ SysConfig: { HideFrameworkFunctions: [], DisableAiAssistant: 1 } }, "AI"), true);
    assert.equal(isMobileAiAssistantEnabled({ HideFrameworkFunctions: ["AI"], DisableAiAssistant: 0 }), true);
    assert.equal(isMobileAiAssistantEnabled({ HideFrameworkFunctions: [], DisableAiAssistant: 1 }), false);
    assert.throws(() => frameworkAiMount(navbarSource.replace(/<DesktopAiAssistant\b[^>]*\/>/, "<!-- DesktopAiAssistant -->")));
    assert.throws(() => frameworkAiMount(navbarSource.replace("showFrameworkFunction('AI')", "showFrameworkFunction('Bluetooth')")));
    assert.match(desktopSource, /isMobileAiAssistantEnabled\(diyStore\.SysConfig\)/);
    assert.match(desktopSource, /v-if="aiAssistantEnabled"/);
    assert.match(desktopSource, /data-testid="desktop-ai-entry"/);
    assert.match(desktopSource, /import MciAiIcon from ['"]@\/components\/MciAiIcon\.vue['"]/);
    assert.match(desktopSource, /<MciAiIcon\s+class="desktop-ai-entry__icon"\s*\/>/);
    assert.doesNotMatch(desktopSource, /MagicStick/);
    // 实际组件以同一主题色绘制圆框、A的两斜边/横杆和I的上下横杆/竖线，避免退化为空圈或装饰图。
    assert.match(aiIconSource, /<svg\b[^>]*viewBox="0 0 24 24"[^>]*aria-hidden="true"/);
    assert.match(aiIconSource, /<circle\b[^>]*cx="12"[^>]*cy="12"[^>]*r="10\.2"[^>]*stroke="currentColor"/);
    assert.match(aiIconSource, /<path\b[^>]*d="M[\d. ]+M[\d. ]+h[\d.]+M[\d. ]+h[\d.]+M[\d. ]+v[\d.]+M[\d. ]+h[\d.]+"[^>]*stroke="currentColor"/);
    assert.doesNotMatch(desktopSource, /<img\b|assistant-robot\.png/);
    assert.match(desktopSource, /aria-label="打开AI助手"/);
    assert.doesNotMatch(desktopSource, /吾码\s*AI\s*助手|吾码AI助手/);
});

test("PC entry opens a movable dialog backed by the unified AI core", () => {
    assert.match(desktopSource, /<el-dialog[\s\S]*?draggable[\s\S]*?destroy-on-close/);
    assert.match(desktopSource, /data-testid="desktop-ai-dialog-drag-handle"/);
    assert.match(desktopSource, /<AiEngine embedded\s*\/>/);
    assert.match(desktopSource, /height:\s*min\(760px, calc\(100vh - 140px\)\)/);
    assert.match(aiEngineSource, /data-testid="unified-ai-assistant"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-history"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-new-conversation"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-history-archived"/);
    assert.match(aiEngineSource, /value:\s*"secure-data"/);
    assert.match(aiEngineSource, /sendMobileAiQuestion/);
    assert.match(aiEngineSource, /sendChatStream/);
    assert.match(aiEngineSource, /sendDataQuestion/);
    assert.match(aiEngineSource, /sendCodeQuestion/);
    assert.match(aiEngineSource, /sendBuilderQuestion/);
});

test("unified core preserves both conversation protocols and security boundaries", () => {
    assert.match(aiEngineSource, /const SOURCE = "ai-engine-workbench"/);
    assert.match(aiEngineSource, /const SECURE_DATA_SOURCE = "mci-ai-data-assistant"/);
    assert.match(aiEngineSource, /loadMobileAiBootstrap/);
    assert.match(aiEngineSource, /listMobileAiConversations/);
    assert.match(aiEngineSource, /listMobileAiMessages/);
    assert.match(aiEngineSource, /renameMobileAiConversation/);
    assert.match(aiEngineSource, /setMobileAiConversationArchived/);
    assert.match(aiEngineSource, /\/api\/Ai\/ChatStream/);
    assert.match(aiEngineSource, /PostAsync\("\/apiengine\/platform-ai-runtime",\s*\{\s*Action: "NL2SQL"/);
    assert.match(aiEngineSource, /\/api\/Ai\/NL2V8Engine/);
    assert.match(aiEngineSource, /内容由人工智能生成，请注意甄别/);
    assert.match(aiEngineSource, /secureAssistantAvailable \? '权限边界已就绪' : '账号隔离会话'/);
    assert.match(aiEngineSource, /secureAssistantFailure\.description/);
    assert.match(aiEngineSource, /classifyMobileAiBootstrapFailure\(error\)/);
    assert.match(aiEngineSource, /安全业务数据：\{\{ secureAssistantFailure\.description \}\}/);
    assert.match(aiEngineSource, /title:\s*text,[\s\S]*?desc:\s*`查询范围：\$\{secureAssistantScopeLabel\.value\}`/);
    assert.doesNotMatch(aiEngineSource, /title:\s*`安全数据分析\$\{/);
});

test("unified core renders safe Markdown and keeps the assistant chrome quiet", () => {
    const markdownSource = fs.readFileSync(
        path.resolve(testDir, "../src/utils/ai-markdown.js"),
        "utf8"
    );
    assert.match(markdownSource, /marked\.parse\(String\(value\), MARKDOWN_OPTIONS\)/);
    assert.match(markdownSource, /sanitizeHtml\(/);
    assert.match(aiEngineSource, /v-safe-html="renderAiMarkdown\(message\.content\)"/);
    assert.doesNotMatch(aiEngineSource, /<pre v-if="message\.content"/);
    assert.match(aiEngineSource, /\.slice\(0, 4\)/);
    assert.match(aiEngineSource, /class="quick-prompt-content"/);
    assert.match(aiEngineSource, /class="composer-settings-trigger"/);
    assert.match(aiEngineSource, /data-testid="unified-ai-settings"/);
    assert.match(aiEngineSource, /popper-class="ai-composer-settings-popper"/);
});
