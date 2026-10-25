import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseProject, parseReceipt, inspect } from './inspect.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
const receipt = '<TestRun><Times finish="2026-10-25T00:00:00Z"/><Results><UnitTestResult executionId="one" testName="Example.DatabaseCapabilitiesTests.Case" outcome="Passed"/><UnitTestResult executionId="two" testName="Example.SecurityCheck" outcome="NotExecuted"/></Results><Counters total="2" passed="1" failed="0"/></TestRun>';
test('项目版本不从注释提取，驱动版本保持原值', () => {
  assert.deepEqual(parseProject('<!-- <Version>0.0.0</Version> --><Version>8.6.9</Version><TargetFramework>net10.0</TargetFramework><PackageReference Include="Npgsql" Version="8.0.9"/>'), { version: '8.6.9', targetFramework: 'net10.0', dependencies: [{ name: 'Npgsql', version: '8.0.9' }] });
});
test('历史回执保留未通过，摘要不等于真实兼容认证', () => {
  const result = parseReceipt(Buffer.from(receipt), sha(receipt));
  assert.equal(result.counts.notPassed, 1);
  assert.equal(result.groups.databaseContracts[0].passed, 1);
  assert.doesNotMatch(JSON.stringify(result), /SecurityCheck|executionId/);
});
test('回执摘要、重复执行、汇总计数篡改均拒绝', () => {
  assert.throws(() => parseReceipt(Buffer.from(receipt), '0'.repeat(64)), /摘要/);
  for (const changed of [receipt.replace('total="2"', 'total="3"'), receipt.replace('passed="1"', 'passed="2"'), receipt.replace('executionId="two"', 'executionId="one"')]) assert.throws(() => parseReceipt(Buffer.from(changed), sha(changed)), /不一致/);
});
test('外部实体与空回执拒绝，不能以零项通过', () => {
  const changed = '<!DOCTYPE test>' + receipt;
  assert.throws(() => parseReceipt(Buffer.from(changed), sha(changed)), /实体/);
  assert.throws(() => parseReceipt(Buffer.from(''), sha('')), /计数/);
});
test('源码盘点保留未验证边界，不读取运行配置', async () => {
  const result = await inspect();
  assert.equal(result.databases.length, 6);
  assert.ok(result.databases.every(row => row.declaredDriverVersion && row.verifiedDatabaseServerVersion === null && row.thirdPartyCertification === 'not-provided'));
  assert.equal(result.historicalReceipt, null);
  assert.doesNotMatch(JSON.stringify(result), /DbConn|Password=|AuthSecret|computerName/);
});
