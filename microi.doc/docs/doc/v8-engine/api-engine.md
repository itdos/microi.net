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
>4. **`后端`V8事件调用<font color="red">接口引擎</font>**    `[支持调试]`
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

## 异步执行代码
>* 新开一个线程异步执行V8代码。System更多用法见：[V8函数列表-后端-System](https://microi.net/doc/v8-engine/v8-server.html#system)
```js
//方法1（推荐）
var timer1 = setTimeout(function() {
    V8.FormEngine.UptFormData('diy_test1', {
      Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
      Text45 : '2222',
    });
}, 1000);
//可在timer1开始执行前随时手动提前终止定时执行
clearTimeout(timer1);

//方法2
System.Threading.Tasks.Task.Run(function(){
  //实现setTimeout(function, 1000)的效果，不加则是setTimeout(function, 0)的异步效果
  System.Threading.Thread.Sleep(1000);
  V8.FormEngine.UptFormData('diy_test1', {
    Id : '8007f94b-4883-4a0c-8c23-f25aca910722'
    Text45 : '2222',
  });
});
```

## 扩展接口引擎
>* 详见[`Microi.V8Engine`](https://gitee.com/ITdos/microi.net/tree/master/Microi.Server/Microi.V8Engine)类库，在[`V8EngineExtend`](https://gitee.com/ITdos/microi.net/blob/master/Microi.Server/Microi.V8Engine/V8EngineExtend.cs)类中扩展
::: details 展开查看 JavaScript 代码（40 行）
```js
using System;
using Dos.Common;
using Microi.Model.Aliyun;
namespace Microi.net
{
    public partial class V8EngineExtend
    {
        /// <summary>
        /// 这种方式支持。测试扩展V8.TestV8Extend3('test')方法
        /// </summary>
        /// <returns></returns>
        public string TestV8Extend3(string testParam)
        {
            return "TestV8Extend3：" + testParam;
        }
        /// <summary>
        /// 新增V8.Alipay对象。
        /// 这种方式支持V8.Alipay.Test22('test')，也支持V8.Alipay.CreatePay({ AppId : '11' })
        /// </summary>
        public Alipay Alipay
        {
            get { return new Alipay(); }
        }
        /// <summary>
        /// 新增V8.WeChat对象。
        /// </summary>
        public WeChat WeChat
        {
            get { return new WeChat(); }
        }
        public AlipayV3 AlipayV3
        {
            get { return new AlipayV3(); }
        }
        public Alidns Alidns
        {
            get { return new Alidns(); }
        }
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
var list1Result = V8.FormEngineGetTableData({
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