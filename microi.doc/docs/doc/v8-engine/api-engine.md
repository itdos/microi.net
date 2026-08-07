# ⚙️ 接口引擎

> **写一个获取数据的接口只要 1 分钟，在线使用 JavaScript 编写 API 接口，保存即生效**

---

## 📌 简介

- 接口引擎作为平台的最大亮点之一，主要解决复杂的业务逻辑，统一管理定制接口
- 在线使用 JavaScript 编写 API 接口，支持 [AI 编程](https://microi.net/doc/v8-engine/ai-apiengine)
- 支持 `Get`/`Post` 请求，返回 JSON、字符串、文件、HTML 等
- 支持自定义接口地址、分布式锁、权限、自定义扩展函数等
- 极致的性能（V8 代码预编译、多级缓存）与开发效率，无需本地编译发布
- 经过 8 年以上成功案例验证，部分项目高达 500+ 接口

::: tip 相关文档
[[FormEngine 用法]](https://microi.net/doc/v8-engine/form-engine)    [[Where 条件用法]](https://microi.net/doc/v8-engine/where)
:::

![在这里插入图片描述](https://static.itdos.com/upload/img/microi-apiengine-20260208.jpg)

## 默认实现边界：业务逻辑优先接口引擎

新增后端能力时，先判断表单引擎 CRUD/后端事件是否可以完成，其次使用接口引擎。只有接口引擎缺少通用底层原子能力时，才扩展 `V8.Method` 等 V8 函数；只有第三方协议验签、不可暴露密钥、可信鉴权、原始流/网络边界或运行时内核不能由 V8 安全表达时，才进入 C#。

第三方回调推荐使用“协议网关 + 官方核心接口 + 租户扩展 Hook”三层结构：

1. C# 协议网关只验签、解密、校验 AppId/租户并输出脱敏事件，不写业务表、不编排通知。
2. 官方核心接口引擎负责幂等、状态、基础日志，并由应用商城以 `Managed` 资源交付。
3. 租户 Hook 由应用商城首次创建，策略为 `CreateIfMissing`；之后客户可在线修改，应用更新永不覆盖。

以微信小程序内容安全回调为例，微信后台推荐填写：

```text
https://你的API域名/api/WeChatContentSecurity/Callback--OsClient--你的OsClient--
```

普通 HTTP 调试也支持：

```text
https://你的API域名/api/WeChatContentSecurity/Callback?OsClient=你的OsClient
```

不使用 `?o=`。路径和查询参数同时出现时必须指向同一租户，否则服务端拒绝请求。Token 与 `EncodingAESKey` 保存在 SaaS 引擎当前租户的微信配置中，只由 C# 协议层读取，不进入 V8、日志或接口响应。业务扩展修改 `mci-wechat-content-callback-extension`，无需重新编译发布后端；涉及积分、库存、外部通知等副作用时必须以 `EventId` 建唯一约束或先写 outbox。

```js
//获取一个数据列表
var result = V8.FormEngine.GetTableData('tableName', {
  _Where : [ // WHERE GuanLianID = 1 OR GuanLianID IS NULL
    ['GuanLianID', '=', '1'],
    ['OR', 'GuanLianID', '=', null]
  ],
  _PageIndex : 1,
  _PageSize : 15,
});
return result;
```

## 强大的V8调试功能
>* 支持`本地`、`在线`两种方式编写V8接口引擎，`双向增量同步`在线、本地V8代码
>* 支持`本地调试V8事件代码`、`接口引擎代码`，同时支持V8代码调用`平台插件源码`关联调试
>* **整个接口请求全路径支持`断点调试`**：
>1. `前端`表单进入V8事件      `[支持调试]`
>2. `前端`表单提交前V8事件      `[支持调试]`
>3. `后端`表单提交前V8事件      `[支持调试]`
>4. **`后端`V8事件调用<span class="mci-doc-danger">接口引擎</span>**    `[支持调试]`
>5. **`后端`接口引擎调用`V8.Cache`等任何后端插件源码**    `[支持调试]`
>6. `后端`表单提交后V8事件      `[支持调试]`
>7. `前端`表单提交后V8事件      `[支持调试]`

## 支持所有后端V8函数
>* 见平台文档：[V8函数-后端](https://microi.net/doc/v8-engine/v8-server.html)

## 支持`Get`、`Post`请求
>* 无论您是通过`get`还是`post`，均能成功请求接口引擎

## 支持`Form`、`Json`请求
>* 无论您的请求是`form-data`还是`payload-json`，均支持

## V8.Param
>* 均能接收和访问到`form`、`json`、`url`三种参数
```javascript
//支持接收3种类型的参数，均使用V8.Param.***访问
var id = V8.Param.Id;
```

## 异步与后台任务

接口引擎支持真正的请求内异步调用；需要等待结果时使用 `await`，并在本次请求结束前完成：

```js
var result = await V8.Http.PostAsync({
  Url: 'https://api.example.com/orders',
  ParamType: 'json',
  PostParam: { OrderId: V8.Param.OrderId }
});
return result;
```

不要使用后端 `setTimeout`、`System.Threading.Tasks.Task.Run` 或自行创建线程，把数据库写入、通知、同步等业务延伸到接口已经返回之后。这些进程内任务在多节点调度、滚动发布、进程崩溃或服务器重启时可能丢失，也无法提供可靠的幂等、重试与可观测性。

需要“稍后执行”或长耗时处理时，应根据业务选择：

- 菜单后台任务：按钮配置 `RunBackground/BackgroundTask/IsBackgroundTask=true`，并绑定 `ApiEngineKey`。
- `Microi.Job`：适合定时扫描、补偿和周期任务；多节点下必须使用带租约的分布式锁，并同时保证业务幂等。
- MQ/outbox：适合可靠异步消息、重试和跨服务处理；事件使用稳定的全局 `EventId`，消费端幂等。
- 前端 `setTimeout`：仅用于当前页面生命周期内的短时 UI 延迟或防抖，不承担可靠业务；页面关闭、卸载或租户切换时必须清理。

详见：[V8 函数列表（后端）](https://microi.net/doc/v8-engine/v8-server.html) 与接口引擎配置 Skill（[GitHub](https://github.com/itdos/microi.net/tree/master/microi.skills/v8-api-config) / [Gitee](https://gitee.com/ITdos/microi.net/tree/master/microi.skills/v8-api-config)）。

## 扩展接口引擎
>* 当前扩展统一通过 `Microi.V8Engine/V8Extend.cs`（[GitHub](https://github.com/itdos/microi.net/blob/master/Microi.Server/Microi.V8Engine/V8Extend.cs) / [Gitee](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.V8Engine/V8Extend.cs)）中的 `V8ExtensionRegistry` 注册，不再修改旧 `V8EngineExtend` partial 属性。
>* 官方内置注册包括 `V8.Alipay`、`V8.AlipayV3`、`V8.WeChat`、`V8.Alidns`、`V8.System` 和 `V8.Image`；实际可用清单以当前部署源码为准。
>* 支付、微信、DNS 等扩展会接触私钥和供应商凭据，只能从当前租户受控配置读取，不得写死在 V8、日志或响应中。
::: details 展开查看 C# 注册示例
```csharp
public static class V8Extend
{
    internal static void Initialize()
    {
        V8ExtensionRegistry.Register("Alipay", () => new Alipay());
        V8ExtensionRegistry.Register("WeChat", () => new WeChat());

        // 自定义扩展示例：
        V8ExtensionRegistry.Register("CustomService", () => new CustomService());
    }
}
```
:::

## 返回数据
>* 将数据返回给前端，可以是JSON、字符串、Html、文件等
::: details 展开查看 JavaScript 代码（38 行）
```javascript
//当指定了Code值为1时，平台会自动提交事务，无需手动执行V8.DbTrans.Commit()
return { Code : 1, Data : [1, 2, 3], Msg : '事务已提交！' };

//若代码出现return，并且未指定Code的值、或Code值不等于1时，则会自动回滚事务，无需手动执行V8.DbTrans.Rollback()
return { Code : 0, Msg : '错误信息，事务已回滚！' };

//若代码出现return，并且未指定Code值（平台识别到非{Code:1}结构时自动回滚事务）
//【注意】禁止手动调用V8.DbTrans.Commit()或V8.DbTrans.Rollback()，事务生命周期由平台统一管理
return { A : 111, B : 222 };

//支持返回JSON
return [{ Id : 1, Name : '张三' }];

return '支持返回字符串';

//支持返回HTML
return `<html>
          <body>
            <h1>支持返回HTML</h1>
          </body>
        </html>`;

//支持直接响应文件，如：图片、Office文档等等
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
V8.Result = {
  Code : 1,
  Data : {
    FileName : '接口引擎直接返回响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};

//旧版返回方式（仍然支持，但建议弃用这种方式）
//V8.Result = { Code : 1, Data : [] }
```
:::

## 接口配置
### 基础配置
>* 名称（`ApiName`）自定义，如：[移动端]获取商品列表
>* Key（`ApiEngineKey`）自定义，如：get-product-list
>* 禁止外部调用（`StopHttp`），开启后只能通过接口引擎V8代码或服务器端V8事件调用此接口（函数），且自定义接口地址失效

### 自定义接口地址
>* 自定义接口地址（`ApiAddress`），建议统一使用`/apiengine/`开头，如：`/apiengine/get-product-list`。当然您要自定义为`/api111/b2222/c333/d444`也可以，使用`ApiBase + ApiAddress`访问接口

### 分布式锁
>* 某些场景的接口，必须使用分布式锁，如：订单发货审批通过后扣除库存，防止库存变为负数。（当然也可以使用消息队列，这种方式其它文章讲解）
>* 开启分布式锁可以设定分布式锁Key，这个大有用处。比如说当我们要给商品A进行库存增减时，分布式锁Key就可以设置为商品A的Id，此时不同的商品走不同的分布式锁Key、排不同的队，大大提高并发吞吐量。
>* 若不设置分布式锁Key，那么1000个人同时调用此接口，都得排队

### 允许匿名调用
>* 接口引擎默认必须传入token才能被调用，否则会报错1001未登录
>* 当开启允许匿名调用时，则无需传入token，但注意在V8引擎中访问**V8.CurrentUser**为{}

### 响应文件
接口引擎开启【响应文件】后，只需要返回 `FileName`、`ContentType`、`FileByteBase64` 三个字段。平台会自动处理响应头：图片和 PDF 在浏览器中直接打开，Excel、压缩包等其它类型保持下载。

平台会校验常见图片和 PDF 的文件头，避免把非 PDF 内容伪装成 `application/pdf` 导致浏览器无法预览。比如 PDF 必须以 `%PDF-` 开头；如果远程系统返回的是业务容器格式、错误页、登录页等内容，接口会返回 JSON 错误，方便排查。

测试访问接口引擎地址：[https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos](https://api.itdos.com/apiengine/test_response_file?OsClient=iTdos)
```javascript
var downResult = V8.Http.GetResponse({
  Url : 'https://static.itdos.com/itdos/img/20230623/WechatIMG21753.png'
});
var imgByte = downResult.RawBytes;
return {
  Code : 1,
  Data : {
    FileName : '测试响应文件.png',
    ContentType : 'image/png',
    FileByteBase64 : System.Convert.ToBase64String(imgByte)
  }
};
```

返回 PDF 的写法相同，V8 代码不需要手动解析文件头：

```javascript
var downResult = V8.Http.GetResponse({
  Url : 'https://example.com/report.pdf'
});
return {
  Code : 1,
  Data : {
    FileName : '报告.pdf',
    ContentType : 'application/pdf',
    FileByteBase64 : System.Convert.ToBase64String(downResult.RawBytes)
  }
};
```

### 界面引擎 Office/PDF 预览返回参数

界面引擎的 `office` 组件可以把接口引擎作为动态数据源。接口既可以返回真实文件，也可以返回 JSON 文件描述；推荐返回 JSON `DosResult`，这样可以同时携带页码、文件缓存 Key、轮询状态等信息。

常用返回字段：

| 字段 | 说明 |
| --- | --- |
| `FileName` | 文件名，例如 `report.pdf` |
| `ContentType` | 文件类型，PDF 使用 `application/pdf` |
| `FileByteBase64` | 文件字节的 Base64。与 `FileUrl` 二选一 |
| `FileUrl` | 文件访问地址。与 `FileByteBase64` 二选一 |
| `PageNumber` / `InitialPage` | 打开 PDF 时要跳转的页码 |
| `FileKey` / `CacheKey` | 当前文件版本标识。前端轮询时会带回 `CurrentFileKey`，接口可据此判断是否需要刷新 |
| `NeedRefresh:false` / `NotModified:true` | 文件和页码未变化时返回，前端保持当前预览，不重新下载文件 |
| `RefreshSeconds` | 建议轮询秒数。具体是否使用取决于界面引擎组件配置 |

界面引擎轮询接口时会传入：

| 参数 | 说明 |
| --- | --- |
| `PageNumber` | 组件配置的初始页码 |
| `CurrentPageNumber` | 前端当前希望停留的页码 |
| `CurrentFileKey` | 前端当前渲染的文件 Key |
| `CurrentFileUrl` | 前端当前渲染的文件地址，仅用于诊断或兼容 |
| `WidgetNumber` | 当前组件编号，便于一个页面多个预览组件时区分缓存 |

示例：

```javascript
var pageNumber = 2;
var activeFileKey = 'role-demo-v1:p' + pageNumber;

if (V8.Param.CurrentFileKey == activeFileKey) {
  return {
    Code: 1,
    Data: {
      NeedRefresh: false,
      NotModified: true,
      FileKey: activeFileKey,
      PageNumber: pageNumber
    }
  };
}

var pdfResp = V8.Http.GetResponse({ Url: 'https://example.com/report.pdf' });
return {
  Code: 1,
  Data: {
    FileName: 'report.pdf',
    ContentType: 'application/pdf',
    FileByteBase64: System.Convert.ToBase64String(pdfResp.RawBytes),
    PageNumber: pageNumber,
    InitialPage: pageNumber,
    FileKey: activeFileKey
  }
};
```

如果返回 `Code: 1` 但 `ContentType` 与真实文件内容不匹配，后端会自动返回类似下面的 JSON 错误：

```json
{
  "Code": 0,
  "Msg": "响应文件内容与ContentType不匹配，浏览器无法正常预览或下载。",
  "Data": {
    "ContentType": "application/pdf",
    "ExpectedFirstAscii": "%PDF-",
    "ActualFirstAscii": "KD_C_PLM........",
    "ActualFirstHex": "4B 44 5F 43 5F 50 4C 4D 00 00 08 00 00 1E 01 00",
    "Length": 73216
  }
}
```

例如金蝶 PLM 电子仓返回的 `KD_C_PLM` 是业务封装流，不是真实 PDF；即使文件最终可由金蝶客户端处理，也不能用 `application/pdf` 返回给浏览器。需要先取得或转换成以 `%PDF-` 开头的真实 PDF 字节，再按上面的结构返回。

::: details ContentType 常用值清单
> `ContentType` 必须与真实文件字节一致。平台会自动校验 PDF、PNG、JPEG、GIF、WebP、AVIF、BMP、TIFF、ICO、SVG 等常见可预览类型。

| 文件类型 | ContentType | 常见后缀 |
| --- | --- | --- |
| PDF | `application/pdf` | `.pdf` |
| PNG 图片 | `image/png` | `.png` |
| JPEG 图片 | `image/jpeg` | `.jpg` `.jpeg` |
| GIF 图片 | `image/gif` | `.gif` |
| WebP 图片 | `image/webp` | `.webp` |
| AVIF 图片 | `image/avif` | `.avif` |
| SVG 图片 | `image/svg+xml` | `.svg` |
| BMP 图片 | `image/bmp` | `.bmp` |
| TIFF 图片 | `image/tiff` | `.tif` `.tiff` |
| ICO 图标 | `image/x-icon` | `.ico` |
| 普通文本 | `text/plain; charset=utf-8` | `.txt` `.log` |
| HTML | `text/html; charset=utf-8` | `.html` `.htm` |
| CSS | `text/css; charset=utf-8` | `.css` |
| JavaScript | `text/javascript; charset=utf-8` | `.js` |
| JSON | `application/json; charset=utf-8` | `.json` |
| XML | `application/xml; charset=utf-8` | `.xml` |
| CSV | `text/csv; charset=utf-8` | `.csv` |
| Markdown | `text/markdown; charset=utf-8` | `.md` |
| RTF | `application/rtf` | `.rtf` |
| Word 旧版 | `application/msword` | `.doc` |
| Word OpenXML | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |
| Excel 旧版 | `application/vnd.ms-excel` | `.xls` |
| Excel OpenXML | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` |
| PowerPoint 旧版 | `application/vnd.ms-powerpoint` | `.ppt` |
| PowerPoint OpenXML | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `.pptx` |
| OpenDocument 文档 | `application/vnd.oasis.opendocument.text` | `.odt` |
| OpenDocument 表格 | `application/vnd.oasis.opendocument.spreadsheet` | `.ods` |
| OpenDocument 演示 | `application/vnd.oasis.opendocument.presentation` | `.odp` |
| ZIP | `application/zip` | `.zip` |
| 7z | `application/x-7z-compressed` | `.7z` |
| RAR | `application/vnd.rar` | `.rar` |
| TAR | `application/x-tar` | `.tar` |
| GZip | `application/gzip` | `.gz` |
| BZip2 | `application/x-bzip2` | `.bz2` |
| WebM 视频 | `video/webm` | `.webm` |
| MP4 视频 | `video/mp4` | `.mp4` |
| MPEG 视频 | `video/mpeg` | `.mpeg` `.mpg` |
| OGG 视频 | `video/ogg` | `.ogv` |
| AVI 视频 | `video/x-msvideo` | `.avi` |
| MOV 视频 | `video/quicktime` | `.mov` |
| MP3 音频 | `audio/mpeg` | `.mp3` |
| WAV 音频 | `audio/wav` | `.wav` |
| OGG 音频 | `audio/ogg` | `.ogg` |
| AAC 音频 | `audio/aac` | `.aac` |
| FLAC 音频 | `audio/flac` | `.flac` |
| WOFF 字体 | `font/woff` | `.woff` |
| WOFF2 字体 | `font/woff2` | `.woff2` |
| TTF 字体 | `font/ttf` | `.ttf` |
| OTF 字体 | `font/otf` | `.otf` |
| 二进制流 | `application/octet-stream` | 任意未知文件 |
:::
## 接口测试
>接口引擎表单提供了接口运行测试的功能（由表单引擎驱动）

## 接口调试
>* 1、定义是否需要向前端输出日志内容：【var isDebugLog = true;】
>* 2、定义需要向前端输出的日志内容：【var debugLog = {};】
>* 3、记录日志：【debugLog.Log1 = list1Result;】。也可以使用【V8.Method.AddSysLog】写MongoDB日志，然后在系统设置 -> 系统日志中查看
>* 4、判断是否向前端输出日志：【DataAppend : { DebugLog : isDebugLog ? debugLog : null }】
::: details 展开查看 JavaScript 代码（41 行）
```js
//【第一步】定义是否需要向前端输出日志内容，需要调试时为true，不需要调试时为false
var isDebugLog = true;//也可以使用系统设置全局变量：var isDebugLog = V8.SysConfig.V8EngineDebugLog;
//【第二步】定义需要向前端输出的日志内容
var debugLog = {};
//获取业务数据
var list1Result = V8.FormEngine.GetTableData({
    FormEngineKey: 'test1',
    _Where: [
      ['field1', '=', '1']
    ]
});
//【记录日志】测试记录日志1
debugLog.Log1 = list1Result;
//【记录日志】【写MongoDB日志】
if(isDebugLog){
  V8.Method.AddSysLog({
    Type : '日志类型',
    Title : '日志标题',
    Content: `日志内容：${JSON.stringify(list1Result)}`
  });
}
if(list1Result.Code != 1){
  return list1Result;
}
//处理业务数据
debugLog.Log2 = [];
for(var i = 0; i < list1Result.Data.length; i++){
    var item = list1Result.Data[i];
    if(item.Number < 10){
        item.Number = '0' + item.Number;
        //【记录日志】测试记录日志2
        debugLog.Log2.push(item.Id);
    }
}
return {
    Code : 1, 
    Data : null, 
    DataAppend : {
        DebugLog : isDebugLog ? debugLog : null // 【第三步】判断是否向前端输出日志
    }
};
```
:::

## 捕获接口代码异常
::: details 展开查看 JavaScript 代码（29 行）
```js
try{
  //你的接口引擎代码
}catch (error) {
    debugLog.errorDetails = {
        message: error.message || '',
        toString: error.toString ? error.toString() : '',
        stack: error.stack || '',
        lineNumber: error.lineNumber || '',
        columnNumber: error.columnNumber || '',
        fileName: error.fileName || '',
        name: error.name || '',
        description: error.description || ''
    };
    
    var errorMsg = '接口引擎的V8代码执行发生异常：' + (error.message || error.toString());
    if (error.lineNumber) {
        errorMsg += ' (行号: ' + error.lineNumber + ')';
    }
    if (error.stack) {
        errorMsg += '\n堆栈: ' + error.stack;
    }
    return {
        Code: 0,
        Msg: errorMsg,
        DataAppend: {
            DebugLog: isDebug ? debugLog : null
        }
    };
}
```
:::

## 接口引擎实战
>* 这里我们会发布大量的接口引擎实现复杂的功能实战：[接口引擎实战](https://microi.net/doc/v8-engine/apiengine-index.html)

## 注意事项
>* 若前端传入的某个参数是数组，接口引擎的V8.Param收到参数时，也是数组，能使用数组的所有特性，但唯独无法使用`Array.isArray(V8.Param.ArrayParamName)`来判断为真
```js
var arrayValue = V8.Param.ArrayParamName;
var isArray = Array.isArray(arrayValue);  //值为 false
var isObject = typeof(arrayValue) == 'object';  //值为 true
var id1 = arrayValue[0].Id;  //可以正常使用
var hasValue = arrayValue.length > 0;  //可以正常使用
```
