# 📡 MQTT 引擎（IoT 物联网）

Microi 吾码 MQTT 引擎不是一个“收到消息后打印日志”的示例，而是一条从设备接入、SaaS 租户隔离、Topic ACL、V8 实时决策，到设备台账、海量数据落库和业务联动的完整 IoT 通道。485、ZigBee、蓝牙、Modbus 等现场协议由网关转换为 MQTT 后，即可进入同一套低代码业务链。

<div class="mci-doc-grid">
  <article class="mci-doc-card">
    <span class="mci-doc-chip">Broker</span>
    <h3>服务内嵌，开箱即用</h3>
    <p>平台随主服务启动 MQTT Broker，支持 TCP、可选 TLS、QoS 0/1/2、Retained Message 与服务端安全下行。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">V8 Events</span>
    <h3>事件即业务入口</h3>
    <p>连接、断开、订阅、上报、保留消息变化和服务启停，都能进入在线接口引擎，无需重新编译后端。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">SaaS ACL</span>
    <h3>租户边界默认收紧</h3>
    <p>租户身份、独立凭据、ClientId 与 Topic 在 Broker 拦截层校验，未知租户和跨租户访问失败关闭。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">Low Code</span>
    <h3>一条消息联动全平台</h3>
    <p>V8 可继续调用 FormEngine、MongoDB、HTTP、接口引擎和通知能力，把遥测、告警、工单与控制指令串起来。</p>
  </article>
</div>

## 一条消息如何穿过吾码

```text
485 / ZigBee / BLE / Modbus 设备
              │  现场网关转换为 MQTT
              ▼
      Microi MQTT Broker（TCP / TLS）
              │  认证、租户解析、Topic ACL
              ▼
    mci_mqtt_client / mci_mqtt_log
              │  设备级或租户级接口引擎
              ▼
        V8.EventName + V8.MQTT
              │
       ┌──────┼────────┬──────────┐
       ▼      ▼        ▼          ▼
  FormEngine MongoDB  V8.Http  V8.ApiEngine
       │      │        │          │
       └──────┴────────┴─────► 告警、工单、报表、下行控制
```

::: info 现场协议与 MQTT 的关系
吾码直接处理的是 MQTT 协议。RS-485、ZigBee、蓝牙、Modbus 等设备通常先接入边缘网关，由网关完成采集、协议解析和 MQTT 发布；吾码负责租户安全、消息路由、业务规则、数据与应用联动。
:::

## 能力全景

| 能力域 | 当前能力 | 适合解决的问题 |
| --- | --- | --- |
| Broker | 内嵌 MQTTnet Broker、TCP 监听、可选 TLS 1.2、QoS 0/1/2、Retain | 快速搭建设备接入入口与双向消息通道 |
| 协议上下文 | JSON 自动解析、原始 UTF-8 文本、MQTT v5 User Properties、Response Topic | 同时兼容结构化遥测、普通文本和链路元数据 |
| 事件编排 | `StartServer`、`Connected`、`Disconnected`、`Subscribing`、`MessageReceived`、`MessageChanged`、`StopServer` | 在线修改设备接入、校验、入库、告警与联动逻辑 |
| SaaS 隔离 | 独立账号密码、租户解析、Topic 规范化、跨租户拒绝、ClientId 冲突拒绝 | 同一 Broker 安全承载多个租户或业务系统 |
| 设备治理 | 自动维护设备在线记录、最后连接时间、设备级接口引擎覆盖 | 不同型号、协议或产线复用不同解析策略 |
| 数据与集成 | FormEngine、关系库、MongoDB、HTTP、接口引擎、通知 | 设备档案、时序数据、ERP/MES 联动、告警与工单 |
| 可观测 | 连接、断开、订阅、接收、启停业务日志与 MQTT 系统诊断 | 定位凭据、端口、Topic ACL、V8 规则和运行异常 |

## 5 分钟接入

### 1. 在 SaaS 引擎配置租户

进入 **系统引擎 → SaaS 引擎 → MQTT 配置**。主租户负责 Broker 监听，主租户和每个需要接入设备的子租户分别维护自己的启用状态、凭据与事件引擎。

| 字段 | 作用 | 配置要点 |
| --- | --- | --- |
| `MqttEnable` | 启用 MQTT | 主租户未启用时 Broker 不启动；子租户未启用时该租户连接被拒绝 |
| `MqttPort` | TCP 监听端口 | 默认 `1883`，只有主租户配置影响 Broker；容器或防火墙还要开放同一端口 |
| `MqttAccount` | MQTT 用户名 | 子租户必须配置自己的完整凭据，不得与其它租户复用 |
| `MqttPwd` | MQTT 密码 | 不写入代码、URL、日志或前端；生产环境使用高强度随机值并制定轮换流程 |
| `MqttApiEngine` | 默认事件接口引擎 | 选择处理该租户 MQTT 事件的接口引擎；历史记录 Id 与当前 `ApiEngineKey` 均可兼容 |

::: details TLS 与高级监听配置

| 字段 | 作用 | 说明 |
| --- | --- | --- |
| `MqttUseTls` | 启用 TLS | 设为 `1` 后开启加密端点 |
| `MqttTlsPort` | TLS 端口 | 默认 `8883`，需要同步开放容器端口与网络入口 |
| `MqttCertPath` | PFX 证书路径 | 填写服务进程或容器内可读取的路径，证书文件应以只读 Secret/持久卷挂载 |
| `MqttCertPassword` | 证书密码 | 属于基础设施秘密，只在可信后端维护 |
| `MqttFallbackPort` | Windows 备用端口 | 主端口因权限问题无法绑定时使用；未配置时平台回退到 `21883` |

当前内嵌 Broker 的有效监听入口是 TCP 与可选 TLS。SaaS 元数据中隐藏的 `MqttWsPort` 是保留字段，当前版本不要把它当作已启用的 WebSocket 监听端口。

:::

### 2. 创建事件接口引擎

创建一个后端接口引擎，例如 `iot_mqtt_event`，再把它选入 `MqttApiEngine`。MQTT 运行时会向接口引擎注入：

```javascript
V8.EventName  // 当前 MQTT 事件名
V8.MQTT       // 当前事件上下文
```

平台启动后再启动 Broker，确保依赖注入与 V8 引擎已经就绪。修改主租户监听端口、TLS 或 Broker 启停配置后需要重启对应 MQTT 节点；只修改接口引擎代码则保存后即可按接口引擎缓存规则生效。

### 3. 让设备连接

推荐把租户同时放进用户名与 ClientId 前缀，便于旧版 MQTT 客户端稳定识别租户，也能降低共享 Broker 上的 ClientId 冲突风险。

```text
Host       = <MQTT 对外入口>
Port       = <MqttPort，默认 1883>
ClientId   = factory-a:temperature-0001
Username   = factory-a:<MqttAccount>
Password   = <MqttPwd>
Publish    = sensor/temperature
Subscribe  = device/temperature-0001/command
```

平台会把业务 Topic 规范化为：

```text
tenant/factory-a/sensor/temperature
tenant/factory-a/device/temperature-0001/command
```

租户也可以通过 MQTT v5 连接 User Property `OsClient` 传入。若 User Property、Username 前缀与 ClientId 前缀同时出现，它们必须指向同一租户；显式未知租户不会回退到主租户。

## Topic 规则与访问边界

| 输入 | 处理结果 |
| --- | --- |
| `sensor/temperature` | 自动变为 `tenant/<lowerOsClient>/sensor/temperature` |
| `tenant/<当前租户>/sensor/temperature` | 保留当前租户前缀并继续校验 |
| `<当前租户>/sensor/temperature` | 兼容旧格式并规范为标准租户前缀 |
| `tenant/<其它租户>/...` | 拒绝 |
| `$SYS/...`、`$share/...` | 拒绝，不能借系统 Topic 或共享订阅绕过租户边界 |
| 发布 Topic 含 `+` 或 `#` | 拒绝；发布不能使用通配符 |
| 订阅 `sensor/+/state`、`sensor/#` | 允许合法通配符，并始终限制在当前租户前缀内 |

服务端下行的 Topic、MQTT v5 `ResponseTopic` 与 Retained Message 也走同一套规范化。子租户不能通过关闭 `MqttTopicIsolation` 或开启匿名访问绕过边界。

::: warning 生产安全底线
子租户必须使用独立且完整的 `MqttAccount` / `MqttPwd`；账号或密码与其它租户重复、凭据不完整、租户未启用、ClientId 跨租户冲突都会拒绝连接。匿名连接只可能由主租户显式开启，生产环境不建议启用。
:::

## 事件与上下文

### 事件矩阵

| `V8.EventName` | 触发时机 | 典型用途 |
| --- | --- | --- |
| `StartServer` | Broker 启动成功后 | 初始化规则、记录服务状态、预热业务数据 |
| `Connected` | 设备通过认证并连接后 | 绑定设备、更新业务在线状态、加载设备专属处理器 |
| `Disconnected` | 当前有效连接断开后 | 更新下线时间、触发离线告警；旧连接的延迟断开不会误删新会话 |
| `Subscribing` | 订阅 Topic 通过 ACL 后 | 记录订阅行为、做业务审计 |
| `MessageReceived` | 发布消息通过租户与 Topic 校验后 | 解析、校验、落库、告警；可用 `Code != 1` 阻止向订阅者广播 |
| `MessageChanged` | Retained Message 发生变化后 | 同步设备最新配置、状态快照或期望值 |
| `StopServer` | Broker 正常停止后 | 记录停机、清理业务状态、通知运维 |

`StartServer` 与 `StopServer` 会对所有已启用且配置了 `MqttApiEngine` 的租户触发；设备事件只进入当前连接所属租户。设备配置了专属接口引擎时，设备事件优先使用专属引擎。

### `V8.MQTT` 字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ClientId` | `string` | 当前设备或客户端 Id |
| `OsClient` | `string` | Broker 已校验的租户标识，不要从 Payload 重新信任租户 |
| `Topic` | `string` | 已规范化后的完整 Topic |
| `Payload` | `object / string` | JSON 文本自动解析为对象；解析失败时为原始字符串 |
| `PayloadRaw` | `string` | 原始 UTF-8 文本，便于验签、审计或兼容非 JSON 载荷 |
| `UserName` | `string` | `Connected` 事件中的连接用户名 |
| `Qos` | `number` | 当前消息 QoS：`0`、`1` 或 `2` |
| `Retain` | `boolean` | 是否为保留消息 |
| `UserProperties` | `object` | MQTT v5 User Properties；没有时为空 |

并非每个事件都有全部字段。例如服务启停没有设备信息，连接事件没有 Payload；业务代码应按 `V8.EventName` 使用对应字段。

## 完整 V8 示例：温度遥测与告警

以下示例假设已创建 `iot_device` 设备表和 `iot_alarm_dispatch` 告警接口。平台内置的 `mci_mqtt_client` 已负责基础在线记录，业务表只维护应用需要的状态。

::: details 展开查看接口引擎代码

```javascript
var eventName = V8.EventName;
var mqtt = V8.MQTT || {};

if (eventName === 'StartServer') {
  console.log('当前租户 MQTT 事件引擎已启动：' + V8.OsClient);
  return { Code: 1 };
}

if (eventName === 'Connected') {
  return V8.FormEngine.UptFormDataByWhere('iot_device', {
    _Where: [['DeviceCode', '=', mqtt.ClientId]],
    OnlineStatus: 1,
    LastOnlineTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
}

if (eventName === 'Disconnected') {
  return V8.FormEngine.UptFormDataByWhere('iot_device', {
    _Where: [['DeviceCode', '=', mqtt.ClientId]],
    OnlineStatus: 0,
    LastOfflineTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
}

if (eventName === 'Subscribing') {
  console.log('设备订阅：' + mqtt.ClientId + ' -> ' + mqtt.Topic);
  return { Code: 1 };
}

if (eventName === 'MessageReceived') {
  var data = mqtt.Payload;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (ex) {
      return { Code: 0, Msg: 'Payload 必须是合法 JSON。' };
    }
  }

  if (!data || data.temperature === undefined) {
    return { Code: 0, Msg: '缺少 temperature。' };
  }

  var temperature = Number(data.temperature);
  if (isNaN(temperature) || temperature < -80 || temperature > 200) {
    return { Code: 0, Msg: 'temperature 超出允许范围。' };
  }

  var saveResult = V8.MongoDb.AddFormData({
    DbName: 'iot_data',
    TableName: 'telemetry_' + DateNow('yyyy_MM'),
    _FormData: {
      EventId: data.eventId || V8.Method.NewUlid(),
      OsClient: mqtt.OsClient,
      DeviceId: mqtt.ClientId,
      Topic: mqtt.Topic,
      Temperature: temperature,
      Qos: mqtt.Qos,
      Retain: mqtt.Retain,
      PayloadRaw: mqtt.PayloadRaw,
      CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
    }
  });
  if (!saveResult || saveResult.Code !== 1) return saveResult;

  if (temperature >= 80) {
    var alarmResult = V8.ApiEngine.Run('iot_alarm_dispatch', {
      eventId: data.eventId,
      deviceId: mqtt.ClientId,
      alarmType: 'temperature',
      value: temperature
    });
    if (!alarmResult || alarmResult.Code !== 1) return alarmResult;
  }

  return { Code: 1, Msg: '遥测已接收。' };
}

if (eventName === 'MessageChanged') {
  console.log('Retained Message 已变化：' + mqtt.Topic);
  return { Code: 1 };
}

if (eventName === 'StopServer') {
  console.log('当前租户 MQTT 事件引擎已停止：' + V8.OsClient);
  return { Code: 1 };
}

return { Code: 0, Msg: '未识别的 MQTT 事件：' + eventName };
```

:::

::: tip `MessageReceived` 的放行语义
接口引擎无返回值、返回普通字符串/数字或显式返回 `Code: 1` 时继续广播；显式返回 `Code != 1` 时阻止消息发给订阅者。已配置的事件引擎执行异常也会失败关闭。接收日志在 V8 规则执行前写入，因此被规则拒绝的消息仍保留审计记录。
:::

## 设备级接口引擎：不同设备走不同解析器

平台自动维护两个基础表：

| 表 | 自动维护内容 | 建议用途 |
| --- | --- | --- |
| `mci_mqtt_client` | `ClientId`、`IsOnline`、`LastConnectTime`、设备级 `ApiEngineId` | 设备接入台账与路由配置 |
| `mci_mqtt_log` | `ServerStart`、`ServerStop`、`Connect`、`Disconnect`、`Subscribe`、`Receive` | 审计、排障和短周期运行记录 |

租户默认走 `sys_osclients.MqttApiEngine`。如果在 `mci_mqtt_client.ApiEngineId` 为某台设备选择专属接口引擎，该设备连接后会优先走设备级处理器，适合：

- 温度传感器、继电器、摄像头网关分别使用不同 Payload 解析逻辑；
- 新旧硬件协议并行迁移；
- 特殊产线增加额外校验，不污染租户通用引擎；
- 灰度验证新解析器，只让少量设备先接入。

设备级配置会在连接时进入当前节点缓存，修改 `ApiEngineId` 后应让设备重新连接以刷新。历史 JoinForm 保存的 GUID/ULID 记录 Id 会在运行时解析为真实 `ApiEngineKey`，新配置直接保存 Key。

## 数据怎么放：状态、遥测、附件分层

<div class="mci-doc-grid">
  <article class="mci-doc-card">
    <span class="mci-doc-chip">关系数据库</span>
    <h3>设备与业务事实</h3>
    <p>设备档案、阈值、归属、工单、告警状态等需要事务和后台维护的数据，优先使用 FormEngine 标准表。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">MongoDB</span>
    <h3>高频遥测与分区</h3>
    <p>高频采样按月份、设备类型或业务域分库分集合，保留稳定 EventId，避免把海量时序明细压进业务关系表。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">对象存储</span>
    <h3>图片、音频与固件</h3>
    <p>大载荷先进入受控文件服务或对象存储，MQTT 只传文件标识、哈希、状态和业务元数据，不在消息里长期搬运大文件。</p>
  </article>
</div>

`mci_mqtt_log` 用于运行审计，不应代替长期遥测仓。高频场景必须设计日志保留与归档策略，并用真实消息大小、QoS、V8 耗时和落库方式做容量测试；案例规模不能直接当作任意部署的性能承诺。

## 服务端安全下行

可信后端可通过 `IMicroiMQTT` 向设备发布命令。必须使用带 `osClient` 的重载，Topic 会在服务端强制收敛到该租户命名空间；没有租户上下文的旧重载会直接拒绝。

```csharp
await mqttService.PublishAsync(
    osClient,
    $"device/{deviceId}/command",
    JsonConvert.SerializeObject(new { Action = "restart", EventId = eventId }),
    qos: 1,
    retain: false);
```

当前公开的 `V8.MQTT` 是 MQTT 事件上下文，不是通用发布函数。若业务需要让接口引擎发起下行，应先由平台提供最小、租户隔离且不可覆盖密钥的安全原子能力，再由接口引擎编排权限、幂等、状态机与审计；不要开放匿名 Controller 绕过边界。

## 部署与集群边界

### 单节点或独立 MQTT 节点

- 主租户 `MqttEnable=1` 后，Broker 在应用完全启动后监听 `MqttPort`；容器部署需要显式映射端口。
- TLS 证书使用只读挂载，轮换后重启 MQTT 节点重建监听。
- `ConnectedClients` 与管理状态接口只代表当前 MQTT 节点，适合诊断，不是集群全局在线事实。
- 设备在线业务判断应结合共享数据库中的最后心跳、超时窗口与设备状态机；进程崩溃时不能只相信一次 `Disconnected` 事件。

### 多 API 节点生产部署

内嵌 Broker 的会话、订阅、Retained Message 与连接快照不在 API 节点间自动共享。不要让负载均衡后的每个 API 节点各自启动一套独立 Broker，再把它们误认为一个集群。

生产可选择：

1. 把内嵌 Broker 固定到独立 MQTT 节点，并让 MQTT TCP/TLS 入口稳定路由到该节点；
2. 使用支持持久化和集群的外部 Broker，再通过租户感知的 MQTT 网关/适配器进入吾码事件链；
3. 所有业务副作用使用稳定 `EventId`、数据库唯一约束、inbox/outbox 或条件更新实现幂等，不能只依赖 QoS 或连接状态。

若要求节点强杀或掉电窗口内也零丢失，必须在返回成功前获得外部 Broker 持久化、共享 outbox 或同步 WAL 的确认；内存状态和“随后异步写库”不能覆盖该窗口。

## 运维与验收清单

### 日常观察

| 入口 | 能看到什么 | 边界 |
| --- | --- | --- |
| `mci_mqtt_client` | 设备、最后连接时间、基础在线状态、专属引擎 | 异常掉电后需结合心跳超时判断 |
| `mci_mqtt_log` | 启停、连接、断开、订阅、接收记录 | 需要保留、归档与容量策略 |
| 系统日志 `Type=MQTT` | 端口占用、凭据拒绝、Topic ACL、V8 异常等诊断 | 不记录明文密码或证书密码 |
| MQTT 管理状态接口 | `IsRunning`、当前租户、当前节点连接快照 | 仅平台管理员、仅当前节点 |

### 上线前至少验证

- [ ] 主租户启用后 TCP 端口真实监听；TLS 启用时证书链和 TLS 端口可用。
- [ ] 正确租户凭据能连接，错误密码、未知租户、未启用租户和重复跨租户凭据均被拒绝。
- [ ] 业务 Topic 自动增加当前租户前缀，访问其它租户、`$SYS`、`$share` 被拒绝。
- [ ] `Connected`、`Subscribing`、`MessageReceived`、`MessageChanged`、`Disconnected` 的上下文字段符合预期。
- [ ] `MessageReceived` 返回 `Code: 0` 时订阅端收不到该消息，日志中能看到拒绝原因。
- [ ] JSON 与普通 UTF-8 文本 Payload 均按预期处理，非法数据不会写入业务表。
- [ ] QoS 0/1/2、Retain、Response Topic 与合法通配订阅按业务策略验证。
- [ ] 同一 ClientId 快速重连时，新会话不会被旧连接的延迟断开误判为离线。
- [ ] 重复消息、接口超时、数据库短暂故障、节点重启后，业务副作用仍保持幂等。
- [ ] 多节点部署验证连接入口、共享状态与故障转移，不把单节点快照当作全局事实。
- [ ] 高峰消息量下检查 Broker、V8、关系库、MongoDB 与日志保留的 CPU、内存、延迟和磁盘增长。

## 常见问题

::: details 子租户已经启用 MQTT，为什么仍然连不上？
先确认主租户已启用并让 Broker 成功启动，再确认子租户有独立的完整账号密码、`MqttApiEngine` 和正确的租户前缀。子租户配置自己的 `MqttPort` 不会新开一个 Broker 端口。
:::

::: details 为什么 V8 中看到的 Topic 多了 `tenant/<osClient>/`？
这是平台在 Broker 层完成的标准化结果，用于强制租户隔离。业务代码应基于规范化后的完整 Topic 判断，或只比较稳定的业务后缀。
:::

::: details 为什么修改设备专属接口引擎后没有立即切换？
设备级 `ApiEngineId` 在连接时进入当前节点缓存。保存配置后让设备重新连接，再检查 `Connected` 日志与实际事件引擎。
:::

::: details 浏览器能否直接连接隐藏的 `MqttWsPort`？
当前内嵌 Broker 没有启用 WebSocket 监听，不能仅靠填写 `MqttWsPort` 获得浏览器 MQTT 连接。需要浏览器接入时，应部署经过鉴权和租户隔离设计的 WebSocket MQTT 网关，并单独完成安全与集群验收。
:::

## 继续阅读

- [SaaS 引擎：租户配置与基础设施边界](/doc/system-engine/saas-engine)
- [接口引擎：在线编写后端业务逻辑](/doc/v8-engine/api-engine)
- [后端 V8 API：FormEngine、MongoDB、HTTP 等能力](/doc/v8-engine/v8-server)
- [消息队列：RabbitMQ 异步任务与 MQTT 实时设备通道的区别](/doc/system-engine/mq)
- [物联网项目案例](/case/iot/iot-case1)
