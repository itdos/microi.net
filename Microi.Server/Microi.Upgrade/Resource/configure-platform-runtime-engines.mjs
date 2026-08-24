import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(root, 'app.microi.saas-engine.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const now = '2026-08-24 00:00:00';

function readSource(fileName) {
  return fs.readFileSync(path.join(root, fileName), 'utf8').replace(/\r\n/g, '\n').trimEnd();
}

function prependOnce(existing, line) {
  const value = existing || '';
  return value.split(/\r?\n/).includes(line) ? value : `${line}\n${value}`;
}

const engines = [
  {
    key: 'mci-module-presentation-stats', name: '模块展示动态统计', file: 'mci-module-presentation-stats.js',
    id: '01KZ000000B4D6G8H2J5M7N9PQ', enableLog: 0, version: 'v1.0.5',
    history: '2026-08-24 v1.0.5 批量统计配合客户端 40ms 合并窗口，并将用户级只读计数缓存调整为 10 秒；ForceRefresh 仍可立即绕过缓存。'
  },
  {
    key: 'mic_home_work_todo_badge', name: '我的工作统计角标', file: 'mic_home_work_todo_badge.js',
    id: '01KZ000000WF4ST4TSB4DGE001', enableLog: 0, version: 'v1.0.4',
    history: '2026-08-24 v1.0.4 使用租户级版本门主动失效用户缓存；新后端缓存 30 秒，旧后端保持 3 秒，避免遗漏工作流更新。'
  },
  {
    key: 'platform-schedule-job', name: '平台定时任务管理', file: 'platform-schedule-job.js',
    id: '01KZ0000007M5Q3R8V2N6C4B1A', enableLog: 1,
    history: '2026-08-24 v1.0.0 定时任务管理迁移至接口引擎，Quartz 仅保留最小可信 V8 原子能力。'
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
    history: '2026-08-24 v1.0.0 客户端兼容日志迁移至接口引擎，安全审计继续只允许后端可信执行点写入。'
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
    key: 'platform-sys-menu', name: '平台菜单与角色菜单权限', file: 'platform-sys-menu.js',
    id: '9434a0ec-f360-4cb1-8adb-00f5fb879f53', enableLog: 1,
    history: '2026-08-24 v1.0.0 菜单与角色菜单授权兼容接口迁移至接口引擎。'
  },
  {
    key: 'platform-sys-role', name: '平台角色目录', file: 'platform-sys-role.js',
    id: '74d79358-ee99-41ca-b86e-d0c060114fb0', enableLog: 1,
    history: '2026-08-24 v1.0.0 角色目录兼容接口迁移至接口引擎，保留权威表权限与可分配角色过滤。'
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
      StopHttp: 0,
      EnableLog: definition.enableLog,
      Category: '平台核心',
      Files: '[]',
      AllowAnonymous: definition.allowAnonymous || 0,
      ApiAddress: `/apiengine/${definition.key}`,
      Lock: 0,
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
  engine.StopHttp = 0;
  engine.AllowAnonymous = definition.allowAnonymous || 0;
  engine.IsEnable = 1;
  engine.EnableLog = definition.enableLog;
  engine.ChangeHistory = prependOnce(engine.ChangeHistory, definition.history);
  packageData.ResourcePolicies.ApiEngines[definition.key] = {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed'
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
for (const capability of [
  'V8.Method.ManageScheduleJob',
  'V8.Method.ManageMq',
  'V8.Method.ManageMqtt',
  'V8.Method.ManageSearchEngine',
  'V8.Method.ManageAiWorkflow',
  'V8.Method.GenerateTencentImUserSig',
  'V8.Method.ManageSystemDirectory',
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
  'ApiEngine:platform-sys-menu',
  'ApiEngine:platform-sys-role',
  'ApiEngine:mci-module-presentation-stats',
  'ApiEngine:mic_home_work_todo_badge'
]) {
  if (!capabilities.includes(capability)) capabilities.push(capability);
}

const packageHistory = '2026-08-24 v7.5.39 内置微服务升级至 v1.8.9，补齐跨月流量明细、真实接口引擎归因、接口引擎流式响应与控制器低代码迁移；热点角标采用主动失效版本门。';
packageData.PackageInfo.Version = 'v7.5.39';
packageData.PackageInfo.ApiEngineCount = packageData.SysApiEngines.length;
packageData.PackageInfo.FieldCount = packageData.DiyFields.length;
packageData.PackageInfo.PhysicalColumnCount = packageData.PhysicalColumns.length;
packageData.PackageInfo.DataRowCount = (packageData.DataSets || [])
  .reduce((total, dataSet) => total + (dataSet.Rows || []).length, 0);
packageData.PackageInfo.ChangeHistory = prependOnce(packageData.PackageInfo.ChangeHistory, packageHistory);

fs.writeFileSync(packagePath, `${JSON.stringify(packageData, null, 2)}\n`, 'utf8');
