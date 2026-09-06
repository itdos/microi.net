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
const nativeController = fs.readFileSync(path.join(
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
  const imageCalls = [];
  const uploads = [];
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
  const imageResult = value => ({
    Code: 1,
    Data: {
      FileName: value.FileName || 'image.png',
      ContentType: 'image/png',
      FileByteBase64: 'iVBORw0KGgo=',
      Width: 100,
      Height: 80,
      Size: 9,
      Format: 'png',
    },
  });
  const image = new Proxy({}, {
    get: (_target, name) => value => {
      imageCalls.push([String(name), value]);
      if (name === 'GetInfo') return { Code: 1, Data: { Width: 100, Height: 80 } };
      return imageResult(value || {});
    },
  });
  const result = await execute({
    Param: { ...request, Action: action },
    CurrentUser: { Id: 'trusted-user', Level: 999 },
    OsClient: 'iTdos',
    SysConfig: { FileServer: 'https://files.example/mci-public' },
    ApiEngine: {
      Run: (key, payload) => {
        hooks.push({ key, payload });
        return { Code: 1 };
      },
    },
    AI: ai,
    Image: image,
    Method: {
      NewUlid: () => '01TESTAIIMAGE00000000000000',
      Upload: payload => {
        uploads.push(payload);
        return {
          Code: 1,
          Data: [{
            Name: Object.keys(payload.FilesByteBase64)[0],
            Path: '/itdos/ai-images/result.png',
            FullPath: 'https://files.example/mci-public/itdos/ai-images/result.png',
            Size: 9,
          }],
        };
      },
    },
  });
  return { result, calls, hooks, imageCalls, uploads };
}

test('platform-ai-runtime is a fixed Managed package resource', () => {
  const engine = packageEngine('platform-ai-runtime');
  assert.ok(engine);
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.2');
  assert.equal(engine.Version, 'v1.1.1');
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

test('ProcessImage only accepts in-memory images, calls the V8.Image whitelist and persists HDFS output', async () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const execution = await run('ProcessImage', {
    Operation: 'grayscale',
    Images: [{ DataUrl: dataUrl }],
    Options: { Strength: 1, OutputFormat: 'png' },
    ApiKey: 'must-not-pass',
    Endpoint: 'https://must-not-pass.example',
  });
  assert.equal(execution.result.Code, 1);
  assert.equal(execution.result.Data.Operation, 'grayscale');
  assert.equal(execution.result.Data.Permanent, true);
  assert.equal(execution.calls.length, 0);
  assert.equal(execution.imageCalls.length, 1);
  assert.equal(execution.imageCalls[0][0], 'Grayscale');
  assert.equal(execution.imageCalls[0][1].DataUrl, dataUrl);
  assert.equal(execution.uploads.length, 1);
  assert.equal(execution.uploads[0].Limit, false);
  assert.equal(execution.uploads[0].OsClient, 'iTdos');
  assert.deepEqual(execution.hooks, [{
    key: 'platform-ai-custom-hook',
    payload: {
      SourceApiEngineKey: 'platform-ai-runtime',
      Stage: 'Before',
      Action: 'ProcessImage',
    },
  }]);
  assert.doesNotMatch(JSON.stringify(execution.imageCalls), /must-not-pass/);
});

test('ProcessImage rejects URLs instead of fetching tenant-external content', async () => {
  const execution = await run('ProcessImage', {
    Operation: 'grayscale',
    Images: [{ DataUrl: 'https://example.com/private.png' }],
  });
  assert.equal(execution.result.Code, 0);
  assert.match(execution.result.Msg, /请上传/);
  assert.equal(execution.imageCalls.length, 0);
  assert.equal(execution.uploads.length, 0);
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

test('chat parameter bridge converts empty HTTP arrays to null before .NET binding', async () => {
  const execution = await run('RecognizeIntent', {
    UserChatMsg: '当前系统有多少用户',
    AiModel: 'model-a',
    Attachments: [],
    ChatHistory: [],
  });
  assert.equal(execution.result.Code, 1);
  assert.equal(execution.calls.length, 1);
  const payload = execution.calls[0][1];
  assert.equal(payload.Attachments, null);
  assert.equal(payload.ChatHistory, null);
});

test('intent bridge keeps a bounded attachment summary out of .NET collection binding', async () => {
  const execution = await run('RecognizeIntent', {
    UserChatMsg: '请分析附件',
    AiModel: 'model-a',
    Attachments: [{
      FileName: 'report.txt',
      ContentType: 'text/plain',
      Size: 12,
      Text: 'attachment excerpt',
    }],
    ChatHistory: [{ Role: 'user', Content: 'old message' }],
  });
  const payload = execution.calls[0][1];
  assert.equal(payload.Attachments, null);
  assert.equal(payload.ChatHistory, null);
  assert.match(payload.UserChatMsg, /附件摘要/);
  assert.match(payload.UserChatMsg, /report\.txt/);
  assert.doesNotMatch(payload.UserChatMsg, /old message/);
});

test('legacy AI JSON routes are centralized while native protocol boundaries remain in Microi.AI', () => {
  const engine = packageEngine('platform-ai-runtime');
  for (const action of [
    'UpdateConversationTitle',
    'RecognizeIntent',
    'Chat',
    'NL2SQL',
    'NL2V8EngineSync',
  ]) {
    assert.match(
      engine.ApiRoutes,
      new RegExp(`/api/Ai/${action}`, 'i'),
      action,
    );
    assert.match(source, new RegExp(`['"]${action}['"]`));
    assert.doesNotMatch(
      nativeController,
      new RegExp(`public\\s+(?:async\\s+)?[^\\n]+\\s${action}\\s*\\(`),
      action,
    );
  }
  assert.match(source, /PLATFORM_RUNTIME_DISPATCH_MARKER_V1/);
  assert.match(nativeController, /Task ChatStream[\s\S]{0,1800}_microiAi\.ChatStreamWithContextAsync/);
  assert.match(nativeController, /Task NL2V8Engine\([\s\S]{0,2200}_microiAi\.NL2V8Engine/);
  assert.match(nativeController, /GetNl2SqlPolicyTableOptions[\s\S]{0,600}_microiAi\.GetNl2SqlPolicyTableOptionsAsync/);
  assert.match(nativeController, /ProxyChatStream[\s\S]{0,1400}_proxyService\.ExecuteAuthenticatedStreamAsync/);
});

test('V8.AI title atom binds current tenant and current user', () => {
  assert.match(aiInterface, /Task<DosResult> UpdateConversationTitle\(/);
  assert.match(tenantAi, /UpdateConversationTitle[\s\S]{0,500}ValidateAccess\(\)/);
  assert.match(tenantAi, /UpdateConversationTitleAsync\([\s\S]{0,250}_currentUser\["Id"\]/);
  assert.match(tenantAi, /UpdateConversationTitleAsync\([\s\S]{0,300}_osClient/);
});
