import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('MCP 实现属于独立类库，HTTP 端点只声明路由和转发', () => {
  assert.ok(fs.existsSync(path.join(root, 'Microi.Server/Microi.MCP/Microi.MCP.csproj')));
  const controller = read('Microi.Server/Microi.net.Api/Controllers/V8EngineController.cs');
  assert.doesNotMatch(controller, /V8McpLogic\.|CheckPermission\(|ReadFormAsync\(|FromBase64String\(|\btry\s*\{/);
  assert.match(controller, /V8McpEndpointService/);
  assert.match(controller, /api\/V8Engine\/\[action\]/);
  assert.match(controller, /api\/V8Debug\/\[action\]/);
  assert.equal(fs.readdirSync(path.join(root, 'Microi.Server/Microi.Core/V8Engine')).filter(n => /^V8Mcp/.test(n)).length, 0);
  assert.ok(!fs.existsSync(path.join(root, 'Microi.Server/Microi.Core/V8Engine/Runtime/V8McpDebugSession.cs')));
});

test('MCP 与 AI 一样使用源码或 NuGet 拓扑，并进入全部加密及源码指纹门禁', () => {
  const props = read('Microi.Server/Directory.Build.props');
  assert.match(props, /MicroiMCPProjectPath/);
  assert.match(props, /MicroiMCPExists/);
  const api = read('Microi.Server/Microi.net.Api/Microi.net.Api.csproj');
  assert.match(api, /ProjectReference Include="\.\.\\Microi.MCP\\Microi.MCP.csproj"/);
  assert.match(api, /PackageReference Include="Microi.MCP" Version="\$\(MicroiNetVersion\)"/);
  assert.doesNotMatch(read('Microi.Server/Microi.net.sln'), /Microi.MCP\\Microi.MCP.csproj/);
  assert.match(read('Microi.Server/Microi.Anderson.sln'), /Microi.MCP\\Microi.MCP.csproj/);
  assert.match(read('Microi一键编译发布.sh'), /ENCRYPTED_PROJECTS=\([^\n]*"Microi.MCP"/);
  assert.match(read('Microi.Server/Microi.net/License/scripts/encrypt-dll.sh'), /ENCRYPTED_DLLS=\([^\n]*"Microi.MCP.dll"/);
  assert.match(read('Microi.Server/tools/release-candidate.mjs'), /Microi.Server\/Microi.MCP/);
  assert.match(read('.public-repo-protected-paths'), /^Microi.Server\/Microi.MCP$/m);
  assert.match(read('.gitignore'), /^\/Microi.Server\/Microi.MCP\/$/m);
});
