---
name: v8-tcp-integration
description: Microi 后端 TCP 与通用 IoT 集成规范。用于 V8.Tcp 一次性客户端、V8.IoT.Send 设备原连接下行、可配置拆帧/校验、跨节点路由，以及 MQTT/HTTP 能力选择、设备权限、幂等和真实验收。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi V8 TCP 原始字节集成

使用后端 `V8.Tcp` 完成一次性 TCP 连接、原始字节写入和可选的有界响应读取。典型场景是 RAW/JetDirect 9100 网络小票机、串口服务器和 PLC；具体协议帧、校验码与打印业务仍由接口引擎编排。

文档维护时，只在 `microi.doc/docs/doc/v8-engine/v8-server.md` 原位更新后端 API；不要新建重复页面，也不要手工维护英文文档。改变公共契约时同步后端源码/测试、Microi.Client Monaco 定义、Microi.Agent 类型与生成知识、AI Skill 镜像。

## 先判断是否适用

| 需求 | 选择 |
|---|---|
| 后端向设备 TCP 端口发送原始字节 | `V8.Tcp` |
| HTTP/HTTPS API | `V8.Http`，不要用 TCP 重写 HTTP |
| RabbitMQ/MQTT | `V8.MQ` 或 MQTT 引擎 |
| 浏览器/5+App 蓝牙或 SPP 打印 | 前端 `V8.Print`，读取 `v8-frontend-events/references/bluetooth-print.md` |
| 设备原始 TCP 上报并保持连接等待应答 | API 宿主可选的 `TcpIngressRulesJson` 入站监听；固定租户与接口引擎，协议帧交给接口引擎处理 |
| 设备已主动连接平台，需要发送控制命令 | `V8.IoT.Send`，沿已授权原连接下行；不依赖某个厂家 |
| TLS、任意协议、可由 V8 动态开端口、自定义连接池 | 当前不提供；单独评估安全边界和传输实现 |

平台已经提供可复用原子能力后，打印模板、设备选择、订单状态、幂等和审计优先写在接口引擎/表单事件；不要为单个打印业务再写 C# Controller。

## API 容器内的原始 TCP 入站

`V8.Tcp` 仍然仅是出站客户端。设备只能填主机/IP 与端口、不能发送 HTTP 请求路径时，可在同一个 `Microi.net.Api` 进程启用独立原始 TCP 监听；HTTP 的 `1052` 等端口不变，TCP 必须使用另一个端口。入口由主租户 `sys_osclients.TcpIngressEnable`、`TcpIngressPort` 与 `TcpIngressRulesJson` 配置：启用状态空值/1 允许加载完整规则、0 明确关闭；端口留空时容器内默认 `1885`；规则留空不监听、坏规则只使 TCP `Faulted`。规则 JSON 不得含 `enabled` 或 `listenPort`。运行中每约 30 秒独立回查主库开关，设 `0` 后下一轮关闭 TCP 监听与会话，HTTP 继续；从 `0` 改回空值/1、或修改端口/规则/Key/CIDR，不会热重绑，必须手工重启现有 API 容器。只允许主租户管理员维护，配置不得进入 `V8.OsClientModel` 投影。

入站配置固定 `osClient`、`apiEngineKey`、来源 CIDR、帧头/帧尾、U16BE 长度字段、CRC16/XMODEM 与请求/响应关联区间；独立的 `TcpIngressPort` 固定容器内监听端口。设备报文绝不能决定租户或调用哪个接口引擎。来源网段优先使用已核实的 IPv4 窄网段；确实无法按来源 IP 限制时，只有在规则 JSON 中显式设置 `allowAnySource:true` 且 `allowedCidrs` **仅**为 `["0.0.0.0/0"]` 才允许任意 IPv4 来源。省略/设为 `false` 时，`/0` 不合法；`/0` 也不能与其它网段混写。这是高风险例外，不是默认推荐或设备鉴权。监听器以固定 `_InvokeType=Server` 内部调用已启用的接口引擎，启动时必须验证目标 `StopHttp=1`、`AllowAnonymous=0`，否则 TCP 局部失败关闭、不监听，以免匿名 HTTP 绕过 TCP 来源约束；HTTP API 保持运行。接口引擎接收 `frameHex`，把原始应答字节的十六进制放在 `Data.ResponseFrameHex`；协议明确的失败应答即使业务 `Code=0` 也需要回传。没有合法应答、校验不通过或超时则关闭连接，不制造成功回执。拆包、粘包、连续心跳均须逐帧处理并在原连接回包。

上线顺序：先部署并启动新 API，确认 `sys_config.ServerVersion >= 7.6.16.0` 且旧 `MqttEnable` 空值已迁为 `0`，再通过商城安装/更新 SaaS 包并发布带 `NullValue=1` 的前端；物理迁移不会自动更新旧租户 UI 元数据。新 TCP 包未安装时空规则不监听、HTTP 继续。然后明确设主租户 `TcpIngressEnable=0` 且暂留空规则；核实旧 HTTP 地址没有合法调用方，或先迁移它们，再**仅对目标接口**设置 `StopHttp=1`、`AllowAnonymous=0` 并验证匿名 HTTP 被拒；最后填写完整 TCP 规则、设 `TcpIngressEnable=1`、配置宿主端口及来源策略并重启同一容器。旧 HTTP 仍被使用时不得直接切换。其它厂商的接口与端口不作改动，但 API 容器重启后要逐条回归。

启用前优先限制来源网段与云安全组，设置帧长、连接数和空闲时间上限；CRC、设备号都不是身份认证。经 CLB 时核对后端实际看到的源 IP，且当前不解析 Proxy Protocol v2 报头。全网例外必须有业务接口内的设备身份/授权校验、幂等与异常连接监控；如果协议本身没有不可伪造的设备凭据，应明确记录剩余风险，并在能识别来源时收窄规则及云侧放行。Docker 在同一个 API service 显式增加如 `19011:1885/tcp`（宿主机对外端口:容器内端口）的映射；不要把 `/apiengine/...` URL、HTTP 的 `80/1052` 或 `V8.Tcp.Send` 当作设备端 TCP 监听。新执行的在线一键安装器会在 `61600+` 连续宿主端口段末尾追加 MQTT/TCP 映射；离线默认宿主 `7010/7011`，都映射至 API 容器 `1883/1885` 并尝试放行宿主机防火墙。窄来源方案仍需云安全组/CLB 人工限源；已有 Compose 不会自动补映射，SaaS 内部端口改变后须同步 Compose。TCP 配置、引擎安全位或端口失败时仅 TCP 状态为 `Faulted`，HTTP 仍可健康；验收必须确认 TCP `Listening` 状态/监听日志、端口探测和合法心跳应答，再核对设备数据。只连上端口不能证明已回 ACK；当前没有对外的 TCP 状态 HTTP 端点，不能把 HTTP 健康当成 TCP 就绪。配置、回环测试、设备联调的详细步骤见官网中文后端 V8 页面；本地回环不等于客户真机已联网。

## 已建立 IoT 连接的主动下行

`V8.IoT` 是受限的设备原连接下行扩展。
设备主动连接平台且需要云端控制时，使用 `V8.IoT.Send({DeviceId, CommandId, FrameHex, ExpireSeconds})`，
不能用 `V8.Tcp.Send` 新建连接代替原设备连接。须配套 Core、V8Engine 和 API 宿主更新；
缺失 `TcpIngressRulesJson.downlink` 或 `enabled:false` 时不启用，修改配置后重启现有 API。

`V8.IoT` 负责连接路由与传输状态；操作码、流水号、厂家 HTTP/MQTT 选择、设备权限和回执
放在接口引擎。禁止在 Core/V8Engine 中新增按厂家名、业务表名或设备编号分支。
MQTT 设备继续使用 MQTT 引擎，平台主动连接设备使用 `V8.Tcp`，厂家云接口使用 `V8.Http`。

接入另一协议先读取厂家真实说明，再检查既有 `framing` 描述是否覆盖：

- 省略 `framing` 保持历史 U16BE/XMODEM，不改变既有配置含义。
- 显式 `framing.mode` 支持 `LengthPrefix`、`FixedLength`、`Delimiter`；帧头 0–32 字节、帧尾 0–16 字节。
- `lengthBytes` 为 1/2/4，`lengthByteOrder` 为 BigEndian/LittleEndian；长度加 `lengthAdjustment` 得总帧长。
- `fixedLength` 为固定帧总长；结束符模式必须有帧尾且载荷不含未转义结束符。
- `checksum` 为 Crc16Xmodem/Crc16Modbus/None；`checksumByteOrder` 与 `checksumStartOffset` 可配置。
- 上报地址由 `deviceOffset/deviceLength` 定义；下行偏移可用 `downlinkDeviceOffset`，地址不能与结构字段重叠。
- 普通 ACK 关联规则继续严格执行；主动下行用同一结构描述单独核对设备，不通过缩短关联区间绕过校验。
- 当前每个 API 进程只有一套监听规则；没有单端口多协议自动探测、TLS 或任意转义解码。
  超出能力时补通用适配器，不声称全部协议均已支持；完整配置示例与限制见官网后端 V8 主文档。

```javascript
// 已完成设备行权限/操作权限校验，且业务指令已提交；由受权派发接口调用。
return V8.IoT.Send({
  DeviceId: deviceAddressHex,
  CommandId: committedCommandId,
  FrameHex: completeProtocolFrameHex,
  ExpireSeconds: 30
});
```

- `downlink` 必须声明 `deviceOffset`、`deviceLength` 和 `sendApiEngineKeys`；其余队列、有效期、
  去重、租约和轮询限额见官网中文后端 V8 原页面。新设置继续使用既有 SaaS 规则，不加环境变量。
- 内部上报引擎确认设备身份和绑定后，每个成功响应显式返回 `Data.IoTDeviceId` 及正常
  `Data.ResponseFrameHex`；地址必须与物理帧匹配。ACK 写入后才登记下行连接；明确免应答消息按下文处理。
- 控制接口必须校验当前用户的设备与操作权限；原子从可信执行上下文获取租户、接口 Key、
  登录用户或可信任务身份，并按管理员的 Key 白名单约束调用。禁止透传前端任意报文。
- `DeviceId` 为定长设备地址十六进制，由业务记录映射；`CommandId` 稳定且长期持久去重。
  `FrameHex` 为无分隔符的完整协议帧。仅四个参数允许传入，租户/Host/Port 不接受。
- `Code=1` 只表示接受指令或发现同编号既有指令。`Queued`、`Sending`、`Written`、
  `Unknown`、`Expired` 是传输状态；设备执行结果由协议回执确认。`Sending/Unknown` 禁止换号重发。
- 业务记录/outbox 先提交，再由派发任务调用原子；Redis 和设备动作不能随数据库回滚。
  Redis 队列绑定连接代次，旧连接不能清除新连接租约，已经开始发送的指令不自动重投。
- 保持正常 ACK 的关联规则；主动下行独立校验目标、结构和 CRC，无需缩短原关联长度。
  原 ACK 与控制指令串行写入同一 Socket，重连与 Redis 故障必须覆盖。
- 单元/Socket 回环、真实 Redis 多节点、真实设备回执和物理动作是不同验收层；不得相互替代。

### 多控制功能与免应答回执

- `V8.IoT.Send` 不筛选具体命令/操作码。设备开关、温度/阈值、定时数组、模式、报警提示等，
  共用原子；命令目录、字段宽度/顺序/单位、机型范围和权限由接口引擎编排，不再加厂家专属 C# 方法。
- 区分“报警上报/恢复”“远程报警提示开关”“消音/故障复位”。协议只有上报时，不能虚构清警指令，
  也不能以修改平台报警记录代替设备故障消除。
- 业务记录保存稳定 `CommandId` 与设备流水号映射；回执按设备、回执命令、子码、流水号及长度匹配。
  不同命令的成功码、流水号位置甚至应答命令可能不同，未知值保持未知，不统一写死。
- 温度范围、型号/固件语义或报文长度不明确的动作默认拒绝，等待厂家确认后修改可信配置。
  前端不能上传命令目录、范围、成功码、完整报文或可执行表达式覆盖后端规则。
- 控制回执无需平台再 ACK 时，受保护规则根节点显式配置 `allowNoResponse:true`，内部接口逐帧返回
  `{Code:1,Data:{IoTDeviceId:authorizedAddressHex,ResponseMode:'None'}}`；不提供 `ResponseFrameHex` 属性。
  默认关闭且必须布尔值，更新后重启 API；只有数值 Code=1 和有效帧才接受，仍复核设备授权。
- `None` 表示消息已处理且零字节写回，不能代表设备已执行；缺失响应、空返回、失败或错误模式不能冒充 None。
  正常应答继续使用 `ResponseFrameHex`（可选 `ResponseMode:'Reply'`）；心跳仍按厂家协议正常回 ACK。
- 回归覆盖可变载荷、不同回执格式、回执后继续心跳/控制、授权撤销、无效模式和存量失败 ACK。

## API 契约：一次性 TCP 客户端

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
- 编辑器：`Microi.Client/.../v8-api-server-definitions.js` 与 `Microi.Agent/src/editor/typingsManager.ts`。
- 文档与知识：官网中文后端 V8 页面、`microi.skills/README.md`、`v8-utilities` 索引、`Microi.AI/Resource` 镜像和向量资源列表。
- 验收：目标测试、后端构建、精确重启与健康检查、独立 TCP 回环；真实打印机出纸必须单独报告，不能用回环测试替代。
