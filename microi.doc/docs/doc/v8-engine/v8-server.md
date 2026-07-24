# 🖥️ V8 函数列表 - 后端

> **服务器端 V8 引擎支持 ES6 语法，集成后端对象和方法**

---

## 📌 介绍

- 服务器端 V8 引擎代码与前端 V8 的编程语言均为 JavaScript 语法
- 服务器端 V8 引擎支持 ES6 语法
- 集成了后端对象、方法，可使用 JS 调用后端方法（非 HTTP）
- 服务器端 V8 代码在服务器端执行
- 主要用于表单属性的服务器端 V8 事件、接口引擎、数据源引擎等

## 接口引擎 V8.ApiEngine

> [接口引擎详细介绍](https://microi.net/doc/v8-engine/api-engine)

服务器端 V8 事件可以直接调用接口引擎（非 HTTP），接口引擎也可以调用其它接口引擎。传入 `V8.DbTrans` 时，共享外层事务；不传时由被调用接口引擎管理自己的事务。

`StopHttp`、允许匿名调用和接口角色限制约束的是外部 HTTP 入口。`V8.ApiEngine.Run` 属于可信服务端调用，不经过 HTTP 门禁。因此，被其它接口引擎复用的敏感业务仍必须在被调用引擎内部校验当前用户、业务状态和数据范围；能够编辑接口引擎、数据源、Job 或后端事件的账号属于“服务端代码执行”信任边界，只应授予高权限管理员。

外部客户端推荐直接向动态路由发送 JSON：

```http
POST /apiengine/{ApiEngineKey}--OsClient--{OsClient}--
Content-Type: application/json

{"Action":"Bootstrap","Keyword":"客户"}
```

兼容旧入口时，请把接口 Key 放在 JSON Body 中：

```http
POST /api/ApiEngine/Run
Content-Type: application/json

{"ApiEngineKey":"your_key","Action":"Bootstrap"}
```

两种入口都会把 JSON Body 恢复到 `V8.Param`；同名 Query/Form 参数保持既有优先级。接口层只负责 HTTP 路由、参数绑定和可信上下文恢复，不承载 AI、模型路由等业务逻辑。客户端提交的 `_CurrentUser`、`_InvokeType:'Server'` 或 `_TrustedServerInvocation` 不能建立服务端信任，身份和调用类型始终由认证中间件及接口层决定。

```javascript
// 同步调用
var result = V8.ApiEngine.Run('ApiEngineKey', { 
    Param1: '1'
});

// 共享当前事务
var result2 = V8.ApiEngine.Run('ApiEngineKey', {
    Param2: '1'
}, V8.DbTrans);
```

接口引擎返回值与事务语义：

- 返回 `DosResult` 或带 `Code` 的对象：`Code === 1` 提交，其它值回滚。
- 返回对象但没有 `Code`：回滚，避免“忘记返回状态”时误提交。
- 返回字符串、数字、数组、布尔值或 `null`，且脚本未抛异常：默认提交。
- 嵌套调用传入外层事务时，最终提交或回滚由外层调用者决定。
- `V8.DbTrans.Commit()`、`Rollback()`、`Close()` 会被安全代理忽略，不要在脚本中手动管理平台事务。

## 表单引擎 V8.FormEngine

见平台文档：[FormEngine 用法](https://microi.net/doc/v8-engine/form-engine.html)。

后端接口引擎和后端表单 V8 事件在活跃 V8 上下文中调用 FormEngine 时，由服务端写入不可被外部 JSON 构造的可信标记，因此不要求 `_SysMenuId`。租户边界、平台保护表和脚本自身的业务校验仍然生效。浏览器或其它外部 HTTP 请求不能通过伪造 `_InvokeType: 'Server'` 获得该信任；`_InvokeType` 只控制是否触发表单事件，不是身份或授权标记。

这里要区分“进入事件前”和“事件内部”：浏览器调用 `AddFormData` 仍要先通过目标菜单的 `Add` 权限，菜单 `SqlWhere` / `SqlJoin` 只约束已有记录的查询、修改和删除，不用于拒绝一条尚不存在的新增记录；进入 `SubmitBeforeServerV8` / `SubmitAfterServerV8` 后，事件代码与接口引擎具有相同的服务器 FormEngine/数据库执行能力，可在当前租户内完成跨表事务、复杂 SQL 及归属字段写入。

前端/外部 HTTP 的菜单授权、历史无 `_SysMenuId` 推断、TableChild 委托和行级权限规则详见 [FormEngine 安全授权](./form-engine.md#安全授权模型)。

平台内部的多层封装也必须保留来源：如果一个已校验管理员的设计器或升级任务在内部再次调用 FormEngine，应传递原管理员上下文，或由服务器构造带 `_TrustedServerInvocation` 的强类型参数；不要把数据转成裸 `JObject` 后依赖类型推断。可信标记是服务端实现细节，V8 代码和 HTTP 客户端都不需要、也不能自行设置。

这一规则也适用于 `AddDiyField/AddField`：它会先读取表定义，再在事务中调用通用 FormEngine 写入 `diy_field`，最后创建物理列。内部 `diy_field` 写入必须继承外层已验证的管理员或可信升级上下文；普通客户端不能借动态建字段入口绕过保护表授权。

## 缓存操作 V8.Cache

`V8.Cache` 是当前租户命名空间内的 Redis 能力。传逻辑 Key 时服务端自动生成 `Microi:${V8.OsClient}:{逻辑Key}`；传完整的当前租户 Key 继续兼容，传入其它租户的 `Microi:` 前缀会被拒绝。它不暴露 Redis `IDatabase`、连接管理、服务器扫描或任意连接能力。

过期时间可传秒数，也可传 `d.HH:mm:ss` 字符串，例如 `59` 或 `0.00:00:59`；省略时为永久。常用方法包括 `Set/Get/Delete/Del/Remove`，以及 `HashSet/HashGet/HashGetAll/HashGetAllKeys/HashDelete/HashExists/HashLength/HashIncrement`。

```javascript
// 推荐只传逻辑 Key，租户前缀由服务端添加
var cacheKey = 'FormData:baoming';
var cacheValue = JSON.stringify(formData);
var result1 = V8.Cache.Set(cacheKey, cacheValue, 59);
var result2 = V8.Cache.Get(cacheKey);
var result3 = V8.Cache.Remove(cacheKey);

V8.Cache.HashSet('Customer:Stats', 'Count', '1');
var count = V8.Cache.HashGet('Customer:Stats', 'Count');
```

不要用“先 `KeyExist`、再 `Set`、最后 `Remove`”实现分布式锁：这不是原子加锁，没有持有者令牌，且可能删除其它节点的锁。接口引擎应使用平台的分布式锁配置，Job/Worker 使用带租约和持有者令牌的锁；锁之外还必须使用稳定幂等键、唯一约束或状态机保证副作用只执行一次。

菜单、角色和表权限保存会递增 Redis 授权版本并使各节点的短期快照失效。不要把“重启容器”或“清空整个 Redis”当作权限刷新方案。

## .NET 互操作与异步边界

后端 V8 对部分 .NET 类型开放互操作，但平台能力应优先使用 `V8.*`：例如用 `V8.Method.NewUlid()` 生成标识、用 `V8.Base64` 编解码、用 `DateNow()` 处理时间。不要依赖全局 `System` 名称访问任意 CLR 类型；平台还提供了 `V8.System` 主机监控扩展，两者可能发生名称冲突，且部分危险 CLR 类型会被禁用。

`setTimeout` 和 `System.Threading.Tasks.Task.Run` 不能作为“请求返回后可靠执行”的方案。`V8Engine.Run` 返回后会释放当前 Jint Engine、租户上下文、事务和并发租约，延迟回调可能面对已失效的上下文。请求内异步 API 使用 `await`；需要脱离请求执行时，使用接口引擎后台任务、Job、MQ 或 outbox，并设计幂等、重试和多节点故障恢复。

```javascript
var now = DateNow('yyyy-MM-dd HH:mm:ss');
var id = V8.Method.NewUlid();

// 请求内异步方法（仅在方法本身提供 Async 版本时）
var result = await V8.ApiEngine.RunAsync('ApiEngineKey', { Id: id });
```

## 常用函数 V8.Method

`V8.Method` 同时包含业务工具、管理员运维能力和平台内部能力。普通业务脚本优先使用下列稳定接口；数据库备份、清空数据库、认证缓存维护等管理方法不能作为普通业务 API 暴露。

::: details 展开查看 JavaScript 代码
```javascript
// 当前 Token 与身份。不要把返回对象直接透传给前端。
var currentTokenObj = V8.Method.GetCurrentToken(token, osClient)
// { OsClient:'', CurrentUser:{}, Token:'不包含 Bearer ' } 或 null

var id = V8.Method.NewUlid();
var timestamp = V8.Method.GetTimestamp();

// 后端可信 V8 按租户内对象路径签发短期代理地址
var result = V8.Method.GetPrivateFileUrl({
    FilePathName: '/microi/file/2023-08-06/xxx.doc'
});

// 结构化系统日志；不要记录密码、Token、密钥或完整请求体
V8.Method.AddSysLog({
    Type: '接口日志',
    Title: '同步完成',
    Content: '记录数：20',
    Level: 1
});
```

### V8.Method.Upload

`V8.Method.Upload` 使用当前租户文件配置，并执行平台上传上限与租户动态配额。默认上限为：单文件 100 MB、单请求 200 MB、最多 10 个文件、每用户每天 2 GB、每租户每天 20 GB；`sys_osclients` 的 `FileUploadEnabled`、`FileUploadMaxFileMB`、`FileUploadMaxRequestMB`、`FileUploadMaxCount`、`FileUploadDailyUserQuotaMB`、`FileUploadDailyTenantQuotaMB` 可按租户进一步收紧。HTTP 上传会在 Base64 解码前预检体积，日配额用 Redis Lua 原子计数；配额服务不可用时失败关闭。

```javascript
var uploadResult = V8.Method.Upload({
  FilesByteBase64: V8.FilesByteBase64,
  Limit: true,
  Preview: false,
  Path: '/file',
  OsClient: V8.OsClient
});
```

普通 HTTP 上传只允许平台规定的目录并默认按私有文件处理；可信后端 V8 可进行租户内受控文件操作，但不能把 `GetPrivateFileByte`、对象列举或删除等管理能力直接暴露给普通用户。浏览器访问私有文件时还必须证明菜单、记录、字段与附件绑定关系，详见 [文件上传与私有文件](../more/hdfs.md)。

`GetPrivateFileUrl` 返回的是后端短期票据代理地址，而不是可泄露的对象存储真实签名地址。后端会分别记录链接签发和实际 `GET/HEAD` 打开/下载行为；登录用户记录为 `Name(Account)`，转发链接被无身份访问时记录为匿名访问。代理支持 `Range` 流式响应并对分片请求短时去重，失败时不会退回未经审计的真实签名地址。`Limit:false` 的公有文件仍可直接走 CDN/公有桶，不记录此类行为日志。

系统日志调用会先进入后端有界内存队列，由单一后台消费者按批次写入 MongoDB；请求线程不等待 MongoDB。每批日志在写 MongoDB 前先写入本地 `logs/syslog-spool`，MongoDB 暂时不可用或服务正常重启时会自动幂等重放。可通过环境变量 `MICROI_SYSLOG_SPOOL_DIR` 指定持久化目录，容器部署时应把该目录挂载到持久卷；多节点实例还应设置稳定且唯一的 `MICROI_NODE_ID`。所有节点共享 MongoDB/Redis，日志按全局 `EventId` 幂等 upsert，详情停留状态和私有附件票据可跨节点继续读取。

平台内置用户行为日志还会记录 `Category`、`Action`、`Source`、`TargetType`、`TargetId`、`SessionId`、`DurationSeconds`、`Success`、`OccurredAt` 等结构化字段。用户显示统一采用 `Name(Account)`；密码、Token、Authorization、Secret、ApiKey、连接字符串等敏感内容会在进入队列时脱敏和限长。
:::

## V8.Base64
>* Base64转换，与System.Convert.ToBase64String(bytes)不同的是V8.Base64若遇异常会直接返回源字符串
```javascript
var result = V8.Base64.StringToBase64('123456');
var result = V8.Base64.Base64ToString('MTIzNDU2');
```

## 图像处理 V8.Image

`V8.Image` 提供跨平台的服务端图片生成、合并和编辑能力。所有方法都以对象形式传参，只处理内存中的 `Base64`、Data URI 或字节数组，不直接读取本地路径，也不会主动访问 URL。

### 图片来源与返回值

图片来源支持以下形式：

```javascript
// 顶层 Base64
{ FileByteBase64: '<base64>' }

// 等价字段
{ Base64: '<base64>' }
{ DataUrl: 'data:image/png;base64,...' }
{ Bytes: response.RawBytes }

// 单图方法也支持 Image / Source 嵌套，值可以是对象或字符串
{ Image: { FileByteBase64: '<base64>' } }
{ Source: '<base64>' }
```

处理成功时，除 `GetInfo` 外均返回标准 `DosResult`：

```javascript
{
  Code: 1,
  Data: {
    FileName: 'image.png',
    ContentType: 'image/png',
    FileByteBase64: '<base64>',
    Width: 800,
    Height: 600,
    Size: 12345,
    Format: 'png'
  },
  Msg: ''
}
```

每次调用后必须先判断 `Code`。接口引擎开启“响应文件”后，可以直接返回这个结果，在浏览器中预览或下载图片。

公共输出参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `OutputFormat` / `Format` | `png` | 支持 `png`、`jpeg` / `jpg`、`webp`、`bmp`；`OutputFormat` 优先 |
| `Quality` | `90` | 编码质量，运行时限制到 1 至 100 |
| `BackgroundColor` | 透明；JPEG 为白色 | 画布背景色 |
| `FileName` | `image.<扩展名>` | 输出文件名，扩展名会按真实格式修正 |

兼容公共别名：`ImageFormat` / `OutputType` → `OutputFormat`，`Background` / `BgColor` → `BackgroundColor`，单图方法的 `ImageBase64` → `FileByteBase64`。

### 方法列表

| 方法 | 说明 |
|------|------|
| `V8.Image.Create(param)` | 生成纯色、渐变、文字或基础图形图片 |
| `V8.Image.Merge(param)` | 横向、纵向、网格或覆盖合并图片 |
| `V8.Image.Overlay(param)` | 覆盖合并快捷方法，未设置模式时自动使用 `overlay` |
| `V8.Image.Resize(param)` | 调整宽高 |
| `V8.Image.Crop(param)` | 裁剪矩形区域 |
| `V8.Image.Rotate(param)` | 旋转图片 |
| `V8.Image.Flip(param)` | 水平或垂直翻转 |
| `V8.Image.Convert(param)` | 转换图片编码格式 |
| `V8.Image.Draw(param)` | 在已有图片上绘制文字和图形 |
| `V8.Image.Watermark(param)` | 添加图片水印 |
| `V8.Image.CreateQRCode(param)` | 生成二维码 |
| `V8.Image.GetInfo(param)` | 读取宽高、格式、帧数等信息 |

`Create` 的专用参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Width` / `Height` | `800` / `600` | 新画布宽高 |
| `CanvasWidth` / `CanvasHeight` | 未设置 | 设置后分别覆盖 `Width` / `Height` |
| `BackgroundColorEnd` | 未设置 | 设置后与 `BackgroundColor` 形成线性渐变 |
| `GradientDirection` | `left-to-right` | 支持横向、`top-to-bottom` / `vertical`、`diagonal` |
| `Text` / `TextColor` / `FontSize` / `FontFamily` | 未设置 / `#111827` / `32` / 默认字体 | 在画布中心追加快捷文字 |
| `Elements` | 未设置 | 文字、矩形、椭圆、圆形和线段列表 |

### 生成图片并覆盖合并

下面示例先生成大图和小图，再把小图覆盖到大图的指定坐标。覆盖模式按 `ZIndex` 从小到大绘制，数值更大的图层位于上方；相同 `ZIndex` 时数组中靠后的图层位于上方。

```javascript
var baseResult = V8.Image.Create({
  Width: 1200,
  Height: 700,
  BackgroundColor: '#2563eb',
  BackgroundColorEnd: '#0f172a',
  GradientDirection: 'left-to-right',
  Text: 'Microi',
  TextColor: '#ffffff',
  FontSize: 72,
  FileName: 'poster.png'
});
if (baseResult.Code !== 1) return baseResult;

var badgeResult = V8.Image.Create({
  Width: 240,
  Height: 120,
  BackgroundColor: '#f97316',
  Text: 'NEW',
  TextColor: '#ffffff',
  FontSize: 42
});
if (badgeResult.Code !== 1) return badgeResult;

var result = V8.Image.Overlay({
  CanvasWidth: 1200,
  CanvasHeight: 700,
  Images: [
    {
      FileByteBase64: baseResult.Data.FileByteBase64,
      Width: 1200,
      Height: 700,
      Fit: 'fill',
      ZIndex: 0
    },
    {
      FileByteBase64: badgeResult.Data.FileByteBase64,
      X: 900,
      Y: 80,
      Scale: 0.75,
      Opacity: 0.95,
      CornerRadius: 16,
      ZIndex: 10
    }
  ],
  OutputFormat: 'png',
  FileName: 'poster-with-badge.png'
});
return result;
```

也可以使用双图简写：

```javascript
return V8.Image.Overlay({
  BaseImage: baseResult.Data.FileByteBase64,
  OverlayImage: badgeResult.Data.FileByteBase64,
  X: 900,
  Y: 80,
  OverlayWidth: 180,
  OverlayHeight: 90,
  Opacity: 0.9
});
```

主图兼容 `BaseImage`、`BackgroundImage`、`FirstImage`、`Base`；覆盖图兼容 `OverlayImage`、`ForegroundImage`、`SecondImage`、`Overlay`。简写结构中的顶层 `X`、`Y`、`Position`、`Opacity`、`OverlayWidth`、`OverlayHeight`、`Scale` 会应用到覆盖图。

### 合并模式

```javascript
// 左右拼接
var horizontal = V8.Image.Merge({
  Mode: 'horizontal',
  Direction: 'ltr',
  Gap: 20,
  Padding: 20,
  Alignment: 'center',
  Images: [
    { FileByteBase64: firstBase64, Height: 320 },
    { FileByteBase64: secondBase64, Height: 320 }
  ]
});

// 上下拼接
var vertical = V8.Image.Merge({
  Mode: 'vertical',
  Direction: 'ttb',
  Gap: 16,
  Alignment: 'left',
  Images: [firstBase64, secondBase64]
});

// 网格拼接
var grid = V8.Image.Merge({
  Mode: 'grid',
  Columns: 3,
  Gap: 12,
  Padding: 12,
  Images: imageBase64List
});
```

| 参数 | 说明 |
|------|------|
| `Mode` | `horizontal`、`vertical`、`grid`、`overlay` |
| `Layout` | 优先于 `Mode`；支持 `row`、`column`、`canvas`、`cover`，以及 `left/right/top/bottom/up/down` 方向快捷值 |
| `Direction` | `ltr`、`rtl`、`ttb`、`btt`，也支持 `left-to-right` 等完整写法 |
| `Images` / `Layers` | 图片或图层数组；数组项可以直接是 Base64 / Data URI 字符串 |
| `CanvasWidth` / `CanvasHeight` | 固定画布尺寸；未设置时按布局自动计算 |
| `Padding` / `Gap` | 内边距 / 图片间距，负数按 0 处理 |
| `Alignment` | 横向时控制上下对齐，纵向时控制左右对齐，网格时控制单元格内对齐 |
| `Columns` | 网格列数 |

合并兼容别名：`MergeType` / `Type` → `Mode`，`Items` → `Images`。

### 图层参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Width` / `Height` | 原尺寸 | 只设置一个时按比例计算另一个 |
| `Scale` | `1` | 在宽高计算后再次按比例缩放，范围大于 0 且不超过 100 |
| `Fit` | `contain` | 同时设置宽高时支持 `contain`、`cover`、`fill` / `stretch`、`none` |
| `X` / `Y` | 未设置 | 覆盖模式绝对坐标；设置其中一个后，另一个默认使用 `Padding` |
| `Position` / `Anchor` | `top-left` | 未设置坐标时的锚点；`Position` 优先 |
| `OffsetX` / `OffsetY` | `0` | 坐标或锚点定位后的偏移 |
| `Opacity` | `1` | 透明度，限制到 0 至 1 |
| `Rotation` | `0` | 顺时针旋转角度 |
| `ZIndex` | `0` | 覆盖顺序，数值越大越靠上 |
| `FlipHorizontal` / `FlipVertical` | `false` | 翻转当前图层 |
| `CropX` / `CropY` / `CropWidth` / `CropHeight` | 原图范围 | 缩放前裁剪源图 |
| `CornerRadius` | `0` | 圆角半径 |
| `BorderColor` / `BorderWidth` | 未设置 / `0` | 图层边框 |
| `BlendMode` | `src-over` | 混合模式 |

`contain` 保持完整内容并等比缩放；`cover` 居中裁剪并填满目标宽高；`fill` / `stretch` 强制拉伸；`none` 使用原尺寸。`Scale` 在上述计算后继续生效。

常用锚点：`top-left`、`top`、`top-right`、`left`、`center`、`right`、`bottom-left`、`bottom`、`bottom-right`。混合模式支持 `src-over`、`multiply`、`screen`、`overlay`、`darken`、`lighten`、`plus` / `add`、`src`、`dst-over`。

图层兼容别名：`Order` → `ZIndex`、`Alpha` → `Opacity`、`Rotate` → `Rotation`、`Left` / `Top` → `X` / `Y`。

### 其它图片操作

```javascript
// 缩放：Width、Height 至少设置一个；Pad=true 时保留完整目标画布
var resized = V8.Image.Resize({
  Image: sourceBase64,
  Width: 800,
  Height: 600,
  Fit: 'cover',
  Pad: false,
  AllowUpscale: true,
  Alignment: 'center'
});

// 裁剪；Clamp=true 时把部分越界区域收缩到图片范围
var cropped = V8.Image.Crop({
  Image: sourceBase64,
  X: 100,
  Y: 80,
  Width: 640,
  Height: 360,
  Clamp: false
});

// 旋转；Expand=false 时保持原画布，边缘可能被裁掉
var rotated = V8.Image.Rotate({
  Image: sourceBase64,
  Degrees: 30,
  Expand: true
});

// 水平、垂直翻转；Horizontal 默认 true，Vertical 默认 false
var flipped = V8.Image.Flip({
  Image: sourceBase64,
  Horizontal: true,
  Vertical: false
});

// 格式转换
var converted = V8.Image.Convert({
  Image: sourceBase64,
  OutputFormat: 'webp',
  Quality: 85,
  FileName: 'converted.webp'
});

// 图片水印
var watermarked = V8.Image.Watermark({
  BaseImage: sourceBase64,
  Watermark: logoBase64,
  Width: 180,
  Height: 90,
  Scale: 1,
  Position: 'bottom-right',
  Margin: 24,
  OffsetX: 0,
  OffsetY: 0,
  Opacity: 0.7,
  Rotation: 0
});

// 二维码；Content 优先于 Text，Size 默认 300
var qr = V8.Image.CreateQRCode({
  Content: 'https://microi.net/',
  Size: 420,
  FileName: 'qrcode.png'
});

// 读取原始图片信息
var info = V8.Image.GetInfo({ Image: sourceBase64 });
// Data: Width、Height、Format、ContentType、Size、FrameCount、
// RepetitionCount、Origin、HasAlpha
```

`Watermark` 的 `BaseImage` 也可写为 `Image`，兼容 `Base` → `BaseImage`、`Overlay` → `Watermark`。

### 绘制文字和图形

`Create` 和 `Draw` 使用相同的 `Elements`。`Create` 在新画布上绘制；`Draw` 在输入图片上绘制，输出宽高与原图相同。

```javascript
var result = V8.Image.Draw({
  Image: sourceBase64,
  Elements: [
    {
      Type: 'text',
      X: 40,
      Y: 40,
      Text: 'CONFIDENTIAL',
      Color: 'rgba(239,68,68,0.75)',
      FontSize: 36,
      FontFamily: 'Arial',
      FontStyle: 'bold-italic',
      Align: 'left',
      VerticalAlign: 'top',
      Rotation: -8
    },
    {
      Type: 'round-rect',
      X: 40,
      Y: 90,
      Width: 320,
      Height: 100,
      FillColor: '#ffffff88',
      StrokeColor: '#ef4444',
      StrokeWidth: 3,
      CornerRadius: 16,
      Opacity: 0.9
    },
    {
      Type: 'line',
      X: 40,
      Y: 220,
      X2: 360,
      Y2: 220,
      StrokeColor: '#ef4444',
      StrokeWidth: 3
    }
  ]
});
```

| 元素类型 | 参数 |
|----------|------|
| `text` | `Text`、`Color`、`FontSize`、`FontFamily`、`FontStyle`、`Align`、`VerticalAlign` |
| `rectangle` / `rect` / `round-rect` | `X`、`Y`、`Width`、`Height`、填充、描边、圆角 |
| `ellipse` / `circle` | `X`、`Y`、`Width`、`Height`、填充、描边 |
| `line` | `X`、`Y`、`X2`、`Y2` 或 `Width`、`Height`、描边 |

所有元素还支持 `Opacity` 和 `Rotation`。单次最多绘制 500 个元素。

### 颜色、安全与资源限制

颜色支持常用英文颜色名、`transparent`、`#RGB`、`#RGBA`、`#RRGGBB`、`#RRGGBBAA`、`rgb(...)`、`rgba(...)`。颜色自身的 Alpha 会与 `Opacity` 相乘。

运行时内置限制：单次最多合并 50 张图；单边不超过 16,384 像素；单张输入或输出画布不超过 25,000,000 像素；单次解码和单次缩放后图层分别不超过 50,000,000 像素；单张输入不超过 25 MB；单次输入总量不超过 100 MB；输出不超过 50 MB。

这些限制是保护上限，不是业务推荐值。匿名接口应增加更严格的数量、尺寸、并发和权限限制。远程图片必须先通过 `V8.Http` 下载，并对用户可控 URL 做协议、域名和目标地址白名单校验，不能把 URL 或服务器路径直接传给 `V8.Image`。

`FontFamily` 是首选字体。运行时会逐个 Unicode 字符验证字形：未传字体、指定字体不存在或某个字体缺少部分字符时，先回退到服务器已安装且包含该字形的字体，再回退到随 `Dos.Common` 程序集发布的 Noto Sans CJK SC；同一段中英文混排文字可使用多个字体段。因此没有安装任何系统字体的 Linux / 群晖 / 精简容器也能绘制基础拉丁字符、数字和简体中文。如果系统字体与内置字体都不包含某字符，接口会返回带字符及 `U+XXXX` 码位的明确错误，绝不会生成“口口”缺字方框。内置字体解决可用性，不替代品牌字体、繁体异体字、特殊符号或 Emoji 字体；要求固定字形时仍应在服务器安装业务字体并显式传 `FontFamily`。

## 当前用户 V8.CurrentUser
>* 当前登陆用户信息，包含用户所属角色、组织机构等，包含使用表单引擎对sys_user表新增字段的信息。
>* 未登录时访问到的值为{}
```js
var userName = V8.CurrentUser.Name;
```

## 数据库对象 V8.Db
>* 数据库访问对象，支持Dos.ORM、SqlSugar切换
>* `FromSql` 只传 SQL 字符串；动态值请使用 `.AddInParameter("@p0", value)` 链式绑定，不要写 `FromSql(sql, value)`。
```js
// 查询多条
var list = V8.Db.FromSql("select Id, Account, Name from sys_user where Status = @p0")
    .AddInParameter("@p0", 1)
    .ToArray();

// 执行 insert/update/delete，返回受影响行数
var affected = V8.Db.FromSql("update sys_user set Status = @p0 where Id = @p1")
    .AddInParameter("@p0", 0)
    .AddInParameter("@p1", userId)
    .ExecuteNonQuery();

// 查询单条
var user = V8.Db.FromSql("select Id, Account, Name from sys_user where Id = @p0")
    .AddInParameter("@p0", userId)
    .First();

// 查询单个标量
var count = V8.Db.FromSql("select count(1) from sys_user where Status = @p0")
    .AddInParameter("@p0", 1)
    .ToScalar();
```

## 数据库只读对象 V8.DbRead
>* 数据库只读对象，用法和V8.Db一样，当数据库未部署读写分离时，此对象与V8.Db对象值一致。

## 扩展数据库对象 V8.Dbs.DbKey
>* 访问多数据库（扩展库）的对象，扩展库管理见：[https://web.microi.net/#/database](https://web.microi.net/#/database)
>* 注意：老的数据库版本上面的表缺少【DbKey】字段，需要更新数据库、或手动添加、或等待应用商城上线【数据库管理】应用安装。
>* 示例：访问oracle扩展库，DbKey的值为OracleDB1，其中V8.Dbs.OracleDB1对象就等同于V8.Db对象。
```js
var dataList = V8.Dbs.OracleDB1.FromSql('').ToArray();

//扩展数据库的事务用法
//【注意】emptyExTrans 是扮展库自己创建的事务，与 V8.DbTrans 完全独立，需要手动管理生命周期
var recordId = V8.Param.Id;
var emptyExTrans = V8.Dbs.EmptyEx.BeginTransaction();
try {
    var count = emptyExTrans
        .FromSql("delete from diy_extend_test where Id = @p0")
        .AddInParameter("@p0", recordId)
        .ExecuteNonQuery();
    emptyExTrans.Commit();
    return { Code : 1, Data : count };
} catch (error) {
    emptyExTrans.Rollback();
    throw error;
} finally {
    emptyExTrans.Close();
}
```
>* 已知问题：在平台中添加扩展库后，需要重启api的docker容器才会生效

## 数据库事务 V8.DbTrans
>* 数据库事务对象，可以像V8.Db一样使用，如：
```js
var array = V8.DbTrans.FromSql('...').ToArray();
```
无需在接口引擎中手动调用 `V8.DbTrans.Commit()` 或 `Rollback()`。事务生命周期由平台安全代理统一管理：

- 返回 `DosResult` 或带 `Code` 的对象时，只有 `Code === 1` 提交。
- 返回对象但没有 `Code` 时回滚。
- 返回字符串、数字、数组、布尔值或 `null`，且脚本未异常时提交。
- 复用外层传入的事务时，最终结果由外层调用决定。
- 脚本显式调用平台事务的 `Commit/ Rollback/Close` 会被忽略。

* 接口引擎示例
```javascript
//操作第一张表，带事务
var result1 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}, V8.DbTrans);
//操作第二张表，带事务
var result2 = V8.FormEngine.UptFormData('表名或表Id，不区分大小写', {
    Id : '',//必传
    Age : 20, //要修改的字段，注意字段值不能是{}或[]，需要序列化
    Sex : '女'
}, V8.DbTrans);
//如果第二张表操作成功
if(result2.Code == 1){
  return { Code : 1 };//平台会自动提交事务，因为返回的Code=1
}else{//如果第二张表操作失败
  return { Code : 0, Msg : result2.Msg };//平台会自动回滚事务，因为返回的Code=0
}
```

## V8.MongoDb
### 介绍
>* 本篇介绍如何在接口引擎、后端V8事件中对MongoDB进行相关操作
>* 对MongoDB的新增操作会自动生成对应数据库名和表名，因此可自定义分库、分表规则

### 新增数据 AddFormData
>*自定义数据库名、表名，不存在时会自动创建
```javascript
//可以指定固定的Id值
var newId = V8.MongoDb.NewId();
V8.MongoDb.AddFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : newId, //也可以不指定，会自动生成
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### 修改数据 DelFormData
```javascript
V8.MongoDb.UptFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
	_FormData : {
		Name : '张三',
		Sex : '男',
		Age : 18
	}
});
```
### 删除数据 DelFormData
```javascript
V8.MongoDb.DelFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

### 查询数据列表 GetTableData
```javascript
V8.MongoDb.GetTableData({
	DbName : '', //数据库名称，如：sys_log_itdos
	TableName: '', //表名名称，如：log_202412
  _Where : [
    ['Type', '=', '访问菜单'], 
    ['OR', 'Type', '=', '点击V8按钮']
  ]
});
```

### 查询单条数据 GetFormData
```javascript
V8.MongoDb.GetFormData({
	DbName : '', //数据库名称，如：sys_log_2024
	TableName: '', //表名名称，如：log_2024_12
	Id : '', //数据Id
});
```

## V8.Http
>* 对 RestSharp 的受控封装，支持 GET、POST、PATCH。前后端 V8 使用相同的 PascalCase 对象参数；后端同步方法直接返回，显式 `*Async` 方法在 Jint 中使用 `await`，前端浏览器端也需使用 `await`。

| 方法 | 主要参数 | 返回值 |
|---|---|---|
| `V8.Http.Get` | `GetParam` | 响应字符串 |
| `V8.Http.Post` | `PostParam` / `PostParamString` | 响应字符串 |
| `V8.Http.Patch` | `PatchParam` / `PatchParamString` | 响应字符串 |
| `GetResponse/PostResponse/PatchResponse` | 同上 | 完整响应对象 |
| `GetAsync/PostAsync/PatchAsync` | 同步版对应参数 | `await` 后得到响应字符串 |
| `GetResponseAsync/PostResponseAsync/PatchResponseAsync` | 同步版对应参数 | `await` 后得到完整响应对象 |

完整响应对象包含 `Content`、`Headers`、`RawBytes`、`StatusCode`、`ErrorMessage`。`Timeout` 与兼容参数名 `TimeOut` 的单位均为秒，默认 `600` 秒（10 分钟）；`Headers` 与 `Header` 等效；`ParamType` 支持 `form`（默认）、`json`、`xml`、`binary`。`GetParam` 是 URL 查询参数，GET、POST、PATCH 均可使用。字符串版遇到部分网络错误时可能直接返回错误文本，因此支付、同步、回调等关键集成应使用 `*Response` 并检查 `StatusCode` 与 `ErrorMessage`，不要假定字符串一定是 JSON。

```javascript
// POST JSON。嵌套对象使用 PostParamString，避免对象转换丢失层级。
var loginText = V8.Http.Post({
  Url: 'https://api.example.com/login',
  PostParamString: JSON.stringify({
    User: { Account: 'admin', Pwd: '******' },
    OsClient: 'demo'
  }),
  ParamType: 'json',
  Timeout: 10,
  Headers: { 'X-Trace-Id': V8.Method.NewGuid() }
});
var loginResult = JSON.parse(loginText);

// GET 查询参数
var listText = V8.Http.Get({
  Url: 'https://api.example.com/users',
  GetParam: { page: 1, size: 20 },
  Headers: { Authorization: 'Bearer ' + loginResult.token }
});

// PATCH JSON。嵌套对象使用 PatchParamString。
var patchText = V8.Http.Patch({
  Url: 'https://api.example.com/users/123',
  PatchParamString: JSON.stringify({ profile: { name: '新名字' } }),
  ParamType: 'json',
  Headers: { Authorization: 'Bearer ' + loginResult.token }
});

// PATCH 完整响应
var patchResp = V8.Http.PatchResponse({
  Url: 'https://api.example.com/users/123',
  PatchParam: { Status: 1 },
  ParamType: 'json'
});
if (patchResp.StatusCode < 200 || patchResp.StatusCode >= 300) {
  return { Code: 0, Msg: patchResp.ErrorMessage || patchResp.Content };
}

// 请求内异步。不要用 setTimeout/Task.Run 把它变成请求外后台任务。
var asyncResp = await V8.Http.GetResponseAsync({
  Url: 'https://api.example.com/health',
  Timeout: 5
});

// XML 请求
var xmlText = V8.Http.Post({
  Url: 'https://api.example.com/xml',
  ParamType: 'xml',
  PostParamString: '<xml><text>1</text></xml>'
});

// 上传文件：键同时作为表单字段名和文件名
var uploadText = V8.Http.Post({
  Url: 'https://api.example.com/upload',
  PostParam: { title: '附件' },
  FilesByteBase64: { 'report.pdf': pdfBase64 }
});
```

接口引擎中必须使用对象参数格式，例如 `V8.Http.Get({ Url: url })`。不要使用 `V8.Http.Get(url)`；旧的 .NET 同名异步重载可能被 Jint 解析为 Promise。

后端 `V8.Http` 的严格 SSRF 防护默认关闭，未配置时完全保留历史行为：不限制协议、URL 内嵌凭据、`localhost`、私网、链路本地或云元数据地址，并继续自动处理重定向。只有显式设置 `SsrfProtection:Enabled=true` 或环境变量 `MICROI_SSRF_PROTECTION_ENABLED=true` 后，才只允许 HTTP(S)，拒绝 URL 内嵌凭据、回环、私网、链路本地、云元数据和其它特殊地址，同时禁止自动跟随 3xx；受控目标可通过 `SsrfProtection:AllowedHosts` / `MICROI_SSRF_ALLOWED_HOSTS` 精确放行。白名单匹配主机，不匹配 URL 子串；严格模式下需要跳转时，先用 `GetResponse/PostResponse/PatchResponse` 检查状态码和 `Location`，再显式发起下一次请求。兼容旧配置的优先级和租户配置方法见 [平台安全总览](../more/security.md)。

## V8.Header、V8.Param
>* 目前两者均只支持在接口引擎中使用，用于获取客户端http post请求接口引擎地址发送的报文和Request Payload参数。

## 加密类 V8.EncryptHelper
>* Dos.Common加密帮助类
```javascript
var pwd = V8.EncryptHelper.DESEncode('123456');//DES加密
var pwd = V8.EncryptHelper.DESDecode('JdZe5gWKjZo=');//DES解密
var pwd = V8.EncryptHelper.SHA1('123456');
var pwd = V8.EncryptHelper.SHA256('123456');
var pwd = V8.EncryptHelper.SHA512('123456');
var digest = V8.EncryptHelper.MD5Encrypt('123456');//兼容用不可逆摘要，不是加密
var pwd = V8.EncryptHelper.Sha256Hex('123456');
```

MD5、SHA1、SHA256 等摘要不能用于新密码存储；密码必须使用平台认证流程和带盐的专用密码哈希。DES/AES 的安全性取决于密钥管理，不要把密钥写进 V8 代码、日志或接口响应。

## V8.Office

`V8.Office` 可在接口引擎中生成 Excel、Word、PowerPoint 文件。导出方法返回 `DosResult<byte[]>`，接口引擎需要开启【响应文件】，并把 `Data` 转成 Base64 返回。

| 方法 | 说明 |
|---|---|
| `ExportExcel({...})` | 导出 `.xlsx`，支持单/多 Sheet、标准表格、高级自由布局、图片、公式、合并、边框、打印和行分组 |
| `ExcelToList({...})` | 解析 Excel；`SheetIndex` 从 `0` 开始 |
| `ExportWordText({...})` | 旧版纯文本 Word 导出，继续兼容 |
| `ExportWord({...})` | 导出 `.docx`，支持段落、章节、表格、图片、页眉页脚、页码 |
| `ExportPowerPoint({...})` | 导出 `.pptx`，支持多页、文本、项目符号、表格、图片、主题、页码 |
| `SendEmail({...})` | 发送 HTML 邮件 |

### 导出 Excel

`ExportExcel` 提供两种可在同一工作簿混用的模式：

- **标准表格模式**：继续使用 `ExcelData + ExcelHeader`，适合数据列表、图片列和常规报表，完全兼容旧代码。
- **高级布局模式**：使用 `ExcelLayout` 按 A1 区域写入任意单元格、公式、样式和合并区域，适合审批单、套打表、主子表、多级表头、统计卡片及截图同款复杂版式。

需要控制工作表名称、列宽、行高、冻结窗格、筛选、打印和公共样式时传 `ExcelOptions`；标准表格中某一列的宽度、隐藏、数字格式或样式仍在 `ExcelHeader` 对应项中配置。

完整单 Sheet 示例：

```js
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelData: dataList,
  ExcelHeader: [
    {
      Name: 'Name', Label: '姓名', Component: 'Text',
      Width: 18, MinWidth: 12, MaxWidth: 30,
      HeaderStyle: { BackgroundColor: '17365D', FontColor: 'FFFFFF' },
      Style: { WrapText: true, VerticalAlignment: 'Center' }
    },
    {
      Name: 'Amount', Label: '金额', Component: 'NumberText', Type: 'decimal',
      Width: 16,
      NumberFormat: '#,##0.00',
      Style: { HorizontalAlignment: 'Right' }
    },
    {
      Name: 'Remark', Label: '备注', Component: 'Textarea',
      AutoSize: true, MinWidth: 20, MaxWidth: 50,
      Style: { WrapText: true }
    }
  ],
  ExcelOptions: {
    SheetName: '销售明细',
    DefaultColumnWidth: 14, // 未设置 Width 的列，单位为 Excel 字符宽度
    HeaderRowHeight: 30,   // 单位：磅（pt）
    DataRowHeight: 24,     // 单位：磅（pt）
    FreezeHeader: true,
    FreezeColumns: 1,
    AutoFilter: true,
    ShowGridLines: false,
    HeaderStyle: {
      FontName: 'Microsoft YaHei', FontSize: 11, Bold: true,
      HorizontalAlignment: 'Center', VerticalAlignment: 'Center',
      BorderStyle: 'Thin', BorderColor: 'B7C9D6'
    },
    CellStyle: {
      FontName: 'Microsoft YaHei', FontSize: 10,
      VerticalAlignment: 'Center'
    }
  }
});
if (excelResult.Code !== 1) return excelResult;

return {
  Code: 1,
  Data: {
    FileName: '业务数据.xlsx',
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};
```

#### `ExcelOptions` 工作表配置

| 参数 | 类型 | 说明 |
|---|---|---|
| `SheetName` | string | 单 Sheet 名称；多 Sheet 通常直接使用每项的 `SheetName` |
| `DefaultColumnWidth` | number | 默认列宽，单位为 Excel 字符宽度；有效范围 `0.1~255` |
| `DefaultRowHeight` | number | 默认行高，单位为磅（pt）；最大 `409.5` |
| `HeaderRowHeight` | number | 表头行高，单位为磅（pt）；最大 `409.5` |
| `DataRowHeight` | number | 数据行高，单位为磅（pt）；最大 `409.5` |
| `FreezeHeader` | boolean | 是否冻结首行 |
| `FreezeRows` | number | 冻结顶部行数；传入后优先于 `FreezeHeader` |
| `FreezeColumns` | number | 冻结左侧列数，例如 `1` 表示冻结首列 |
| `AutoFilter` | boolean | 是否为表头及数据区域启用自动筛选 |
| `AutoFilterRange` | string | 自定义筛选区域，如 `A3:K20`；传入后自动启用筛选 |
| `AutoSizeColumns` | boolean | 是否自动计算所有列宽；大数据量导出建议使用固定 `Width`，性能更稳定 |
| `ShowGridLines` | boolean | 是否显示工作表网格线 |
| `Zoom` | number | 工作表缩放比例，范围 `10~400` |
| `PrintOrientation` | string | 打印方向：`Portrait` / `Landscape` |
| `PaperSize` | string | 纸张：`A3` / `A4` / `A5` / `Letter` / `Legal`，也可传 NPOI 数字代码 |
| `FitToWidth` / `FitToHeight` | number | 打印时缩放为指定页宽/页高；常用 `1` / `0` |
| `PrintArea` | string | 打印区域，如 `A1:K15` |
| `MarginTop/Right/Bottom/Left` | number | 打印页边距，单位为英寸 |
| `CenterHorizontally/Vertically` | boolean | 打印时水平/垂直居中 |
| `HeaderText` / `FooterText` | string | 页眉/页脚文字 |
| `ShowPageNumber` | boolean | 在页脚右侧显示“第 X 页 / 共 Y 页” |
| `HeaderStyle` | object | 全局表头样式，列级 `HeaderStyle` 可覆盖 |
| `CellStyle` | object | 全局数据单元格样式，列级 `Style` 可覆盖 |

#### `ExcelHeader` 列配置

| 参数 | 类型 | 说明 |
|---|---|---|
| `Name` | string | 数据字段名，对应 `ExcelData` 每项的属性 |
| `Label` | string | Excel 表头文字 |
| `Component` / `Config` | string / object | 吾码字段组件与配置；图片、下拉、多选等按原组件规则导出 |
| `Type` | string | `int` / `decimal` 等数值类型会生成 Excel 数值单元格 |
| `Width` / `ColumnWidth` | number | 固定列宽，单位为 Excel 字符宽度；`Width` 为推荐写法 |
| `AutoSize` | boolean | 单列自动宽度；开启后可配合 `MinWidth` / `MaxWidth` 限制范围 |
| `MinWidth` / `MaxWidth` | number | 自动或固定列宽的下限/上限 |
| `Hidden` | boolean | 是否隐藏该列，数据仍保留在文件中 |
| `HeaderHeight` | number | 表头行高候选值；同一 Sheet 取所有列与 `HeaderRowHeight` 的最大值 |
| `RowHeight` | number | 数据行高候选值；同一 Sheet 取所有列与 `DataRowHeight` 的最大值 |
| `NumberFormat` | string | 数字/日期显示格式简写，如 `#,##0.00`、`0.00%`、`yyyy-mm-dd` |
| `HeaderStyle` | object | 当前列表头样式 |
| `Style` | object | 当前列数据单元格样式 |

`HeaderStyle` / `Style` 支持以下属性：

| 参数 | 说明 |
|---|---|
| `FontName`、`FontSize`、`FontColor` | 字体、字号、字体颜色 |
| `Bold`、`Italic`、`Underline` | 加粗、斜体、下划线 |
| `BackgroundColor` | 背景色 |
| `HorizontalAlignment` | `Left` / `Center` / `Right` / `Justify` 等 |
| `VerticalAlignment` | `Top` / `Center` / `Bottom` 等 |
| `WrapText`、`ShrinkToFit`、`Rotation` | 自动换行、缩小字体填充、文字旋转角度（`-90~90`） |
| `NumberFormat` | 数字/日期格式；也可直接写在 `ExcelHeader` 项上 |
| `BorderStyle`、`BorderColor` | 统一设置四边边框样式与颜色，例如 `Thin`、`B7C9D6` |
| `BorderTop/Right/Bottom/LeftStyle` | 分别设置上/右/下/左边框类型，可用 `Thin`、`Medium`、`Dashed`、`Dotted`、`Double`、`DashDot` 等 |
| `BorderTop/Right/Bottom/LeftColor` | 分别设置四条边框颜色；未传时继承 `BorderColor` |

颜色支持 `RRGGBB` 或 `#RRGGBB`。列级样式会继承全局样式并覆盖同名属性。若同时启用 `AutoSize` 与固定 `Width`，以自动计算结果为准，再由 `MinWidth` / `MaxWidth` 限制。要让 `NumberFormat` 按数值或日期参与 Excel 计算，源数据应为数值/日期，并给数值列传 `Type:'int'` 或 `Type:'decimal'`；显示格式不会把普通文本强制转换为数值。没有传任何新配置时，旧导出宽度、行高和样式行为保持不变。

#### `ExcelLayout` 高级自由布局

高级布局不要求每行具有相同字段。每个 `Cells` 项通过 `Range` 指定 A1 单元格或区域；样式作用于整个区域，`Value` / `Formula` 写入区域左上角，`Merge:true` 同时合并该区域。多个样式区域可以重叠，后写入的非空样式属性覆盖先前同名属性，因此可先给 `A3:K15` 统一画细网格，再给首尾行和左右列覆盖中粗外框。

```js
var cells = [
  // 整张申请表的细网格
  { Range: 'A1:H10', Style: {
    FontName: 'Microsoft YaHei', FontSize: 10,
    BorderStyle: 'Thin', BorderColor: '7F8C9A',
    VerticalAlignment: 'Center', WrapText: true
  }},
  // 合并标题
  { Range: 'A1:H1', Value: '盘盈亏及报废申请表', Merge: true, Style: {
    FontSize: 18, Bold: true, BackgroundColor: 'EEF2F7',
    HorizontalAlignment: 'Center',
    BorderTopStyle: 'Medium', BorderTopColor: '34495E'
  }},
  // 表头与一行数据
  { Range: 'A2', Value: '序号', Style: { Bold: true, HorizontalAlignment: 'Center' }},
  { Range: 'B2', Value: '物料编码', Style: { Bold: true, HorizontalAlignment: 'Center' }},
  { Range: 'G2', Value: '数量', Style: { Bold: true, HorizontalAlignment: 'Center' }},
  { Range: 'H2', Value: '金额', Style: { Bold: true, HorizontalAlignment: 'Center' }},
  { Range: 'A3', Value: 1 },
  { Range: 'B3', Value: 'V3-MAT-1200' },
  { Range: 'G3', Value: 2, DataType: 'Number' },
  { Range: 'H3', Formula: 'G3*1200', Style: { NumberFormat: '#,##0.00' }},
  // 合计与审批意见
  { Range: 'A8:G8', Value: '合计', Merge: true, Style: { Bold: true, HorizontalAlignment: 'Right' }},
  { Range: 'H8', Formula: 'SUM(H3:H7)', Style: { Bold: true, NumberFormat: '#,##0.00' }},
  { Range: 'A9:D9', Value: '(1) 申请人：张三（已电子签）', Merge: true },
  { Range: 'E9:H9', Value: '(2) 主管意见：同意（已电子签）', Merge: true },
  { Range: 'A10:H10', Value: '备注：审批完成后原件交财务归档。', Merge: true }
];

var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelSheets: [{
    SheetName: '审批单',
    ExcelLayout: {
      Cells: cells,
      // 也可集中传 MergedRanges: ['A1:H1', 'A8:G8']
      Columns: [
        { Column: 'A', Width: 9 },
        { Column: 'B', Width: 22 },
        { Column: 'H', Width: 16 }
      ],
      Rows: [{ Row: 1, Height: 42 }, { Row: 2, Height: 32 }],
      // Excel 原生分组，适合主表/子表明细展开折叠
      RowGroups: [{ StartRow: 3, EndRow: 7, Collapsed: false }]
    },
    ExcelOptions: {
      ShowGridLines: false,
      FreezeRows: 2,
      FreezeColumns: 1,
      AutoFilterRange: 'A2:H8',
      PrintOrientation: 'Landscape',
      PaperSize: 'A4',
      FitToWidth: 1,
      PrintArea: 'A1:H10',
      ShowPageNumber: true
    }
  }]
});
```

`ExcelLayout` 参数：

| 参数 | 说明 |
|---|---|
| `Cells` | 单元格/区域列表；每项支持 `Range`、`Value`、`Formula`、`DataType`、`Merge`、`Style` |
| `MergedRanges` | 额外合并区域列表，如 `['A1:K1','A10:F10']`；重叠且不完全相同的合并区域会明确报错 |
| `Columns` | 列配置；用 `Column:'A'` 或从 1 开始的 `Index` 定位，支持 `Width/Hidden/AutoSize/MinWidth/MaxWidth` |
| `Rows` | 行配置；`Row` 从 1 开始，支持 `Height/Hidden` |
| `RowGroups` | Excel 原生行分组；`StartRow/EndRow` 从 1 开始，`Collapsed` 控制初始折叠状态 |

`DataType` 可用 `String`、`Number`、`Boolean`、`DateTime`、`Blank`；不传时按值自动识别。公式可带或不带开头的 `=`，生成后会要求 Excel 重新计算。xlsx 限制为最大 1,048,576 行、16,384 列；布局区域越大，创建的单元格和样式越多，应只覆盖实际使用范围。

官方完整示例接口引擎为 `export-excel-advanced-demo`，一次返回 5 张 Sheet：截图同款盘盈亏报废申请、可折叠主子表、复杂多级合并表头、标准数据表、边框与卡片样式库。接口必须开启【响应文件】；示例地址：`/apiengine/export-excel-advanced-demo--OsClient--iTdos--`。

如需把接口地址直接发送给客户在线查看，使用配套匿名接口 `export-excel-advanced-demo-preview`。该接口也必须开启【响应文件】，直接访问会下载 `.xlsx`；`/online-office` 通过 `fileUrl` 接收它的完整地址，平台后端限域读取文件后透明缓存到当前租户公有 HDFS，再把可回源静态地址交给 OnlyOffice。接口引擎仍只响应文件，不需要返回 `FileUrl/OnlineOfficePath` JSON；响应文件动态路由同时支持 `GET/HEAD`。

```text
/apiengine/export-excel-advanced-demo-preview--OsClient--iTdos--
```

本地预览链接示例（`fileUrl` 已 URL 编码）：

```text
http://localhost:1988/?OsClient=iTdos#/online-office?fileUrl=https%3A%2F%2Flocalhost%3A7266%2Fapiengine%2Fexport-excel-advanced-demo-preview--OsClient--iTdos--&fileName=%E5%90%BE%E7%A0%81V8%E9%AB%98%E7%BA%A7Excel%E5%A4%9ASheet%E7%A4%BA%E4%BE%8B.xlsx&fileType=xlsx&canEdit=0
```

匿名 `fileUrl` 只允许当前平台 `ApiBase` 下的 `/apiengine/...`，且必须显式包含当前 `OsClient`，禁止把任意外部 URL 交给 OnlyOffice。开发环境中的 `localhost/127.0.0.1` 仅允许由同端口本地后端读取；文件通过 SHA-256 确定性路径写入当前租户 `office-preview` 公有目录并共享缓存 10 分钟，限制 50MB、不跟随重定向、校验扩展名和文件头。未登录时即使传 `canEdit=1` 也强制只读，并隐藏系统菜单、顶部导航和页签；敏感数据不得开放匿名接口。

#### 多 Sheet

外层 `ExcelOptions` 是全部 Sheet 的默认配置；每个 Sheet 可传自己的 `ExcelOptions` 覆盖局部属性。这样可以统一字体和默认宽度，同时单独控制每个页签的冻结、筛选和行高。

```js
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelOptions: {
    DefaultColumnWidth: 14,
    HeaderRowHeight: 28,
    HeaderStyle: { Bold: true, BackgroundColor: 'D9EAF7' }
  },
  ExcelSheets: [
    {
      SheetName: '订单',
      ExcelData: orderList,
      ExcelHeader: [
        { Name: 'OrderNo', Label: '订单号', Component: 'Text', Width: 22 },
        { Name: 'Amount', Label: '金额', Component: 'NumberText', Type: 'decimal', Width: 16, NumberFormat: '#,##0.00' }
      ],
      ExcelOptions: { FreezeHeader: true, AutoFilter: true }
    },
    {
      SheetName: '客户',
      ExcelData: customerList,
      ExcelHeader: [
        { Name: 'Name', Label: '客户名称', Component: 'Text', Width: 24 },
        { Name: 'Phone', Label: '联系电话', Component: 'Text', Width: 18 }
      ],
      ExcelOptions: { DataRowHeight: 22 }
    }
  ]
});
if (excelResult.Code !== 1) return excelResult;
return {
  Code: 1,
  Data: {
    FileName: '订单与客户.xlsx',
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};
```

`ExcelSheets` 每项可使用 `ExcelLayout` 高级布局，也可使用 `ExcelData + ExcelHeader` 标准表格；标准表格还可传 `FormEngineKey/TableId/_Where/_OrderBy/_PageSize` 等查询参数。同一个工作簿可以混用两种模式。`Sheets` 是兼容别名，新代码使用 `ExcelSheets`。Sheet 名称中的非法字符、31 字符上限和重名会自动处理。

图片列说明：`ImgUpload.Multiple=1` 仍会按最大图片数展开为多列并合并表头；`Width` 会应用到展开后的每一列，`DataRowHeight` / `RowHeight` 控制图片所在行高度。私有文件仍按原规则输出受限值，不会绕过文件权限。自动列宽需要遍历单元格，大批量导出优先显式设置 `Width`，避免不必要的内存和 CPU 开销。

### 导出 Word

新代码使用对象参数的 `ExportWord`；`ExportWordText` 仅作为旧版纯文本接口继续保留。页面边距、图片宽高单位为厘米，字体大小单位为磅。

```js
var wordResult = V8.Office.ExportWord({
  Title: '月度经营报告',
  Subtitle: DateNow('yyyy年MM月'),
  Author: V8.CurrentUser.Name,
  Subject: '经营分析',
  Keywords: '经营,月报',
  Description: '月度经营分析报告',
  PageSize: 'A4',                 // A4 | Letter
  Orientation: 'Portrait',       // Portrait | Landscape
  MarginTop: 2.2,
  MarginRight: 2.0,
  MarginBottom: 2.2,
  MarginLeft: 2.0,
  FontFamily: 'Microsoft YaHei',
  FontSize: 10.5,
  TitleFontSize: 20,
  SubtitleFontSize: 12,
  TitleAlignment: 'Center',
  LineSpacing: 1.25,
  ParagraphSpacingAfter: 6,
  HeaderText: '吾码经营中心',
  FooterText: '内部资料',
  ShowPageNumber: true,
  Paragraphs: [
    { Text: '本月经营情况总体稳定。', FirstLineIndent: 0.74 },
    { Text: '以下数据未经授权不得外传。', Bold: true, FontColor: 'C00000' }
  ],
  Sections: [{
    Heading: '一、核心指标',
    HeadingLevel: 1,
    Content: '本节展示主要经营指标。',
    Tables: [{
      Title: '指标明细',
      Headers: ['指标', '本月', '同比'],
      Rows: [['销售额', 1280000, '12.5%'], ['订单数', 860, '8.1%']],
      ColumnWidths: [4, 4, 4],
      HeaderBackgroundColor: 'D9EAF7',
      BorderColor: 'B7C9D6'
    }]
  }],
  Images: [{
    FileByteBase64: chartBase64,  // 纯 Base64 或 data URI
    FileName: 'chart.png',
    ContentType: 'image/png',
    Width: 15,
    Height: 8,
    Alignment: 'Center',
    Caption: '图 1：趋势分析'
  }]
});
if (wordResult.Code !== 1) return wordResult;
return {
  Code: 1,
  Data: {
    FileName: '月度经营报告.docx',
    ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    FileByteBase64: System.Convert.ToBase64String(wordResult.Data)
  }
};
```

常用子参数：

| 对象 | 支持参数 |
|---|---|
| `Paragraphs[]` | `Text/Alignment/Bold/Italic/Underline/FontFamily/FontSize/FontColor/SpacingBefore/SpacingAfter/LineSpacing/FirstLineIndent/PageBreakBefore` |
| `Sections[]` | `Heading/HeadingLevel/Content/Paragraphs/Tables/Images/PageBreakBefore` |
| `Tables[]` | `Title/Headers/Rows/ColumnWidths/Alignment/HeaderBold/HeaderBackgroundColor/HeaderFontColor/BorderColor/FontSize` |
| `Images[]` | `FileByteBase64/FileName/ContentType/Width/Height/Alignment/Caption` |

### 导出 PowerPoint

幻灯片尺寸、图片/表格位置和宽高单位均为英寸；默认画布为 16:9（`13.333 × 7.5`）。

```js
var pptResult = V8.Office.ExportPowerPoint({
  Title: '季度经营汇报',
  Author: V8.CurrentUser.Name,
  Subject: '季度复盘',
  Keywords: '经营,季度',
  SlideWidth: 13.333,
  SlideHeight: 7.5,
  FontFamily: 'Microsoft YaHei',
  BackgroundColor: 'FFFFFF',
  TitleColor: '17365D',
  TextColor: '222222',
  TitleFontSize: 28,
  BodyFontSize: 18,
  ShowSlideNumber: true,
  Slides: [
    {
      Layout: 'TitleSlide',
      Title: '季度经营汇报',
      Subtitle: DateNow('yyyy-MM-dd')
    },
    {
      Layout: 'TitleAndContent',
      Title: '核心结论',
      Bullets: ['收入保持增长', '重点客户续约稳定'],
      TextItems: [
        { Text: '风险：回款周期延长', Bullet: true, Level: 0, Bold: true, FontColor: 'C00000' }
      ],
      Tables: [{
        Headers: ['指标', '本期', '目标'],
        Rows: [['销售额', '128万', '120万']],
        X: 0.7, Y: 4.0, Width: 11.9, Height: 2.2,
        HeaderBackgroundColor: '17365D'
      }]
    },
    {
      Title: '趋势图',
      Images: [{
        FileByteBase64: chartBase64,
        FileName: 'trend.png',
        ContentType: 'image/png',
        X: 1.2, Y: 1.5, Width: 10.9, Height: 5.2
      }]
    }
  ]
});
if (pptResult.Code !== 1) return pptResult;
return {
  Code: 1,
  Data: {
    FileName: '季度经营汇报.pptx',
    ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    FileByteBase64: System.Convert.ToBase64String(pptResult.Data)
  }
};
```

| 对象 | 支持参数 |
|---|---|
| 顶层 | `Title/Author/Subject/Keywords/Company/SlideWidth/SlideHeight/FontFamily/BackgroundColor/TitleColor/TextColor/TitleFontSize/BodyFontSize/ShowSlideNumber/Slides` |
| `Slides[]` | `Layout/Title/Subtitle/Content/Bullets/TextItems/Images/Tables/BackgroundColor/TitleColor/TextColor/TitleFontSize/BodyFontSize` |
| `TextItems[]` | `Text/Level/Bullet/Bold/Italic/FontSize/FontColor/Alignment` |
| `Images[]` | `FileByteBase64/FileName/ContentType/X/Y/Width/Height` |
| `Tables[]` | `Headers/Rows/ColumnWidths/X/Y/Width/Height/HeaderBackgroundColor/HeaderFontColor/CellBackgroundColor/CellFontColor/FontSize` |

### 解析 Excel

```js
var rows = V8.Office.ExcelToList({
  FileByteBase64: excelBase64,
  SheetIndex: 0
});
```

### 发送邮件 SendEmail
>* 源码实现在[/Microi.Server/Microi.Office/MicroiOffice.cs](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.Office/MicroiOffice.cs)
```js
return V8.Office.SendEmail({
  SmtpServer : 'smtp.qq.com',
  SmtpPort : 587,
  EnableSSL : true,
  SystemEmail : 'admin@itdos.com',
  SystemEmailPwd : 'uuzrnazvv*******',
  EmailSubject : '测试接口引擎发邮件标题',
  EmailBody : '<b>测试接口引擎发邮件内容，<span style="color:red;">支持html</span></b>',
  Receivers : ['123446172@qq.com', '973702@qq.com']
});
```

## 系统设置 V8.SysConfig
>* 访问当前租户系统设置中的非敏感业务与展示字段；返回值是独立脱敏副本，脚本修改不会写回缓存或数据库。
>* `ClientSecrets`、`PwdV8`、`GlobalServerV8Code` 以及 Password/Secret/Token/Key/Connection 等疑似凭据字段不会注入 V8。`V8.FormEngine.GetSysConfig(...)` 同样强制绑定当前租户并应用此安全边界。
```js
var sysTitle = V8.SysConfig.SysTitle;
// V8.SysConfig.ClientSecrets / GlobalServerV8Code 为 undefined
```

## SaaS引擎信息 V8.OsClientModel / V8.ClientModel
>* 两者是当前租户 SaaS 配置的独立脱敏副本，脚本修改不会写回服务端运行配置。
>* 数据库连接、鉴权密钥以及共享 Redis、对象存储、RabbitMQ、MQTT、Search 的地址、账号和密码不会注入 V8；即使接口错误地 `return V8.ClientModel`，也不会泄露主库基础设施凭据。
>* 当前租户自行扩展的业务集成字段（例如微信支付 Key）仍可供后端 V8 使用，但不得把整个配置对象或单个密钥返回前端。
>* 存储类型 `HDFS` 与公开文件域名可以读取；访问缓存、文件、MQ、MQTT 和 Search 必须使用对应的 `V8.*` 受控能力，服务端自动添加当前租户命名空间。
```js
var title = V8.OsClientModel.SysTitle;
var storageType = V8.ClientModel.HDFS; // ClientModel 是兼容别名

// 以下字段为 undefined，不再暴露：
// V8.ClientModel.DbConn / RedisPwd / MinIOSecretKey / MQPassword / MqttPwd / SearchEngineApiKey
```

共享基础设施可以复用同一 Redis、对象存储、RabbitMQ Broker、MQTT Broker 和搜索集群，但隔离边界由服务端强制执行：缓存 Key、对象路径、队列、Topic、索引分别绑定当前 `OsClient`。RabbitMQ、MQTT 和 Search 还必须为子租户配置独立凭据；缺少独立凭据时对应能力失败关闭，不会回退使用主租户账号。

## 表单数据 V8.Form
>* 表单提交事件中可访问表单数据，接口引擎中此对象为空。

## V8.OldForm
>* 在修改数据时，后端V8事件可访问到V8.OldForm修改前的数据值

## V8.FormSubmitAction
>* 表单提交类型：可能的值：`Insert` `Delete` `Update`（string类型）
>* 注意服务器端V8事件里面没有`FormOutAction`、`FormOutAfterAction`，只有`FormSubmitAction`

## V8.EventName
>* 后端V8事件名称，在全局V8引擎代码中比较好用，可能的值：
```js
FormSubmitBefore：表单提交前V8事件
FormSubmitAfter：表单提交后V8事件
DataFilter：数据处理V8事件
WFNodeLine：流程节点条件判断V8事件
WFNodeEnd：流程节点结束V8事件
WFNodeStart：流程节点开始V8事件
```


## V8.Param
>* 用于访问前端传入的参数，能访问到url参数、form-data参数、payload-json参数

## V8.Action
>* 用于访问在全局服务器V8代码处自定义的方法

## V8.InvokeType
>* 访问当前调用类型，可能的值：`Server`、`Client`，当访问到的V8.InvokeType为空时，则默认`Server`
>* `Server`：服务器端调用，如在接口引擎中调用接口引擎，在后端V8事件中调用接口引擎
>* `Client`：前端调用，如在前端V8事件中调用接口引擎，在前端提交表单

## V8.TableModel
>* 在后端V8事件中，可访问到操作的当前`diy_table`表的信息

## V8.OsClient
>* 访问当前的OsClient值

## 其它后端能力与支持边界

后端会把多个扩展同时注册为 `V8.*` 和兼容全局对象。新代码统一使用 `V8.*`，不要依赖全局别名，避免与 JavaScript、CLR 或其它扩展同名。

| 能力 | 推荐入口 | 适用范围与安全边界 |
|---|---|---|
| 数据源引擎 | `V8.DataSourceEngine.Run/RunAsync` | 只运行当前租户数据源；动态 SQL、远程连接和返回字段仍需按业务授权 |
| 模块引擎 | `V8.ModuleEngine` | 读取当前用户可见模块模型；不能代替 FormEngine 的数据权限 |
| 工作流引擎 | `V8.WFEngine`、事件中的 `V8.WF` | 启动、发送、撤回、取消等动作必须校验当前用户、当前租户、流程状态与表单范围 |
| 翻译引擎 | `V8.TranslateEngine.Translate/GetLang...` | 使用当前租户的语言与供应商配置，不能传其它租户消耗其凭据或额度 |
| 文件能力 | `V8.HDFS`、`V8.Method.Upload/GetPrivateFileUrl` | 普通业务优先使用受控上传和短期代理；列举、删除、读取私有字节属于可信管理能力 |
| 消息能力 | `V8.MQ.SendMsg` | 队列名绑定当前租户；消费、关闭通道等属于 Worker 内部能力，消息必须有全局 `EventId` 和幂等消费 |
| 短信 | `V8.Sms.Send` | 供应商配置必须脱敏，发送接口要有频率、金额/条数、模板和收件人限制 |
| 爬虫 | `V8.Spider` | 属于高风险 Worker 能力；必须使用租户目标地址策略、租户/用户会话隔离、并发和运行时限，禁止脚本指定浏览器可执行文件 |
| 主机监控 | `V8.System` | CPU、内存、磁盘、网络等运维数据仅供管理员/运维，不应从普通或匿名接口返回 |
| 支付、微信、DNS | 对应 `V8.*` 扩展 | 单独校验签名、幂等键、回调重放、金额与租户凭据，不要返回密钥 |

动态建表、动态字段、数据库备份/清空、缓存连接管理、接口引擎代码写入等属于控制面能力。即使某个低层方法在 V8 对象上可见，也不等于普通业务脚本可以安全暴露；控制面 HTTP API 还会独立执行 `Level >= 9999` 管理员门禁。

## 执行上下文与资源限制

常见上下文包括 `V8.Param`、`V8.Header`、`V8.CurrentUser`、`V8.OsClient`、`V8.Form`、`V8.OldForm`、`V8.TableModel`、`V8.TableData`、`V8.FormSubmitAction`、`V8.EventName`、`V8.InvokeType`、`V8.RowIndex`、`V8.CacheData`、`V8.NotSaveField`、`V8.LineValue`、`V8.NextNodeId`、`V8.FilesByteBase64` 和 `V8.WF`。`Engine`、`HttpContext`、执行租约等宿主对象属于内部实现，不要保存到静态变量、缓存或延迟回调。

平台的 `SecurityGuard`、`PressureGuard`、`V8Limits`、`OrmLimits`、`StartupLimits` 以及 V8 并发门共同限制单次脚本和单节点资源。进程内并发门不是集群级配额或分布式锁；多节点副作用仍必须依赖 Redis/数据库租约、幂等键、唯一约束、状态机或 outbox/inbox。

脚本应主动控制：

- SQL 页大小、字段数、循环次数和返回体大小；
- HTTP 超时、响应大小与目标地址；
- 图片、Office、ZIP 的文件数、解压体积和托管内存；
- MQ/短信/支付等外部副作用的幂等与重试；
- 日志内容的脱敏、限长与关联 ID。

完整的部署与安全基线见 [平台安全总览](../more/security.md)。

## console
>* Microi.net.dll从v3.5.1开始支持console往服务器端输出日志
```js
console.log('日志输出');
console.error('日志输出');
console.warn('日志输出');
console.info('日志输出');
//服务端查看日志
docker logs microi-api
```
