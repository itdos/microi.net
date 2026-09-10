import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 后端只持有自包含的知识快照；规则正文仍以 microi.skills 为唯一可编辑事实源。
const skillsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.resolve(skillsRoot, '../Microi.Server/Microi.AI');
const project = fs.readFileSync(path.join(serverRoot, 'Microi.AI.csproj'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(skillsRoot, '.progressive-disclosure-manifest.json'), 'utf8'));
const check = process.argv.includes('--check');
const names = process.argv.slice(2).filter(value => value !== '--check');
if (!names.length) throw new Error('请显式指定本次需要同步的 Skill 名称。');
const stripMarkers = text => text.replace(/<!--\s*\/?microi-progressive:[^>]*-->\r?\n?/g, '');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
const results = [];

for (const name of names) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`无效 Skill 名称：${name}`);
  const file = `skill-${name}.md`;
  // 不擅自新增程序集资源；只有现有项目明确注册的知识快照可以由此脚本刷新。
  if (!project.includes(`Resource\\${file}`)) throw new Error(`后端尚未注册 ${file}，请先审阅资源归属。`);
  let text = fs.readFileSync(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
  const references = manifest.skills[name]?.references || [];
  if (references.length) {
    const route = text.indexOf('## 详细参考路由（渐进披露）');
    const end = text.indexOf('<!-- microi-progressive:end -->', route);
    if (route < 0 || end < route) throw new Error(`${name} 缺少受控参考路由，停止覆盖快照。`);
    text = text.slice(0, route) + text.slice(end + '<!-- microi-progressive:end -->'.length);
    for (const reference of references) {
      const source = path.resolve(skillsRoot, name, reference.path);
      const relative = path.relative(path.join(skillsRoot, name), source);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('参考文件越过 Skill 目录。');
      // 平台 AI 读取程序集时不能打开工作区相对路径，必须带上渐进参考的完整正文。
      text += `\n\n${fs.readFileSync(source, 'utf8')}`;
    }
  }
  text = `${stripMarkers(text).replace(/\r\n/g, '\n').trimEnd()}\n`;
  const target = path.join(serverRoot, 'Resource', file);
  const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const changed = before.replace(/\r\n/g, '\n') !== text;
  if (changed && !check) fs.writeFileSync(target, text, 'utf8');
  results.push({ name, changed, sha256: digest(text) });
}
console.log(JSON.stringify({ check, results }, null, 2));
if (check && results.some(item => item.changed)) process.exitCode = 1;
