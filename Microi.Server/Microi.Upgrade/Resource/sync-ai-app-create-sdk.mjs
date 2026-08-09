import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(directory, 'app.microi.store.json');
const sdkPath = resolve(directory, '../../../microi.skills/microi.v8.js');

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function nextPatchVersion(version) {
  const match = String(version || '').match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) throw new Error(`ai_app_create 版本格式无效：${version}`);
  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function chinaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}`;
}

function replaceSdkFunction(source, sdkSource) {
  const marker = 'function vueMicroiSdk() {';
  const nextMarker = '\nfunction vueMicroiBridge';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('ai_app_create 缺少 vueMicroiSdk');
  const end = source.indexOf(nextMarker, start);
  if (end < 0) throw new Error('ai_app_create 缺少 vueMicroiBridge 边界');
  const replacement = `${marker}\n  return ${JSON.stringify(sdkSource)};\n}\n`;
  return `${source.slice(0, start)}${replacement}${source.slice(end + 1)}`;
}

const packageModel = JSON.parse(await readFile(packagePath, 'utf8'));
const sdkSource = normalizeText(await readFile(sdkPath, 'utf8'));
const engines = Array.isArray(packageModel.SysApiEngines) ? packageModel.SysApiEngines : [];
const engine = engines.find(item => item.ApiEngineKey === 'ai_app_create');
if (!engine) throw new Error('app.microi.store.json 缺少 ai_app_create');

const currentSource = normalizeText(engine.ApiV8Code);
const updatedSource = replaceSdkFunction(currentSource, sdkSource);
if (updatedSource === currentSource) {
  console.log(JSON.stringify({ changed: false, version: engine.Version }, null, 2));
  process.exit(0);
}

const oldVersion = String(engine.Version || '');
const newVersion = nextPatchVersion(oldVersion);
const timestamp = chinaTimestamp();
const summary = '同步维护版 Microi 前端 SDK，确保新建 Web 与 MicroService 使用完整当前能力。';
const headerPattern = new RegExp(`Version:\\s*${oldVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const versionedSource = updatedSource.replace(headerPattern, `Version: ${newVersion}`);
if (versionedSource === updatedSource) throw new Error('ai_app_create 源码头未找到旧版本');
new Function(versionedSource);

engine.ApiV8Code = versionedSource;
engine.Version = newVersion;
engine.UpdateTime = timestamp;
engine.ChangeHistory = `${timestamp} ${newVersion} ${summary}\n${String(engine.ChangeHistory || '')}`;

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  changed: true,
  oldVersion,
  newVersion,
  sdkBytes: Buffer.byteLength(sdkSource, 'utf8'),
  packagePath,
}, null, 2));
