---
name: v8-crud-api
description: Microi V8 CRUD 接口引擎开发。用于编写服务端 JavaScript，涉及 V8.FormEngine Add/Upt/Del/GetTableData、DosResult 返回、事务和校验。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 CRUD API 接口引擎开发

你正在开发 Microi 吾码平台的 V8 接口引擎。接口引擎是运行在服务端的 JavaScript 函数，通过 `V8.FormEngine` 操作数据库，通过 `V8.Result` 或 `return` 返回结果。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-crud-api-000 sha256=bfeaae480ebf6028fe98904cc6f8feb630b140b99551fefcc551c8038a2ca078 -->
## 本地优先与版本头（必做）

AI 本地开发接口引擎时，优先修改 `microi-v8-engine/<租户>/<项目>/接口引擎/.../*.js` 本地文件，再通过 MCP 或 VS Code 插件同步到数据库。插件提示“本地和远端不一致”时，必须先读取本地与远端代码并合并有效差异，不能盲目用任一侧覆盖另一侧。

每一次修改、上传、推送接口引擎代码，都必须维护文件顶部版本区域。版本号从 `v1.0.0` 开始；每次上传/推送/修改递增 1；补丁位和次版本位最大为 9 并向前进位（`v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`）。代码头只写完整功能说明，不写修改历史、时间戳或 ChangeLog。推荐格式：

```javascript
/*
 * V8 ApiEngine
 * ApiEngineKey: 示例接口引擎Key
 * Version: v1.0.0
 * 功能说明：
 * - 完整说明该接口引擎负责的业务功能、输入参数、关键返回字段和重要副作用。
 */
```

同步流程：`确认后端可达（不可达则自动启动 Microi.Server/Microi.net.Api/Microi.net.Api.csproj） -> 读取远端 -> 修改本地并递增语义版本头 -> JS 语法检查 -> 保存远端 -> 回读远端确认代码头 Version 与 sys_apiengine.Version 一致 -> 用 HTTP /apiengine/{key} + osclient Header 复测`。只用 MCP 保存成功不算完成，必须至少做回读或 HTTP 验证。普通 POST/PUT/PATCH/DELETE 禁止无脑追加 `--OsClient--...--`；该特殊路径仅保留给确实无法传 Header/Form/Query 的 GET/HEAD 或第三方回调场景。

如果保存或回读时出现 `fetch failed`、`ECONNREFUSED`、`000 Failed to connect`、端口无人监听等服务不可达问题，不能提前中止。需要启动或重启本地 API 时，必须在 `Microi.Server/Microi.net.Api` 目录通过 VS Code 可见终端执行 `dotnet run --launch-profile Microi.net.Api`，让开发者能肉眼看到并手动停止；不要用隐藏后台 shell 启动长期占用端口的 API 进程。若工具当前无法打开可见终端，应先说明限制并让用户启动/重启后继续验证。涉及 PC 页面联调或 Playwright 时，`Microi.Client` 也必须使用可见终端执行：`npm run dev -- --host 0.0.0.0 --port 1988`。只有启动失败、依赖缺失、数据库连接失败或端口冲突无法处理时才报告阻塞。

Microi.net.Api 普通本地启动不要额外设置 `ASPNETCORE_ENVIRONMENT` / `DOTNET_ENVIRONMENT`，让 `Program.cs` 读取 `Microi.Server/Microi.net.Api/.microi-local` 并加载对应的 `appsettings.{Env}.json`。

版本与历史同步规则：通过 MCP 或 VS Code 插件保存接口引擎时，必须同步写入 `sys_apiengine.Version`；修改记录只写入 `sys_apiengine.ChangeHistory`，不得写进代码头。`ChangeHistory` 是“修改历史说明”，每次更新都必须把最新说明拼接到最前面，并保留原有全部历史文字，禁止覆盖、清空或只保留最新一条。旧数据库可能没有 `Version`、`ChangeHistory` 字段，工具必须检测字段或失败回退，保证旧库仍可只更新 `ApiV8Code` 与 `UpdateTime`。

生成接口引擎代码时，代码内容本身（文件头、普通注释、`console.log`、返回 `Msg` 等）不要包含 `Microi`、`吾码` 等平台品牌文字，除非业务数据或字段值本身必须如此。生成代码要有可维护注释：每个 `function` 前写清用途、关键参数和返回值；跨表事务、权限校验、状态机、金额/库存计算、复杂 `_Where` 条件等代码段前写短注释说明业务原因；避免“给变量赋值”这类无信息量注释。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-001 sha256=86768d106f68593e51beb29bcff1ee0291c483706431181da34984b22228ff21 -->
## 核心规则

- 接口引擎文件是纯 JavaScript（Jint 引擎，非 Node.js）
- 全局对象 `V8` 是所有后端能力的入口
- 通过 `V8.Param` 获取前端传入的参数（URL参数 / form-data / payload-json）
- 通过 `V8.CurrentUser` 获取当前登录用户信息
- 返回结果统一格式：`{ Code: 1, Data: any, Msg: '成功' }`
- 所有 FormEngine 方法在服务器端支持第三个参数传入 `V8.DbTrans`（事务对象）
- 服务端调用 FormEngine 默认**不触发**表单 V8 事件，加 `_InvokeType: 'Client'` 才触发
- 接口内 `return Code=1` 自动提交事务、`Code≠1` 自动回滚事务，**禁止**手动 Commit/Rollback

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-002 sha256=9f10ab278468f292b5e26679b7a7ab2ea91bb6d4094e2bff8adb7cb15e39adce -->
## 性能底线（必须自检）

- 写接口引擎前必须先做数据访问计划：需要哪些表、哪些字段、预计数据量、是否分页、是否需要缓存。
- 禁止在 `for` / `while` / `forEach` / 嵌套循环中反复调用 `GetFormData`、`GetTableData`、`FromSql`、`ApiEngine.Run` 或外部 HTTP。先收集 Id/Key，用一次 `In` 查询或一条 JOIN/聚合 SQL 批量取回，再用对象字典映射。
- 禁止用双重循环匹配两组列表。先把小表或关联表整理成 `{ id: row }`、`{ parentId: [] }` 这类 Map，再单循环组装结果。
- 所有列表查询必须设置 `_SelectFields`，只取业务需要的字段；面向前端的列表必须分页或显式限制 `_PageSize`，不能一次拉全表。
- 报表、统计、跨表汇总优先使用数据库聚合（`COUNT/SUM/GROUP BY/JOIN`）或一次批量查询后内存聚合，不能逐行查明细再累加。
- 高频读取的系统配置、字典、菜单、字段、角色权限等静态数据要优先使用 `V8.Cache` 或平台已有缓存；写入后必须清理相关缓存。
- 外部 HTTP、短信、翻译、文件处理等慢操作不要放在数据库事务内循环执行；能批量就批量，不能批量就拆成异步任务/队列。
- 返回前做一次性能复核：数据库访问次数是否与数据量无关、是否避免 N+1 查询、是否有索引友好的 `_Where` 条件、是否不会因空参数导致全表扫描。

### 计量流水与分页审计

- Token、积分、余额等计量必须由服务端在真实成功结果后记录，失败请求不得扣减；能够取得供应商 `usage` 时禁止用完整 JSON 字符数代替真实输入/输出 Token。
- 余额扣减与流水新增必须在同一事务内完成，并锁定当前账户行，避免并发请求透支或出现“余额已扣但流水未写”。
- 面向个人中心的流水接口必须按 `V8.CurrentUser.Id` 强制隔离，并返回 `PageIndex`、`PageSize`、`TotalCount`；列表只取页面需要的审计字段。
- 为便于用户核对，可以保存经过空白归一化的用户输入短摘要；摘要按 Unicode 文本元素截取，不能截断 emoji 或代理对，也不要把完整请求 JSON 当摘要。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-003 sha256=d46768bbaaf8b2ebfdd38e09d11e886b135cb65e78984dbfa67d75ec5f947175 -->
## DosResult 状态码

| Code | 含义 |
|------|------|
| `1` | 成功 |
| `0` | 业务失败（自动回滚） |
| `2` | `GetFormData` 数据不存在（特殊值，仍属正常查询）|
| `1001` | Token 失效 |
| `1002` | 身份验证失败 |

```javascript
// GetFormData Code=2 的处理
var r = V8.FormEngine.GetFormData('Order', { Id: V8.Param.id });
if (r.Code === 2) return { Code: 0, Msg: '订单不存在' };
if (r.Code !== 1) return r;
// r.Data 才是真实数据
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-004 sha256=6d58584cabd1659ae3af6cbddb797df2c0844c99fd8d2627d02a9c0eae98e8c2 -->
## 全局日期函数

```javascript
DateNow('yyyy-MM-dd HH:mm:ss')                // 当前时间字符串
DateFormat(new Date(), 'yyyy-MM-dd')          // 格式化
DateAdd(new Date(), 'd', 7, 'yyyy-MM-dd')     // 加减（s/m/h/d/w/q/M/y）
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-005 sha256=35220022799bbed7f9b3d82fe14dc0855aa8f77d0640ac411c61d222d02b0eda -->
## 查询单条

```javascript
if (!V8.Param.id) {
  return { Code: 0, Msg: 'id 不能为空' };
}

var result = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Id', '=', V8.Param.id]],
  _SelectFields: ['Id', 'Account', 'Name', 'Phone']
});
// 也可以用 Id 直接查：{ Id: 'xxx' }

if (result.Code !== 1 || !result.Data) {
  return { Code: 0, Msg: '数据不存在' };
}

return { Code: 1, Data: result.Data };
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-006 sha256=510588ad14503caff0a92c614f0e7453bdd343a1e22711c6c5a2b3f8893b5a8d -->
## 新增

```javascript
if (!V8.Param.Account || !V8.Param.Name) {
  return { Code: 0, Msg: '账号和姓名不能为空' };
}

// 检查唯一性
var exist = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Account', '=', V8.Param.Account]]
});
if (exist.Code === 1 && exist.Data) {
  return { Code: 0, Msg: '账号已存在' };
}

var result = V8.FormEngine.AddFormData('SysUser', {
  // Id 不传会自动生成 GUID
  Account: V8.Param.Account,
  Name: V8.Param.Name,
  Phone: V8.Param.Phone || '',
  Status: 1
});
// result.Data 包含 Id, CreateTime, UserId 等自动生成字段

return { Code: result.Code, Data: result.Data, Msg: result.Code === 1 ? '新增成功' : result.Msg };
```

### 批量新增

```javascript
var addList = [];
for (var i = 0; i < V8.Param.items.length; i++) {
  addList.push({
    FormEngineKey: 'SysUser',  // 支持不同表混合批量
    Account: V8.Param.items[i].Account,
    Name: V8.Param.items[i].Name
  });
}
var result = V8.FormEngine.AddTableData(addList);
```

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-查询列表-分页.md](references/progressive-01-查询列表-分页.md)：查询列表（分页）；更新；删除；按条件批量操作；事务处理；请求内异步与后台处理；动态加字段（运行时改表结构）；旧版 _Where 兼容
- [references/progressive-02-where-条件语法速查.md](references/progressive-02-where-条件语法速查.md)：_Where 条件语法速查；注意事项
<!-- microi-progressive:end -->
