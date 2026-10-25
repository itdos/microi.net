import { createHash } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const repositories = [
  { host: 'gitee', repo: 'ITdos/microi.net', api: 'https://gitee.com/api/v5', web: 'https://gitee.com/ITdos/microi.net' },
  { host: 'github', repo: 'itdos/microi.net', api: 'https://api.github.com', web: 'https://github.com/itdos/microi.net' },
];
const sha256 = text => createHash('sha256').update(text).digest('hex');
const inWindow = (date, since, until) => Number.isFinite(Date.parse(date)) && Date.parse(date) >= Date.parse(since) && Date.parse(date) < Date.parse(until);

// 仅保留托管站的账号 Id；不读取邮箱或用姓名、邮箱猜测跨站身份。
function actor(user) {
  if (!user?.id) return null;
  return { id: String(user.id), bot: user.type === 'Bot' || /\[bot\]$/i.test(user.login || '') };
}
export function summarize(kind, rows, since, until) {
  const unique = new Map();
  for (const row of rows) {
    const key = kind === 'commits' ? row.sha : row.number;
    if (key != null && !unique.has(String(key))) unique.set(String(key), row);
  }
  const identities = new Set();
  const bots = new Set();
  let unknown = 0;
  const selected = [...unique.values()].filter(row => kind === 'commits'
    ? inWindow(row.commit?.committer?.date, since, until)
    : inWindow(row.updated_at, since, until));
  for (const row of selected) {
    const account = actor(kind === 'commits' ? row.author : row.user);
    if (!account) unknown++;
    else (account.bot ? bots : identities).add(account.id);
  }
  const metrics = {
    observedRecordsInWindow: selected.length,
    identifiedNonBotAccounts: identities.size,
    identifiedBotAccounts: bots.size,
    recordsWithoutMappedAccount: unknown,
  };
  if (kind !== 'commits') {
    // 创建/关闭时间分别计数，不能把 updated_at 误当作者在窗口内的贡献行为。
    metrics.createdInWindow = [...unique.values()].filter(row => inWindow(row.created_at, since, until)).length;
    metrics.closedInWindow = [...unique.values()].filter(row => inWindow(row.closed_at, since, until)).length;
    if (kind === 'pulls') metrics.mergedInWindow = [...unique.values()].filter(row => inWindow(row.merged_at, since, until)).length;
  }
  return metrics;
}

async function readJson(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'Microi-public-ecosystem-evidence', Accept: 'application/json' },
    });
    if (!response.ok) return { error: `HTTP_${response.status}`, status: response.status };
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) return { error: 'RESPONSE_TOO_LARGE', status: response.status };
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    return { data: JSON.parse(text), status: response.status, sha256: sha256(text) };
  } catch (error) {
    // 错误正文、Header 和原始 API JSON 可能含个人信息，不能直接写入报告。
    return { error: error.name === 'TimeoutError' ? 'TIMEOUT' : 'REQUEST_OR_JSON_FAILED' };
  }
}

export async function collectRepository(repository, { since, until, maxPages = 10, fetchImpl = fetch }) {
  const base = `${repository.api}/repos/${repository.repo}`;
  const metadata = await readJson(base, fetchImpl);
  const result = { host: repository.host, repository: repository.web, collectedAt: new Date().toISOString(), metadata: null, datasets: {} };
  if (metadata.error || !metadata.data?.default_branch) {
    result.error = metadata.error || 'INVALID_REPOSITORY_METADATA';
    return { report: result, commitShas: [] };
  }
  const meta = metadata.data;
  result.metadata = { defaultBranch: meta.default_branch, stars: meta.stargazers_count ?? null, forks: meta.forks_count ?? null, pushedAt: meta.pushed_at ?? null, source: base, responseSha256: metadata.sha256 };
  const head = await readJson(`${base}/commits?sha=${encodeURIComponent(meta.default_branch)}&per_page=1&page=1`, fetchImpl);
  const headSha = Array.isArray(head.data) ? head.data[0]?.sha : null;
  result.defaultBranchHead = headSha;
  const commitShas = [];
  for (const kind of ['commits', 'issues', 'pulls']) {
    const dataset = { status: 'complete', pages: [], metrics: null };
    result.datasets[kind] = dataset;
    if (kind === 'commits' && !headSha) { dataset.status = 'unavailable'; dataset.error = head.error || 'HEAD_UNAVAILABLE'; continue; }
    const rows = [];
    for (let page = 1; page <= maxPages; page++) {
      const query = new URLSearchParams({ per_page: '100', page: String(page) });
      if (kind === 'commits') { query.set('sha', headSha); query.set('since', since); query.set('until', until); }
      else { query.set('state', 'all'); query.set('sort', 'updated'); query.set('direction', 'desc'); }
      const url = `${base}/${kind}?${query}`;
      const data = await readJson(url, fetchImpl);
      dataset.pages.push({ url, status: data.status ?? null, responseSha256: data.sha256 ?? null });
      if (data.error || !Array.isArray(data.data)) {
        dataset.status = rows.length ? 'partial' : 'unavailable'; dataset.error = data.error || 'INVALID_LIST'; break;
      }
      const malformed = data.data.some(row => !row || typeof row !== 'object' || (kind === 'commits'
        ? typeof row.sha !== 'string' || !Number.isFinite(Date.parse(row.commit?.committer?.date))
        : row.number == null || !Number.isFinite(Date.parse(row.updated_at)) || !Number.isFinite(Date.parse(row.created_at))));
      if (malformed) {
        dataset.status = rows.length ? 'partial' : 'unavailable'; dataset.error = 'INVALID_RECORD_SCHEMA'; break;
      }
      rows.push(...data.data);
      if (data.data.length < 100) break;
      // 仅 GitHub 明确支持按更新时间降序。Gitee 不假设排序语义，继续有界翻页。
      if (kind !== 'commits' && repository.host === 'github' && data.data.every(row => Date.parse(row.updated_at) < Date.parse(since))) break;
      if (page === maxPages) { dataset.status = 'partial'; dataset.error = 'PAGE_LIMIT'; }
    }
    if (dataset.status !== 'unavailable') {
      const records = kind === 'issues' ? rows.filter(row => !row.pull_request) : rows;
      dataset.metrics = summarize(kind, records, since, until);
      if (kind === 'commits') commitShas.push(...records.filter(row => inWindow(row.commit?.committer?.date, since, until)).map(row => row.sha));
    }
  }
  return { report: result, commitShas };
}

export async function collect({ since, until, maxPages = 10, fetchImpl = fetch }) {
  if (!Number.isFinite(Date.parse(since)) || !Number.isFinite(Date.parse(until)) || Date.parse(since) >= Date.parse(until)) throw new Error('需要有效且递增的 since/until ISO 时间');
  if (Date.parse(until) > Date.now()) throw new Error('until 不能晚于采集开始时间');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 30) throw new Error('maxPages 必须为 1 到 30');
  const reports = [], hashes = new Set();
  for (const repository of repositories) {
    const { report, commitShas } = await collectRepository(repository, { since, until, maxPages, fetchImpl });
    reports.push(report); for (const sha of commitShas) hashes.add(sha);
  }
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), window: { since, until, convention: '[since, until)' },
    method: '匿名公开 REST；默认分支固定提交；提交按 SHA 去重；各站账号按服务端 Id 去重；不输出身份列表、邮箱或邮箱哈希',
    limits: { maxPagesPerDataset: maxPages, pageSize: 100, atomicSnapshot: false, thirdPartyContributorCount: null, crossHostUniquePeople: null, medianMaintainerResponseHours: null },
    repositories: reports,
    crossHostCommits: { observedUniqueShaCount: hashes.size, complete: reports.every(row => row.datasets.commits?.status === 'complete') },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--since', '--until', '--out', '--max-pages'].includes(args[i]) || !args[i + 1]) throw new Error('用法: node collect.mjs --since ISO --until ISO [--max-pages 10] [--out report.json]');
    options[args[i]] = args[i + 1];
  }
  const until = options['--until'] || new Date().toISOString();
  const since = options['--since'] || new Date(Date.parse(until) - 90 * 86400000).toISOString();
  if (options['--out']) {
    let exists = false;
    try { await access(options['--out']); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (exists) throw new Error('输出文件已存在，请指定新的文件名；已有快照不会被覆盖');
  }
  const report = await collect({ since, until, maxPages: Number(options['--max-pages'] || 10) });
  const output = JSON.stringify(report, null, 2) + '\n';
  if (options['--out']) await writeFile(options['--out'], output, { flag: 'wx' });
  else process.stdout.write(output);
  if (report.repositories.some(repo => repo.error || Object.values(repo.datasets).some(dataset => dataset.status !== 'complete'))) process.exitCode = 2;
}
