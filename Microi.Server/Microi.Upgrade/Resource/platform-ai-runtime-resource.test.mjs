import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(directory, '..', '..');
const source = fs.readFileSync(path.join(directory, 'platform-ai-runtime.js'), 'utf8');
const packageModel = JSON.parse(fs.readFileSync(
  path.join(directory, 'app.microi.ai-engine.json'),
  'utf8',
));
const controller = fs.readFileSync(path.join(
  serverRoot,
  'Microi.net.Api', 'Controllers', 'AiController.cs',
), 'utf8');
const aiInterface = fs.readFileSync(path.join(
  serverRoot,
  'Microi.Core', 'Interface', 'IV8AI.cs',
), 'utf8');
const tenantAi = fs.readFileSync(path.join(
  serverRoot,
  'Microi.net', 'V8Engine', 'V8TenantAI.cs',
), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function packageEngine(key) {
  return packageModel.SysApiEngines.find(item => item.ApiEngineKey === key);
}

async function run(action, request = {}) {
  const calls = [];
  const hooks = [];
  const ai = {
    UpdateConversationTitle: async (...args) => {
      calls.push(['UpdateConversationTitle', args]);
      return { Code: 1, Data: 'title' };
    },
    RecognizeIntent: async value => {
      calls.push(['RecognizeIntent', value]);
      return { Code: 1, Data: 'intent' };
    },
    Chat: async value => {
      calls.push(['Chat', value]);
      return { Code: 1, Data: 'chat' };
    },
    NL2SQL: async value => {
      calls.push(['NL2SQL', value]);
      return { Code: 1, Data: 'sql' };
    },
    NL2V8: async value => {
      calls.push(['NL2V8', value]);
      return { Code: 1, Data: 'v8' };
    },
  };
  const execute = new AsyncFunction('V8', source);
  const result = await execute({
    Param: { ...request, Action: action },
    CurrentUser: { Id: 'trusted-user', Level: 999 },
    ApiEngine: {
      Run: (key, payload) => {
        hooks.push({ key, payload });
        return { Code: 1 };
      },
    },
    AI: ai,
  });
  return { result, calls, hooks };
}

test('platform-ai-runtime is a fixed Managed package resource', () => {
  const engine = packageEngine('platform-ai-runtime');
  assert.ok(engine);
  assert.equal(packageModel.PackageInfo.Version, 'v7.6.0');
  assert.equal(engine.Version, 'v1.0.0');
  assert.equal(engine.ApiAddress, '/apiengine/platform-ai-runtime');
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.AllowAnonymous, 0);
  assert.equal(engine.ApiV8Code, `${source.trimEnd()}\n`);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['platform-ai-runtime'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.match(source, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(source, /AI_RUNTIME_MANAGED_NON_STREAM_V1/);
});

test('all non-stream actions call only V8.AI and expose a three-field safe hook envelope', async () => {
  const cases = [
    ['UpdateConversationTitle', 'UpdateConversationTitle'],
    ['RecognizeIntent', 'RecognizeIntent'],
    ['Chat', 'Chat'],
    ['NL2SQL', 'NL2SQL'],
    ['NL2V8EngineSync', 'NL2V8'],
  ];
  for (const [action, expectedCall] of cases) {
    const execution = await run(action, {
      ConversationId: 'conversation-1',
      Title: 'safe title',
      Source: 'ai-engine-workbench',
      UserChatMsg: 'secret question',
      Question: 'secret question',
      AiModel: 'model-a',
      ApiKey: 'must-not-pass',
      Endpoint: 'https://must-not-pass.example',
      OsClient: 'forged',
      CurrentUserId: 'forged',
    });
    assert.equal(execution.result.Code, 1, action);
    assert.equal(execution.calls.length, 1, action);
    assert.equal(execution.calls[0][0], expectedCall, action);
    assert.deepEqual(execution.hooks, [{
      key: 'platform-ai-custom-hook',
      payload: {
        SourceApiEngineKey: 'platform-ai-runtime',
        Stage: 'Before',
        Action: action,
      },
    }]);
    const serializedCall = JSON.stringify(execution.calls[0]);
    assert.doesNotMatch(serializedCall, /must-not-pass|forged/);
  }
});

test('legacy Controller methods are compatibility forwards while native boundaries remain native', () => {
  for (const action of [
    'UpdateConversationTitle',
    'RecognizeIntent',
    'Chat',
    'NL2SQL',
    'NL2V8EngineSync',
  ]) {
    assert.match(
      controller,
      new RegExp(`Task<JsonResult> ${action}\\b[\\s\\S]{0,1300}RunAiRuntimeCompatibilityAsync\\(\\s*"${action}"`),
      action,
    );
  }
  assert.match(controller, /Task ChatStream[\s\S]{0,1800}_microiAi\.ChatStreamWithContextAsync/);
  assert.match(controller, /Task NL2V8Engine\([\s\S]{0,2200}_microiAi\.NL2V8Engine/);
  assert.match(controller, /GetNl2SqlPolicyTableOptions[\s\S]{0,600}_microiAi\.GetNl2SqlPolicyTableOptionsAsync/);
  assert.match(controller, /ProxyChatStream[\s\S]{0,1400}_proxyService\.ExecuteAuthenticatedStreamAsync/);
});

test('V8.AI title atom binds current tenant and current user', () => {
  assert.match(aiInterface, /Task<DosResult> UpdateConversationTitle\(/);
  assert.match(tenantAi, /UpdateConversationTitle[\s\S]{0,500}ValidateAccess\(\)/);
  assert.match(tenantAi, /UpdateConversationTitleAsync\([\s\S]{0,250}_currentUser\["Id"\]/);
  assert.match(tenantAi, /UpdateConversationTitleAsync\([\s\S]{0,300}_osClient/);
});
