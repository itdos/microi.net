import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { platform, release, arch } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
export const providers = [
  ['MySql', 'MySql.Data'], ['SqlServer', 'System.Data.SqlClient'],
  ['Oracle', 'Oracle.ManagedDataAccess.Core'], ['PostgreSql', 'Npgsql'],
  ['DaMeng', 'DM.DmProvider'], ['KingBase', 'Kdbndp_V9'],
];
const groups = {
  databaseContracts: ['DatabaseCapabilitiesTests', 'DatabasePlatformRegistryTests', 'DatabaseConfigurationResolverTests', 'ExternalDatabaseCatalogTests', 'DatabaseAdministrationCompatibilityTests'],
  securityContracts: ['DiyHttpSsrfCompatibilityTests', 'TenantConfigurationSecurityTests', 'UserAccessKeySecurityTests', 'TokenRotationSecurityTests', 'FormEngineTenantBoundaryTests'],
};
const attr = tag => Object.fromEntries([...tag.matchAll(/([A-Za-z][\w]*)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
export function parseReceipt(buffer, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 || '') || hash(buffer) !== expectedSha256.toLowerCase()) throw new Error('TRX 摘要不匹配，不能复用回执');
  const xml = buffer.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不接受带外部实体的 TRX');
  const counterTags = [...xml.matchAll(/<Counters\b[^>]*\/?\s*>/g)];
  if (counterTags.length !== 1) throw new Error('TRX 缺少唯一计数');
  const counters = attr(counterTags[0][0]);
  const rows = [...xml.matchAll(/<UnitTestResult\b[^>]*>/g)].map(([tag]) => attr(tag));
  if (!rows.length || rows.length !== Number(counters.total) || new Set(rows.map(row => row.executionId)).size !== rows.length) throw new Error('TRX 用例计数或执行 Id 不一致');
  const counts = { total: rows.length, passed: rows.filter(row => row.outcome === 'Passed').length, failed: rows.filter(row => row.outcome === 'Failed').length, notPassed: rows.filter(row => row.outcome !== 'Passed').length };
  if (counts.passed !== Number(counters.passed) || counts.failed !== Number(counters.failed)) throw new Error('TRX 汇总与逐用例结果不一致');
  const grouped = {};
  for (const [key, names] of Object.entries(groups)) {
    grouped[key] = names.map(name => {
      const selected = rows.filter(row => row.testName?.includes(`.${name}.`));
      return { testClass: name, total: selected.length, passed: selected.filter(row => row.outcome === 'Passed').length, notPassed: selected.filter(row => row.outcome !== 'Passed').length };
    });
  }
  const times = attr(xml.match(/<Times\b[^>]*>/)?.[0] || '');
  return { sha256: hash(buffer), finishedAt: times.finish || null, counts, groups: grouped, scope: '历史测试回执核验；不证明当前候选、真实数据库组合或第三方认证通过' };
}

export function parseProject(text) {
  const plain = text.replace(/<!--[\s\S]*?-->/g, '');
  return {
    targetFramework: plain.match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] || null,
    version: plain.match(/<Version>([^<]+)<\/Version>/)?.[1] || null,
    dependencies: [...plain.matchAll(/<PackageReference\s+[^>]*>/g)].map(([tag]) => attr(tag)).filter(row => row.Include && row.Version).map(row => ({ name: row.Include, version: row.Version })),
  };
}
export async function inspect({ trx, expectedSha256, testedPlatformVersion, sourceCommit } = {}) {
  const sources = [];
  for (const path of ['Microi.Server/Dos.ORM/Dos.ORM.csproj', 'Microi.Server/Microi.Core/Microi.Core.csproj', 'Microi.Server/Microi.net.Api/Microi.net.Api.csproj']) {
    const body = await readFile(resolve(root, path));
    sources.push({ path, sha256: hash(body), ...parseProject(body.toString('utf8')) });
  }
  let head = null;
  try { head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* 源码压缩包可能没有 Git。 */ }
  const report = {
    schemaVersion: 1, inspectedAt: new Date().toISOString(), checkoutHead: head,
    scope: '本地源码依赖盘点；读取文件，不启动服务、不连接数据库、不写业务数据；工作树可能有未提交修改，以逐文件 SHA-256 为准',
    inspectorHost: { os: platform(), osRelease: release(), architecture: arch(), node: process.version, meaning: '仅为本盘点工具运行环境，不是平台跨操作系统认证' },
    sources,
    databases: providers.map(([type, driver]) => ({ type, driver, declaredDriverVersion: sources[0].dependencies.find(item => item.name === driver)?.version || null, verifiedDatabaseServerVersion: null, verifiedOperatingSystem: null, verifiedCpu: null, runtimeAcceptance: 'not-verified-by-this-inspection', thirdPartyCertification: 'not-provided' })),
    historicalReceipt: null,
  };
  if (trx) {
    if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(testedPlatformVersion || '') || !/^[a-f0-9]{40}$/i.test(sourceCommit || '')) throw new Error('回执需明确原测试平台版本和完整源码提交号');
    report.historicalReceipt = { testedPlatformVersion, sourceCommit, attribution: '原归档摘要中的来源声明；TRX 摘要另行核验，不把当前源码版本附会到历史测试', ...parseReceipt(await readFile(trx), expectedSha256) };
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), options = {};
  const keys = { '--trx': 'trx', '--expected-sha256': 'expectedSha256', '--tested-platform-version': 'testedPlatformVersion', '--source-commit': 'sourceCommit', '--out': 'out' };
  for (let i = 0; i < args.length; i += 2) {
    if (!keys[args[i]] || !args[i + 1]) throw new Error('未知参数或缺少值，参见 README.md');
    options[keys[args[i]]] = args[i + 1];
  }
  const result = await inspect(options);
  const text = JSON.stringify(result, null, 2) + '\n';
  if (options.out) await writeFile(options.out, text, { flag: 'wx' }); else process.stdout.write(text);
  if (result.historicalReceipt?.counts.notPassed > 0 || result.databases.some(row => !row.declaredDriverVersion)) process.exitCode = 2;
}
