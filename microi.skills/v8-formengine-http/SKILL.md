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
| `Token`        | 鉴权接口必填 | 登录返回的 Token |

## Body 结构（POST JSON）

```jsonc
{
  "OsClient": "lsg",
  "FormEngineKey": "mall_product",   // 形式一必填；形式二可选（已在 URL 中）
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
{ "OsClient":"lsg", "FormEngineKey":"mall_shopping_cart",
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
const OS_CLIENT = 'lsg';
function getToken(){ return uni.getStorageSync('mall_token') || ''; }

function formEngineRequest(action, table, body = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE}/api/formengine/${action}-${table}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'OsClient': OS_CLIENT,
        'Token': getToken()
      },
      data: { OsClient: OS_CLIENT, FormEngineKey: table, ...body },
      success: (res) => resolve(res.data || {}),
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
> 而 V8 引擎内调用 `V8.FormEngine.*` 默认**不**触发，除非显式传 `_InvokeType:'Client'`。
