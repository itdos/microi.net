import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const normalize = value => `${String(value).replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
const [core, extension, statusBatch] = await Promise.all([
  readFile(resolve(root, "core.js"), "utf8"),
  readFile(resolve(root, "extension.js"), "utf8"),
  readFile(resolve(root, "status-batch.js"), "utf8"),
]);

const engine = (id, key, name, code, policy, options = {}) => ({
  Id: id,
  ApiName: name,
  ApiEngineKey: key,
  ApiAddress: "",
  ApiRemark: options.remark || (policy === "Managed"
    ? "微信回调官方核心逻辑，由应用商城受管升级；检测到租户修改时停止覆盖。"
    : "微信回调租户扩展 Hook，首次安装后归租户维护，应用更新永不覆盖。"),
  ApiV8Code: normalize(code),
  Version: options.version || "v1.0.0",
  ChangeHistory: options.changeHistory || "2026-08-06 v1.0.0 微信协议网关与业务接口引擎分层；支持租户扩展 Hook。",
  Category: "微信内容安全",
  IsEnable: 1,
  IsDeleted: 0,
  StopHttp: options.stopHttp === undefined ? 1 : options.stopHttp,
  AllowAnonymous: 0,
  Lock: options.lock === undefined ? 1 : options.lock,
  ResponseFile: 0,
  EnableLog: 0,
  Timeout: 120,
  LimitMemory: 128,
  LimitRecursion: 64,
  V8Unlimited: 0,
  ApiRole: "[]",
});

const packageModel = {
  PackageInfo: {
    Name: "微信小程序内容安全",
    Version: "v1.0.1",
    AppVersion: "v1.0.1",
    AppId: "microi-wechat-content-security",
    ApplicationType: "Platform",
    Description: "微信小程序内容安全回调核心接口、批量状态查询与租户扩展 Hook。",
    CreateTime: "2026-08-06 00:00:00",
    CreateUser: "Microi吾码",
    OsClient: "iTdos",
    ApiEngineCount: 3,
  },
  DDLStatements: [],
  PhysicalColumns: [],
  DiyTables: [],
  DiyFields: [],
  DataSets: [],
  SysMenus: [],
  WfFlowDesigns: [],
  WfNodes: [],
  WfLines: [],
  SysApiEngines: [
    engine(
      "01KZZWECHATCONTENTCORE0000000",
      "mci-wechat-content-callback-core",
      "[微信内容安全]回调核心",
      core,
      "Managed",
    ),
    engine(
      "01KZZWECHATCONTENTHOOK0000000",
      "mci-wechat-content-callback-extension",
      "[微信内容安全]租户回调扩展",
      extension,
      "CreateIfMissing",
    ),
    engine(
      "01KZZWECHATSTATUSBATCH0000000",
      "mci-wechat-content-status-batch",
      "[微信内容安全]批量状态查询",
      statusBatch,
      "Managed",
      {
        stopHttp: 0,
        lock: 0,
        remark: "登录用户批量查询本人微信图片审核状态，使用租户共享 Redis，供小程序合并轮询。",
        changeHistory: "2026-08-07 v1.0.0 多图审核批量状态查询；按当前用户和租户校验记录归属。",
      },
    ),
  ],
  ResourcePolicies: {
    SchemaVersion: 1,
    ApiEngines: {
      "mci-wechat-content-callback-core": {
        Ownership: "Application",
        UpgradePolicy: "Managed",
      },
      "mci-wechat-content-callback-extension": {
        Ownership: "Tenant",
        UpgradePolicy: "CreateIfMissing",
      },
      "mci-wechat-content-status-batch": {
        Ownership: "Application",
        UpgradePolicy: "Managed",
      },
    },
  },
};

await writeFile(
  resolve(root, "app.microi.wechat-content-security.json"),
  `${JSON.stringify(packageModel, null, 2)}\n`,
  "utf8",
);
