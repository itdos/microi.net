# Microi.V8Engine — V8 引擎扩展开发指南

> **Microi 吾码** 开源低代码平台的 V8 引擎扩展类库，允许开发者用 C# 编写扩展能力，注入到 V8 引擎中供 JavaScript 脚本调用。

## 目录

- [项目概述](#项目概述)
- [架构设计](#架构设计)
- [快速开始：5 分钟添加一个扩展](#快速开始5-分钟添加一个扩展)
- [详细开发指南](#详细开发指南)
  - [第一步：创建扩展类](#第一步创建扩展类)
  - [第二步：注册扩展](#第二步注册扩展)
  - [第三步：编译发布](#第三步编译发布)
  - [第四步：在 JavaScript 中使用](#第四步在-javascript-中使用)
- [扩展开发规范](#扩展开发规范)
  - [命名空间](#命名空间)
  - [返回值规范](#返回值规范)
  - [参数传递](#参数传递)
  - [错误处理](#错误处理)
- [扩展 V8.Method 的方法](#扩展-v8method-的方法)
- [内置扩展参考](#内置扩展参考)
- [完整示例：实现一个短信服务扩展](#完整示例实现一个短信服务扩展)
- [项目结构说明](#项目结构说明)
- [常见问题](#常见问题)

---

## 项目概述

`Microi.V8Engine` 是 Microi 吾码平台的 V8 引擎扩展类库，基于以下技术栈：

| 项 | 说明 |
|---|---|
| **目标框架** | `netstandard2.1` |
| **发布形式** | NuGet 包 |
| **JS 引擎** | [Jint](https://github.com/sebastienros/jint)（.NET 上的 JavaScript 解释器） |
| **核心依赖** | `Dos.Common`、`Microi.Core` |

**核心价值**：开发者用 C# 编写能力扩展 → 注册到 V8 引擎 → 用户在接口引擎 / 表单 V8 事件中通过 `V8.xxx` 直接调用。

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  用户 JavaScript 脚本                        │
│  var result = V8.Alipay.CreatePay({...});                   │
│  var info = V8.System.GetOSInfo();                          │
│  var sign = V8.Method.HmacSha256Sign(data, key);           │
└────────────────────────────┬────────────────────────────────┘
                             │ 调用
┌────────────────────────────▼────────────────────────────────┐
│              Jint JavaScript Engine                          │
│  engine.SetValue("Alipay", alipayInstance);                 │
│  engine.Execute("V8.Alipay = Alipay;");                    │
└────────────────────────────┬────────────────────────────────┘
                             │ 注入
┌────────────────────────────▼────────────────────────────────┐
│           V8ExtensionRegistry（核心注册器）                    │
│                                                              │
│  Register("Alipay",  () => new Alipay());                   │
│  Register("WeChat",  () => new WeChat());                   │
│  Register("System",  () => new SystemInfo());               │
│  Register("YourExt", () => new YourExtension());  ← 你的扩展 │
└────────────────────────────┬────────────────────────────────┘
                             │ 配置
┌────────────────────────────▼────────────────────────────────┐
│           V8Extend.Initialize()（注册入口）                    │
│  所有内置扩展和自定义扩展在此统一注册                            │
└─────────────────────────────────────────────────────────────┘
```

### 工作流程

1. **应用启动** → `V8ExtensionRegistry` 静态构造函数自动执行
2. **自动调用** `V8Extend.Initialize()` → 注册所有扩展的工厂方法
3. **脚本执行时** → `V8ExtensionRegistry.InjectAll(engine)` 将所有扩展注入 Jint 引擎
4. **每个扩展** 同时注册为全局变量和 `V8` 对象属性
5. **用户脚本** 通过 `V8.ExtensionName.Method()` 调用

---

## 快速开始：5 分钟添加一个扩展

### 1. 创建扩展类

在 `Extend/` 目录下新建文件 `Extend/MyService/MyService.cs`：

```csharp
namespace Microi.net
{
    public class MyService
    {
        public string SayHello(string name)
        {
            return $"Hello, {name}！来自 V8.MyService";
        }
    }
}
```

### 2. 注册扩展

打开 `V8Extend.cs`，在 `Initialize()` 方法中添加一行：

```csharp
V8ExtensionRegistry.Register("MyService", () => new MyService());
```

### 3. 编译

```bash
cd Microi.Server/Microi.V8Engine
dotnet build
```

### 4. 在 JavaScript 中调用

```javascript
// 接口引擎 或 表单V8事件中
var result = V8.MyService.SayHello('张三');
// 输出: "Hello, 张三！来自 V8.MyService"
return { Code: 1, Data: result };
```

**就是这么简单！只需要两步：写一个类 + 注册一行代码。**

---

## 详细开发指南

### 第一步：创建扩展类

#### 文件位置

在 `Extend/` 目录下按功能分类创建子目录：

```
Extend/
├── Ali/              # 阿里云相关
├── WeChat/           # 微信相关
├── System/           # 系统监控
├── DwgConvert/       # DWG 文件转换
└── YourCategory/     # ← 你的扩展分类目录
    └── YourExtension.cs
```

#### 基本模板

```csharp
using System;
using Dos.Common;              // DosResult 等公共类
using Newtonsoft.Json.Linq;    // JObject（可选）

namespace Microi.net
{
    /// <summary>
    /// V8引擎扩展 - 你的扩展描述
    /// 用户脚本中通过 V8.YourExtension 访问
    /// </summary>
    public class YourExtension
    {
        /// <summary>
        /// 方法描述
        /// </summary>
        /// <param name="param">参数描述</param>
        /// <returns>返回值描述</returns>
        public DosResult YourMethod(YourParam param)
        {
            try
            {
                // 你的业务逻辑
                var data = DoSomething(param);
                return new DosResult(1, data);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
    }
}
```

#### 参数类定义

如果方法有多个参数，推荐定义一个参数类（Jint 会自动将 JavaScript 对象映射到 C# 类的属性）：

```csharp
namespace Microi.net
{
    public class YourParam
    {
        /// <summary>应用ID</summary>
        public string AppId { get; set; }
        
        /// <summary>密钥</summary>
        public string Secret { get; set; }
        
        /// <summary>业务参数</summary>
        public string Data { get; set; }
    }
}
```

JavaScript 调用时直接传对象即可自动映射：

```javascript
var result = V8.YourExtension.YourMethod({
    AppId: 'app123',
    Secret: 'xxx',
    Data: '业务数据'
});
```

### 第二步：注册扩展

打开项目根目录的 `V8Extend.cs`，在 `Initialize()` 方法末尾添加注册代码：

```csharp
public static class V8Extend
{
    internal static void Initialize()
    {
        // ... 已有的内置扩展 ...

        // ============================================
        // 【用户自定义扩展 - 在此添加你的扩展】
        // ============================================
        V8ExtensionRegistry.Register("YourExtension", () => new YourExtension());
    }
}
```

**注册名称就是 JavaScript 中的访问名**：
- `Register("SMS", ...)` → JavaScript 中用 `V8.SMS.xxx()`
- `Register("OSS", ...)` → JavaScript 中用 `V8.OSS.xxx()`

### 第三步：编译发布

#### 开发模式（Debug）

```bash
cd Microi.Server/Microi.V8Engine
dotnet build
```

Debug 模式不生成 NuGet 包，仅用于本地开发调试。主项目 `Microi.net.Api` 通过 `ProjectReference` 直接引用。

#### 发布模式（Release）

```bash
dotnet build -c Release
```

Release 模式会自动生成 NuGet 包：`bin/Release/Microi.V8Engine.{版本号}.nupkg`。

#### 版本号管理

在 `Microi.V8Engine.csproj` 中修改版本号：

```xml
<Version>5.0.8</Version>
<AssemblyVersion>5.0.8</AssemblyVersion>
<FileVersion>5.0.8</FileVersion>
```

> 注意：升级此类库版本号时，必须同时升级 `Microi.net` 主项目的版本号。

### 第四步：在 JavaScript 中使用

注册完成并编译后，用户可以在以下场景中使用扩展：

#### 接口引擎

```javascript
// 接口引擎 JavaScript 代码
var result = V8.YourExtension.YourMethod({
    AppId: V8.Param.appId,
    Secret: '配置的密钥',
    Data: JSON.stringify(V8.Param)
});

if (result.Code === 1) {
    return { Code: 1, Data: result.Data };
} else {
    return { Code: 0, Msg: result.Msg };
}
```

#### 表单 V8 事件（SubmitBeforeServerV8.js / SubmitAfterServerV8.js）

```javascript
// 表单提交后事件
var notifyResult = V8.YourExtension.SendNotify({
    UserId: V8.Form.UserId,
    Message: '订单已提交'
});
```

---

## 扩展开发规范

### 命名空间

所有扩展类统一使用 `Microi.net` 命名空间：

```csharp
namespace Microi.net
{
    public class YourExtension { }
}
```

### 返回值规范

推荐使用 `DosResult` 标准返回格式，与 Microi 平台统一：

```csharp
// 成功
return new DosResult(1, data);                    // Code=1, Data=data
return new DosResult(1, data, "", count);         // 带数据总条数
return new DosResult(1, data, "", 0, appendData); // 带附加数据

// 失败
return new DosResult(0, null, "错误信息");          // Code=0, Msg="错误信息"
```

JavaScript 侧接收到的格式：

```javascript
var result = V8.YourExtension.YourMethod(param);
// result.Code      → 1(成功) / 0(失败)
// result.Data      → 返回数据
// result.Msg       → 错误信息
// result.DataCount → 数据总条数
// result.DataAppend → 附加数据
```

**也可以返回其他类型**：

| 返回类型 | 适用场景 | 示例 |
|---------|---------|------|
| `DosResult` | 标准业务方法 | 增删改查、支付、发送通知 |
| `JObject` | 结构化数据 | 系统信息、监控数据 |
| `string` | 简单结果 | 签名、加密、ID 生成 |
| `bool` | 判断型方法 | 文件转换是否成功 |
| `byte[]` | 二进制数据 | 文件转换结果 |

### 参数传递

#### 方式一：参数类（推荐，适合 3 个以上参数）

```csharp
// C# 参数类
public class SmsParam
{
    public string Phone { get; set; }
    public string Content { get; set; }
    public string SignName { get; set; }
    public string TemplateCode { get; set; }
}

// C# 方法
public DosResult Send(SmsParam param) { ... }
```

```javascript
// JavaScript 调用 - Jint 自动将 JS 对象映射到 C# 参数类
V8.SMS.Send({
    Phone: '13800138000',
    Content: '验证码：1234',
    SignName: 'Microi',
    TemplateCode: 'SMS_001'
});
```

#### 方式二：直接参数（适合少量参数）

```csharp
// C# 方法
public string HmacSha256Sign(string data, string key) { ... }
```

```javascript
// JavaScript 调用
var sign = V8.Method.HmacSha256Sign('待签名数据', '密钥');
```

#### 方式三：动态参数（灵活但类型不安全）

```csharp
// C# 方法接收 object 类型
public DosResult Process(object param)
{
    var json = Newtonsoft.Json.JsonConvert.SerializeObject(param);
    // 解析处理 ...
}
```

### 错误处理

**必须** 在扩展方法中做好异常捕获，避免未处理异常导致 V8 引擎崩溃：

```csharp
public DosResult YourMethod(YourParam param)
{
    try
    {
        // 参数校验
        if (string.IsNullOrWhiteSpace(param.AppId))
            return new DosResult(0, null, "AppId 不能为空");

        // 业务逻辑
        var result = DoSomething(param);
        return new DosResult(1, result);
    }
    catch (Exception ex)
    {
        // 捕获异常并返回错误信息，切勿让异常外抛
        return new DosResult(0, null, ex.Message);
    }
}
```

---

## 扩展 V8.Method 的方法

`V8.Method` 是 Microi 平台内置的工具方法集合。本项目通过 `partial class` 机制扩展 `V8.Method`，添加新的工具方法。

### 扩展文件

`Extend/V8MethodExtend.cs` — 使用 `partial class V8EngineMethodExtend` 扩展：

```csharp
namespace Microi.net
{
    // partial class — 与 Microi.Core 中的同名类合并
    public partial class V8EngineMethodExtend
    {
        public string NewUlid()
        {
            return Ulid.NewUlid().ToString();
        }

        public string HmacSha256Sign(string data, string key)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key)))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }
    }
}
```

### JavaScript 调用

```javascript
var ulid = V8.Method.NewUlid();
var sign = V8.Method.HmacSha256Sign('数据', '密钥');
var md5 = V8.Method.Md5SignHex('待加密文本');
var json = V8.Method.JsonStringify(someObject);
```

### 已有的 V8.Method 扩展方法列表

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `NewGuid()` | 生成 GUID | `string` |
| `NewUlid()` | 生成 ULID（推荐替代 GUID，更好的排序性） | `string` |
| `HmacSha1Sign(data, key)` | HMAC-SHA1 签名 | `string`（Base64） |
| `HmacSha256Sign(data, key)` | HMAC-SHA256 签名 | `string`（Base64） |
| `Md5Sign(data)` | MD5 签名 | `string`（Base64） |
| `Md5SignHex(data)` | MD5 签名 | `string`（十六进制） |
| `JsonStringify(obj)` | JSON 序列化（紧凑） | `string` |
| `JsonStringifyIndented(obj)` | JSON 序列化（格式化） | `string` |

---

## 内置扩展参考

### V8.Alipay — 支付宝支付（v2）

```javascript
// 创建手机网站支付
var result = V8.Alipay.CreatePay({
    AppId: '2021001100xxxx',
    PrivateKey: 'MIIEvgIBA...',
    AlipayPublicKey: 'MIIBIjAN...',
    OutTradeNo: '202401010001',
    TotalAmount: '0.01',
    Subject: '订单标题',
    ProductCode: 'QUICK_WAP_WAY',
    NotifyUrl: 'https://yourdomain.com/notify',
    ReturnUrl: 'https://yourdomain.com/return',
    QuitUrl: 'https://yourdomain.com/quit'
});
```

### V8.AlipayV3 — 支付宝支付（v3 新版）

```javascript
var result = V8.AlipayV3.CreatePay({
    AppId: '2021001100xxxx',
    PrivateKey: 'MIIEvgIBA...',
    AlipayPublicKey: 'MIIBIjAN...',
    OutTradeNo: '202401010001',
    TotalAmount: '0.01',
    Subject: '订单标题',
    ProductCode: 'QUICK_WAP_WAY'
});
```

### V8.WeChat — 微信支付 & 消息

```javascript
// AES-GCM 解密微信消息
var plaintext = V8.WeChat.AesGcmDecrypt(associated_data, nonce, ciphertext, aesKey);

// RSA 签名
var signature = V8.WeChat.GetWeChatSign(privateKeyPEM, ['param1', 'param2', 'param3']);

// 生成微信 API Authorization 头
var auth = V8.WeChat.GetWeChatAuthorization(mchid, serialNo, privateKey, '/v3/pay/xxx', jsonBody);
```

### V8.Alidns — 阿里云 DNS

```javascript
// 更新 DNS A 记录
var result = V8.Alidns.UptDomainRecord({
    AccessKeyId: 'LTAI4xxxx',
    AccessKeySecret: 'xxx',
    RecordId: '191041053406xxxx',
    Value: '1.2.3.4',
    RR: 'test',
    Type: 'A'
});

// 更新 ESA DNS 记录
var result = V8.Alidns.UptESADomainRecord({
    AccessKeyId: 'LTAI4xxxx',
    AccessKeySecret: 'xxx',
    RecordId: '191041053406xxxx',
    Value: '1.2.3.4'
});
```

### V8.System — 系统监控

```javascript
// 获取操作系统信息
var osInfo = V8.System.GetOSInfo();
// → { Platform, OSVersion, Is64Bit, MachineName, ProcessorCount, IsDocker, ... }

// 获取 CPU 和内存使用情况
var cpuMem = V8.System.GetCpuMemoryInfo();
// → { CpuUsagePercent, MemoryUsagePercent, MemoryTotalMB, MemoryUsedMB, ... }

// 获取磁盘信息
var disk = V8.System.GetDiskInfo();
// → { Disks: [{ Filesystem, MountPoint, TotalGB, UsedGB, FreeGB, UsagePercent }] }

// 获取网络流量（需调用两次，间隔一段时间，才有速率数据）
var net = V8.System.GetNetworkTrafficInfo();

// 获取磁盘 IO
var io = V8.System.GetDiskIOInfo();
```

---

## 完整示例：实现一个短信服务扩展

以下是一个完整的扩展实现示例，演示从零开始添加一个短信发送能力：

### 1. 创建参数类 `Extend/SMS/SmsParam.cs`

```csharp
namespace Microi.net
{
    public class SmsParam
    {
        /// <summary>接收手机号</summary>
        public string Phone { get; set; }

        /// <summary>短信签名</summary>
        public string SignName { get; set; }

        /// <summary>模板编号</summary>
        public string TemplateCode { get; set; }

        /// <summary>模板变量（JSON 格式）</summary>
        public string TemplateParam { get; set; }

        /// <summary>AccessKey ID</summary>
        public string AccessKeyId { get; set; }

        /// <summary>AccessKey Secret</summary>
        public string AccessKeySecret { get; set; }
    }
}
```

### 2. 创建扩展类 `Extend/SMS/SmsService.cs`

```csharp
using System;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// V8引擎扩展 - 短信服务
    /// 用户脚本中通过 V8.SMS 访问
    /// </summary>
    public class SmsService
    {
        /// <summary>
        /// 发送短信
        /// </summary>
        /// <param name="param">短信参数</param>
        /// <returns>发送结果</returns>
        public DosResult Send(SmsParam param)
        {
            try
            {
                // 参数校验
                if (string.IsNullOrWhiteSpace(param.Phone))
                    return new DosResult(0, null, "手机号不能为空");
                if (string.IsNullOrWhiteSpace(param.TemplateCode))
                    return new DosResult(0, null, "模板编号不能为空");

                // 调用短信 API（这里以伪代码示意）
                // var client = new SmsClient(param.AccessKeyId, param.AccessKeySecret);
                // var response = client.Send(param.Phone, param.SignName, param.TemplateCode, param.TemplateParam);

                return new DosResult(1, new { MessageId = "MSG_" + Guid.NewGuid().ToString("N") });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "短信发送失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 批量发送短信
        /// </summary>
        /// <param name="phones">手机号（逗号分隔）</param>
        /// <param name="signName">签名</param>
        /// <param name="templateCode">模板编号</param>
        /// <param name="templateParam">模板参数</param>
        /// <returns>发送结果</returns>
        public DosResult BatchSend(string phones, string signName, string templateCode, string templateParam)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(phones))
                    return new DosResult(0, null, "手机号不能为空");

                var phoneList = phones.Split(',');
                // 批量发送逻辑 ...

                return new DosResult(1, new { Count = phoneList.Length });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
    }
}
```

### 3. 注册扩展 `V8Extend.cs`

```csharp
// 在 Initialize() 方法中添加：
V8ExtensionRegistry.Register("SMS", () => new SmsService());
```

### 4. 如果需要 NuGet 依赖

在 `Microi.V8Engine.csproj` 中添加：

```xml
<ItemGroup>
    <!-- 示例：阿里云短信 SDK -->
    <PackageReference Include="AlibabaCloud.SDK.Dysmsapi20170525" Version="3.0.0" />
</ItemGroup>
```

### 5. JavaScript 调用

```javascript
// 接口引擎中发送短信
var result = V8.SMS.Send({
    Phone: '13800138000',
    SignName: 'Microi吾码',
    TemplateCode: 'SMS_123456',
    TemplateParam: JSON.stringify({ code: '1234' }),
    AccessKeyId: 'LTAI4xxxx',
    AccessKeySecret: 'xxx'
});

if (result.Code === 1) {
    return { Code: 1, Msg: '短信发送成功', Data: result.Data };
} else {
    return { Code: 0, Msg: result.Msg };
}
```

---

## 项目结构说明

```
Microi.V8Engine/
├── Microi.V8Engine.csproj       # 项目配置（目标框架、NuGet 信息、依赖）
├── V8Extend.cs                  # 【重要】扩展注册入口 — 所有扩展在此注册
├── Core/
│   └── V8ExtensionRegistry.cs   # 【核心】扩展注册管理器 — 注册、注入、管理
├── Extend/                      # 【扩展目录】所有扩展实现
│   ├── V8MethodExtend.cs        # V8.Method 扩展方法（partial class）
│   ├── Ali/                     # 阿里云相关
│   │   ├── Alipay.cs            # 支付宝 v2 支付
│   │   ├── AlipayV3.cs          # 支付宝 v3 支付
│   │   └── Alidns.cs            # 阿里云 DNS 管理
│   ├── WeChat/
│   │   └── WeChat.cs            # 微信支付 & 消息加解密
│   ├── System/
│   │   └── SystemInfo.cs        # 系统硬件监控（Docker 友好）
│   └── DwgConvert/
│       └── DwgConverter.cs      # DWG→DXF 文件格式转换
├── Examples/                    # 使用示例
│   └── DwgConverterExample.cs
└── Resource/
    └── microi-blue-256.png      # NuGet 包图标
```

### 关键文件速查

| 我想... | 修改哪个文件 |
|---------|------------|
| 添加新扩展 | 1. 在 `Extend/` 下新建类 → 2. 在 `V8Extend.cs` 中注册 |
| 给 V8.Method 添加方法 | `Extend/V8MethodExtend.cs` |
| 修改注册逻辑 | `Core/V8ExtensionRegistry.cs` |
| 添加 NuGet 依赖 | `Microi.V8Engine.csproj` |
| 查看或修改版本号 | `Microi.V8Engine.csproj` 中 `<Version>` |

---

## 常见问题

### Q: 扩展注册后，JavaScript 中如何访问？

注册名即访问名。`Register("ABC", ...)` 注册后：
- `V8.ABC.Method()` — 通过 V8 对象访问（推荐）
- `ABC.Method()` — 直接作为全局变量访问

### Q: JavaScript 传入的对象参数如何映射到 C# 类？

Jint 引擎会自动将 JavaScript 对象的属性映射到 C# 类的同名属性（区分大小写）。确保 JavaScript 对象字段名与 C# 属性名完全一致。

```javascript
// JS 传入
V8.SMS.Send({ Phone: '13800138000', Content: 'hello' })
```

```csharp
// C# 自动接收
public class SmsParam {
    public string Phone { get; set; }   // ← 对应 JS 的 Phone
    public string Content { get; set; } // ← 对应 JS 的 Content
}
```

### Q: 能否在扩展中访问 Microi 平台能力（如 Redis、数据库）？

可以。`Microi.V8Engine` 依赖了 `Dos.Common` 和 `Microi.Core`，你可以直接使用这两个库提供的能力。

### Q: 如何调试扩展？

1. 在扩展方法中使用 `System.Diagnostics.Debug.WriteLine()` 输出调试信息
2. 使用 `try-catch` 将异常信息通过 `DosResult` 返回给 JavaScript 层
3. 在 Docker 环境中使用 `Console.WriteLine()` 配合 `docker logs` 查看输出

### Q: 扩展中可以使用异步方法吗？

Jint 引擎为同步执行环境，建议扩展方法使用同步调用。如果必须调用异步 API，使用 `.GetAwaiter().GetResult()` 转为同步：

```csharp
public DosResult CallExternalApi(string url)
{
    try
    {
        // 将异步调用转为同步
        var response = httpClient.GetAsync(url).GetAwaiter().GetResult();
        var content = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        return new DosResult(1, content);
    }
    catch (Exception ex)
    {
        return new DosResult(0, null, ex.Message);
    }
}
```

### Q: 是否每次脚本执行都会创建新的扩展实例？

是的。`V8ExtensionRegistry.InjectAll()` 方法在每次 V8 引擎执行时调用，会执行注册的工厂方法 `() => new YourExtension()` 创建新实例。这意味着：
- 扩展类应当是**无状态**的，或每次创建的状态是独立的
- 如果需要共享状态（如缓存），使用 `static` 字段

### Q: Microi.net.Api 主项目如何引用此类库？

主项目已通过 `ProjectReference` 引用：

```xml
<!-- Microi.net.Api.csproj -->
<ProjectReference Include="../Microi.V8Engine/Microi.V8Engine.csproj" />
```

编译主项目时会自动编译 `Microi.V8Engine`。

---

## 许可与贡献

- **开源协议**：与 Microi 吾码主项目一致
- **官网**：https://microi.net
- **技术支持**：973702@qq.com
