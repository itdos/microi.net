# Microi MQTT 生产参考

本参考用于设计或审查 Microi MQTT 配置、事件接口引擎、设备路由、服务端下行、
安全边界和生产部署。优先以目标版本源码与实际租户元数据为准；旧部署可能尚未
具备本文列出的全部字段或行为。

## 目录

- [事实源与适用边界](#事实源与适用边界)
- [接入架构与协议边界](#接入架构与协议边界)
- [SaaS 配置矩阵](#saas-配置矩阵)
- [租户识别与连接认证](#租户识别与连接认证)
- [Topic ACL 与规范化](#topic-acl-与规范化)
- [事件与字段可用性](#事件与字段可用性)
- [V8 返回值和失败关闭](#v8-返回值和失败关闭)
- [设备级接口引擎](#设备级接口引擎)
- [安全的遥测处理模式](#安全的遥测处理模式)
- [服务端安全下行](#服务端安全下行)
- [数据分层与可观测性](#数据分层与可观测性)
- [单节点与多节点部署](#单节点与多节点部署)
- [上线验收清单](#上线验收清单)
- [自动覆盖检查的证据边界](#自动覆盖检查的证据边界)

## 事实源与适用边界

按以下顺序确认当前能力，不要仅凭示例或历史文档推断：

1. `Microi.Server/Microi.Core/Model/MqttParam.cs`：`V8.MQTT` 可用字段。
2. `Microi.Server/Microi.MQTT/MicroiMQTT.cs`：Broker、认证、Topic ACL、事件、
   返回值、设备缓存和日志的真实行为。
3. `Microi.Server/Microi.Core/SaaSEngine/TenantConfigurationSecurity.cs`：共享监听
   配置、租户凭据、Topic 规范化和敏感字段边界。
4. `Microi.Server/Microi.Core/Interface/IMicroiMQTT.cs`：
   `IMicroiMQTT.PublishAsync(osClient, ...)` 可信后端发布和节点状态接口。
5. `Microi.Server/Microi.net.Api/Controllers/MqttController.cs`：平台管理员、当前节点
   状态与示例下行入口的权限边界。
6. `microi.doc/docs/doc/system-engine/mqtt-engine.md`：面向用户的完整能力说明。

目标服务器可能落后于当前源码。编写事件代码前回读其 `sys_osclients` 字段和运行
版本；缺少字段时走官方应用包/版本升级，不要在 V8 中伪造配置。

## 接入架构与协议边界

Microi 当前直接处理 MQTT，不直接解析 RS-485、ZigBee、BLE 或 Modbus 帧：

```text
现场设备 -> 边缘网关/协议转换 -> MQTT TCP/TLS -> Microi Broker
         -> 租户认证与 Topic ACL -> mci_mqtt_client / mci_mqtt_log
         -> V8.EventName + V8.MQTT -> 业务表、MongoDB、HTTP、告警、工单
```

边缘网关负责现场总线、采样与协议解析；Microi 负责租户边界、实时业务规则、数据
治理和应用联动。浏览器 MQTT 需要独立的 WebSocket MQTT 网关；当前隐藏元数据
`MqttWsPort` 不代表内嵌 Broker 已启用 WebSocket。

## SaaS 配置矩阵

| 字段 | 作用域 | 当前行为与默认值 | 变更生效 |
| --- | --- | --- | --- |
| `MqttEnable` | 每租户 | 主租户为 `1` 才启动 Broker；子租户为 `1` 才允许其连接 | 启停监听需重启 MQTT 节点 |
| `MqttPort` | 主租户共享 | TCP 监听端口，默认 `1883` | 重启 MQTT 节点 |
| `MqttUseTls` | 主租户共享 | `1` 时尝试启用 TLS 端点 | 重启 MQTT 节点 |
| `MqttTlsPort` | 主租户共享 | TLS 端口，默认 `8883` | 重启 MQTT 节点 |
| `MqttCertPath` | 主租户共享 | 进程/容器内可读的 PFX 路径 | 挂载证书后重启 |
| `MqttCertPassword` | 主租户共享秘密 | PFX 密码，只允许可信后端读取 | 轮换后重启 |
| `MqttFallbackPort` | 主租户运行时 | Windows 主端口被拒绝时使用；无有效配置则 `21883` | 重启 MQTT 节点 |
| `MqttWsPort` | 保留元数据 | 当前未创建 WebSocket 监听 | 不得宣称已生效 |
| `MqttAccount` | 每租户凭据 | 子租户必须独立、完整，不能与其它租户账号重复 | 新连接使用新值 |
| `MqttPwd` | 每租户秘密 | 子租户必须独立、完整，不能与其它租户密码重复 | 新连接使用新值 |
| `MqttApiEngine` | 每租户 | 默认 MQTT 事件接口引擎；兼容历史 GUID/ULID Id 和当前 `ApiEngineKey` | 按接口引擎缓存规则 |
| `MqttAllowAnonymous` | 仅主租户兼容 | 只有主租户显式为 `1` 才可能匿名；生产不建议 | 新连接使用新值 |
| `MqttTopicIsolation` | 兼容元数据 | 不能关闭强制租户 Topic ACL，子租户设为 `0` 也不放宽 | 无放宽语义 |

把 PFX 以只读 Secret/持久卷挂载，不把证书密码、MQTT 密码写入代码、URL、日志、
前端或普通 V8。运行时读取了某字段不等于所有历史数据库都已经拥有该字段；部署前
必须回读目标表结构。

当前 `MqttUseTls=1` 是在默认明文 TCP 端点之外增加 TLS 1.2 端点，不是 TLS-only
模式；证书路径无效时会写诊断，但默认 TCP Broker 仍可能启动。要求强制加密时，
除验证 TLS 握手外，还要在防火墙/入口层关闭公网明文端口，不能只看 `IsRunning`。

## 租户识别与连接认证

连接验证按以下优先级解析租户：

1. MQTT v5 User Property `OsClient`；
2. Username 的 `<OsClient>:<MqttAccount>` 前缀；
3. ClientId 的 `<OsClient>:<设备Id>` 前缀；
4. 旧主租户客户端仅在 Username 精确等于主租户 `MqttAccount` 时兼容。

同时提供多个来源时必须全部指向同一租户。显式未知租户、未启用租户、空/非法
ClientId、错误密码和跨租户 ClientId 冲突均失败关闭，不回退主租户。

子租户还必须满足：

- 账号与密码都非空；
- 账号不能与任一其它租户账号相同；
- 密码不能与任一其它租户密码相同；
- 不能通过 `MqttAllowAnonymous=1` 或 `MqttTopicIsolation=0` 绕过边界。

凭据使用常量时间字符串比较。不要在 Payload 中传一个 `OsClient` 后自行切换租户；
业务代码只信任 `V8.MQTT.OsClient`。

同一 ClientId 快速重连时，每次有效连接持有独立会话令牌。旧连接的延迟
`Disconnected` 会被记录为 `StaleDisconnectIgnored`，不会删除替代连接的租户映射
或错误标记新会话下线。

## Topic ACL 与规范化

业务 Topic 会被收敛为：

```text
tenant/{lowerOsClient}/{businessTopic}
```

| 输入 | 结果 |
| --- | --- |
| `sensor/temperature` | 自动加当前租户前缀 |
| `tenant/<当前租户>/sensor/temperature` | 保留并规范化租户大小写 |
| `<当前租户>/sensor/temperature` | 兼容旧前缀并转为标准格式 |
| `tenant/<其它租户>/...` | 拒绝 |
| `$SYS/...`、`$share/...` | 拒绝 |
| 发布 Topic 包含 `+` 或 `#` | 拒绝 |
| 订阅 `sensor/+/state` 或 `sensor/#` | 允许合法完整段通配符并加租户前缀 |
| 包含控制字符、反斜杠、`//`、`.` 或 `..` 路径段 | 拒绝 |

发布、订阅、Retained Message、可信后端下行和 MQTT v5 `ResponseTopic` 都执行同一
租户边界。`#` 只能是订阅的最后一个完整段，`+` 只能作为完整段。

## 事件与字段可用性

| `V8.EventName` | 触发时机 | 主要字段 | 返回值影响 |
| --- | --- | --- | --- |
| `StartServer` | Broker 成功启动后，逐个启用且配置引擎的租户 | `OsClient` | 不改变启动结果 |
| `Connected` | 认证成功、设备表/日志更新后 | `ClientId`、`OsClient`、`UserName`、`UserProperties` | 不能否决连接 |
| `Disconnected` | 当前有效会话断开、设备表/日志更新后 | `ClientId`、`OsClient`、`UserProperties` | 不能否决断开 |
| `Subscribing` | Topic ACL 已通过、订阅日志写入后 | `ClientId`、`OsClient`、`Topic`、`UserProperties` | 不能否决订阅 |
| `MessageReceived` | 发布 Topic 通过 ACL、接收日志写入后 | `ClientId`、`OsClient`、`Topic`、`Payload`、`PayloadRaw`、`Qos`、`Retain`、`UserProperties` | `Code != 1` 阻止广播 |
| `MessageChanged` | Retained Message 变化并通过 ACL 后 | `ClientId`、`OsClient`、`Topic`、`Payload`、`PayloadRaw`、`Qos`、`Retain` | 返回值不改变结果 |
| `StopServer` | Broker 正常停止后，逐个启用且配置引擎的租户 | `OsClient` | 不改变停止结果 |

`V8.MQTT` 完整模型：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ClientId` | `string` | 设备/客户端 Id |
| `Payload` | `object / string` | JSON 自动反序列化；失败时为原始字符串 |
| `PayloadRaw` | `string` | 原始 UTF-8 文本，适合验签与审计 |
| `Topic` | `string` | 已规范化的完整 Topic |
| `OsClient` | `string` | 已校验租户 |
| `UserName` | `string` | 连接用户名，仅部分事件有值 |
| `Qos` | `number` | `0`、`1`、`2` |
| `Retain` | `boolean` | Retain 标记 |
| `UserProperties` | `object` | MQTT v5 用户属性；没有时为空 |

按事件读取字段，不要假设生命周期事件也有 ClientId/Payload，或连接事件已有 Topic。

## V8 返回值和失败关闭

只有 `MessageReceived` 把接口引擎返回值作为发布策略：

- `null`/无返回值：放行；
- 字符串、数字等普通历史返回值：放行；
- 没有 `Code` 的对象：放行；
- `Code: 1`：放行；
- 显式 `Code != 1`：阻止向订阅者广播并写系统诊断；
- 已配置的事件引擎执行异常：归一为 `Code: 0`，失败关闭。

没有配置 `MqttApiEngine` 时不存在 V8 策略闸门，Broker 仍只执行内置认证与 Topic
ACL。接收日志在 V8 执行前进入 `mci_mqtt_log`，因此规则拒绝的消息仍可审计。

`Connected`、`Disconnected`、`Subscribing`、`MessageChanged` 和生命周期事件是业务
观察/联动入口，当前返回值不会反向改变底层协议动作。不要误写“在 `Connected`
返回 `Code: 0` 即可拒绝连接”或“在 `Subscribing` 返回失败即可拒绝订阅”。

## 设备级接口引擎

`mci_mqtt_client.ApiEngineId` 可覆盖租户 `sys_osclients.MqttApiEngine`。连接时平台：

1. 新增或更新 `ClientId`、`LastConnectTime`、`IsOnline`；
2. 把已有设备 `ApiEngineId` 放进当前节点缓存；
3. 优先使用设备引擎处理当前连接期间的 MQTT 事件；
4. 缺少设备引擎时回退租户默认引擎。

历史 JoinForm 配置可能保存 `sys_apiengine.Id`（GUID/ULID）；运行时会解析为真实
`ApiEngineKey`。新配置优先保存 Key。

设备级缓存是当前节点、当前连接的优化，不是共享事实。修改 `ApiEngineId` 后让设备
重新连接。当前源码在有效断开时先移除连接与设备引擎缓存，因此
`Disconnected` 事件会走租户默认引擎；需要设备专属离线业务时，在租户默认引擎
按 `ClientId` 查询设备配置，不要假设断开事件仍持有设备缓存。

## 安全的遥测处理模式

```javascript
var mqtt = V8.MQTT || {};

if (V8.EventName !== 'MessageReceived') {
  return { Code: 1 };
}

var data = mqtt.Payload;
if (typeof data === 'string') {
  try {
    data = JSON.parse(data);
  } catch (ex) {
    return { Code: 0, Msg: 'Payload 必须是合法 JSON。' };
  }
}

if (!data || !data.eventId) {
  return { Code: 0, Msg: '缺少稳定的 eventId。' };
}

var temperature = Number(data.temperature);
if (isNaN(temperature) || temperature < -80 || temperature > 200) {
  return { Code: 0, Msg: 'temperature 超出允许范围。' };
}

// iot_telemetry_ingest 必须按 mqtt.OsClient + data.eventId 做唯一约束/inbox 去重。
var result = V8.ApiEngine.Run('iot_telemetry_ingest', {
  eventId: data.eventId,
  osClient: mqtt.OsClient,
  clientId: mqtt.ClientId,
  topic: mqtt.Topic,
  temperature: temperature,
  qos: mqtt.Qos,
  retain: mqtt.Retain,
  payloadRaw: mqtt.PayloadRaw
});

return result && result.Code === 1
  ? { Code: 1 }
  : { Code: 0, Msg: (result && result.Msg) || '遥测处理失败。' };
```

不要在重试时用 `NewUlid()` 重新生成业务幂等键。稳定 `EventId` 应由设备/网关生成，
或由网关基于设备序列号、消息序号和采样时间确定性构造。消费端仍需数据库唯一约束、
inbox/outbox、状态机或条件更新，QoS 2 也不能代替业务幂等。

## 服务端安全下行

可信后端只调用带租户上下文的接口：

```csharp
await mqttService.PublishAsync(
    osClient,
    $"device/{deviceId}/command",
    JsonConvert.SerializeObject(new { Action = "restart", EventId = eventId }),
    qos: 1,
    retain: false);
```

运行时会规范化 Topic、`ResponseTopic`，覆盖 User Property 中的 `OsClient`，并用内部
租户 SenderClientId 注入消息。缺少 `osClient` 的旧原生重载会直接抛错拒绝。

`V8.MQTT` 是只读事件上下文，不是 `Publish` API。若需要 V8 下行，先在 C# 提供
最小、租户隔离、不可覆盖基础设施秘密的原子能力，再由接口引擎做菜单/表/行权限、
状态机、稳定 EventId、审计和业务编排；不要开放匿名通用发布 Controller。

## 数据分层与可观测性

| 数据 | 推荐位置 | 原因 |
| --- | --- | --- |
| 设备档案、阈值、归属、工单、告警状态 | FormEngine/关系库 | 需要事务、权限和后台维护 |
| 高频遥测、采样序列 | MongoDB/专用时序存储 | 便于分区、保留和批量查询 |
| 图片、音频、固件、大文件 | 对象存储/文件服务 | MQTT 只传文件 Id、哈希和元数据 |
| Broker 运行审计 | `mci_mqtt_log` | 排障，不代替长期遥测仓 |
| 当前设备接入台账 | `mci_mqtt_client` | 最后连接、基础在线状态、设备引擎 |

系统日志 `Type=MQTT` 记录端口占用、TLS、认证拒绝、Topic ACL、V8 异常和旧连接
断开忽略等诊断。当前 `mci_mqtt_log` 的 `Receive` 审计会保存解析后的 Payload 与
`PayloadRaw`；不要在 MQTT Payload 携带密码、Token 等秘密，并为该表配置严格权限、
脱敏、保留、归档和容量策略。日志/设备表写入失败只记录告警，不会停止消息主流程，
因此它们不能单独作为“消息一定持久化”的证明。

`mci_mqtt_client.IsOnline` 只能反映运行时最后写入的基础状态。节点崩溃不会保证
产生 `Disconnected`；业务在线判断应结合共享数据库中的心跳、最后活动时间、超时
窗口和设备状态机。

## 单节点与多节点部署

### 单节点或独立 MQTT 节点

- 显式映射 `MqttPort` 和 `MqttTlsPort`，开放防火墙/负载入口。
- 把证书挂载为只读文件；轮换后重启 MQTT 节点。
- 把 MQTT TCP/TLS 流量稳定路由到该节点，不要求 HTTP 会话粘滞来保证业务正确。
- `GetConnectedClients(osClient)` 和管理状态接口只用于当前节点诊断。

### 多 API 节点

内嵌 Broker 的连接、会话、订阅、Retained Message 和内存缓存不会跨 API 节点共享。
不要让负载均衡后的每个 API 节点各启动一套 Broker，再宣称它们组成一个集群。

选择以下一种生产架构：

1. 仅在独立 MQTT 节点启用内嵌 Broker，TCP/TLS 入口固定路由到该节点；
2. 使用支持持久化与集群的外部 Broker，并通过租户感知网关/适配器进入 Microi
   事件链；外部 Broker 本身不会自动触发当前进程内 `V8.MQTT`；
3. 所有业务副作用使用稳定 EventId、数据库唯一约束、inbox/outbox 和条件更新。

若要求掉电或强杀窗口内零丢失，必须在返回成功前获得外部 Broker 持久化、共享
outbox 或同步 WAL 的确认；内存状态与异步稍后写库不能覆盖该窗口。

## 上线验收清单

- [ ] 主租户启用后 TCP 端口真实监听；TLS 证书链、端口和客户端握手真实可用。
- [ ] 正确凭据连接成功；错误密码、未知/未启用租户、凭据碰撞均被拒绝。
- [ ] 多租户来源冲突、跨租户 ClientId、空或非法 ClientId 被拒绝。
- [ ] 普通 Topic 自动加租户前缀；其它租户、`$SYS`、`$share`、非法路径被拒绝。
- [ ] 合法订阅通配符、QoS 0/1/2、Retain、`ResponseTopic` 按预期工作。
- [ ] 七类事件按实际触发时机进入正确租户，字段可用性与本参考一致。
- [ ] `MessageReceived` 返回 `Code: 0` 或执行异常时订阅端收不到广播，审计仍存在。
- [ ] JSON 与 UTF-8 文本载荷都按策略处理，非法载荷不会写业务表。
- [ ] 设备级 `ApiEngineId` 重连后生效，历史 Id 能解析为 `ApiEngineKey`。
- [ ] 同一 ClientId 快速重连时，旧断开不会把新连接标记为离线。
- [ ] 可信后端下行被强制限制在当前租户 Topic，旧无租户重载被拒绝。
- [ ] 重复消息、接口超时、数据库短故障、节点重启后，业务副作用仍然至多一次。
- [ ] 多节点场景验证入口路由、故障转移与共享业务状态，不把节点快照当全局事实。
- [ ] 峰值压测记录 Broker、V8、关系库/MongoDB、日志的 CPU、内存、延迟与磁盘增长。

静态源码、自动测试、本地 Broker、生产网络和真实硬件属于不同证据层。未执行某一层
时必须明确说明，不能用另一层的成功替代。

## 自动覆盖检查的证据边界

运行：

```powershell
node microi.skills/v8-mq-mqtt/scripts/check-mqtt-skill-coverage.mjs
```

脚本验证当前源码提取到的 MQTT 事件与 `MqttParam` 属性都出现在主 Skill、生产参考、
官网 MQTT 文档和 V8 后端索引中，并检查配置、安全、设备路由、下行、节点状态与
部署关键字。它不能证明：

- 字段已升级到某台目标服务器；
- Broker 已监听或证书有效；
- 外部 Broker/网关适配器已实现；
- V8 示例在目标表结构上运行成功；
- 真实设备、网络抖动、吞吐、掉电和多节点故障转移已经实测。
