export interface SourceIntegrityIssue {
  line: number;
  marker: string;
}

const SOURCE_CONTAMINATION_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'tokens truncated', regex: /(?:\.\.\.|…)\s*[\d,.]+\s+tokens?\s+truncated\s*(?:\.\.\.|…)/i },
  { label: 'Exit code', regex: /^\s*Exit code:\s*-?\d+\s*$/i },
  { label: 'Process exited with code', regex: /^\s*Process exited with code\s+-?\d+\s*$/i },
  { label: 'Chunk ID', regex: /^\s*Chunk ID:\s*\S+\s*$/i },
  { label: 'Wall time', regex: /^\s*Wall time:\s*[\d.]+\s*(?:s|sec(?:ond)?s?)\s*$/i },
];

export function findSourceIntegrityIssues(source: string): SourceIntegrityIssue[] {
  const issues: SourceIntegrityIssue[] = [];
  String(source || '').replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
    for (const pattern of SOURCE_CONTAMINATION_PATTERNS) {
      if (pattern.regex.test(line)) {
        issues.push({ line: index + 1, marker: pattern.label });
        break;
      }
    }
  });
  return issues;
}

export function assertSourceIntegrity(source: string, operation: string): void {
  const issues = findSourceIntegrityIssues(source);
  if (issues.length === 0) return;
  const first = issues[0];
  throw new Error(
    `${operation} 已拦截：源码第 ${first.line} 行包含 AI/终端工具输出标记 "${first.marker}"。`
    + ' 这通常表示工具结果被截断或命令包装文本被误当成源码；请从本地完整文件或分段读取结果恢复源码后再保存。',
  );
}

export function assertPayloadSourceIntegrity(value: unknown, operation: string, path = 'payload'): void {
  if (typeof value === 'string') {
    const issues = findSourceIntegrityIssues(value);
    if (issues.length > 0) {
      const first = issues[0];
      throw new Error(
        `${operation} 已拦截：${path} 第 ${first.line} 行包含 AI/终端工具输出标记 "${first.marker}"。`
        + ' 请恢复完整源码后再提交。',
      );
    }
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Non-JSON strings are valid source/config values; the caller owns syntax validation.
      }
      if (parsed && typeof parsed === 'object') {
        assertPayloadSourceIntegrity(parsed, operation, `${path}(json)`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPayloadSourceIntegrity(item, operation, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      assertPayloadSourceIntegrity(item, operation, `${path}.${key}`);
    }
  }
}
