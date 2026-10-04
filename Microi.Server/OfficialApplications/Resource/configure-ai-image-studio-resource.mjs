import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(directory, 'app.microi.ai-engine.json');
const runtimePath = path.join(directory, 'platform-ai-runtime.js');
const packageVersion = 'v7.6.4';
const runtimeVersion = 'v1.1.0';
const releaseTime = '2026-09-03 12:00:00';
const packageHistory = '2026-09-03 v7.6.4 新增简洁 AI 图像工作台、MiniMax 私有参考图图生图、AI 抠图收尾及黑白、缩放、裁剪、旋转、翻转、格式转换、多图拼接等精确处理能力。';
const runtimeHistory = '2026-09-03 v1.1.0 新增 ProcessImage 白名单动作，复用 V8.Image 完成精确处理并把结果写入当前租户 HDFS。';

function normalizeSource(value) {
  return `${String(value || '').replace(/\r\n?/g, '\n').trimEnd()}\n`;
}

function prependOnce(value, line) {
  const current = String(value || '');
  return current.split(/\r?\n/).includes(line) ? current : `${line}\n${current}`.trimEnd();
}

const model = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const runtime = (model.SysApiEngines || []).find(item => item.ApiEngineKey === 'platform-ai-runtime');
if (!runtime) throw new Error('app.microi.ai-engine.json 缺少 platform-ai-runtime。');
const keys = (model.SysApiEngines || []).map(item => String(item.ApiEngineKey || '')).sort();
const expectedKeys = [
  'mci_ai_data_assistant',
  'platform-ai-account',
  'platform-ai-custom-hook',
  'platform-ai-runtime',
].sort();
if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
  throw new Error(`AI助手必须保持四接口闭包，当前=${keys.join(',')}`);
}

runtime.ApiV8Code = normalizeSource(fs.readFileSync(runtimePath, 'utf8'));
runtime.Version = runtimeVersion;
runtime.ChangeHistory = prependOnce(runtime.ChangeHistory, runtimeHistory);

model.PackageInfo.Version = packageVersion;
model.PackageInfo.ChangeHistory = prependOnce(model.PackageInfo.ChangeHistory, packageHistory);
model.PackageInfo.ChangeLog = {
  Version: packageVersion,
  Title: 'AI 图像工作台与参考图编辑',
  ChangeType: 'Feature',
  Content: '重构 AI助手能力导航，新增文生图、图生图、高清重绘、消除、扩图、去水印、证件照、多图融合、抠图、上色及精确图片处理；参考图私有存储，结果写入租户 HDFS。',
  ReleaseTime: releaseTime,
};
const capabilities = Array.isArray(model.PackageInfo.RequiredPlatformCapabilities)
  ? model.PackageInfo.RequiredPlatformCapabilities
  : [];
model.PackageInfo.RequiredPlatformCapabilities = Array.from(new Set([
  ...capabilities.filter(value => !String(value).startsWith('ApiEngine:platform-ai-runtime@')),
  'ApiEngine:platform-ai-runtime@v1.0.0',
  `ApiEngine:platform-ai-runtime@${runtimeVersion}`,
  'V8.Image.Grayscale',
  'V8.Image.RemoveSolidBackground',
]));
model.PackageInfo.ApiEngineCount = model.SysApiEngines.length;

fs.writeFileSync(packagePath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
process.stdout.write(`${path.basename(packagePath)}\t${packageVersion}\t${runtimeVersion}\n`);
