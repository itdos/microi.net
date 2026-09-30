# 查询账号列表 (Query Account List)

获取当前租户下绑定的自媒体平台账号列表及其 UID 信息。

## 触发场景 (Trigger)
- **意图辨析**：用户需要获取、筛选或确认其在蚁小二平台上绑定的自媒体账号信息（如 UID、昵称、登录状态、分组等）时触发。
- **典型提示词**：
  - “列出我所有的抖音号”
  - “看看我有哪些账号登录失效了”
  - “查询分组 A 下的账号”
  - “确认一下视频号的作者 ID”

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`accounts` |
| `platform` | `string` | 否 | 指定展示某个平台，必须传平台中文名，如 `抖音`。见 [平台定义](./platform.md)。 |
| `name` | `string` | 否 | 按账号昵称模糊查询。 |
| `group` | `string` | 否 | 按分组名称查询。 |
| `page` | `number` | 否 | 当前页码，默认 `1`。 |
| `size` | `number` | 否 | 每页数量，默认 `20`，最大 `1000`。 |
| `platforms` | `string[]` | 否 | 平台批量查询，支持多个。见 [平台定义](./platform.md)。 |
| `platformType` | `number[]` | 否 | 平台类型批量查询。见 [平台定义-平台类型](./platform.md#平台类型枚举-platformtype)。 |
| `loginStatus` | `number` | 否 | 账号登录状态查询。见下方【登录状态枚举】。 |
| `isolation` | `string` | 否 | 是否显示隔离数据，`true`|`false`，默认 `false`。 |
| `parentId` | `string` | 否 | 父级ID，用于查询子账号列表。 |
| `time` | `number` | 否 | 查询此时间戳之后是否有新消息（unix ms）。 |

### 枚举定义 (Enumerations)

#### 登录状态 (LoginStatus)
| 值 | 定义 | 说明 |
| :--- | :--- | :--- |
| `0` | `Never` | 未曾登录/待登录 |
| `1` | `Succesed` | 登录成功 |
| `2` | `Expired` | 登录过期/失效。**提示：在查询时传 2 会同时匹配 2(过期), 3(失败), 4(取消授权)** |
| `3` | `Failed` | 登录失败 |
| `4` | `CancelAuth` | 取消授权 |


## 执行逻辑 (Logic Flow)
1. **意图解析**：识别查询意图，提取关键词（如平台名称、分组名、昵称片段）。
2. **状态前置**：若涉及“失效账号查询”，自动注入 `loginStatus: 2` 参数。
3. **参数装配**：构造 `action: "accounts"` 及其余过滤参数（如 `page`, `size`）。
4. **指令执行**：调用 `yxer accounts [platform] [--name 关键词] [--status 1] [--json]`。
5. **分页处理**：CLI 默认查询第 `1` 页、每页 `20` 条；可通过 `--page`、`--size` 控制单页查询，通过 `--all` 按接口返回的分页信号继续汇总后续页。
6. **结果解析**：处理返回的 `PlatformAccountDTO` 列表，重点提取 `id` 和 `status` 供后续操作。

## 返回结果说明 (Response Details)

脚本返回标准的 JSON 数组或对象。每一个账号对象 (`PlatformAccountDTO`) 包含：

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | `string` | 平台内部账号 ID |
| `platformAccountName` | `string` | 账号昵称 |
| `platformName` | `string` | 平台名称（如：抖音、百家号） |
| `platformAvatar` | `string` | 账号头像地址 |
| `platformAuthorId` | `string` | 平台方的 UID / 作者 ID |
| `status` | `number` | 登录状态（见上方枚举） |
| `platformType` | `number` | 平台类型（见上方枚举） |
| `parentId` | `string` | 父账号 ID（针对微信视频号等子账号结构） |
| `groups` | `string[]` | 账号所属的分组 ID 列表 |
| `proxyId` | `string` | 绑定的团队代理 ID (如果有) |
| `kuaidailiArea` | `string` | 绑定的内置代理地区编码 (如果有) |
| `favorites` | `Object[]` | 账号收藏夹列表。包含 `id`, `name`, `websiteUrl` |
| `isOperate` | `boolean` | 当前用户是否拥有该账号的运营权限 |
| `isFreeze` | `boolean` | 账号是否被冻结 |
| `createdAt` | `number` | 账号创建时间戳 |

## 调用指令 (Command)

```bash
yxer accounts 抖音 --name 昵称 --json
yxer accounts list 抖音 --page 2 --size 20 --json
yxer accounts list 小红书 --all --status 1 --json
```

## 注意事项
- 请确保环境变量 `YIXIAOER_API_KEY` 已设置。
- **账号有效性提示**：发布前应校验账号 `status` 是否为 `1`。
- **分页约定**：不要根据“当前页条数已满”猜测还有下一页；只有显式传 `--all` 时，CLI 才会按接口返回的分页字段继续翻页。
