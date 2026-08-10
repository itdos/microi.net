import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDocsRoot = path.join(projectRoot, 'docs');
const maintainedRoots = [
  path.join(siteDocsRoot, 'doc'),
  path.join(siteDocsRoot, 'case'),
];
const profileModulePath = path.join(projectRoot, 'docs', '.vitepress', 'theme', 'doc-visual-profiles.js');
const {
  DOC_VISUAL_PROFILES,
  DOC_VISUAL_PROFILE_NAMES,
} = await import(pathToFileURL(profileModulePath).href);

const protectedFiles = new Set(['doc/about/update-log.md']);
const customSiteShells = new Map([
  ['index.md', '官网首页'],
  ['apps.md', 'AI 应用广场'],
  ['app-detail.md', 'AI 应用详情'],
  ['profile.md', '用户中心'],
  ['login.md', '登录页'],
  ['contact/index.md', '联系页'],
]);
const MAX_PROSE_BLOCK_CHARACTERS = 700;
const WARN_PROSE_BLOCK_CHARACTERS = 450;
const WARN_PROSE_RUN_CHARACTERS = 900;
const reportMode = process.argv.includes('--report');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return entry.isFile() && entry.name.endsWith('.md') ? [absolutePath] : [];
  });
}

function toRelativePath(file) {
  return path.relative(siteDocsRoot, file).replaceAll('\\', '/');
}

function toRouteKey(relativePath) {
  const key = relativePath.replace(/\.md$/u, '');
  return key.startsWith('doc/') ? key.slice('doc/'.length) : key;
}

function stripFrontmatter(source) {
  return source.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n/u, '');
}

function stripNonRenderedSource(source) {
  return stripFrontmatter(source)
    .replace(/```[\s\S]*?```/gu, '\n\n[MCI_CODE]\n\n')
    .replace(/~~~[\s\S]*?~~~/gu, '\n\n[MCI_CODE]\n\n')
    .replace(/<style\b[\s\S]*?<\/style>/giu, '\n\n')
    .replace(/<script\b[\s\S]*?<\/script>/giu, '\n\n')
    .replace(/<!--([\s\S]*?)-->/gu, '\n\n');
}

function normalizeProse(block) {
  return block
    .replace(/<[^>]+>/gu, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[`*_>#|:-]/gu, ' ')
    .replace(/&(?:nbsp|ensp|emsp);/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isProseBlock(block) {
  const trimmed = block.trim();
  if (!trimmed || trimmed === '[MCI_CODE]') return false;
  if (/^(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|\|)/u.test(trimmed)) return false;
  if (/^>\s*[-+*]\s/u.test(trimmed)) return false;
  if (/^<\/?(?:table|section|article|div|figure|ul|ol|h[1-6]|details|summary)\b/iu.test(trimmed)) return false;
  if (/^:{3,4}/u.test(trimmed)) return false;
  return true;
}

function countVisibleHeadings(renderedSource) {
  const markdownH1 = (renderedSource.match(/^#\s+\S.*$/gmu) || []).length;
  const htmlH1 = (renderedSource.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/giu) || []).length;
  const h2 = (renderedSource.match(/^##\s+\S.*$/gmu) || []).length
    + (renderedSource.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/giu) || []).length;
  const h3 = (renderedSource.match(/^###\s+\S.*$/gmu) || []).length
    + (renderedSource.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/giu) || []).length;
  return { h1: markdownH1 + htmlH1, h2, h3 };
}

function contentAfterPrimaryHeading(renderedSource) {
  const markdownHeading = /^#\s+\S.*$/mu.exec(renderedSource);
  const htmlHeading = /<h1\b[^>]*>[\s\S]*?<\/h1>/iu.exec(renderedSource);
  const candidates = [markdownHeading, htmlHeading].filter(Boolean).sort((a, b) => a.index - b.index);
  if (candidates.length === 0) return '';
  const primary = candidates[0];
  const start = primary.index + primary[0].length;
  const tail = renderedSource.slice(start);
  const nextMarkdownH2 = /^##\s+\S.*$/mu.exec(tail);
  const nextHtmlH2 = /<h2\b[^>]*>/iu.exec(tail);
  const boundaries = [nextMarkdownH2, nextHtmlH2].filter(Boolean).map(match => match.index);
  return boundaries.length > 0 ? tail.slice(0, Math.min(...boundaries)) : tail;
}

function getVisualKinds(source) {
  const kinds = new Set();
  if (/^\|.+\|\s*$/mu.test(source) && /^\|?\s*:?-{3,}/mu.test(source)) kinds.add('table');
  if (/^(?:```|~~~)/mu.test(source)) kinds.add('code');
  if (/!\[[^\]]*\]\([^)]*\)|<img\b/iu.test(source)) kinds.add('image');
  if (/^>\s|^:{3,4}\s*(?:tip|info|warning|danger)/mu.test(source)) kinds.add('callout');
  if (/^(?:[-+*]\s|\d+[.)]\s)/mu.test(source)) kinds.add('list');
  if (/<(?:section|div)\b[^>]*class=["'][^"']*(?:hero|grid|cards?|flow|showcase|matrix)/iu.test(source)) kinds.add('custom-layout');
  if (/<details\b/iu.test(source)) kinds.add('details');
  return kinds;
}

function hasRequiredVisualStructure(profile, kinds) {
  if (profile === 'showcase') {
    return kinds.has('custom-layout')
      || kinds.has('image')
      || (kinds.has('table') && kinds.has('callout'));
  }
  if (profile === 'overview') return kinds.size >= 2;
  if (profile === 'guide') return ['code', 'image', 'list', 'callout', 'details'].some(kind => kinds.has(kind));
  if (profile === 'reference') return ['table', 'code', 'list'].some(kind => kinds.has(kind));
  if (profile === 'policy') return ['table', 'list', 'callout'].some(kind => kinds.has(kind));
  return false;
}

function inspectProse(relativePath, renderedSource, failures, warnings) {
  let currentRun = 0;
  let largestRun = 0;
  let largestRunLine = 1;
  let currentRunLine = 1;
  let currentRunPreview = '';
  let largestRunPreview = '';
  let searchFrom = 0;
  for (const block of renderedSource.split(/\r?\n\s*\r?\n/gu)) {
    const blockIndex = renderedSource.indexOf(block, searchFrom);
    const line = blockIndex < 0 ? 1 : renderedSource.slice(0, blockIndex).split(/\r?\n/u).length;
    searchFrom = Math.max(searchFrom, blockIndex + block.length);
    if (!isProseBlock(block)) {
      if (currentRun > largestRun) {
        largestRun = currentRun;
        largestRunLine = currentRunLine;
        largestRunPreview = currentRunPreview;
      }
      currentRun = 0;
      currentRunPreview = '';
      continue;
    }
    const prose = normalizeProse(block);
    if (!prose) continue;
    if (currentRun === 0) currentRunLine = line;
    currentRun += prose.length;
    if (currentRunPreview.length < 90) currentRunPreview += `${currentRunPreview ? ' / ' : ''}${prose.slice(0, 90)}`;
    if (prose.length > MAX_PROSE_BLOCK_CHARACTERS) {
      failures.push(`${relativePath}:${line}: 存在 ${prose.length} 字符的连续文字块，请拆成标题、列表、表格、卡片或图示。`);
    } else if (prose.length > WARN_PROSE_BLOCK_CHARACTERS) {
      warnings.push(`${relativePath}:${line}: ${prose.length} 字符的长段落，建议拆分（${prose.slice(0, 110)}…）。`);
    }
  }
  if (currentRun > largestRun) {
    largestRun = currentRun;
    largestRunLine = currentRunLine;
    largestRunPreview = currentRunPreview;
  }
  if (largestRun > WARN_PROSE_RUN_CHARACTERS) {
    warnings.push(`${relativePath}:${largestRunLine}: 同一阅读段落组累计 ${largestRun} 字符，建议增加小标题或结构化视觉（${largestRunPreview.slice(0, 110)}…）。`);
  }
}

const files = maintainedRoots
  .flatMap(walk)
  .filter(file => !protectedFiles.has(toRelativePath(file)))
  .sort((a, b) => toRelativePath(a).localeCompare(toRelativePath(b), 'zh-CN'));
const failures = [];
const warnings = [];
const reports = [];

const allChineseMarkdown = walk(siteDocsRoot)
  .map(toRelativePath)
  .filter(relativePath => !relativePath.startsWith('en/'))
  .filter(relativePath => !relativePath.startsWith('.vitepress/'));
const classifiedFiles = new Set([
  ...files.map(toRelativePath),
  ...protectedFiles,
  ...customSiteShells.keys(),
]);
for (const relativePath of allChineseMarkdown) {
  if (!classifiedFiles.has(relativePath)) {
    failures.push(`${relativePath}: 中文 Markdown 未归入阅读文档、受保护文件或自定义站点页面。`);
  }
}
for (const relativePath of [...protectedFiles, ...customSiteShells.keys()]) {
  if (!allChineseMarkdown.includes(relativePath)) failures.push(`${relativePath}: 已登记的中文页面不存在。`);
}

const routeKeys = new Set(files.map(file => toRouteKey(toRelativePath(file))));
const profileKeys = new Set(Object.keys(DOC_VISUAL_PROFILES));

for (const routeKey of routeKeys) {
  if (!profileKeys.has(routeKey)) failures.push(`${routeKey}.md: 缺少逐页视觉档案。`);
}
for (const routeKey of profileKeys) {
  if (!routeKeys.has(routeKey)) failures.push(`视觉档案指向不存在的中文文档：${routeKey}.md。`);
}

for (const file of files) {
  const relativePath = toRelativePath(file);
  const routeKey = toRouteKey(relativePath);
  const profile = DOC_VISUAL_PROFILES[routeKey];
  const source = fs.readFileSync(file, 'utf8');
  const renderedSource = stripNonRenderedSource(source);
  const headings = countVisibleHeadings(renderedSource);
  const kinds = getVisualKinds(source);
  const intro = contentAfterPrimaryHeading(renderedSource);
  const introText = normalizeProse(intro);
  const hasCustomIntro = /class=["'][^"']*(?:hero|lead|intro)/iu.test(intro);

  if (!DOC_VISUAL_PROFILE_NAMES.includes(profile)) {
    failures.push(`${relativePath}: 视觉档案类型无效：${profile || '未设置'}。`);
  }
  if (headings.h1 !== 1) {
    failures.push(`${relativePath}: 应有且仅有一个可见一级标题，当前为 ${headings.h1} 个。`);
  }
  if (headings.h2 < 1) failures.push(`${relativePath}: 缺少二级章节，页面无法形成清晰阅读层级。`);
  if (source.length > 12_000 && headings.h2 < 4) {
    failures.push(`${relativePath}: 长篇文档只有 ${headings.h2} 个二级章节，导航密度不足。`);
  }
  if (profile !== 'reference' && introText.length < 18 && !hasCustomIntro) {
    failures.push(`${relativePath}: ${profile} 页首屏缺少“是什么/有什么价值/如何使用”的简短引导。`);
  }
  if (!hasRequiredVisualStructure(profile, kinds)) {
    failures.push(`${relativePath}: ${profile} 页缺少与页面类型匹配的列表、表格、代码、图示、提示或自定义布局。`);
  }

  for (const match of renderedSource.matchAll(/!\[([^\]]*)\]\([^)]*\)/gu)) {
    const alt = match[1].trim();
    if (!alt || /^(?:在这里插入图片描述|图片|image)$/iu.test(alt)) {
      failures.push(`${relativePath}: Markdown 图片缺少可读 alt。`);
    }
  }
  for (const match of renderedSource.matchAll(/<img\b([^>]*)>/giu)) {
    const altMatch = /\balt\s*=\s*["']([^"']+)["']/iu.exec(match[1]);
    if (!altMatch || /^(?:在这里插入图片描述|图片|image)$/iu.test(altMatch[1].trim())) {
      failures.push(`${relativePath}: HTML 图片缺少可读 alt。`);
    }
  }

  inspectProse(relativePath, renderedSource, failures, warnings);
  reports.push({ relativePath, profile, headings, kinds: [...kinds].sort(), introLength: introText.length });
}

const themeEntry = fs.readFileSync(path.join(projectRoot, 'docs', '.vitepress', 'theme', 'index.ts'), 'utf8');
const readableTheme = fs.readFileSync(path.join(projectRoot, 'docs', '.vitepress', 'theme', 'styles', 'doc-readable.scss'), 'utf8');
const microAppTheme = fs.readFileSync(path.join(projectRoot, 'docs', '.vitepress', 'theme', 'styles', 'micro-app.scss'), 'utf8');
for (const token of ['doc-visual-profiles.js', 'getDocVisualProfile', 'styles/doc-readable.scss']) {
  if (!themeEntry.includes(token)) failures.push(`主题入口未加载逐页视觉契约：${token}`);
}
for (const token of ['--mci-doc-reading-width', '&.dark', '.mci-doc-profile--reference', '.vp-doc details', '.mci-doc-grid', 'prefers-reduced-motion']) {
  if (!readableTheme.includes(token)) failures.push(`doc-readable.scss 缺少整站阅读契约：${token}`);
}
for (const token of ['--micro-app-hero-surface', '--micro-app-hero-ink', '&.dark body:has(.mci-micro-app-page)', '&.dark .micro-app-hero']) {
  if (!microAppTheme.includes(token)) failures.push(`micro-app.scss 缺少亮暗主题配对：${token}`);
}
if (/^\.dark\s+\.micro-app-/mu.test(microAppTheme)) {
  failures.push('micro-app.scss 在 html:lang(zh) 作用域内使用了失效的 .dark 子节点选择器，应使用 &.dark。');
}

if (reportMode) {
  console.log('中文文档逐页视觉档案：');
  for (const report of reports) {
    console.log(`- [${report.profile.padEnd(9)}] ${report.relativePath} | H2 ${report.headings.h2} | 首屏 ${report.introLength} 字 | ${report.kinds.join(', ')}`);
  }
  console.log(`受发版规则保护、只登记不修改：${[...protectedFiles].join('，')}`);
  console.log(`使用专用 Vue 交互布局、不套正文档视觉档案：${[...customSiteShells.entries()].map(([file, label]) => `${file}（${label}）`).join('，')}`);
}

for (const warning of warnings.slice(0, 20)) console.warn(`WARN ${warning}`);
if (warnings.length > 20) console.warn(`WARN 另有 ${warnings.length - 20} 个可读性建议。`);

if (failures.length > 0) {
  console.error(`中文文档视觉与可读性检查失败（${failures.length} 项）：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const profileSummary = DOC_VISUAL_PROFILE_NAMES
  .map(profile => `${profile}=${reports.filter(report => report.profile === profile).length}`)
  .join('，');
console.log(`中文阅读文档静态视觉审计通过：${files.length} 个页面全部建档（${profileSummary}）；${warnings.length} 个非阻断建议。`);
console.log(`范围闭环：另登记 ${protectedFiles.size} 个受保护页面、${customSiteShells.size} 个专用站点页面；英文生成文档未纳入。`);
console.log('说明：静态审计不替代真实浏览器的亮色、暗色、桌面和移动端视觉验收。');
