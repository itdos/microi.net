---
name: v8-tcp-integration
description: Microi 后端 V8 TCP 原始字节集成规范。用于通过 V8.Tcp.Send/SendAsync/SendAndReceive/SendAndReceiveAsync 连接网络小票机、串口服务器、PLC 或其它 TCP 设备，处理 Byte/Base64/Hex/Text 载荷、GBK/GB18030、超时、响应、幂等与出站安全。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 TCP 原始字节集成

使用后端 `V8.Tcp` 完成一次性 TCP 连接、原始字节写入和可选的有界响应读取。典型场景是 RAW/JetDirect 9100 网络小票机、串口服务器和 PLC；具体协议帧、校验码与打印业务仍由接口引擎编排。

文档维护时，只在 `microi.doc/docs/doc/v8-engine/v8-server.md` 原位更新后端 API；不要新建重复页面，也不要手工维护英文文档。改变公共契约时同步后端源码/测试、Microi.Client Monaco 定义、Microi.VSCode 类型与生成知识、AI Skill 镜像。

## 先判断是否适用

| 需求 | 选择 |
|---|---|
| 后端向设备 TCP 端口发送原始字节 | `V8.Tcp` |
| HTTP/HTTPS API | `V8.Http`，不要用 TCP 重写 HTTP |
| RabbitMQ/MQTT | `V8.MQ` 或 MQTT 引擎 |
| 浏览器/5+App 蓝牙或 SPP 打印 | 前端 `V8.Print`，读取 `v8-frontend-events/references/bluetooth-print.md` |
| 长连接、TCP 服务端监听、TLS、自定义连接池 | 当前 `V8.Tcp` 不提供；设计独立网关/Worker |

平台已经提供可复用原子能力后，打印模板、设备选择、订单状态、幂等和审计优先写在接口引擎/表单事件；不要为单个打印业务再写 C# Controller。

## API 契约

| 方法 | 行为 |
|---|---|
| `V8.Tcp.Send({...})` | 连接、发送、关闭，返回 `DosResult` |
| `await V8.Tcp.SendAsync({...})` | 当前请求内异步发送 |
| `V8.Tcp.SendAndReceive({...})` | 发送后读取响应，再关闭 |
| `await V8.Tcp.SendAndReceiveAsync({...})` | 当前请求内异步发送并读取响应 |

必填目标参数：

- `Host`：主机名或 IP；只允许主机，不传 `tcp://` URL。
- `Port`：1-65535。

发送内容必须且只能选择一组：

- `Bytes`（别名 `RawBytes`、`ByteArray`）：每项为 0-255 的整数。
- `ByteBase64`（别名 `BytesBase64`、`Base64`）。
- `Hex`：允许空格、`0x`、`-`、`:`、逗号和下划线分隔。
- `Text`：按 `Encoding` 编码。默认 `utf-8`，还支持 `ascii`、`gb18030`、`gbk/gb2312`、UTF-16/UTF-32 大小端。

边界参数：

| 参数 | 默认 | 范围 |
|---|---:|---:|
| `ConnectTimeout` | 10 秒 | 1-120 秒 |
| `SendTimeout` | 10 秒 | 1-120 秒 |
| `ReceiveTimeout` | 3 秒 | 1-120 秒 |
| `MaxReceiveBytes` | 65536 | 1-1048576 |
| `NoDelay` | `true` | 布尔值 |

单次发送最多 4 MiB。`Send` 成功数据为 `{BytesSent, RemoteEndPoint}`。收发方法另有 `BytesReceived`、`RawBytes`、`ByteBase64`、`Hex`、`ReceiveEndReason`、`Truncated`；`ReceiveEndReason` 为 `RemoteClosed`、`Timeout` 或 `MaxReceiveBytes`。

## 实现流程

### 1. 固定并授权设备目标

从 SaaS 可信配置或受行权限保护的设备表读取 `Host`、`Port`，按当前用户/门店/租户决定可用设备，再与精确白名单比较。禁止这样写：

```javascript
// 错误：匿名或普通调用者可扫描后端可达内网。
return V8.Tcp.Send({
  Host: V8.Param.Host,
  Port: V8.Param.Port,
  Hex: V8.Param.Hex
});
```

### 2. 形成一个完整帧

ESC/POS、Modbus TCP 或设备私有协议的命令、正文和校验码应先合成一个完整字节载荷。不要为了拼帧而打开多次连接；包含中文和控制命令时，优先在可信后端/上游把完整帧编码为 `Bytes`、`ByteBase64` 或 `Hex`。

```javascript
var result = V8.Tcp.Send({
  Host: '192.168.1.88', // 示例；生产从可信配置读取
  Port: 9100,
  Bytes: [
    27, 64,                         // ESC @ 初始化
    77, 105, 99, 114, 111, 105, 10,
    10, 10,
    29, 86, 0                       // GS V 0 切纸
  ],
  ConnectTimeout: 5,
  SendTimeout: 5
});
if (result.Code !== 1) return result;
```

只有纯文本时可使用打印机常见编码：

```javascript
var result = await V8.Tcp.SendAsync({
  Host: '192.168.1.88',
  Port: 9100,
  Text: '吾码小票\n合计：12.00\n\n',
  Encoding: 'gb18030'
});
if (result.Code !== 1) return result;
```

### 3. 需要协议响应时显式收取

```javascript
var result = V8.Tcp.SendAndReceive({
  Host: '192.168.1.20',
  Port: 4001,
  Hex: '01 03 00 00 00 02 C4 0B',
  ReceiveTimeout: 3,
  MaxReceiveBytes: 4096
});
if (result.Code !== 1) return result;

var bytes = result.Data.RawBytes;
var hex = result.Data.Hex;
```

接收超时是整段接收的总时间。已收到部分数据后超时会返回成功和已有数据，并标记 `ReceiveEndReason='Timeout'`；未收到任何字节则失败。协议必须知道响应长度或结束条件，不能把超时默认当作完整帧。

### 4. 分开判断写入、设备执行和实物结果

- `Code=1` 只表示字节已写入 TCP 连接。
- 设备协议回执可证明设备接受/处理到哪一步，但仍不一定证明机械动作完成。
- “小票已打印”需要打印机状态、设备回执或实物/硬件验收证据。

打印不是天然幂等。不确定失败时自动重试可能重复出纸；需要可靠打印时使用业务打印单号、设备回执、状态机以及 Job/MQ/outbox，且重试策略必须识别“尚未发送”和“结果未知”。

## 安全与运行约束

1. TCP 不经过 `V8.Http` 的 SSRF 防护。容器网络策略/防火墙只放行目标设备网段和端口；匿名接口不得暴露任意目标。
2. 不把票据正文、设备口令、原始帧和响应秘密写入日志；日志只记录脱敏设备标识、业务单号、字节数、耗时和错误分类。
3. `SendAsync` 只是在当前请求内等待 I/O，不能替代后台任务。不要遗留未等待 Promise、`setTimeout` 或 `Task.Run`。
4. 每次调用都会创建并关闭连接；不能假设设备会保持会话状态。
5. Docker 内的 `localhost` 指容器自身。验收前从实际后端容器验证到设备 IP/端口的路由和出站策略。
6. 载荷、超时和响应均有硬上限；不要通过拆成无限循环规避限制。

## 修改公共能力时的同步门禁

- 源码：`Microi.Server/Microi.V8Engine/Extend/Tcp/V8Tcp.cs` 与 `V8Extend.cs`。
- 测试：真实 Jint 注入、Byte/Base64/Hex/Text、回环收发、超时/上限/非法参数。
- 编辑器：`Microi.Client/.../v8-api-server-definitions.js` 与 `Microi.VSCode/src/editor/typingsManager.ts`。
- 文档与知识：官网中文后端 V8 页面、`microi.skills/README.md`、`v8-utilities` 索引、`Microi.AI/Resource` 镜像和向量资源列表。
- 验收：目标测试、后端构建、精确重启与健康检查、独立 TCP 回环；真实打印机出纸必须单独报告，不能用回环测试替代。

