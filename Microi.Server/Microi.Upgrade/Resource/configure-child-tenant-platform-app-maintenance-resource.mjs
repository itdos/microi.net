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

const storePackage = readJson("app.microi.store.json");
const childWorkerKey = "bulk-import-microi-store-packages";
const childWorkerSource = fs.readFileSync(
  path.join(directory, "bulk-import-packages.js"),
  "utf8"
).replace(/\r\n/g, "\n");
ensureMinimumPackageVersion(storePackage.PackageInfo, "v7.6.12");
const storeClosureChange =
  "2026-08-25 v7.6.12 受信 StartupDependencies 任务可选择只自举：从应用商城与 SaaS 官方不可变包补齐 platform-sys-menu 和六个运行门面，物理强回读七项契约后立即成功；普通安装和既有在途任务保持完整包流程。";
storePackage.PackageInfo.ChangeHistory = prependHistory(
  storePackage.PackageInfo.ChangeHistory,
  storeClosureChange
);
storePackage.PackageInfo.ChangeLog = {
  Version: "v7.6.12",
  Title: "大范围事故恢复支持只自举启动接口",
  ChangeType: "Fix",
  Content:
    "受信 StartupDependencies 任务可选择只自举：从应用商城与 SaaS 官方不可变包补齐 platform-sys-menu 和六个运行门面，物理强回读七项契约后立即成功；普通安装和既有在途任务保持完整包流程。",
  ReleaseTime: "2026-08-25 22:00:00"
};
storePackage.PackageInfo.RequiredPlatformCapabilities =
  (storePackage.PackageInfo.RequiredPlatformCapabilities || []).filter(
    capability => !String(capability).startsWith("ApiEngine:bulk-import-microi-store-packages@")
      && String(capability) !== "BackgroundTask:StartupDependencyPreinstallBootstrapV1"
      && String(capability) !== "BackgroundTask:StartupDependencyBootstrapOnlyV1"
  );
for (const capability of [
  "BackgroundTask:StartupDependencyResourceClosureV2",
  "BackgroundTask:StartupDependencyPreinstallBootstrapV1",
  "BackgroundTask:StartupDependencyBootstrapOnlyV1",
  "ApiEngine:bulk-import-microi-store-packages@v1.3.7"
]) addCapability(storePackage.PackageInfo, capability);
const childWorker = (storePackage.SysApiEngines || [])
  .find(item => item.ApiEngineKey === childWorkerKey);
if (!childWorker) throw new Error(`${childWorkerKey} is missing from app.microi.store.json`);
childWorker.ApiV8Code = childWorkerSource;
childWorker.Version = "v1.3.7";
childWorker.UpdateTime = "2026-08-25 22:00:00";
childWorker.ChangeHistory = prependHistory(
  childWorker.ChangeHistory,
  "2026-08-25 22:00:00 v1.3.7 受信事故任务可只自举七项启动接口，物理强回读后结束且不写应用安装版本"
);
refreshCounts(storePackage);
writeJson("app.microi.store.json", storePackage);

const saasPackage = readJson("app.microi.saas-engine.json");
const orchestratorKey = "bulk-update-child-tenant-platform-apps";
const orchestratorSource = fs.readFileSync(
  path.join(directory, "bulk-update-child-tenant-platform-apps.js"),
  "utf8"
).replace(/\r\n/g, "\n");
ensureMinimumPackageVersion(saasPackage.PackageInfo, "v7.6.19");
saasPackage.PackageInfo.Description =
  "SaaS 引擎基础资源。提供固定平台启动接口、匿名服务健康契约与真实后端版本，并支持主租户为全部启用子租户执行可回读的平台应用维护。";
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
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-25 v7.6.15 子租户事故恢复固定安装应用商城与 SaaS 引擎两个唯一资源所有者，并强回读 platform-sys-menu、platform-sys-config 等启动接口，避免只修复系统设置后仍无法登录。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-25 v7.6.16 新增 platform-service-health 匿名 Managed 接口，以固定健康契约返回 Healthy 与当前后端程序集版本；不查询业务表、不调用租户 Hook，避免单个菜单或业务接口异常被误判为整个 API 服务不可用。"
);
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-25 v7.6.17 主租户可在受信 StartupDependencies 事故任务中启用只自举模式；子任务入队后原子写入并强回读精确两应用闭包和只自举标志，失败即取消，普通平台应用维护不受影响。"
);
const targetedFullMaintenanceCollisionLine =
  "2026-08-25 v7.6.18 受信超级管理员后台任务支持按权威目录定向完整维护单个历史租户；启动依赖只自举仍严格限制为两应用闭包，避免为修复极老空库重跑全部子租户。";
saasPackage.PackageInfo.ChangeHistory = String(saasPackage.PackageInfo.ChangeHistory || "")
  .split(/\r?\n/)
  .filter(line => line && line !== targetedFullMaintenanceCollisionLine)
  .join("\n") + "\n";
saasPackage.PackageInfo.ChangeHistory = prependHistory(
  saasPackage.PackageInfo.ChangeHistory,
  "2026-08-25 v7.6.19 受信超级管理员后台任务支持按权威目录定向完整维护单个历史租户；启动依赖只自举仍严格限制为两应用闭包，避免为修复极老空库重跑全部子租户。"
);
if (saasPackage.PackageInfo.Version === "v7.6.19") {
  saasPackage.PackageInfo.ChangeLog = {
    Version: "v7.6.19",
    Title: "历史子租户支持定向完整平台维护",
    ChangeType: "Fix",
    Content:
      "受信超级管理员后台任务支持按权威目录定向完整维护单个历史租户；启动依赖只自举仍严格限制为两应用闭包，避免为修复极老空库重跑全部子租户。",
    ReleaseTime: "2026-08-25 23:00:00"
  };
}
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
  "BackgroundTask:StartupTargetFilter",
  "BackgroundTask:TargetedFullMaintenance",
  "BackgroundTask:StartupDependencyClosureV2",
  "BackgroundTask:StartupDependencyBootstrapOnlyV1",
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
    "2026-08-25 23:00:00 v1.3.1 受信超级管理员任务允许按权威目录定向执行完整平台应用维护；StartupDependencyBootstrapOnly 仍只允许 StartupDependencies\n" +
    "2026-08-25 22:00:00 v1.3.0 受信 StartupDependencies 新增只自举标志；子任务 Pending 阶段原子写入并强回读，失败即取消且不退化为完整重装\n" +
    "2026-08-25 20:00:00 v1.2.9 StartupDependencies 固定为应用商城 + SaaS 引擎完整闭包，覆盖 platform-sys-menu 与 platform-sys-config\n" +
    "2026-08-25 16:15:00 v1.2.8 StartupDependencies 支持经权威子租户目录校验的 TargetOsClients 定向修复，不再为单租户事故重跑全量租户\n" +
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
  Version: "v1.3.1",
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
