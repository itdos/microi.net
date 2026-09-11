import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// 中央回归入口按发行契约加载同一份微服务测试，避免新增 SDK/页面回归只在应用目录执行。
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const contract=JSON.parse(await readFile(path.join(root,'Microi.Server/Microi.Upgrade/Resource/platform-service-release.json'),'utf8'));
const source=path.resolve(root,contract.SourceRoot),relative=path.relative(root,source);
assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
const directory=path.join(source,'test');
const files=(await readdir(directory)).filter(name=>name.endsWith('.test.mjs')).sort();
assert.ok(files.includes('platform-reminder-api.test.mjs'),'必须执行提醒正式 SDK 适配器测试');
for(const file of files)await import(pathToFileURL(path.join(directory,file)).href);
