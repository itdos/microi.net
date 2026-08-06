# 📝 FormEngine 用法

> **前后端 V8 共享文档，均为 JavaScript 语法，用法基本一致，略有差别**

---

## 📌 前后端 V8 语法差异

| 端 | 说明 |
| :--: | ---- |
| 服务器端 | `V8.FormEngine` 对表的所有操作均支持第二个参数传入 `V8.DbTrans` 数据库事务对象 |
| 服务器端 | `V8.FormEngine` 操作**不会触发**表单属性的任何事件（除非传入 `_InvokeType:'Client'`） |
| 前端 | `V8.FormEngine` 操作**会触发**表单属性事件 |
| 前端 | 直接调用 FormEngine 对应的接口地址也会触发服务器端 V8 事件 |

::: tip 提示
`V8.FormEngine` 下所有函数均为单表操作（除 Batch 批量操作外）。后端 V8 可用 `V8.ModuleEngine` 让模块关联配置生效，或使用参数化 SQL 完成受控 JOIN；当前标准前端 V8 没有公开挂载 `V8.ModuleEngine`。
:::
>* __<span class="mci-doc-danger">注意：从Microi.net.dll v3.0.2开始，在删除、修改数据时若数据库受影响行数为0，仍然返回Code=1成功，并且会额外返回DataCount值为实际受影响行数（之前版本是返回Code=1006）</span>__

## 🌐 HTTP 直接调用（重要）

> 移动端/外部系统不通过 V8 引擎调用 FormEngine 时，必须使用以下 RESTful 路由。**不要拼出 `/formengine/{表名}/gettabledata` 这种地址，那是错误写法，会得到 404。**

平台路由由 `Microi.net.Api/Handler/DynamicApiEngine.cs` 的 `FormEngineRoutes` 字典决定，所有 FormEngine HTTP 接口共有两种调用形式：

### 形式一：标准 Controller 路由（推荐，FormEngineKey 放 Body）

| Method | URL | Body |
| --- | --- | --- |
| POST | `/api/formengine/GetFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...] }` |
| POST | `/api/formengine/GetTableData`    | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...], "_PageIndex":1, "_PageSize":20 }` |
| POST | `/api/formengine/AddFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", ...字段 }` |
| POST | `/api/formengine/UptFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "Id":"...", ...字段 }` |
| POST | `/api/formengine/UptFormDataByWhere` | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...], ...字段 }` |
| POST | `/api/formengine/DelFormData`     | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "Id":"..." }` 或 `{ "Ids":[...] }` |
| POST | `/api/formengine/DelFormDataByWhere` | `{ "OsClient":"xxx", "FormEngineKey":"<表名>", "_Where":[...] }` |

匿名版本（无需 Token，需在 `diy_table.IsAnonymous` 中允许）：
| POST | `/api/formengine/GetFormDataAnonymous`     | 同上 |
| POST | `/api/formengine/GetTableDataAnonymous`    | 同上 |
| POST | `/api/formengine/AddFormDataAnonymous`     | 同上 |

### 形式二：动态短路由别名（FormEngineKey 写在 URL 里）

`DynamicApiEngine` 维护以下前缀映射，效果与形式一完全一致：

```
POST /api/formengine/getformdata-{表名}        → GetFormData
POST /api/formengine/get-formdata-{表名}       → GetFormData
POST /api/formengine/gettabledata-{表名}       → GetTableData
POST /api/formengine/get-tabledata-{表名}      → GetTableData
POST /api/formengine/addformdata-{表名}        → AddFormData
POST /api/formengine/add-formdata-{表名}       → AddFormData
POST /api/formengine/uptformdata-{表名}        → UptFormData
POST /api/formengine/upt-formdata-{表名}       → UptFormData
POST /api/formengine/delformdata-{表名}        → DelFormData
POST /api/formengine/del-formdata-{表名}       → DelFormData
```

URL 中的表名建议小写。Body 仍可传 `FormEngineKey` 用于校验，多余时以 URL 为准。

### 必传 Header

| Header | 说明 |
| --- | --- |
| `Content-Type` | `application/json`（推荐）或 `application/x-www-form-urlencoded` |
| `OsClient` | 当前租户标识；也可作为 querystring `?OsClient=xxx` 或 body 字段传入 |
| `Token` | 登录后获得的 Token；匿名接口可省略 |

### HTTP 授权边界

::: warning Token 不是数据授权
Token 只证明“当前请求是谁、属于哪个 `OsClient`”，不能据此读取或修改任意表。浏览器、移动端和其它外部客户端发起的 FormEngine 请求，服务端会继续校验表、菜单、角色、操作类型和数据范围；隐藏前端按钮不能代替服务端授权。
:::

平台按以下顺序执行客户端 FormEngine 授权：

1. **显式菜单严格校验**：请求传 `_SysMenuId`（推荐）或兼容的 `ModuleEngineKey` 时，服务端校验菜单确实绑定目标 `diy_table`，且当前用户的有效角色在 `sys_rolelimit` 中拥有该菜单及当前操作权限。列表、写入、导入、导出显式传错、伪造或借用其它表的菜单 Id 会直接失败。
2. **详情按表菜单授权**：单行详情只校验当前用户是否拥有至少一个直接绑定目标表的菜单（或精确表级 `Read` 权限），不应用菜单 `SqlWhere`、`SqlJoin`。旧版 PC/UniApp 未传菜单或保留已删除菜单 Id 时，只要当前授权快照中仍有同表菜单即可恢复。该规则不适用于列表枚举、导入和导出。
3. **历史无菜单调用安全推断**：为兼容存量项目中大量未传 `_SysMenuId` 的前端 V8，登录用户的无菜单请求由后端从“当前用户有效角色真正拥有的 `sys_menu`”中推断目标表和操作权限。候选菜单及权限来自后端授权快照，不相信客户端提交的角色、菜单列表或权限 JSON。集合查询的多个范围只有 Join 上下文一致时才可合并；无法合并时失败关闭。
4. **高级表权限兜底**：确实没有菜单入口的 SDK / 定制页面，可在角色管理的【高级表权限】中为普通业务表按最小权限授予 `Read`、`Add`、`Edit`、`Del`。对应数据使用 `sys_rolelimit.Type = 'Table'` 保存；`diy_table.BindRole` 只做候选角色过滤，不能单独代替具体操作权限。
5. **平台表分级保护**：后端 `PlatformResourceSecurity` 是唯一事实源。账号、角色、权限、SaaS 配置、接口引擎、表/字段元数据、任务、数据源、密钥、基础设施和安全审计表属于“管理员专用”，客户端通用 FormEngine 对 `Level < 9999` 硬拒绝。工作流、微服务/应用商店、蓝图和微应用运行元数据属于“只读委托”，普通角色只有获得真实菜单或高级表 `Read` 权限后才能查询，增删改仍要求 `Level >= 9999`。`mic_page`、`mic_print` 属于“按角色管理”，登录用户可按明确授予的 `Read`、`Add`、`Edit`、`Del` 使用。三类平台表都禁止匿名 FormEngine 访问。
6. **导入/导出**：必须携带真实菜单上下文，并分别拥有 `Import`、`Export` 权限；高级表权限不能绕过。导出属于查询并继续应用菜单数据范围；导入属于写入，由 `Import` 权限和表单后端 V8 业务校验控制，不使用菜单查询 Join/Where 拒绝。

标准 PC 表单引擎的前端 FormEngine facade 会给“当前菜单绑定的当前表”自动注入真实 `_SysMenuId`；跨表 V8 调用故意保持无菜单，由后端按目标表授权推断，不能把当前主表菜单错误传播给其它表。菜单表单的详情、新增、修改、删除以及导入上传、进度查询、清理临时数据，应持续传递同一个菜单上下文。导入、导出等操作类型由服务端固定，不能相信客户端提交的操作名称。

旧版 PC/UniApp 的单表字段请求可在菜单缺失或过期时回退到当前用户另一个已授权且引用同表的菜单。调用 `GetDiyFieldByDiyTables` 时还可能一次提交“主表 + 多张关联表”：服务端按原顺序把第一张表视为主表授权锚点，主表无权时返回 `NoAuth`；主表有权时，后续关联表逐张校验并只返回有权表的字段，未授权表和当前操作仍要求超级管理员的平台表会被剔除而不会使整张业务表单失败。元数据兼容不会授予关联表的数据行访问权。

#### 数据范围和子表委托

- 菜单 `SqlWhere`、`SqlJoin` / `JoinTables` 只进入真实列表、计数和导出 SQL，不能只在界面或查询后过滤；单行详情不应用这些模块列表过滤配置，它们也不是行级写权限。
- 模块设计器在桌面端采用“左侧图形配置、右侧实时 SQL”的布局，可见范围右侧的最终 `SqlWhere` 始终可以手动编辑；左侧图形配置变化时会按最新配置重新生成右侧正文，关联关系右侧继续展示自动生成的 `SqlJoin`；窄屏自动改为上下布局。自动生成的 `SqlWhere` 会在每个权限语义块前使用 `-- 【权限说明】` 中文行注释，解释租户隔离、AND/OR、角色/部门/本人范围及括号作用。图形回显状态使用紧凑、明文可读的 `-- MICROI_DATA_PERMISSION_CONFIG:{...}` 首行保存，默认值和关联关系不重复写入；旧 `-- MICROI_DATA_PERMISSION_V1:...` Base64 标记仅作读取兼容，不再新生成。服务端执行查询前会移除这些平台专用注释、兼容的历史 `-- 【吾码权限说明】` 以及旧版设计器块注释，数据库最终只接收可执行条件；用户手写 SQL 注释保持原样。
- 标准表单提交会对真正的 `CodeEditor` 字段使用显式 UTF-8 Base64URL 传输信封，以避免代理或 JSON 链路改写源码；FormEngine 控制器在进入新增、修改和批量业务逻辑前统一解码并移除信封，数据库中始终保存明文。未携带信封的历史请求保持兼容，非法或不完整信封会整体失败，不会写入半解码内容。
- 主表新增、修改、删除分别校验菜单或高级表权限中的 `Add`、`Edit`、`Del`，不把菜单查询条件追加到写入 SQL，也不因查询包含跨表 Join 而拒绝。需要“仅可修改本人数据”等业务规则时，在 `SubmitBeforeServerV8` 或专用接口引擎中以服务端可信代码校验。
- 导入校验菜单 `Import` 权限；导出校验 `Export` 并继续应用查询范围。
- `TableChild` 隐藏子菜单不要求存量角色逐个补权限。后端会验证父菜单、父表的 TableChild 字段配置、子菜单绑定、父记录数据范围、父键唯一性及子表外键，再把外键条件强制写入查询/写入。伪造 `_TableChildAuth`、跨父记录或脱离父表直接访问都会失败。

#### 服务端可信调用与缓存

后端接口引擎、后端表单 V8 和平台内部调用由服务端创建不可由 HTTP JSON 伪造的可信上下文，调用 `V8.FormEngine` 时不要求 `_SysMenuId`。`_InvokeType:'Server'` 只是事件语义，不是客户端授权开关。接口引擎、任务、数据源和 V8 管理入口本身必须限制为 `Level >= 9999`。

浏览器发起 `AddFormData` 时，服务端会先验证用户拥有目标菜单和 `Add` 权限，再进入 `SubmitBeforeServerV8` / `SubmitAfterServerV8`。事件内部的 `V8.FormEngine`、`V8.Db` 与接口引擎一样属于服务器可信执行，可在当前租户内实现复杂 SQL 和跨表事务，不会被外层浏览器菜单权限二次拦截。

授权校验使用按 `OsClient` 隔离的 Redis `epoch`、用户授权快照、短 TTL L1 与共享 L2 缓存，不会每次请求都重新查询所有权限表。用户、角色、菜单、数据范围和角色授权变化后提升共享 `epoch`，所有 API/Worker 节点自然丢弃旧快照，无需逐节点重启或清空 Redis；共享缓存不可用时按平台策略回源主库。

#### 兼容迁移

- 标准后台菜单继续继承菜单权限，不需要维护“角色 × 所有业务表”的巨大矩阵；【高级表权限】只用于没有菜单入口的 SDK、定制页面。
- 新页面应携带真实菜单上下文；历史前端 V8 无菜单请求继续由后端安全推断，不应为兼容而加全局表白名单。
- 匿名读取/新增仍须由 `diy_table` 明确开启；包括 `mic_page`、`mic_print` 和只读委托表在内的全部平台表都不会因匿名开关而放行。
- 完整安全模型、CORS/SSRF、登录会话和文件权限见 [平台安全与兼容基线](../more/security)。

### 常见错误对照

| 错误现象 | 原因 |
| --- | --- |
| 404 Not Found | URL 写成 `/formengine/{表名}/gettabledata`、缺少 `/api/` 前缀、或表名与动作之间写成 `/` 而非 `-` |
| `Code:1001 登录身份已过期` | 未带 Token、Token 过期、或 Redis 缓存被清空 |
| `Code:1002 身份验证失败` | OsClient 与 Token 不匹配 |
| `Code:0 无权限` | 当前角色没有目标表菜单/操作权限、列表范围无法安全合并、写入使用错误菜单、向只读委托表写入，或普通帐号访问管理员专用表 |
| `Code:0 表不存在` | `FormEngineKey` 大小写或拼写错误（实际不区分大小写，但表必须存在于 `diy_table`） |

### 移动端 uni-app 调用示例

```javascript
const BASE = 'https://api.itdos.com';
const OS_CLIENT = runtimeConfig.osClient;
function formEngineGet(table, where = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE}/api/formengine/gettabledata-${table}`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'OsClient': OS_CLIENT,
        'Token': uni.getStorageSync('token') || ''
      },
      data: { OsClient: OS_CLIENT, FormEngineKey: table, ...where },
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}
// 使用
const r = await formEngineGet('mall_product', {
  _Where: [['Status','=','OnSale']],
  _OrderBy: 'SoldCount',
  _OrderByType: 'DESC',
  _PageSize: 20
});
```

---

## 前端V8异步、同步用法
```javascript
//前端同步执行：
var result = await V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : []
});
if(result.Code != 1){
	V8.Tips(`获取数据出现错误：${result.Msg}`, false); return;
}
var dataList = result.Data;

//前端异步执行：
V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : []
}, function(result){//异步回调函数
	if(result.Code != 1){
		V8.Tips(`获取数据出现错误：${result.Msg}`, false); return;
	}
    var dataList = result.Data;
});
```

## 后端V8异步、同步用法
```javascript
//后端同步执行，第3个参数均支持传入V8.DbTrans数据库事务对象
var result = V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    _Where : [],
}, V8.DbTrans);

//后端异步执行，支持await转为同步
V8.FormEngine.GetTableDataAsync('表名或表Id，不区分大小写', {
    _Where : [],
});
```

## 后端.NET二次开发C#用法
```csharp
var _formEngine = new FormEngine();
var result = await _formEngine.GetTableDataAsync('表名或表Id，不区分大小写', new {
    _Where = new List<DiyWhere>(){ 
        new DiyWhere(){
            Name = "Xingming", Value = '张三', Type = "Like"
        }
     }
});
var dataList = result.Data;
```

## _Where条件
>* 见平台文档：[Where条件](https://microi.net/doc/v8-engine/where.html)

## 获取一条数据 GetFormData
```javascript
//必须传入Id或_Where
var result = await V8.FormEngine.GetFormData('表名或表Id，不区分大小写', {
    Id : 'a',//可选，与_Where必选其一，等同于_Where : [['Id', '=', 'a']]
    _Where : [
        [ 'Id', '=', 'a' ]
    ],//可选，与Id必选其一
    _SelectFields : ['Id', 'Name'],//可选，指定查询哪些字段
});
//当查询到的数据不存在时，返回的result为： { Code : 2, Data : null, Msg : '不存在的数据！' }
if(result.Code != 1){
	//错误信息：result.Msg
    return result;
}
var data = result.Data;//格式：{}
```

## 获取数据列表 GetTableData
::: details 展开查看 JavaScript 代码（22 行）
```javascript
var result = V8.FormEngine.GetTableData('表名或表Id，不区分大小写', {
    Ids : [1, 2, 3],//可选，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
    _Where : [
        ['Age', '>', '10']
    ],
    _PageSize : 15,//每页多少条数据。可选，默认最大值1000
    _PageIndex: 1,//第几页数据，从1开始索引。
    _OrderBy : 'Name',//可选。传入排序字段名称。默认值CrateTime、Id
    _OrderByType : 'ASC',//可选。值：DESC、ASC（不区分大小写）。默认值ASC
    _OrderBys: { //或者使用多字段排序 order by Account asc, Phone desc
		'Account' : 'asc', 
		'Phone' : 'desc' 
	},
    _SelectFields : ['Id', 'Name'],//可选，指定查询哪些字段
});
//返回 { Code : 1/0, Data : [], DataCount : 数量总数用于计算分页, Msg : '错误信息' }
//当查询到的数据不存在时，返回的result为： { Code : 1, Data : [] }
if(result.Code != 1){
	//错误信息：result.Msg
    return result;
}
var data = result.Data;//格式：[]
```
:::

### 匿名获取数据列表 GetTableDataAnonymous
>* 用法和以上GetTableData一致
>* 注意如果是在前端V8中使用，必须要在表单属性中开启【允许匿名读取】

### 仅获取数据条数 GetTableDataCount
>* 用法和以上GetTableData一致
```js
var dataCount = result.DataCount;
```

### 获取树形数据列表 GetTableDataTree
>* 用法和以上GetTableData一致
>* 注意表单属性中必须开启【树形结构】配置


## 新增一条数据 AddFormData
```javascript
var result = V8.FormEngine.AddFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，若不传则由服务器端自动生成guid值
    Sex : '男',
    Age : 18,
});
//其它可选参数
_InvokeType : 'Client',//若是在服务器端V8代码中传入此参数值，则也会触发表单属性服务器端V8事件（反之不会触发表单属性服务器端V8事件）。其它方法同理。

//返回 { Code : 1/0, Data : {新增后的数据对象，包含Id、CreateTime、UserId等默认字段}, Msg : '错误信息！' }
//当表单属性中开启【允许匿名新增数据】时，未登录客户端可调用
//POST /api/formengine/AddFormDataAnonymous；参数与上面一致，并传入 OsClient。
//当前后端 V8.FormEngine 不公开匿名新增方法，V8 内部代码仍使用 AddFormData 并遵守当前执行身份。
```

## 批量新增数据 AddTableData
>* 等于老版的`AddFormDataBatch`
```javascript
//自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var addList = [];
addList.push({
    FormEngineKey : '表名或表Id，不区分大小写',
    Id : '',//可选
    Age : 18,
    Sex : '女'
});
var addResult = V8.FormEngine.AddTableData(addList);
```

## 修改一条数据 UptFormData
>* __<span class="mci-doc-danger">注意：仅支持传入Id进行单条数据的修改，若要根据其它条件修改，考虑到安全性（防止批量误操作更新），请使用【UptFormDataByWhere】</span>__

```javascript
V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传。 注意：如果想根据_Where条件进行修改，请使用【UptFormDataByWhere】
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
});
//其它可选参数：
//有时候传入的对象中包含的字段数量过多，可传入此参数忽略部分字段的修改
_NotSaveField : ['字段名1', '字段名2', '字段名3']
//当要修改的数据不存在时，则执行数据插入动作。默认值false（UptFormDataBatch、UptFormDataByWhere 同理）
_NoLineForAdd : true
//如果是【自动编号】字段，默认不支持修改，若要强制修改自动编号字段，请额外传入参数
_ForceUpt : true //UptFormDataBatch、UptFormDataByWhere 同理
```

## 根据where条件批量修改数据 UptFormDataByWhere
```javascript
//，谨慎操作。如果未传入条件，则返回错误
//对应sql：update diy_content set Name='xxx' where ContentKey like '%test%'
var result = V8.FormEngine.UptFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like'， 'test']
    ],
    Name : 'xxx'
});
//支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```

## 批量修改数据 UptTableData
>* 等于老版的`UptFormDataBatch`
```javascript
//批量修改，自带事务，也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var uptList = [];
uptList.push({
    FormEngineKey : '表名或表Id，不区分大小写',
    Id : '',//必传
    Age : 20,
    Sex : '女'
});
var uptResult = V8.FormEngine.UptTableData(uptList);
//支持传入【_NoLineForAdd:true】，当修改数据受影响行数为0时，则会执行插入数据动作
```

## 删除一条数据 DelFormData
```javascript
V8.FormEngine.DelFormData('表名或表Id，不区分大小写', {
    Id : '',//可选，与Ids必传其一
    Ids : [1, 2, 3],//可选，与Id必传其一，等同于：_Where : [['Id', 'In', JSON.stringify([1,2,3])]]
    //注意：为了防止用户误传错误的_Where批量删除了业务数据，因此此处不支持传入_Where，根据_Where条件进行批量删除请使用 DelFormDataByWhere
});
```

## 批量删除数据 DelTableData
>* 等于老版的`DelFormDataBatch`
```javascript
//也可第二个参数传入V8.DbTrans事务对象。
//每条数据支持不同的表FormEngineKey
var delList = [];
delList.push({
    FormEngineKey : '',
    Id : '',//必传
});
var delResult = V8.FormEngine.DelTableData(delList);
```

## 根据where条件批量删除数据 DelFormDataByWhere
```javascript
//谨慎操作。如果未传入条件，则返回错误
//对应sql：DELETE FROM diy_content WHERE ContentKey LIKE '%test%'
var result = V8.FormEngine.DelFormDataByWhere('表名或表Id，不区分大小写', {
    _Where : [
        ['ContentKey', 'Like', 'test']
    ],
});
```

## 多表联合查询
>* 后端 V8 的 `V8.ModuleEngine.GetTableData` 接收包含 `ModuleEngineKey` 的查询对象，并让对应模块的关联表配置生效。当前标准前端 V8 没有公开挂载 `V8.ModuleEngine`；前端需要多表数据时应调用受控接口引擎/数据源引擎。
```js
// 方式一：后端 V8 使用已经配置好关联字段的模块
var moduleResult = V8.ModuleEngine.GetTableData({
    ModuleEngineKey: 'customer-order-module',
    _PageIndex: 1,
    _PageSize: 20
});

// 方式二：后端 V8 使用参数化 JOIN；所有动态值都必须绑定参数
var sql = `SELECT A.*, B.Id AS BID, B.Name AS BName
           FROM tableA A
           LEFT JOIN tableB B ON A.BID = B.ID
           WHERE A.ClassType = @p0`;
var rows = V8.Db.FromSql(sql)
    .AddInParameter('@p0', V8.Param.ClassType)
    .ToArray();
```

## 新增一个字段 AddField
```javascript
//暂时仅支持服务器端V8。新增一个字段
var addField = V8.FormEngine.AddField({
    TableName : 'Diy_Test',//表名
    Name : 'Age',//字段名
    Type : 'int',//字段类型
    Label : '年龄',//字段显示名称,
    Component : 'NumberText',//控件类型
    TableWidth : '100',//表格宽度
    Visible : 1 //是否显示
});
```
## 新增一张表 AddTable
>* 暂时仅支持服务器端V8。新增一张表

## 表单设计器批量保存字段

`/api/DiyField/UptDiyFieldList` 是 PC 表单设计器使用的平台控制面接口，不是普通业务角色或前端 V8 的通用批量写接口。

- 入口要求 `Level >= 9999`，并在批次开始时完成一次管理员身份与目标表校验。
- 每个字段必须属于请求中的同一 `TableId`；混入其它表字段会整体回滚。
- 字段元数据在同一数据库事务中批量更新，物理列只有在名称或类型确实变化时才执行变更。
- 批次完成后只执行一次字段缓存、授权快照和 V8 代码版本刷新，不会按字段数量重复刷新 SaaS 配置。
- 该内部元数据批处理不逐条触发 `diy_field` 的通用 FormEngine V8/数据日志管线。业务数据需要逐行事件时应继续使用 `V8.FormEngine.UptTableData` 或受控接口引擎。


## 获取某个字段配置的数据源 GetFieldData

## 在事务中执行增删改查、调用其它接口引擎
::: details 展开查看 JavaScript 代码（37 行）
```js
//业务逻辑1：查询数据
var selectResult = V8.FormEngine.GetTableData('tableName', {
    _Where: [
        ['Id', 'In', '(1, 2, 3)']
    ]
}, V8.DbTrans);
if(selectResult.Code != 1){
    return selectResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑2：修改数据
var uptResult = V8.FormEngine.UptFormData('tableName', {
    Id : 1,
    Name : '修改后的值',
    Sex : '女'
}, V8.DbTrans);
if(uptResult.Code != 1){
    return uptResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑3：删除数据
var delResult = V8.FormEngine.DelFormData('tableName', {
    Id : 1,
}, V8.DbTrans);
if(delResult.Code != 1){
    return delResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//业务逻辑4：调用其它接口引擎
var apiEngineResult = V8.ApiEngine.Run('apiEngineKey', {
    Id : 1,
}, V8.DbTrans);
//防止某些接口引擎未返回数据，而是返回的null导致apiEngineResult.Code报错，所以这里的判断是【apiEngineResult && apiEngineResult.Code != 1】
if(apiEngineResult && apiEngineResult.Code != 1){
    return apiEngineResult;//平台会自动回滚事务，无需手动执行V8.DbTrans.Rollback();
}
//当Code=1时平台会自动提交事务，无需手动执行V8.DbTrans.Commit();
//注意：当返回值未指定Code的值时，平台默认自动提交事务，而不是回滚
//注意：只要指定了Code的值，并且不等于1，则平台会自动回滚事务
return { Code : 1, Msg : '操作成功！' };
```
:::
