export interface PrepareV8VersionOptions {
  kind: 'ApiEngine' | 'V8Event' | 'Workflow';
  key: string;
  eventType?: string;
  currentCode: string;
  remoteCode?: string;
  remoteVersion?: string;
  functionDescription?: string;
  changeSummary?: string;
  initial?: boolean;
}

export interface PreparedV8Code {
  code: string;
  version: string;
  changeHistory: string;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

const VERSION_LINE_RE = /^\s*\*?\s*Version\s*:\s*(v\d+\.\d+\.\d+)\s*$/im;
const SEMVER_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

export function parseV8Version(value?: string): string | null {
  const text = (value || '').trim();
  if (!text) { return null; }
  const direct = text.match(SEMVER_RE);
  if (direct) { return `v${Number(direct[1])}.${Number(direct[2])}.${Number(direct[3])}`; }
  const line = text.match(VERSION_LINE_RE);
  return line ? parseV8Version(line[1]) : null;
}

function toParsedVersion(version: string | null): ParsedVersion | null {
  if (!version) { return null; }
  const match = version.match(SEMVER_RE);
  if (!match) { return null; }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareVersion(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) { return left.major - right.major; }
  if (left.minor !== right.minor) { return left.minor - right.minor; }
  return left.patch - right.patch;
}

function maxVersion(versions: Array<string | null>): string | null {
  let maxParsed: ParsedVersion | null = null;
  for (const version of versions) {
    const parsed = toParsedVersion(version);
    if (!parsed) { continue; }
    if (!maxParsed || compareVersion(parsed, maxParsed) > 0) {
      maxParsed = parsed;
    }
  }
  return maxParsed ? `v${maxParsed.major}.${maxParsed.minor}.${maxParsed.patch}` : null;
}

export function incrementV8Version(version: string | null): string {
  const parsed = toParsedVersion(version);
  if (!parsed) { return 'v1.0.0'; }
  let { major, minor, patch } = parsed;
  if (patch < 9) { return `v${major}.${minor}.${patch + 1}`; }
  patch = 0;
  if (minor < 9) { return `v${major}.${minor + 1}.${patch}`; }
  minor = 0;
  major += 1;
  return `v${major}.${minor}.${patch}`;
}

function normalizeDescription(description?: string): string[] {
  const text = (description || '').trim();
  if (!text) { return ['请补充该 V8 代码的完整功能说明。']; }
  return text.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
}

function extractFunctionDescriptionFromHeader(header: string): string | undefined {
  const lines = header.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];
  let inFunction = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*\/\*+\s?/, '').replace(/^\s*\*\/?\s?/, '').trim();
    if (/^(Function|功能说明)\s*[:：]/i.test(line)) {
      inFunction = true;
      const inline = line.replace(/^(Function|功能说明)\s*[:：]\s*/i, '').trim();
      if (inline) { result.push(inline.replace(/^[-*]\s*/, '')); }
      continue;
    }
    if (/^(ChangeLog|修改记录|LastModified|Version|ApiEngineKey|TableKey|WorkflowKey|EventType)\s*[:：]/i.test(line)) {
      if (inFunction) { break; }
      continue;
    }
    if (inFunction && line && line !== '*/') {
      result.push(line.replace(/^[-*]\s*/, ''));
    }
  }
  return result.length ? result.join('\n') : undefined;
}

function stripLeadingVersionHeader(code: string): { header?: string; body: string } {
  const normalized = code.replace(/^\uFEFF/, '');
  const match = normalized.match(/^\s*\/\*[\s\S]*?\*\/\s*/);
  if (!match) { return { body: normalized }; }
  const header = match[0];
  if (!/Microi\s+V8|Version\s*:|ChangeLog\s*:|ApiEngineKey\s*:|TableKey\s*:|WorkflowKey\s*:/i.test(header)) {
    return { body: normalized };
  }
  return { header, body: normalized.slice(header.length) };
}

function buildHeader(options: PrepareV8VersionOptions, version: string, previousHeader?: string): string {
  const description = options.functionDescription || extractFunctionDescriptionFromHeader(previousHeader || '');
  const descriptionLines = normalizeDescription(description);
  const title = options.kind === 'ApiEngine'
    ? 'V8 ApiEngine'
    : options.kind === 'V8Event'
      ? 'V8 Event'
      : 'V8 Workflow';
  const keyLabel = options.kind === 'ApiEngine'
    ? 'ApiEngineKey'
    : options.kind === 'V8Event'
      ? 'TableKey'
      : 'WorkflowKey';
  const lines = [
    '/*',
    ` * ${title}`,
    ` * ${keyLabel}: ${options.key}`,
  ];
  if (options.eventType) {
    lines.push(` * EventType: ${options.eventType}`);
  }
  lines.push(` * Version: ${version}`);
  lines.push(' * Function:');
  for (const line of descriptionLines) {
    lines.push(` * - ${line}`);
  }
  lines.push(' */');
  return `${lines.join('\n')}\n\n`;
}

export function prepareV8VersionedCode(options: PrepareV8VersionOptions): PreparedV8Code {
  const currentVersion = parseV8Version(options.currentCode);
  const remoteCodeVersion = parseV8Version(options.remoteCode);
  const remoteDbVersion = parseV8Version(options.remoteVersion);
  const baseVersion = maxVersion([currentVersion, remoteCodeVersion, remoteDbVersion]);
  const version = options.initial ? (baseVersion || 'v1.0.0') : incrementV8Version(baseVersion);
  const { header, body } = stripLeadingVersionHeader(options.currentCode || '');
  const code = `${buildHeader(options, version, header)}${body.replace(/^\s+/, '')}`;
  const summary = (options.changeSummary || '同步 V8 代码').trim();
  return {
    code,
    version,
    changeHistory: `${version} ${summary}`,
  };
}
