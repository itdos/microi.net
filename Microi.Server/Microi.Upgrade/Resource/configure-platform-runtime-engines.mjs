import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialApiEnginePolicies } from './official-api-engine-notice.mjs';
import { normalizeOfficialPackageExecutionLimits } from './resource-sync-core.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(root, 'app.microi.saas-engine.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const now = '2026-08-25 12:00:00';

function readSource(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8').replace(/\r\n/g, '\n').trimEnd();
}

function prependOnce(existing, line) {
  const value = String(existing || '').replace(/\r\n/g, '\n').trim();
  const block = String(line || '').replace(/\r\n/g, '\n').trim();
  if (!block) return value;

  // 部分接口的单个版本记录本身包含多行。旧实现按“单行相等”判断，
  // 每次生成都会再次前置整个多行记录。这里按完整行块去重后只保留一份，
  // 既修复已有重复，也保证同一输入连续生成得到逐字节一致的候选包。
  const sourceLines = value ? value.split('\n') : [];
  const blockLines = block.split('\n');
  const remaining = [];
  for (let index = 0; index < sourceLines.length;) {
    let matches = index + blockLines.length <= sourceLines.length;
    for (let offset = 0; matches && offset < blockLines.length; offset++) {
      matches = sourceLines[index + offset] === blockLines[offset];
    }
    if (matches) {
      index += blockLines.length;
      continue;
    }
    remaining.push(sourceLines[index]);
    index++;
  }
  const tail = remaining.join('\n').trim();
  return tail ? `${block}\n${tail}` : block;
}

function removeHistoryVersion(existing, version) {
  const normalizedVersion = String(version || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+${normalizedVersion}(?:\\s|$)`);
  return String(existing || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter(line => !pattern.test(line.trim()))
    .join('\n')
    .trim();
}

function compareSemver(left, right) {
  const parse = value => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/i.exec(String(value || '').trim());
    return match ? match.slice(1).map(Number) : [0, 0, 0];
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

const engines = [
  {
    key: 'mci-module-presentation-stats', name: '模块展示动态统计', file: 'mci-module-presentation-stats.js',
    id: '01KZ000000B4D6G8H2J5M7N9PQ', enableLog: 0, version: 'v1.0.7',
    history: '2026-09-03 v1.0.7 将任务调度“启用”指标按真实“正常”状态统计，避免英文枚举推断造成恒为 0。\n2026-08-24 v1.0.5 批量统计配合客户端 40ms 合并窗口，并将用户级只读计数缓存调整为 10 秒；ForceRefresh 仍可立即绕过缓存。'
  },
  {
    key: 'mic_home_work_todo_badge', name: '我的工作统计角标', file: 'mic_home_work_todo_badge.js',
    id: '01KZ000000WF4ST4TSB4DGE001', enableLog: 0, version: 'v1.0.4',
    history: '2026-08-24 v1.0.4 使用租户级版本门主动失效用户缓存；新后端缓存 30 秒，旧后端保持 3 秒，避免遗漏工作流更新。'
  },
  {
    key: 'platform-schedule-job', name: '平台定时任务管理', file: 'platform-schedule-job.js',
    id: '01KZ0000007M5Q3R8V2N6C4B1A', enableLog: 1, version: 'v1.0.1',
    apiRoutes: '/api/Job/GetAllJob;/api/Job/GetJobDetail;/api/Job/AddJob;/api/Job/UpdateJob;/api/Job/PauseJob;/api/Job/ResumeJob;/api/Job/DeleteJob',
    history: '2026-09-03 v1.0.1 补齐七条旧 /api/Job/* 多路由，并按宿主注入的可信请求路径映射列表、详情、新增、修改、暂停、恢复与删除动作。'
  },
  {
    key: 'platform-mq', name: '平台 RabbitMQ 消息发布', file: 'platform-mq.js',
    id: '10c6f4e1-1662-44ff-b488-c23004c88351', enableLog: 1,
    history: '2026-08-24 v1.0.0 RabbitMQ HTTP 控制器迁移至接口引擎并固定租户队列命名空间。'
  },
  {
    key: 'platform-mqtt', name: '平台 MQTT 管理', file: 'platform-mqtt.js',
    id: 'bb73a5c8-2cec-4db0-966f-79dca0149908', enableLog: 1,
    history: '2026-08-24 v1.0.0 MQTT 管理迁移至接口引擎，Broker 仅暴露受限可信原子能力。'
  },
  {
    key: 'platform-search-engine', name: '平台搜索引擎管理', file: 'platform-search-engine.js',
    id: '67eb1936-fdc5-4f9a-971f-7336dfc29fd6', enableLog: 1,
    history: '2026-08-24 v1.0.0 搜索管理迁移至接口引擎并由插件原子边界固定当前租户。'
  },
  {
    key: 'platform-ai-workflow', name: '平台 AI 工作流', file: 'platform-ai-workflow.js',
    id: '79e1e7dc-6cbb-40ef-902b-1564fdeccf55', enableLog: 1,
    history: '2026-08-24 v1.0.0 AI 工作流 HTTP 动作迁移至接口引擎，图谱构建保留为 AI 插件原子能力。'
  },
  {
    key: 'platform-client-log', name: '平台客户端兼容日志', file: 'platform-client-log.js',
    id: '9972dfe1-d424-4452-9a6e-8fecf60430d1', enableLog: 0,
    version: 'v1.0.1', apiRoutes: '/api/SysLog/AddSysLog',
    history: '2026-09-08 v1.0.1 补齐旧 SysLog/AddSysLog 多路由和大小写兼容字段读取，保留真实用户与客户端日志边界。'
  },
  {
    key: 'platform-tencent-im', name: '平台腾讯 IM 管理', file: 'platform-tencent-im.js',
    id: '94370168-2633-40ec-9144-70547a62b3b1', enableLog: 1,
    history: '2026-08-24 v1.0.0 腾讯 IM 集成迁移至接口引擎，Secret 改由租户后端私有设置读取。'
  },
  {
    key: 'platform-sys-base-data', name: '平台基础数据目录', file: 'platform-sys-base-data.js',
    id: '05df3bb5-a666-4e91-bd52-1bea273f2d51', enableLog: 0, allowAnonymous: 1,
    history: '2026-08-24 v1.0.0 基础数据目录迁移至接口引擎，匿名入口仅保留 GetSysBaseData_Biz。'
  },
  {
    key: 'platform-sys-dept', name: '平台组织机构目录', file: 'platform-sys-dept.js',
    id: 'bc09475f-4c33-4fe9-9229-4b627cc9418b', enableLog: 1,
    history: '2026-08-24 v1.0.0 组织机构兼容接口迁移至接口引擎，写操作固定为当前租户超级管理员。'
  },
  {
    key: 'platform-sys-role', name: '平台角色目录', file: 'platform-sys-role.js',
    id: '74d79358-ee99-41ca-b86e-d0c060114fb0', enableLog: 1,
    history: '2026-08-24 v1.0.0 角色目录兼容接口迁移至接口引擎，保留权威表权限与可分配角色过滤。'
  },
  {
    key: 'platform-online-terminal', name: '平台在线终端管理', file: 'platform-online-terminal.js',
    id: '019d2a01-9d63-7f91-8c01-000000000013', enableLog: 1,
    history: '2026-08-26 v1.0.0 补齐已移除 OnlineTerminalController 对应的 Managed 接口，并在可信原子前调用租户个性化 Hook。'
  },
  {
    key: 'platform-cache-manager', name: '平台缓存管理', file: 'platform-cache-manager.js',
    id: '019d2a01-9d63-7f91-8c01-000000000014', enableLog: 1,
    history: '2026-08-26 v1.0.0 补齐已移除 CacheController 对应的 Managed 接口，并在可信原子前调用租户个性化 Hook。'
  },
  {
    key: 'mci-system-observability-query', name: '系统日志与监控统一查询', file: 'mci-system-observability-query.js',
    id: '019d2a01-9d63-7f91-8c01-000000000015', enableLog: 0, version: 'v1.0.9',
    history: '2026-08-26 v1.0.9 将主租户已有的系统观测查询正式纳入 SaaS 官方 Managed 包，并增加只暴露 Action 的租户个性化 Hook。'
  },
  {
    key: 'mci-system-observability-action', name: '系统日志与监控安全治理', file: 'mci-system-observability-action.js',
    id: '019d2a01-9d63-7f91-8c01-000000000016', enableLog: 1,
    history: '2026-08-26 v1.0.0 IP 封禁与解封迁入官方 Managed 接口；可信原子固定管理员、租户和审计字段。'
  },
  {
    key: 'platform-data-source-run', name: '平台数据源运行时', file: 'platform-data-source-run.js',
    id: '019d2a01-9d63-7f91-8c01-000000000017', enableLog: 0, version: 'v1.1.0',
    history: '2026-08-27 v1.1.0 兼容入口按历史 Id/Key 转发到带 DataSourceType 的接口引擎，修复 V8 ExpandoObject 返回值被强制转换为 DosResult 的异常。'
  },
  {
    key: 'platform-module-data', name: '平台模块查询运行时', file: 'platform-module-data.js',
    id: '019d2a01-9d63-7f91-8c01-000000000018', enableLog: 0,
    history: '2026-08-26 v1.0.0 模块查询 Controller 迁入 Managed 接口，可信原子固定 Client 权限上下文。'
  },
  {
    key: 'platform-ocr-recognize', name: '平台 OCR 识别运行时', file: 'platform-ocr-recognize.js',
    id: '019d2a01-9d63-7f91-8c01-000000000019', enableLog: 1,
    history: '2026-08-26 v1.0.0 OCR REST 业务入口迁入 Managed 接口，供应商密钥继续只存在于租户绑定网关。'
  },
  {
    key: 'platform-office-export-word-by-template', name: '平台 Word 模板导出', file: 'platform-office-export-word-by-template.js',
    id: '019d2a01-9d63-7f91-8c01-000000000020', enableLog: 1,
    responseFile: 1, responseType: 'File',
    history: '2026-08-26 v1.0.0 Word 模板导出迁入响应文件接口引擎；宿主原子重新校验菜单、表与行读取权限。'
  },
  {
    key: 'platform-translate-runtime', name: '平台翻译运行时', file: 'platform-translate-runtime.js',
    id: '019d2a01-9d63-7f91-8c01-000000000021', enableLog: 1,
    history: '2026-08-26 v1.0.0 文本、检测、语言、文件、建议与健康六类翻译入口统一迁入 Managed 接口。'
  },
  {
    key: 'platform-user-behavior-signal', name: '平台用户行为信号', file: 'platform-user-behavior-signal.js',
    id: '019d2a01-9d63-7f91-8c01-000000000022', enableLog: 0,
    history: '2026-08-26 v1.0.0 客户端行为信号迁入 Managed 接口；会话、终端和用户身份由可信 DiyToken 原子解析。'
  },
  {
    key: 'platform-runtime-custom-hook', name: '平台运行时个性化扩展', file: 'platform-runtime-custom-hook.js',
    id: '019d2a01-9d63-7f91-8c01-000000000001', enableLog: 1, stopHttp: 1,
    upgradePolicy: 'CreateIfMissing', ownership: 'Tenant',
    history: '2026-08-25 v1.0.0 新增租户个性化 Hook；首次安装后由租户维护，官方升级永不覆盖。'
  },
  {
    key: 'platform-os-client-by-domain', name: '平台按域名解析租户', file: 'platform-os-client-by-domain.js',
    id: '019d2a01-9d63-7f91-8c01-000000000002', enableLog: 0, allowAnonymous: 1,
    history: '2026-08-25 v1.0.0 将域名租户发现迁移为匿名 Managed 接口引擎，只返回 OsClient 最小投影。'
  },
  {
    key: 'platform-sys-config', name: '平台公开系统设置', file: 'platform-sys-config.js',
    id: '019d2a01-9d63-7f91-8c01-000000000003', enableLog: 0, allowAnonymous: 1,
    history: '2026-08-25 v1.0.0 将浏览器公开系统设置迁移为匿名 Managed 接口引擎，强制服务端安全投影。'
  },
  {
    key: 'platform-service-health', name: '平台固定服务健康检查', file: 'platform-service-health.js',
    id: '019d2a01-9d63-7f91-8c01-000000000012', enableLog: 0, allowAnonymous: 1,
    version: 'v1.0.1',
    history: '2026-08-25 v1.0.1 版本原子在后端滚动升级期间允许暂不可用，健康接口仍稳定返回 Healthy；新二进制上线后自动补齐真实版本。\n2026-08-25 v1.0.0 新增固定匿名健康契约并返回真实后端程序集版本；业务接口失败不再代表整个 API 服务不可用。'
  },
  {
    key: 'platform-lang-bundle', name: '平台语言词条包', file: 'platform-lang-bundle.js',
    id: '019d2a01-9d63-7f91-8c01-000000000004', enableLog: 0, allowAnonymous: 1,
    history: '2026-08-25 v1.0.0 将语言词条包迁移为匿名 Managed 接口引擎。'
  },
  {
    key: 'platform-current-user', name: '平台当前用户', file: 'platform-current-user.js',
    id: '019d2a01-9d63-7f91-8c01-000000000005', enableLog: 0,
    history: '2026-08-25 v1.0.0 将当前用户自省迁移为鉴权 Managed 接口引擎，直接返回可信 V8.CurrentUser。'
  },
  {
    key: 'platform-private-file-url', name: '平台私有文件授权地址', file: 'platform-private-file-url.js',
    // 历史移动会员 Token 入口必须先匿名到达可信后端再完成身份验证；
    // 与现有正式包保持一致，避免生成器把 AllowAnonymous 从 1 意外归零。
    id: '019d2a01-9d63-7f91-8c01-000000000006', enableLog: 1, allowAnonymous: 1,
    history: '2026-08-25 v1.0.0 将私有文件短链迁移为鉴权 Managed 接口引擎，复用 Core 菜单、行、字段与引用授权。'
  },
  {
    key: 'platform-sys-user-public-info', name: '平台公共用户目录', file: 'platform-sys-user-public-info.js',
    id: '019d2a01-9d63-7f91-8c01-000000000007', enableLog: 0,
    history: '2026-08-25 v1.0.0 将公共用户目录迁移为鉴权 Managed 接口引擎，只返回 Id、Name、Avatar。'
  },
  {
    key: 'platform-login-wallpapers', name: '平台登录壁纸', file: 'platform-login-wallpapers.js',
    id: '019d2a01-9d63-7f91-8c01-000000000008', enableLog: 0, allowAnonymous: 1,
    version: 'v1.1.0',
    history: '2026-08-25 v1.1.0 改用 ApiEngineKey 绑定的可信宿主原子读取登录壁纸，不开放 diy_wallpaper 通用匿名权限。\n2026-08-25 v1.0.0 将登录壁纸最小公开投影迁移为匿名 Managed 接口引擎。'
  },
  {
    key: 'microi-init', name: '平台初始化兼容门面', file: 'platform-microi-init.js',
    id: '2a78d645-18c2-46f4-979a-b909399f3730', enableLog: 0, allowAnonymous: 1,
    version: 'v2.0.2',
    history: '2026-08-25 v2.0.2 登录初始化只返回递归脱敏的会话投影，密码材料、AI Key 与一次性票据绝不进入响应。\n2026-08-25 v2.0.1 纳入 SaaS 官方 Managed 升级链；匿名阶段仅返回公开设置，原始 DiyToken 经后端重验且租户一致后才返回用户与权限菜单。'
  },
  {
    key: 'platform-tenant-runtime-registration', name: '平台恢复自助租户运行登记',
    file: 'platform-tenant-runtime-registration.js', id: '91fb4cb1-8b8d-5a0b-9f04-b1c6c3d1cc80', enableLog: 0,
    history: '2026-09-06 v1.0.0 检查并幂等补齐自助租户网络登记；保留原配置、数据库和密码，主租户管理员经精确确认后执行。'
  },
  {
    key: 'platform-create-tenant', name: '平台创建租户', file: 'platform-create-tenant.js',
    id: '019d2a01-9d63-7f91-8c01-000000000009', enableLog: 1,
    history: '2026-08-25 v1.0.0 将当前用户创建租户的业务编排迁入 Managed 接口引擎，底层只保留可信开通原子。'
  },
  {
    key: 'platform-tenant-admin-credential-repair', name: '平台修复自助租户管理员密码编码',
    file: 'platform-tenant-admin-credential-repair.js', id: 'd9f39c6a-74c1-53d8-9a30-25f28d61a445', enableLog: 0,
    history: '2026-09-06 v1.0.0 仅对可验证的历史 DES 密文修正空库遗留 V8 标记，不改变密码，不解密自定义算法或单向哈希。'
  },
  {
    key: 'admin_repair_saas_tenant_database_access', name: '平台修复子租户数据库连接',
    file: 'admin-repair-saas-tenant-database-access.js',
    id: '019e2d5f-9940-7f91-8c01-000000000001', enableLog: 0, lock: 1,
    version: 'v1.0.2',
    replaceHistoryVersions: ['v1.0.2', 'v1.0.1', 'v1.0.0'],
    history: '2026-09-01 v1.0.2 兼容历史 MCP/接口调试运行时自动追加的短标量 TestParam1 占位字段；该值不参与业务且绝不转发，对象、超长值、其它未知字段和连接材料继续失败关闭。\n2026-09-01 v1.0.1 兼容并严格校验 MCP/服务端自动注入的租户、接口 Key 与调用语义字段；其余未知字段继续失败关闭。\n2026-09-01 v1.0.0 新增主租户超级管理员受控修复入口；仅传递目标定位字段，后端能力缺失、预检未完成或确认串不匹配时失败关闭。'
  },
  {
    key: 'platform-external-login-binding', name: '平台外部身份绑定', file: 'platform-external-login-binding.js',
    id: '019d2a01-9d63-7f91-8c01-000000000010', enableLog: 1, stopHttp: 1, lock: 1,
    history: '2026-08-25 v1.0.0 外部登录协议验签后由一次性可信上下文进入 Managed 接口引擎完成身份绑定。'
  },
  {
    key: 'platform-wechat-user-binding', name: '平台微信用户绑定', file: 'platform-wechat-user-binding.js',
    id: '019d2a01-9d63-7f91-8c01-000000000011', enableLog: 1, stopHttp: 1, lock: 1,
    history: '2026-08-25 v1.0.0 微信 OAuth 协议归一化后由一次性可信上下文进入 Managed 接口引擎完成用户绑定。'
  }
];

const scheduleTable = (packageData.DiyTables || []).find(
  item => String(item.Name || '').toLowerCase() === 'diy_schedule_job');
if (!scheduleTable) throw new Error('app.microi.saas-engine.json 缺少 diy_schedule_job。');
scheduleTable.SubmitBeforeServerV8 = readSource('platform-schedule-job-submit-before.js');
scheduleTable.OutFormV8 = '// 定时任务运行时同步已迁移至服务器端表单事件与 platform-schedule-job 接口引擎。';

packageData.SysApiEngines ||= [];
packageData.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
packageData.ResourcePolicies.SchemaVersion ||= 1;
packageData.ResourcePolicies.ApiEngines ||= {};
// 单一官方应用所有权：菜单启动接口由应用商城自举包交付，个人偏好由系统账号包交付。
// SaaS 包必须显式移除历史副本，避免多个 Managed 应用在安装顺序不同时互相覆盖。
for (const exclusiveKey of ['platform-sys-menu', 'platform-user-update-preferences']) {
  packageData.SysApiEngines = packageData.SysApiEngines.filter(item => item.ApiEngineKey !== exclusiveKey);
  delete packageData.ResourcePolicies.ApiEngines[exclusiveKey];
}
for (const definition of engines) {
  let engine = packageData.SysApiEngines.find(item => item.ApiEngineKey === definition.key);
  if (!engine) {
    engine = {
      IsDeleted: 0,
      UserName: '管理员',
      UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
      CreateTime: now,
      Id: definition.id,
      ChangeHistory: '',
      Version: 'v1.0.0',
      LimitRecursion: 5000,
      LimitMemory: 2048,
      MaxStatements: 100000000,
      Timeout: 600,
      StopHttp: definition.stopHttp || 0,
      EnableLog: definition.enableLog,
      Category: '平台核心',
      Files: '[]',
      AllowAnonymous: definition.allowAnonymous || 0,
      ApiAddress: `/apiengine/${definition.key}`,
      Lock: definition.lock || 0,
      ResponseFile: definition.responseFile || 0,
      ResponseType: definition.responseType || '',
      ApiV8Code: '',
      ApiRole: '[]',
      IsEnable: 1,
      ApiEngineKey: definition.key,
      ApiName: definition.name
    };
    packageData.SysApiEngines.push(engine);
  }
  engine.ApiV8Code = readSource(definition.file);
  engine.ApiAddress = `/apiengine/${definition.key}`;
  engine.ApiName = definition.name;
  engine.Version = definition.version || 'v1.0.0';
  engine.StopHttp = definition.stopHttp || 0;
  engine.AllowAnonymous = definition.allowAnonymous || 0;
  engine.IsEnable = 1;
  engine.EnableLog = definition.enableLog;
  engine.Lock = definition.lock || 0;
  if (definition.apiRoutes !== undefined) engine.ApiRoutes = definition.apiRoutes;
  if (definition.responseFile !== undefined) engine.ResponseFile = definition.responseFile;
  if (definition.responseType !== undefined) engine.ResponseType = definition.responseType;
  if (definition.key === 'platform-data-source-run') {
    engine.ChangeHistory = removeHistoryVersion(engine.ChangeHistory, 'v1.1.0');
    engine.ChangeHistory = removeHistoryVersion(engine.ChangeHistory, 'v1.0.0');
    engine.ChangeHistory = prependOnce(
      engine.ChangeHistory,
      '2026-08-26 v1.0.0 数据源 HTTP Controller 迁入 Managed 接口，并保留访问密钥的数据源白名单校验。',
    );
  }
  for (const historyVersion of definition.replaceHistoryVersions || []) {
    engine.ChangeHistory = removeHistoryVersion(engine.ChangeHistory, historyVersion);
  }
  engine.ChangeHistory = prependOnce(engine.ChangeHistory, definition.history);
  packageData.ResourcePolicies.ApiEngines[definition.key] = {
    Ownership: definition.ownership || 'Platform',
    UpgradePolicy: definition.upgradePolicy || 'Managed'
  };
}

const settingDataSet = (packageData.DataSets || []).find(
  item => String(item.TableName || '').toLowerCase() === 'mci_system_setting');
if (!settingDataSet) throw new Error('app.microi.saas-engine.json 缺少 mci_system_setting 种子数据集。');
settingDataSet.Rows ||= [];
const imSettings = [
  {
    Id: '308c3b7f-cf7d-4669-ae51-00d116b06141', ConfigKey: 'TencentImSdkAppId',
    Description: '腾讯云即时通信 IM SDKAppID；仅供后端签名与服务端接口使用', IsSecret: 0, Sort: 560
  },
  {
    Id: '8b3c0d6f-2e15-4bf2-80d8-69f34b84139b', ConfigKey: 'TencentImIdentifier',
    Description: '腾讯云即时通信 IM 管理员账号；仅供后端服务端接口使用', IsSecret: 0, Sort: 561
  },
  {
    Id: 'f479f136-76e9-44c4-9234-c8811aaf7825', ConfigKey: 'TencentImSecretKey',
    Description: '腾讯云即时通信 IM SecretKey；仅在可信后端解密并生成 UserSig', IsSecret: 1, Sort: 562
  }
];
for (const definition of imSettings) {
  let row = settingDataSet.Rows.find(item => item.ConfigKey === definition.ConfigKey);
  if (!row) {
    row = {
      Id: definition.Id,
      CreateTime: now,
      IsDeleted: 0,
      ConfigKey: definition.ConfigKey,
      ConfigValue: '',
      SecretCipher: '',
      ValueType: 'String',
      Category: '安全与服务接入',
      Description: definition.Description,
      IsPublic: 0,
      IsSecret: definition.IsSecret,
      IsEnabled: 0,
      Sort: definition.Sort,
      ValueSource: 'OfficialDefault'
    };
    settingDataSet.Rows.push(row);
  }
}

const osClientTable = (packageData.DiyTables || []).find(
  item => String(item.Name || '').toLowerCase() === 'sys_osclients');
if (!osClientTable) throw new Error('app.microi.saas-engine.json 缺少 sys_osclients。');
const numberTemplate = (packageData.DiyFields || []).find(
  item => item.TableId === osClientTable.Id && item.Name === 'BackgroundTaskMaxParallel');
if (!numberTemplate) throw new Error('sys_osclients 缺少 NumberText 字段模板。');
const streamSettings = [
  {
    Id: 'e1c833bb-c7d1-4bee-a1c4-6a487ec91c01', Name: 'ApiEngineStreamMaxChunkKB',
    Label: '流式单分片上限 KB', DefaultValue: '256', Sort: 17000,
    Description: '当前租户有效。接口引擎每个流式分片的最大 UTF-8 字节数，宿主强制限制为 4 至 1024 KB。'
  },
  {
    Id: '9919c334-9f9a-4c94-8b26-ec97f74f3d02', Name: 'ApiEngineStreamMaxTotalMB',
    Label: '流式响应总上限 MB', DefaultValue: '16', Sort: 17100,
    Description: '当前租户有效。单次接口引擎流式响应累计上限，宿主强制限制为 1 至 256 MB。'
  },
  {
    Id: '3ecf2158-40f6-4b36-8316-557788724f03', Name: 'ApiEngineStreamHeartbeatSeconds',
    Label: '流式心跳间隔秒', DefaultValue: '15', Sort: 17200,
    Description: '当前租户有效。SSE/NDJSON 连接空闲心跳间隔，宿主强制限制为 5 至 60 秒。'
  }
];
packageData.DiyFields ||= [];
for (const definition of streamSettings) {
  let field = packageData.DiyFields.find(
    item => item.TableId === osClientTable.Id && item.Name === definition.Name);
  if (!field) {
    field = JSON.parse(JSON.stringify(numberTemplate));
    packageData.DiyFields.push(field);
  }
  Object.assign(field, definition, {
    TableName: 'sys_osclients',
    TableId: osClientTable.Id,
    Tab: '平台运行配置',
    Type: 'int',
    Component: 'NumberText',
    FormWidth: 6,
    TableWidth: 180,
    Visible: 1,
    AppVisible: 1,
    IsDeleted: 0,
    CreateTime: field.CreateTime || now
  });
}

const responseTypeFieldId = 'a0dcefb5-e695-4e1f-915d-035f6660b70c';
let responseTypeField = packageData.DiyFields.find(item => item.Id === responseTypeFieldId)
  || packageData.DiyFields.find(item =>
    item.TableId === 'cf389aef-72cc-4980-9c5b-143123561ac0'
    && item.Name === 'ResponseType');
if (!responseTypeField) {
  responseTypeField = {
    Id: responseTypeFieldId,
    TableId: 'cf389aef-72cc-4980-9c5b-143123561ac0',
    TableName: 'sys_apiengine',
    Name: 'ResponseType',
    Label: '响应类型',
    Type: 'varchar(50)',
    Component: 'Radio',
    Config: '{"ParamData":{},"EnableSearch":false,"DataSource":"Data","SelectSaveFormat":"Text","Unique":{"Type":"Alone"}}',
    Sort: 700,
    FormWidth: 24,
    TableWidth: 120,
    Visible: 1,
    AppVisible: 1,
    IsDeleted: 0,
    CreateTime: now
  };
  packageData.DiyFields.push(responseTypeField);
}
Object.assign(responseTypeField, {
  Data: '["JSON","String","File","HTML","Stream"]',
  Description: '默认自动识别 JSON 或字符串；File 返回文件；HTML 返回完整页面；Stream 使用 V8.Stream 以 SSE/NDJSON 输出暂态分片，并在事务完成后发送 done/error 终态。'
});

const apiEngineTableId = 'cf389aef-72cc-4980-9c5b-143123561ac0';
const dataSourceTypeFieldId = 'fedc2eca-0eba-4581-95d8-3881f53e3cd7';
let dataSourceTypeField = packageData.DiyFields.find(item => item.Id === dataSourceTypeFieldId)
  || packageData.DiyFields.find(item =>
    item.TableId === apiEngineTableId && item.Name === 'DataSourceType');
if (!dataSourceTypeField) {
  dataSourceTypeField = { Id: dataSourceTypeFieldId };
  packageData.DiyFields.push(dataSourceTypeField);
}
Object.assign(dataSourceTypeField, {
  TableId: apiEngineTableId,
  TableName: 'sys_apiengine',
  Name: 'DataSourceType',
  Label: '数据源类型',
  NameConfirm: 1,
  Type: 'varchar(50)',
  Component: 'Radio',
  Description: '留空或 V8 按服务端 JavaScript 执行；SQL 按当前租户数据库查询；JSON 直接解析。API 仅用于标识历史待改写源码，请改写为 V8.Http 后切换为 V8。',
  NotEmpty: 0,
  Visible: 1,
  Readonly: 0,
  Sort: 2150,
  Data: '["V8","SQL","JSON","API"]',
  Config: JSON.stringify({
    ParamData: {}, EnableSearch: false, DataSource: 'Data',
    SelectSaveFormat: 'Text', Unique: { Type: 'Alone' }
  }),
  FormWidth: 24,
  TableWidth: 120,
  DefaultValue: '',
  Unique: 0,
  BindRole: '[]',
  AppVisible: 1,
  IsDeleted: 0,
  CreateTime: dataSourceTypeField.CreateTime || now
});

const apiV8CodeFieldId = 'cfa14691-214e-4af8-9a47-ffb55fbab013';
let apiV8CodeField = packageData.DiyFields.find(item => item.Id === apiV8CodeFieldId)
  || packageData.DiyFields.find(item =>
    item.TableId === apiEngineTableId && item.Name === 'ApiV8Code');
if (!apiV8CodeField) {
  apiV8CodeField = { Id: apiV8CodeFieldId };
  packageData.DiyFields.push(apiV8CodeField);
}
Object.assign(apiV8CodeField, {
  TableId: apiEngineTableId,
  TableName: 'sys_apiengine',
  Name: 'ApiV8Code',
  Label: '接口代码',
  NameConfirm: 1,
  Type: 'mediumtext',
  Component: 'CodeEditor',
  Description: '统一源码字段。编辑器会随数据源类型切换 JavaScript、SQL、JSON 或历史 API 文本语言；普通接口留空数据源类型并继续按服务端 V8 执行。',
  NotEmpty: 0,
  Visible: 1,
  Readonly: 0,
  Sort: 2200,
  Data: '[]',
  Config: JSON.stringify({
    ParamData: {},
    EnableSearch: false,
    DataSource: '',
    SelectSaveFormat: 'Text',
    CodeEditor: {
      Height: '500',
      Language: 'javascript',
      LanguageField: 'DataSourceType',
      LanguageMap: {
        V8: 'javascript',
        'V8数据源': 'javascript',
        SQL: 'sql',
        'SQL数据源': 'sql',
        JSON: 'json',
        'JSON数据源': 'json',
        '普通数据源': 'json',
        API: 'plaintext',
        'API数据源': 'plaintext'
      },
      V8CodeType: 'server'
    },
    Unique: { Type: 'Alone' }
  }),
  FormWidth: 24,
  TableWidth: 100,
  DefaultValue: '',
  Unique: 0,
  BindRole: '[]',
  AppVisible: 1,
  IsDeleted: 0,
  CreateTime: apiV8CodeField.CreateTime || now
});

packageData.PhysicalColumns ||= [];
let maxOsClientOrdinal = packageData.PhysicalColumns
  .filter(item => String(item.TABLE_NAME || '').toLowerCase() === 'sys_osclients')
  .reduce((maximum, item) => Math.max(maximum, Number(item.ORDINAL_POSITION || 0)), 0);
for (const definition of streamSettings) {
  let column = packageData.PhysicalColumns.find(item =>
    String(item.TABLE_NAME || '').toLowerCase() === 'sys_osclients'
    && item.COLUMN_NAME === definition.Name);
  if (!column) {
    column = { TABLE_NAME: 'sys_osclients', COLUMN_NAME: definition.Name };
    packageData.PhysicalColumns.push(column);
  }
  Object.assign(column, {
    ORDINAL_POSITION: column.ORDINAL_POSITION || ++maxOsClientOrdinal,
    COLUMN_TYPE: 'int(11)',
    DATA_TYPE: 'int',
    IS_NULLABLE: 'YES',
    COLUMN_DEFAULT: Number(definition.DefaultValue),
    COLUMN_COMMENT: definition.Label,
    COLUMN_KEY: '',
    EXTRA: ''
  });
}

let maxApiEngineOrdinal = packageData.PhysicalColumns
  .filter(item => String(item.TABLE_NAME || '').toLowerCase() === 'sys_apiengine')
  .reduce((maximum, item) => Math.max(maximum, Number(item.ORDINAL_POSITION || 0)), 0);
let dataSourceTypeColumn = packageData.PhysicalColumns.find(item =>
  String(item.TABLE_NAME || '').toLowerCase() === 'sys_apiengine'
  && item.COLUMN_NAME === 'DataSourceType');
if (!dataSourceTypeColumn) {
  dataSourceTypeColumn = { TABLE_NAME: 'sys_apiengine', COLUMN_NAME: 'DataSourceType' };
  packageData.PhysicalColumns.push(dataSourceTypeColumn);
}
Object.assign(dataSourceTypeColumn, {
  ORDINAL_POSITION: dataSourceTypeColumn.ORDINAL_POSITION || ++maxApiEngineOrdinal,
  COLUMN_TYPE: 'varchar(50)',
  DATA_TYPE: 'varchar',
  IS_NULLABLE: 'YES',
  COLUMN_DEFAULT: null,
  COLUMN_COMMENT: '数据源类型',
  COLUMN_KEY: '',
  EXTRA: ''
});

const osClientDdl = (packageData.DDLStatements || []).find(
  item => String(item.TableName || '').toLowerCase() === 'sys_osclients');
if (!osClientDdl) throw new Error('app.microi.saas-engine.json 缺少 sys_osclients DDL。');
for (const definition of streamSettings) {
  if (!osClientDdl.DDL.includes(`\`${definition.Name}\``)) {
    osClientDdl.DDL = osClientDdl.DDL.replace(
      /\n\) ENGINE=/,
      `,\n  \`${definition.Name}\` int(11) NULL DEFAULT ${definition.DefaultValue} COMMENT '${definition.Label}'\n) ENGINE=`);
  }
}

const capabilities = packageData.PackageInfo.RequiredPlatformCapabilities ||= [];
for (let index = capabilities.length - 1; index >= 0; index--) {
  if (capabilities[index] === 'ApiEngine:platform-sys-menu'
      || capabilities[index] === 'ApiEngine:platform-user-update-preferences') {
    capabilities.splice(index, 1);
  }
}
for (const capability of [
  'V8.Method.ManageScheduleJob',
  'V8.Method.ManageMq',
  'V8.Method.ManageMqtt',
  'V8.Method.ManageSearchEngine',
  'V8.Method.ManageAiWorkflow',
  'V8.Method.GenerateTencentImUserSig',
  'V8.Method.ManageSystemDirectory',
  'V8.Method.ManageOnlineTerminal',
  'V8.Method.ManageCache',
  'V8.Method.GetSystemObservability',
  'V8.Method.ManageSystemObservability',
  'V8.Method.RunDataSourceEngine',
  'ServerFeature:ApiEngineDataSourceType',
  'V8.Method.RunModuleEngine',
  'V8.Method.ExportWordByTemplate',
  'V8.Method.TrackUserBehavior',
  'V8.OCR.Recognize',
  'V8.TranslateEngine.TranslateText',
  'ServerFeature:ApiEngineStreaming',
  'ApiEngine:platform-schedule-job',
  'ApiEngine:platform-mq',
  'ApiEngine:platform-mqtt',
  'ApiEngine:platform-search-engine',
  'ApiEngine:platform-ai-workflow',
  'ApiEngine:platform-client-log',
  'ApiEngine:platform-tencent-im',
  'ApiEngine:platform-sys-base-data',
  'ApiEngine:platform-sys-dept',
  'ApiEngine:platform-sys-role',
  'ApiEngine:platform-online-terminal',
  'ApiEngine:platform-cache-manager',
  'ApiEngine:mci-system-observability-query',
  'ApiEngine:mci-system-observability-action',
  'ApiEngine:platform-data-source-run',
  'ApiEngine:platform-module-data',
  'ApiEngine:platform-ocr-recognize',
  'ApiEngine:platform-office-export-word-by-template',
  'ApiEngine:platform-translate-runtime',
  'ApiEngine:platform-user-behavior-signal',
  'V8.Method.ResolveOsClientByDomain',
  'V8.Method.GetPublicSysConfig',
  'V8.Method.GetBackendVersion',
  'V8.Method.GetLangBundle',
  'V8.Method.GetLoginWallpapers',
  'V8.Method.GetAuthorizedPrivateFileUrl',
  'ApiEngine:platform-runtime-custom-hook',
  'ApiEngine:platform-os-client-by-domain',
  'ApiEngine:platform-sys-config',
  'ApiEngine:platform-service-health',
  'ApiEngine:platform-lang-bundle',
  'ApiEngine:platform-current-user',
  'ApiEngine:platform-private-file-url',
  'ApiEngine:platform-sys-user-public-info',
  'ApiEngine:platform-login-wallpapers',
  'ApiEngine:microi-init',
  'V8.Method.ProvisionCurrentUserTenant',
  'V8.Method.RepairAdminTenantDatabaseAccess',
  'V8.Method.RequireManagedProtocolContext',
  'ApiEngine:platform-create-tenant',
  'ApiEngine:admin_repair_saas_tenant_database_access',
  'ApiEngine:platform-external-login-binding',
  'ApiEngine:platform-wechat-user-binding',
  'ApiEngine:mci-module-presentation-stats',
  'ApiEngine:mic_home_work_todo_badge'
]) {
  if (!capabilities.includes(capability)) capabilities.push(capability);
}

const packageHistory = '2026-08-25 v7.6.0 SaaS 官方接口递归深度统一收敛到运行时硬上限 5000；保留 v7.5.46 登录、Token 缓存刷新与 microi-init 敏感材料清除契约。';
if (compareSemver(packageData.PackageInfo.Version, 'v7.6.0') < 0) {
  packageData.PackageInfo.Version = 'v7.6.0';
}
const serviceHealthPackageVersion = 'v7.6.18';
const serviceHealthHistory = '2026-08-25 v7.6.18 固定健康接口兼容应用包先于后端二进制的滚动升级顺序；版本原子暂不可用时仍返回 Healthy，新二进制上线后自动补齐真实版本。';
if (compareSemver(packageData.PackageInfo.Version, serviceHealthPackageVersion) < 0) {
  packageData.PackageInfo.Version = serviceHealthPackageVersion;
}
if (packageData.PackageInfo.Version === serviceHealthPackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。提供固定平台启动接口、匿名服务健康契约与真实后端版本，并支持主租户为全部启用子租户执行可回读的平台应用维护。';
  packageData.PackageInfo.ChangeLog = {
    Version: serviceHealthPackageVersion,
    Title: '固定健康契约兼容滚动升级',
    ChangeType: 'Fix',
    Content: '固定健康接口兼容应用包先于后端二进制的滚动升级顺序；版本原子暂不可用时仍返回 Healthy，新二进制上线后自动补齐真实版本。',
    ReleaseTime: '2026-08-25 22:10:00'
  };
}
packageData.PackageInfo.ApiEngineCount = packageData.SysApiEngines.length;
packageData.PackageInfo.FieldCount = packageData.DiyFields.length;
packageData.PackageInfo.PhysicalColumnCount = packageData.PhysicalColumns.length;
packageData.PackageInfo.DataRowCount = (packageData.DataSets || [])
  .reduce((total, dataSet) => total + (dataSet.Rows || []).length, 0);
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  serviceHealthPackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(packageData.PackageInfo.ChangeHistory, packageHistory);
packageData.PackageInfo.ChangeHistory = prependOnce(packageData.PackageInfo.ChangeHistory, serviceHealthHistory);

const apiClosurePackageVersion = 'v7.6.21';
const apiClosureHistory = '2026-08-26 v7.6.21 补齐在线终端、缓存管理与系统观测三个官方 Managed 接口；前端引用、Controller 迁移目标和应用包内部依赖纳入自动闭包门禁。';
if (compareSemver(packageData.PackageInfo.Version, apiClosurePackageVersion) < 0) {
  packageData.PackageInfo.Version = apiClosurePackageVersion;
}
if (packageData.PackageInfo.Version === apiClosurePackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。启动自动补齐全部官方运行时接口闭包，并保护租户 CreateIfMissing 个性化源码。';
  packageData.PackageInfo.ChangeLog = {
    Version: apiClosurePackageVersion,
    Title: '官方运行时接口闭包补全',
    ChangeType: 'Fix',
    Content: apiClosureHistory.substring(apiClosureHistory.indexOf(' ') + 1).replace(/^v7\.6\.21\s+/, ''),
    ReleaseTime: '2026-08-26 18:30:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  apiClosurePackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(packageData.PackageInfo.ChangeHistory, apiClosureHistory);

const controllerSlimPackageVersion = 'v7.7.1';
const controllerSlimHistory = '2026-08-26 v7.7.1 数据源、模块、OCR、Office 模板导出、翻译、系统安全治理与用户行为迁入官方 Managed 接口；只保留最小可信 V8 原子和租户 CreateIfMissing Hook。';
const emptyDatabaseRuntimeHistory = '2026-08-26 v7.6.22 空数据库制作新增清理网络流量汇总、应用流式发布门禁审计和 NuGet 日统计三类运行态数据，并把三张表纳入发布后零残留门禁；继续递归清除顶级“AI应用”菜单树且保留平台核心“AI助手”。';
if (compareSemver(packageData.PackageInfo.Version, controllerSlimPackageVersion) < 0) {
  packageData.PackageInfo.Version = controllerSlimPackageVersion;
}
if (packageData.PackageInfo.Version === controllerSlimPackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。平台业务入口优先由 Managed ApiEngine 编排，宿主仅保留启动、协议与可信安全原子。';
  packageData.PackageInfo.ChangeLog = {
    Version: controllerSlimPackageVersion,
    Title: '平台业务 Controller 进一步迁入 V8',
    ChangeType: 'Optimize',
    Content: controllerSlimHistory.substring(controllerSlimHistory.indexOf(' ') + 1).replace(/^v7\.7\.1\s+/, ''),
    ReleaseTime: '2026-08-26 20:30:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  controllerSlimPackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(
  packageData.PackageInfo.ChangeHistory,
  emptyDatabaseRuntimeHistory,
);
packageData.PackageInfo.ChangeHistory = prependOnce(packageData.PackageInfo.ChangeHistory, controllerSlimHistory);

const typedDataSourcePackageVersion = 'v7.7.2';
const typedDataSourceHistory = '2026-08-27 v7.7.2 将数据源类型、统一 ApiV8Code 编辑体验和历史入口兼容迁入接口引擎；升级程序事务化复制旧数据并软删除 sys_datasource。';
if (compareSemver(packageData.PackageInfo.Version, typedDataSourcePackageVersion) < 0) {
  packageData.PackageInfo.Version = typedDataSourcePackageVersion;
}
if (packageData.PackageInfo.Version === typedDataSourcePackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。数据源统一由带类型的接口引擎承载，并兼容历史移动端数据源入口。';
  packageData.PackageInfo.ChangeLog = {
    Version: typedDataSourcePackageVersion,
    Title: '数据源引擎统一迁入接口引擎',
    ChangeType: 'Optimize',
    Content: typedDataSourceHistory.substring(typedDataSourceHistory.indexOf(' ') + 1).replace(/^v7\.7\.2\s+/, ''),
    ReleaseTime: '2026-08-27 12:00:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  typedDataSourcePackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(
  packageData.PackageInfo.ChangeHistory,
  typedDataSourceHistory,
);

// 该版本只登记受控修复入口；真正执行仍要求同版本后端提供可信原子，
// 因而应用包可以先安装但会在旧节点上明确失败关闭，不会退回 V8 处理连接秘密。
const tenantDatabaseRepairPackageVersion = 'v7.7.19';
const tenantDatabaseRepairHistory = '2026-09-01 v7.7.19 新增主租户超级管理员修复子租户 DatabaseOnly 连接的 Managed 接口；仅接受目标定位字段，ValidateOnly 与精确确认串均通过后才调用可信后端原子。';
if (compareSemver(packageData.PackageInfo.Version, tenantDatabaseRepairPackageVersion) < 0) {
  packageData.PackageInfo.Version = tenantDatabaseRepairPackageVersion;
}
if (packageData.PackageInfo.Version === tenantDatabaseRepairPackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。提供租户开通、启动运行时与主租户受控的子租户数据库连接修复入口。';
  packageData.PackageInfo.ChangeLog = {
    Version: tenantDatabaseRepairPackageVersion,
    Title: '子租户数据库连接安全修复入口',
    ChangeType: 'Fix',
    Content: '新增主租户超级管理员修复子租户 DatabaseOnly 连接的 Managed 接口；仅接受目标定位字段，ValidateOnly 与精确确认串均通过后才调用可信后端原子。',
    ReleaseTime: '2026-09-01 11:30:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseRepairPackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseRepairHistory,
);

const tenantDatabaseRepairMcpCompatibilityPackageVersion = 'v7.7.22';
const tenantDatabaseRepairMcpCompatibilityHistory = '2026-09-01 v7.7.22 兼容历史 MCP/接口调试运行时自动追加的短标量 TestParam1 占位字段；该值完全丢弃，对象、超长值、其它未知字段和连接材料仍失败关闭；继续支持 {{ OsVersion }} 和 {{ YYYY }}，且不携带 Sys_Config 租户数据。';
if (compareSemver(packageData.PackageInfo.Version, tenantDatabaseRepairMcpCompatibilityPackageVersion) < 0) {
  packageData.PackageInfo.Version = tenantDatabaseRepairMcpCompatibilityPackageVersion;
}
if (packageData.PackageInfo.Version === tenantDatabaseRepairMcpCompatibilityPackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。提供租户开通、启动运行时与主租户受控的子租户数据库连接修复入口。';
  packageData.PackageInfo.ChangeLog = {
    Version: tenantDatabaseRepairMcpCompatibilityPackageVersion,
    Title: '数据库连接修复入口兼容历史调试占位参数',
    ChangeType: 'Fix',
    Content: '兼容历史 MCP/接口调试运行时自动追加的短标量 TestParam1 占位字段；该值完全丢弃，对象、超长值、其它未知字段和连接材料仍失败关闭；继续支持 {{ OsVersion }} 和 {{ YYYY }}，且不携带 Sys_Config 租户数据。',
    ReleaseTime: '2026-09-01 23:30:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseRepairMcpCompatibilityPackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseRepairMcpCompatibilityHistory,
);

const tenantDatabaseStaleReadRepairPackageVersion = 'v7.7.23';
const tenantDatabaseStaleReadRepairHistory = '2026-09-02 v7.7.23 子租户数据库连接修复增加复制残留读库的精确确认模式；仅当旧读库名与请求完全匹配且不同于目标库时，才由可信宿主原子替换读写连接，真实读副本、未知连接和并发变化继续失败关闭。';
if (compareSemver(packageData.PackageInfo.Version, tenantDatabaseStaleReadRepairPackageVersion) < 0) {
  packageData.PackageInfo.Version = tenantDatabaseStaleReadRepairPackageVersion;
}
if (packageData.PackageInfo.Version === tenantDatabaseStaleReadRepairPackageVersion) {
  packageData.PackageInfo.Description = 'SaaS 引擎基础资源。提供租户开通、启动运行时与主租户受控的子租户数据库连接修复入口。';
  packageData.PackageInfo.ChangeLog = {
    Version: tenantDatabaseStaleReadRepairPackageVersion,
    Title: '精确修复复制残留的子租户读库连接',
    ChangeType: 'Fix',
    Content: '子租户数据库连接修复增加复制残留读库的精确确认模式；仅当旧读库名与请求完全匹配且不同于目标库时，才由可信宿主原子替换读写连接，真实读副本、未知连接和并发变化继续失败关闭。',
    ReleaseTime: '2026-09-02 09:30:00'
  };
}
packageData.PackageInfo.ChangeHistory = removeHistoryVersion(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseStaleReadRepairPackageVersion,
);
packageData.PackageInfo.ChangeHistory = prependOnce(
  packageData.PackageInfo.ChangeHistory,
  tenantDatabaseStaleReadRepairHistory,
);

normalizeOfficialApiEnginePolicies(packageData, path.basename(packagePath));
const normalizedPackageData = JSON.parse(normalizeOfficialPackageExecutionLimits(
  path.basename(packagePath),
  JSON.stringify(packageData),
));
fs.writeFileSync(packagePath, `${JSON.stringify(normalizedPackageData, null, 2)}\n`, 'utf8');
