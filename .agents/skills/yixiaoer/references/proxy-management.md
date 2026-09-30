# 代理管理 (Proxy Management)

获取租户下的代理列表，并为特定账号配置代理。云发布时，代理配置是确保发布成功率的核心要素。

## 触发场景 (Trigger)
- **意图辨析**：
  - **查询代理**：用户反馈发布由于 IP 问题失败，或需要查看可用网络资源时。
  - **配置代理**：新绑定账号后，或需要切换账号出口 IP（保护账号权重/避免封封）时。
- **典型提示词**：
  - “我的抖音号发布报错了，是不是 IP 不对？”
  - “帮我查查有哪些上海的代理”
  - “把这个账号绑定到团队代理 A 上”

## 1. 查询代理列表 (List Proxies)

获取当前团队下所有已配置的代理。

### 参数定义 (Parameters)
| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`proxies` |
| `size` | `number` | 否 | 每页数量，默认 `9999`。 |

### 执行逻辑 (Logic Flow)
1. **指令构造**：组装 `action: "proxies"`。
2. **指令执行**：当前能力正在迁移到 `yxer` CLI，本文档不再推荐脚本直调。
3. **数据呈现**：展示代理名称、IP 及启用状态。

---

## 2. 查询内置代理地区列表 (List Default Proxy Areas)

### 参数定义 (Parameters)
| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`proxy-areas` |

### 执行逻辑 (Logic Flow)
1. **意图获取**：当用户希望使用“内置地区代理”而非独立服务器时触发。
2. **列表拉取**：执行 `action: "proxy-areas"`。
3. **编码匹配**：获取接口返回的 `code`。
    - **直辖市**（如北京、上海）：直接使用第一层级的 `code`（例如：北京 `11`，上海 `31`）。
    - **其他城市**（如长沙）：必须进入 `cities` 数组中获取对应的 `code`（例如：长沙 `430100`）。

---

## 3. 更新账号代理 (Update Account Proxy)

为指定账号设置代理信息。

### 参数定义 (Parameters)
| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`accounts.update` |
| `account_id` | `string` | **是** | 平台的账号 ID |
| `proxyId` | `string` | 否 | 团队代理 ID |
| `kuaidailiArea` | `string` | 否 | 内置代理地区编码。直辖市取一级 `code`，普通城市取 `cities` 下的 `code`。 |
| `remark` | `string` | 否 | 账号备注 |
| `groups` | `string[]` | 否 | 分组 ID 列表 |

### 执行逻辑 (Logic Flow)
1. **前置查询**：必须先获得目标 `account_id` 及代理 `id`/`code`。
2. **预览请求**：先执行 `yxer accounts update <account_id> ... --dry-run`，检查返回的 `action: "accounts.update.dry-run"` 和 `data.request`。
3. **更新执行**：确认无误后执行 `yxer accounts update <account_id> ...`，成功输出 `action: "accounts.update"`。
4. **验证反馈**：确认账号代理详情已变更。

## 注意事项
- 云发布环境下，未设置代理的账号可能会导致任务执行失败。
- **二选一**：`proxyId` 与 `kuaidailiArea` 通常建议只配置其中一个。
