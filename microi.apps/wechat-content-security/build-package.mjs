import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const normalize = value => `${String(value).replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
const [core, extension] = await Promise.all([
  readFile(resolve(root, "core.js"), "utf8"),
  readFile(resolve(root, "extension.js"), "utf8"),
]);

const engine = (id, key, name, code, policy) => ({
  Id: id,
  ApiName: name,
  ApiEngineKey: key,
  ApiAddress: "",
  ApiRemark: policy === "Managed"
    ? "微信回调官方核心逻辑，由应用商城受管升级；检测到租户修改时停止覆盖。"
    : "微信回调租户扩展 Hook，首次安装后归租户维护，应用更新永不覆盖。",
  ApiV8Code: normalize(code),
  Version: "v1.0.0",
  ChangeHistory: "2026-08-06 v1.0.0 微信协议网关与业务接口引擎分层；支持租户扩展 Hook。",
  Category: "微信内容安全",
  IsEnable: 1,
  IsDeleted: 0,
  StopHttp: 1,
  AllowAnonymous: 0,
  Lock: 1,
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
    Version: "v1.0.0",
    AppVersion: "v1.0.0",
    AppId: "microi-wechat-content-security",
    ApplicationType: "Platform",
    Description: "微信小程序内容安全回调核心接口与租户扩展 Hook。",
    CreateTime: "2026-08-06 00:00:00",
    CreateUser: "Microi吾码",
    OsClient: "iTdos",
    ApiEngineCount: 2,
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
    },
  },
};

await writeFile(
  resolve(root, "app.microi.wechat-content-security.json"),
  `${JSON.stringify(packageModel, null, 2)}\n`,
  "utf8",
);
