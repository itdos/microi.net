import { pathToFileURL } from 'node:url';

export const EXCLUDED_NAME_PATTERN = /测试|演示|空库|标准库|压力|压测|回归|test|demo|e2e|smoke|benchmark|fixture/iu;
const ALLOWED_ROW_FIELDS = new Set(['Id', 'ClientName']);

// 原始租户记录仅在调用进程内处理；输出结构中不保留名称、标识或逐行哈希。
export function summarizeRegistry({ pages, verifiedAt }) {
  if (!Array.isArray(pages) || !pages.length || !/^\d{4}-\d{2}-\d{2}T/.test(verifiedAt ?? '') || !Number.isFinite(Date.parse(verifiedAt))) {
    throw new Error('需要完整分页和有效核验时间');
  }
  const total = pages[0].Total;
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('登记总数无效');
  const ids = new Set();
  const names = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page.Total !== total || page.PageIndex !== i + 1 || !Array.isArray(page.Data)) {
      throw new Error('分页顺序或总数发生变化，请重新只读采集');
    }
    for (const row of page.Data) {
      if (!row || Object.keys(row).some(key => !ALLOWED_ROW_FIELDS.has(key))) {
        throw new Error('仅接受 Id 与 ClientName 的最小投影');
      }
      if (typeof row.Id !== 'string' || !row.Id || ids.has(row.Id)) throw new Error('记录标识缺失或重复');
      if (row.ClientName != null && typeof row.ClientName !== 'string') throw new Error('登记名称格式无效');
      ids.add(row.Id);
      names.push((row.ClientName ?? '').normalize('NFKC').trim());
    }
  }
  if (ids.size !== total) throw new Error('分页不完整，不能发布统计');
  const nonEmpty = names.filter(Boolean);
  const candidates = nonEmpty.filter(name => !EXCLUDED_NAME_PATTERN.test(name));
  return {
    schemaVersion: 1,
    verifiedAt: new Date(verifiedAt).toISOString(),
    source: '官方主租户 SaaS 引擎，经管理员 MCP 只读查询',
    pagination: { total, uniqueRecords: ids.size, pages: pages.length, complete: true },
    counts: {
      registeredRecords: total,
      emptyNames: names.length - nonEmpty.length,
      excludedNames: nonEmpty.length - candidates.length,
      candidateRecords: candidates.length,
      distinctExactNames: new Set(candidates).size,
    },
    method: {
      normalization: 'Unicode NFKC + 首尾去空格；相同名称按规范化后的完整字符串去重',
      excludedNamePattern: EXCLUDED_NAME_PATTERN.source,
      entityResolution: '未进行法人、项目、环境或商业状态合并',
      consistency: '分页总数相同且 Id 唯一；非数据库事务快照',
    },
    limits: ['登记记录不等于客户数、付费客户数、独立法人或成功交付项目数', '名称只用于统计与筛选，不用于推断行业、上线状态、绩效或客户认可', '未读取任何子租户业务数据、联系方式、域名、连接串、密码或密钥'],
    privacy: { rawNamesPublished: false, recordIdsPublished: false, customerContactsPublished: false, perRecordHashesPublished: false },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (Buffer.byteLength(input) > 4 * 1024 * 1024) throw new Error('输入超过限制');
    }
    process.stdout.write(JSON.stringify(summarizeRegistry(JSON.parse(input)), null, 2) + '\n');
  } catch {
    // 解析错误可能携带原始 JSON 片段，禁止原样输出异常。
    process.stderr.write('统计失败：检查分页、最小字段投影及输入格式；未输出原始记录。\n');
    process.exitCode = 1;
  }
}
