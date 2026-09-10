import { readFileSync, writeFileSync } from 'node:fs';
const directory = import.meta.dirname;
const header = "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1\n * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】\n * 所属官方应用：消息通知\n * ApiEngineKey：platform-reminder-runtime\n * 从可信吾码官方应用源安装、更新或重新安装“消息通知”，都会以官方源码恢复此 Managed 接口。\n * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，\n * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。\n */\n\n/*\n * V8 ApiEngine\n * ApiEngineKey: platform-reminder-runtime\n * Version: v1.0.6\n * Function:\n * - 统一系统公告的草稿、校验、发布快照、计划和回执；支持可信帐号范围及每次后端重启后的首次登录展示，采用稳定请求与数据库唯一领取，事务失败不重复发布。\n */\n\n";
// 头部以 MCP 保存后的完整回读为准，含规范化官方声明与自动递增版本。
const content = header + readFileSync(directory + '/platform-reminder-model.js','utf8') + '\n' + readFileSync(directory + '/platform-reminder-runtime.body.js','utf8') + "\n";
if (process.argv.includes('--check')) {
  if (readFileSync(directory + '/platform-reminder-runtime.js','utf8') !== content) throw Error('提醒运行时与责任源码不一致。');
} else writeFileSync(directory + '/platform-reminder-runtime.js', content);
