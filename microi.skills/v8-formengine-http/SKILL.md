---
name: v8-formengine-http
description: 移动端 / 外部系统通过 HTTP 直接调用 Microi FormEngine（GetTableData / GetFormData / Add / Upt / Del）的 RESTful 路由约定与排错指南
---

# FormEngine HTTP 路由约定（外部系统调用）

> 适用于：uni-app H5、原生 App、Postman、第三方系统、Playwright/Cypress 自动化测试等任何**没有进入 V8 引擎**的客户端。
> 不适用于：服务器端 V8 接口引擎内部 — 那种情况请直接 `V8.FormEngine.GetTableData(...)`。

## ⚠️ 最常见错误

```text
❌ POST /formengine/{表名}/gettabledata          → 404
❌ POST /api/formengine/{表名}/gettabledata      → 404
✅ POST /api/formengine/gettabledata-{表名}      → OK   （动态短路由）
✅ POST /api/formengine/GetTableData    body 中带 FormEngineKey  → OK   （标准路由）
```

平台路由由 `Microi.Server/Microi.net.Api/Handler/DynamicApiEngine.cs` 的 `FormEngineRoutes` 字典决定，**只认上面两种形式**。

## 路由总表

### 形式一：标准 Controller 路由 — 推荐
全部为 `POST`，URL 不含表名，`FormEngineKey` 放在 Body 中。

| URL | 动作 |
| --- | --- |
| `/api/formengine/GetFormData`            | 取一条 |
| `/api/formengine/GetTableData`           | 取列表（分页） |
| `/api/formengine/AddFormData`            | 新增 |
| `/api/formengine/UptFormData`            | 按 Id 修改 |
| `/api/formengine/UptFormDataByWhere`     | 按 _Where 批量改 |
| `/api/formengine/DelFormData`            | 删除（Id / Ids） |
| `/api/formengine/DelFormDataByWhere`     | 按 _Where 批量删 |
| `/api/formengine/GetFormDataAnonymous`   | 匿名取一条 |
| `/api/formengine/GetTableDataAnonymous`  | 匿名取列表 |
| `/api/formengine/AddFormDataAnonymous`   | 匿名新增 |

### 形式二：动态短路由（表名写进 URL，URL-friendly）
| URL 前缀 | 等价于 |
| --- | --- |
| `/api/formengine/getformdata-{table}`     | `/api/formengine/GetFormData` |
| `/api/formengine/get-formdata-{table}`    | `/api/formengine/GetFormData` |
| `/api/formengine/gettabledata-{table}`    | `/api/formengine/GetTableData` |
| `/api/formengine/get-tabledata-{table}`   | `/api/formengine/GetTableData` |
| `/api/formengine/addformdata-{table}`     | `/api/formengine/AddFormData` |
| `/api/formengine/add-formdata-{table}`    | `/api/formengine/AddFormData` |
| `/api/formengine/uptformdata-{table}`     | `/api/formengine/UptFormData` |
| `/api/formengine/upt-formdata-{table}`    | `/api/formengine/UptFormData` |
| `/api/formengine/delformdata-{table}`     | `/api/formengine/DelFormData` |
| `/api/formengine/del-formdata-{table}`    | `/api/formengine/DelFormData` |

URL 中的表名小写最稳，平台不区分大小写。匿名版本目前**只在形式一上有**（`GetTableDataAnonymous` 等）。

## 请求 Header

| Header | 是否必填 | 说明 |
| --- | --- | --- |
| `Content-Type` | 必填 | `application/json` 推荐 |
| `OsClient`     | 必填 | 租户标识；亦可放 querystring `?OsClient=xxx` 或 body |
| `authorization` | 鉴权接口必填 | `Bearer <Token>`；兼容旧客户端的 `Token` Header |
| `did` | 登录及鉴权接口推荐 | 当前终端稳定设备标识；首次生成后持久化，不能每次请求随机变化 |

注意：上表是 FormEngine 路由约定。ApiEngine HTTP 复测和移动端 `callEngine` 使用稳定路径 `/apiengine/{key}`，租户通过唯一的 `osclient` Header 传递，JSON/Form Body 可冗余携带 `OsClient`。普通 POST/PUT/PATCH/DELETE 禁止追加 `--OsClient--...--`；特殊路径只用于无法设置 Header/Form/Query 的 GET/HEAD 或第三方回调。

平台可能通过响应 Header `authorization`（兼容 `token`）续签或替换 Token。客户端必须立即保存新 Token，并保证并发旧响应不能覆盖已经写入的新 Token。跨域部署还必须在 CORS 中暴露 `authorization`、`token` 等需要读取的响应 Header。Token 属于凭据，禁止写入 URL、日志、错误上报和页面源码。

## FormEngine 数据授权边界

“Token 有效”只代表身份有效，不代表可以访问任意表。客户端 FormEngine CRUD 还会经过表、菜单、角色和行级范围授权：

1. 受保护的平台敏感表优先拒绝普通用户；匿名接口也不能绕过。
2. 标准菜单页应携带真实 `_SysMenuId`，或使用 `ModuleEngineKey`。服务器会严格校验该菜单是否绑定目标表、当前角色是否拥有菜单及对应操作权限；列表、计数、导出追加该菜单的数据范围。
3. 列表、写入、导入、导出显式传错 `_SysMenuId` / `ModuleEngineKey` 会直接拒绝，不会降级为其它菜单或表权限。单行详情只要当前角色拥有至少一个直接绑定同表的菜单（或精确表级 `Read` 权限）即可读取，不应用菜单 `SqlWhere` / `SqlJoin`；旧客户端携带过期菜单 Id 时也按该规则恢复。
4. 为兼容历史前端 V8/外部客户端，普通 CRUD 未传菜单上下文时，服务器会从当前用户的版本化授权缓存中查找“当前角色已获授权且直接绑定目标表”的菜单。无菜单列表仍安全合并候选菜单的数据范围，不能靠漏参绕过；详情按同表菜单访问，写入按 `Add/Edit/Del` 动作权限。也可以使用角色的精确表级 `Read/Add/Edit/Del` 授权。`JoinTables` 不是独立访问授权。
5. 导入、导出必须锚定具体菜单，不能依赖无菜单兼容推断。
6. `TableChild` 子表委托由标准表单运行时生成 `_TableChildAuth`，服务器重新校验父菜单、父记录、字段绑定、子表和外键，并强制父子范围。它是内部不透明上下文，外部客户端不要手工拼装。
7. `_InvokeType:'Client'` 只决定是否执行客户端语义的表单事件，不是权限开关。可信服务器调用标记也不能通过 HTTP Body 伪造。

因此：

- 标准模块、详情页和其字段元数据请求优先传真实 `_SysMenuId`，使服务器确定菜单绑定与操作权限；其中只有列表、计数、导出应用菜单查询范围。
- 历史无 `_SysMenuId` 请求可继续工作，但前提是当前用户确实拥有目标表对应的菜单或精确表权限；不能把兼容推断理解为“有 Token 即可查表”。
- 历史单表字段请求可在菜单缺失/过期时回退到当前角色另一个引用同表的已授权菜单；`GetDiyFieldByDiyTables` 批量字段请求按“第一张主表必须授权、后续表逐张授权并过滤”兼容。后续未授权/保护表不会导致主表失败，也不会返回其字段配置；这些规则不授予数据行权限。
- 表单设计器 `/api/DiyField/UptDiyFieldList` 属于 `Level >= 9999` 控制面：外层一次授权、字段归属校验、同事务批量更新、批次末一次缓存/版本刷新。禁止在 100+ 字段循环中逐条调用完整 `UptFormDataAsync("diy_field", ...)`，否则会重复执行授权、V8、日志及 SaaS/Redis 缓存工作。
- 接口引擎内的 `V8.FormEngine.*` 属于服务器端调用，不要求客户端 `_SysMenuId`。但接口引擎本身必须正确限制谁能调用，并在服务端校验业务对象范围，不能把表名和条件原样交给不可信客户端。
- 客户端新增、修改、删除分别校验真实菜单的 `Add`、`Edit`、`Del` 权限。`SqlWhere` / `SqlJoin` 是模块查询过滤，不是行级写权限：不得把它们追加到写入 SQL，也不得因查询包含 Join 拒绝已获授权的主表写入。
- 进入 `SubmitBeforeServerV8` / `SubmitAfterServerV8` 后，事件内 FormEngine/数据库调用与接口引擎一样属于可信服务器执行，可实现当前租户内的跨表事务。需要“只能修改本人数据”等业务约束以及归属字段写入时，应在这里或专用接口引擎中完成。

## Body 结构（POST JSON）

```jsonc
{
  "OsClient": "demo",
  "FormEngineKey": "mall_product",   // 形式一必填；形式二可选（已在 URL 中）
  "_SysMenuId": "目标菜单Id",         // 标准模块推荐；必须是真实绑定目标表且当前角色有权访问的菜单
  "_Where": [["Status","=","OnSale"], ["AND","Stock",">",0]],
  "_SelectFields": ["Id","Title","CurrentPrice","MainImg"],
  "_OrderBy": "SoldCount",
  "_OrderByType": "DESC",
  "_PageIndex": 1,
  "_PageSize": 20
}
```

写操作（Add/Upt）将业务字段平铺到 body：
```jsonc
{ "OsClient":"demo", "FormEngineKey":"biz_order",
  "Id":"01ABC...", "Quantity": 2, "Selected": 1 }
```

## 响应 DosResult 标准格式

```jsonc
{ "Code": 1, "Data": [...], "DataCount": 123, "Msg": "" }
```
| Code | 含义 |
| --- | --- |
| 1    | 成功 |
| 0    | 业务失败（看 `Msg`） |
| 1001 | 登录身份已过期 / Token 无效 |
| 1002 | 身份验证失败（OsClient 与 Token 不匹配） |

## 客户端封装样板（uni-app）

```javascript
const BASE = 'https://api.itdos.com';
const OS_CLIENT = runtimeConfig.osClient;
const TOKEN_KEY = 'mall_token';
const DID_KEY = 'mall_did';

function normalizeToken(value) {
  return String(value || '').replace(/^Bearer\s+/i, '').trim();
}
function getToken() {
  return normalizeToken(uni.getStorageSync(TOKEN_KEY));
}
function getDid() {
  let did = uni.getStorageSync(DID_KEY);
  if (!did) {
    did = `uni-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    uni.setStorageSync(DID_KEY, did);
  }
  return did;
}
function readHeader(headers, name) {
  const key = Object.keys(headers || {}).find(k => k.toLowerCase() === name);
  return key ? headers[key] : '';
}
function applyResponseToken(headers, requestToken) {
  const responseToken = normalizeToken(
    readHeader(headers, 'authorization') || readHeader(headers, 'token')
  );
  if (!responseToken) return;

  const currentToken = getToken();
  // 旧请求若只回显旧 Token，不得覆盖其它请求/标签页已保存的新 Token。
  if (currentToken && requestToken && currentToken !== requestToken && responseToken === requestToken) {
    return;
  }
  uni.setStorageSync(TOKEN_KEY, responseToken);
}

function formEngineRequest(action, table, body = {}) {
  return new Promise((resolve, reject) => {
    const requestToken = getToken();
    uni.request({
      url: `${BASE}/api/formengine/${action}-${table}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'OsClient': OS_CLIENT,
        'authorization': requestToken ? `Bearer ${requestToken}` : '',
        'did': getDid()
      },
      data: { OsClient: OS_CLIENT, FormEngineKey: table, ...body },
      success: (res) => {
        applyResponseToken(res.header || res.headers, requestToken);
        resolve(res.data || {});
      },
      fail: reject
    });
  });
}
export const formEngineGet    = (t, w) => formEngineRequest('gettabledata', t, w);
export const formEngineGetOne = (t, w) => formEngineRequest('getformdata',  t, w);
export const formEngineAdd    = (t, d) => formEngineRequest('addformdata',  t, d);
export const formEngineUpt    = (t, d) => formEngineRequest('uptformdata',  t, d);
export const formEngineDel    = (t, d) => formEngineRequest('delformdata',  t, d);
```

## 排错速查

| 现象 | 真实原因 |
| --- | --- |
| 404 Not Found | URL 缺 `/api/` 前缀，或表名/动作之间用 `/` 而不是 `-` |
| 405 Method Not Allowed | 用了 GET（FormEngine 全部为 POST） |
| 1001 登录身份已过期 | 没传 Token / Token 过期 / Redis 重启 |
| 1002 身份验证失败 | OsClient 不匹配 |
| `NoAuth` / `您没有权限做此操作` | Token 有效但菜单、表操作权限、表绑定角色、行级范围或敏感表策略不允许 |
| 显式传 `_SysMenuId` 后无权限 | 列表/写入使用错误菜单会严格拒绝；唯一详情在当前角色仍拥有另一个同表菜单时可恢复，不应用菜单查询范围 |
| 无 `_SysMenuId` 仍无权限 | 当前角色没有直接绑定该表的菜单授权，也没有精确表级授权 |
| 并发后提示 TokenReplaced / MissingToken | 客户端没有接收响应新 Token，或旧请求/其它标签页覆盖或清除了共享新 Token |
| Code:0 表不存在 | `FormEngineKey` 在 `diy_table` 不存在 |
| Code:0 字段不存在 | `_Where` / `_SelectFields` 写了表上没有的字段 |
| 返回 `null` 而不是 DosResult | Controller 抛了异常被吞，到后端日志看 `Microi.Core` 报错 |

## 与服务器端 V8 的对照

| 客户端 HTTP 路由                             | V8 内等价写法 |
| --- | --- |
| POST `/api/formengine/gettabledata-mall_product` | `V8.FormEngine.GetTableData('mall_product', {...})` |
| POST `/api/formengine/getformdata-mall_member`   | `V8.FormEngine.GetFormData('mall_member', {...})` |
| POST `/api/formengine/uptformdata-mall_shopping_cart` | `V8.FormEngine.UptFormData('mall_shopping_cart', {...})` |

> 客户端 HTTP 调用**会**触发 `SubmitBeforeServerV8`、`SubmitAfterServerV8`、`DataFilterV8` 等服务端事件；
> 而 V8 引擎内调用 `V8.FormEngine.*` 默认**不**触发，除非显式传 `_InvokeType:'Client'`。`_InvokeType` 只影响事件语义，不授予任何客户端表权限。
