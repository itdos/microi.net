import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureMinimumPackageVersion } from "./resource-sync-core.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const writeJson = (name, value) => fs.writeFileSync(
  path.join(directory, name),
  JSON.stringify(value, null, 2) + "\n",
  "utf8"
);
const prependHistory = (current, line) => {
  const remaining = String(current || "")
    .split(/\r?\n/)
    .filter(item => item && item !== line);
  return [line, ...remaining].join("\n") + "\n";
};
const addCapability = (packageInfo, capability) => {
  packageInfo.RequiredPlatformCapabilities ||= [];
  if (!packageInfo.RequiredPlatformCapabilities.includes(capability)) {
    packageInfo.RequiredPlatformCapabilities.push(capability);
  }
};
const refreshCounts = packageModel => {
  const info = packageModel.PackageInfo;
  info.MenuCount = (packageModel.SysMenus || []).length;
  info.TableCount = (packageModel.DiyTables || []).length;
  info.FieldCount = (packageModel.DiyFields || []).length;
  info.DDLCount = (packageModel.DDLStatements || []).length;
  info.PhysicalColumnCount = (packageModel.PhysicalColumns || []).length;
  info.ApiEngineCount = (packageModel.SysApiEngines || []).length;
  info.DataSetCount = (packageModel.DataSets || []).length;
  info.DataRowCount = (packageModel.DataSets || []).reduce(
    (sum, item) => sum + (Array.isArray(item.Rows)
      ? item.Rows.length
      : (Array.isArray(item.Data) ? item.Data.length : 0)),
    0
  );
};

const modulePackage = readJson("app.microi.module-engine.json");
modulePackage.PackageInfo.Version ||= "v7.5.5";
modulePackage.PackageInfo.Description ||=
  "模块引擎基础资源。左侧菜单数字角标支持配置接口引擎统计值和悬停说明；记录直达与表单展示继续使用物理配置。";
const badgeTooltipHistory =
  "2026-08-22 v7.5.2 新增 sys_menu.MenuBadgeTooltip，左侧菜单数字角标可显示自定义悬停说明，旧菜单未配置时保持原有标题提示。";
if (!String(modulePackage.PackageInfo.ChangeHistory || "").includes(badgeTooltipHistory)) {
  modulePackage.PackageInfo.ChangeHistory = prependHistory(
    modulePackage.PackageInfo.ChangeHistory,
    badgeTooltipHistory
  );
}
addCapability(modulePackage.PackageInfo, "ServerField:SysMenu.MenuBadgeTooltip");

const ddl = modulePackage.DDLStatements[0];
if (!/\bMenuBadgeTooltip\b/.test(ddl.DDL)) {
  ddl.DDL = ddl.DDL.replace(
    "  `MenuBadgeApiEngineKey` varchar(100) NULL COMMENT '菜单统计接口引擎',",
    "  `MenuBadgeApiEngineKey` varchar(100) NULL COMMENT '菜单统计接口引擎',\n" +
      "  `MenuBadgeTooltip` varchar(500) NULL COMMENT '菜单角标悬停说明',"
  );
}

if (!modulePackage.PhysicalColumns.some(item => item.COLUMN_NAME === "MenuBadgeTooltip")) {
  const maxOrdinal = Math.max(
    0,
    ...modulePackage.PhysicalColumns
      .filter(item => String(item.TABLE_NAME).toLowerCase() === "sys_menu")
      .map(item => Number(item.ORDINAL_POSITION) || 0)
  );
  modulePackage.PhysicalColumns.push({
    TABLE_NAME: "sys_menu",
    COLUMN_NAME: "MenuBadgeTooltip",
    COLUMN_TYPE: "varchar(500)",
    DATA_TYPE: "varchar",
    IS_NULLABLE: "YES",
    COLUMN_DEFAULT: null,
    COLUMN_COMMENT: "菜单角标悬停说明",
    COLUMN_KEY: "",
    EXTRA: "",
    ORDINAL_POSITION: maxOrdinal + 1
  });
}

if (!modulePackage.DiyFields.some(item => item.Name === "MenuBadgeTooltip")) {
  const source = modulePackage.DiyFields.find(item => item.Name === "MenuBadgeApiEngineKey");
  if (!source) throw new Error("MenuBadgeApiEngineKey field is missing");
  modulePackage.DiyFields.push({
    ...source,
    Id: "e20ca27c-f0cf-4d2a-9b80-c9e8fffb3d2d",
    CreateTime: "2026-08-22 00:00:00",
    Type: "varchar(500)",
    Name: "MenuBadgeTooltip",
    Component: "Text",
    Label: "菜单角标悬停说明",
    Placeholder: "例如：当前登录用户的待办与未读抄送数量之和",
    Description: "鼠标移入左侧菜单右侧的数字角标时显示；用于解释数字的业务含义。留空时沿用历史标题提示。",
    Config: "{}",
    Sort: 3230,
    TableWidth: 260
  });
}
refreshCounts(modulePackage);
writeJson("app.microi.module-engine.json", modulePackage);

const saasPackage = readJson("app.microi.saas-engine.json");
const orchestratorKey = "bulk-update-child-tenant-platform-apps";
const orchestratorSource = fs.readFileSync(
  path.join(directory, "bulk-update-child-tenant-platform-apps.js"),
  "utf8"
).replace(/\r\n/g, "\n");
ensureMinimumPackageVersion(saasPackage.PackageInfo, "v7.5.31");
saasPackage.PackageInfo.Description =
  "SaaS 引擎基础资源。主租户可为全部启用子租户补齐商城工作器并创建独立的平台应用安装/更新后台任务，父任务以全部子任务真实终态为准。";
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-22 v7.5.9 子租户任务投递前幂等补齐运行时物理前置列和固定商城工作器；父任务持续汇总每个子任务真实进度与终态，仅当全部成功时成功。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-22 v7.5.10 将子租户自举与终态汇总能力标记移出可替换文件头，确保 MCP 安全维护接口源码时仍可回读能力。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-22 v7.5.11 父任务后台进度统一使用百分比 Current/Total，避免子任务入队数量导致父任务提前显示 99%。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-22 v7.5.12 子租户工作器投递失败时在父任务通知中直接显示租户名、失败阶段和安全门禁原因。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-23 v7.5.24 父任务进入 Monitor 后只汇总持久化子任务，不再重复执行租户目录发现与商城工作器自举。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-23 v7.5.31 补齐 diy_LeftJoinRightView 表、字段和物理结构；子租户运行时缺失时按 sys_osclients 自动重载，单租户投递失败不再提前中止其它子任务汇总。"
);
for (const capability of [
  "V8.Method.GetChildTenantPlatformAppMaintenanceTargets",
  "V8.Method.QueueChildTenantPlatformAppMaintenance",
  "BackgroundTask:TrustedTargetOsClient",
  "InstallerBootstrap:ChildTenantMarketplaceWorkers",
  "BackgroundTask:ChildTenantTerminalAggregation",
  "Installer:PackageDataTableClosure",
  "BackgroundTask:ChildTenantRuntimeReloadRecovery",
  "BackgroundTask:PartialQueueTerminalAggregation",
  "BackgroundTask:StartupDependencyIncidentScope",
  "BackgroundTask:StartupNoRequeueRefresh",
  "V8.Method.ReloadOsClient"
]) addCapability(saasPackage.PackageInfo, capability);
saasPackage.PackageInfo.RequiredPlatformCapabilities =
  (saasPackage.PackageInfo.RequiredPlatformCapabilities || []).filter(capability => ![
    "BackgroundTask:StartupBootstrapRefresh",
    "BackgroundTask:StartupBootstrapRuntimeFlagRefresh",
    "BackgroundTask:StartupBootstrapRevisionReset",
    "BackgroundTask:StartupBootstrapTaskReadback",
  ].includes(capability));

const engine = {
  IsDeleted: 0,
  UserName: "管理员",
  UserId: "c74d669c-a3d4-11e5-b60d-b870f43edd03",
  CreateTime: "2026-08-22 00:00:00",
  Id: "8b6ee32a-69c5-47cd-95d5-7a1342d64a87",
  ChangeHistory:
    "2026-08-25 16:05:00 v1.2.7 在途任务按 ApiEngineKey 自动读取最新工作器；旧刷新检查点仅迁移为 Monitor，禁止重新投递产生第二批任务\n" +
    "2026-08-25 15:50:00 v1.2.6 归一化 DosResult.Data 并强回读原子任务 Id、幂等键、目标租户与唯一 SaaS 范围\n" +
    "2026-08-25 15:35:00 v1.2.5 提升刷新修订至 v4，触发已误标 v3 的在途父任务重新执行完整一致轮次\n" +
    "2026-08-25 15:30:00 v1.2.4 刷新分片中途升级修订时从首租户重启同一幂等轮次，避免混合版本漏补\n" +
    "2026-08-25 15:20:00 v1.2.3 兼容 MySQL BIT(1) 历史列绑定，再次刷新在途任务的运行标志补正器\n" +
    "2026-08-25 15:10:00 v1.2.2 再次刷新在途任务，补正历史租户匿名启动标志并重建完整接口缓存\n" +
    "2026-08-25 14:50:00 v1.2.1 在途事故父任务用原幂等子任务刷新官方商城工作器，优先恢复 Jhyxdkj/lsg 且不创建重复任务\n" +
    "2026-08-25 14:10:00 v1.1.9 兼容滚动发布旧控制面：子任务入队后强制写入并回读启动依赖范围，失败即停止\n" +
    "2026-08-25 13:50:00 v1.1.8 新增 StartupDependencies 受信事故恢复范围，仅投递 SaaS 启动依赖包\n" +
    "2026-08-23 20:20:00 v1.1.7 兼容旧控制面：目录或投递遇到未加载 OsClient 时受控重载并重试\n" +
    "2026-08-23 20:00:00 v1.1.6 子租户运行时逐个重载；单个投递失败仍持续汇总全部已投递子任务\n" +
    "2026-08-23 00:40:30 v1.1.5 安全保存后的官方实际版本；Monitor 仅汇总持久化 ChildTasks\n" +
    "2026-08-23 00:40:00 v1.1.4 Monitor 阶段只读取持久化 ChildTasks，避免运行中自举重检误中断父任务\n" +
    "2026-08-23 00:30:00 v1.1.3 Monitor 阶段只读取持久化 ChildTasks，避免运行中自举重检误中断父任务\n" +
    "2026-08-22 14:00:00 v1.1.2 父任务投递失败通知直接包含租户和安全门禁详情\n" +
    "2026-08-22 13:00:00 v1.1.1 父任务 Current/Total 改用百分比单位，避免排队数量触发 99% 假进度\n" +
    "2026-08-22 12:00:00 v1.1.0 投递前补齐子租户商城工作器，并持续汇总全部子任务真实终态\n" +
    "2026-08-22 00:00:00 v1.0.0 创建主租户批量维护子租户平台应用编排接口\n",
  Version: "v1.2.7",
  LimitRecursion: 1000,
  LimitMemory: 256,
  MaxStatements: 10000000,
  Timeout: 600,
  StopHttp: 1,
  EnableLog: 1,
  Category: "平台运维",
  Files: "[]",
  AllowAnonymous: 0,
  ApiAddress: "/apiengine/" + orchestratorKey,
  ResponseFile: 0,
  Lock: 0,
  ApiV8Code: orchestratorSource,
  ApiRole: "[]",
  IsEnable: 1,
  ApiEngineKey: orchestratorKey,
  ApiName: "[SaaS引擎]为全部子租户安装或更新平台应用"
};
const existingEngineIndex = (saasPackage.SysApiEngines || [])
  .findIndex(item => item.ApiEngineKey === orchestratorKey);
if (existingEngineIndex >= 0) saasPackage.SysApiEngines[existingEngineIndex] = engine;
else saasPackage.SysApiEngines.push(engine);

saasPackage.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
saasPackage.ResourcePolicies.ApiEngines ||= {};
saasPackage.ResourcePolicies.ApiEngines[orchestratorKey] = {
  Ownership: "Platform",
  UpgradePolicy: "Managed"
};

const saasMenu = saasPackage.SysMenus.find(item => item.Url === "/osclients");
if (!saasMenu) throw new Error("SaaS menu /osclients is missing");
const pageButtons = JSON.parse(saasMenu.PageBtns || "[]");
const pageButton = {
  Id: "bulk-update-child-tenant-platform-apps-page-btn",
  Sort: 30,
  Name: "一键为所有子租户安装/更新所有平台应用",
  Icon: "Download",
  BtnStyle: "warning",
  IsVisible: true,
  ShowRow: false,
  V8CodeShow:
    "var level = Number((V8.CurrentUser && V8.CurrentUser.Level) || 0);\n" +
    "var isMainTenant = !!(V8.SysConfig && (V8.SysConfig.IsMainTenant === true || Number(V8.SysConfig.IsMainTenant) === 1));\n" +
    "V8.Result = level >= 9999 && isMainTenant;\nreturn V8.Result;",
  V8Code:
    "V8.ConfirmTips(\n" +
    "  '系统会为当前运行环境中的每个启用子租户分别创建一个“安装/更新全部平台应用”后台任务。每个租户的真实进度和结果都会显示在主租户右上角通知中心。确认继续？',\n" +
    "  async function() {\n" +
    "    try {\n" +
    "      var operationId = Date.now() + '-' + Math.random().toString(36).substring(2);\n" +
    "      var result = await V8.ApiEngine.RunBackground(\n" +
    "        'bulk-update-child-tenant-platform-apps',\n" +
    "        {},\n" +
    "        '为全部子租户安装/更新所有平台应用',\n" +
    "        {\n" +
    "          IdempotencyKey: 'child-platform-apps-orchestrator:' + operationId,\n" +
    "          ConcurrencyKey: 'bulk-update-child-tenant-platform-apps',\n" +
    "          MaxAttempts: 1,\n" +
    "          RetryOnFailure: false\n" +
    "        }\n" +
    "      );\n" +
    "      if (!result || result.Code != 1) {\n" +
    "        V8.Tips('启动子租户平台应用维护失败：' + ((result && result.Msg) || '接口无返回'), false);\n" +
    "        return;\n" +
    "      }\n" +
    "      V8.Tips('批量维护任务已提交。父任务会持续汇总每个子租户的真实安装进度，全部子任务成功后才会完成。', true);\n" +
    "      if (typeof window !== 'undefined') {\n" +
    "        window.dispatchEvent(new CustomEvent('microi-background-task-started', { detail: result.Data || result }));\n" +
    "      }\n" +
    "    } catch (error) {\n" +
    "      V8.Tips('启动子租户平台应用维护失败：' + ((error && error.message) || error), false);\n" +
    "    }\n" +
    "  },\n" +
    "  null,\n" +
    "  { Title: '维护全部子租户平台应用', OkText: '开始创建任务', Icon: 'warning' }\n" +
    ");",
  _RawName: "一键为所有子租户安装/更新所有平台应用",
  Workload: {
    ExecutionMode: "DurableFanOut",
    Resumable: true,
    MaxItemsPerChunk: 20
  }
};
const existingButtonIndex = pageButtons.findIndex(item => item.Id === pageButton.Id);
if (existingButtonIndex >= 0) pageButtons[existingButtonIndex] = pageButton;
else pageButtons.push(pageButton);
pageButtons.sort((left, right) => Number(left.Sort || 0) - Number(right.Sort || 0));
saasMenu.PageBtns = JSON.stringify(pageButtons);
refreshCounts(saasPackage);
writeJson("app.microi.saas-engine.json", saasPackage);
