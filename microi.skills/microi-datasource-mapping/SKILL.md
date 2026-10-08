---
name: microi-datasource-mapping
description: Microi 选项类字段的数据源 Key/Value 映射规范。用于 Select、Radio、Checkbox、UniApp 枚举显示、KeyValue 配置、数据迁移和接口返回标签映射。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# microi-datasource-mapping — 数据源 Key/Value 映射规范

## 一、后台字段数据源的两种模式

Microi 低代码平台中，`Select / Radio / Checkbox` 等选项组件支持两种数据源配置方式：

| 模式 | 格式 | DB 存储值 | 前端显示值 | 示例 |
|------|------|-----------|-----------|------|
| **Key ≠ Value**（推荐） | `"key1\|label1,key2\|label2"` | key (如 `"VIP"`) | label (如 `"VIP会员"`) | `"VIP\|VIP会员,普通会员\|普通会员"` |
| **Key = Value**（简单） | `"值1,值2,值3"` | 原始值 (如 `"普通会员"`) | 原始值 (如 `"普通会员"`) | `"普通会员,VIP"` |

> ⚠️ 注意：若误将 Key 与 Value 设置为相同中文，后台和 DB 中存的就是中文字符串（如 `Level='普通会员'`）。

### 字段 V8 必须按保存格式读取选中值

`SelectSaveFormat='Text'` 时，`V8.Form.<字段>` 可以是保存字段的原始文本；旧配置可能仍为对象或 JSON 文本。按钮不能无条件读取 `.TableName`、`.Id` 等对象属性。先按真实 Config 提取值并校验非空，再调用接口；接口失败和网络异常均在 `finally` 恢复 Loading。验收须覆盖文本、旧对象、JSON 文本和空选项。

---

## 二、移动端前端显示枚举值的规范

移动端（UniApp）不应假定页面已经加载后台 `diy_field.Config`。优先由接口返回当前租户可用的 `Key/Value` 选项，或复用项目内的共享字典模块；只有不会被租户配置动态修改的协议枚举，才适合在前端维护映射函数：

```js
// ✅ 正确做法：手写完整的枚举映射
function statusLabel(status) {
  return ({
    Draft: '草稿',
    Enabled: '启用',
    Disabled: '停用'
  })[status] || status; // 未知值显示原始 key
}

// ✅ 动态选项：后端返回 [{ Key, Value }] 后建立映射
export function createOptionLabel(options = []) {
  const map = new Map(options.map(x => [String(x.Key), x.Value]));
  return key => map.get(String(key ?? '')) || String(key ?? '');
}
```

**原则**：
- 映射函数兜底返回原始 key，方便发现新枚举值或配置漂移
- **不要** 用 `|| '未知'` 作为兜底，否则后台新增类型后移动端会显示"未知"而不是英文 key（更难排查）
- 租户可配置的 Select/Radio/Checkbox 选项不得复制成官方 Skill 中的固定业务字典

---

### 原生详情与异步关联回显

- `View` 只读表单可能使用静态展示器，不挂载 `Select`。数据库Id会先成为 `{Key: Id, Value: Id}` 占位对象；只更新字段 `Data` 不能保证该对象的显示名随之更新。
- 通过已授权接口取得当前关联记录的名称后，同时更新字段选项和同Key显示对象。仅补名称时用 `V8.Form.字段名 = {Key, Value}` 静默赋值，避免 `FormSet` 触发部门/人员等字段的异步联动或把纯查看标记为业务修改。存储字段仍为原Key，不能改成名称或默认第一条。
- 详情解析以持久主记录和真实权限为依据，不能靠请求传入的任意关联Id读取人员或外站资料。首屏之外的当前关联须单独授权解析，不扩大候选全集；返回仅包含选择器所需字段。
- 异步回填前核对表单实例、记录Id、依赖值和当前选择；换记录、换部门、改选后的迟到响应丢弃。失败不得伪造名称或清空已有业务关联。
- 验收覆盖新增检索、编辑、只读详情、首屏外已有值、停用/越权关联和迟到响应；必须实际截图核对可读名称，不能仅看控件类型或接口返回成功。

## 三、历史遗留数据迁移

从第三方数据库迁移枚举前，先用 `microi_inspect_external_database` 确认真实字段类型和说明，再用受限 `microi_query_external_database` 抽样唯一值。第三方显示文字不能直接成为吾码协议 Key；建立明确的“源值 -> 稳定 Key -> 展示 Value”映射，未识别值进入失败清单，禁止静默写成“未知”。持续同步应把映射版本写入任务配置，并保证同一源记录重投不会重复新增。

当后台 Select 字段的 Key 发生变更时（如从英文 `Normal` 改为中文 `普通会员`），DB 中已存入的旧 key 不会自动更新。需要手动执行迁移：

```js
// 接口引擎：一次性数据迁移
var affected = V8.Db.FromSql(
  'UPDATE biz_member SET Level = @p0, UpdateTime = @p1 WHERE Level = @p2'
)
  .AddInParameter('@p0', 'NormalMember')
  .AddInParameter('@p1', DateNow('yyyy-MM-dd HH:mm:ss'))
  .AddInParameter('@p2', 'Normal')
  .ExecuteNonQuery();
return { Code: 1, Msg: '迁移完成，共更新 ' + affected + ' 条', Data: { Updated: affected } };
```

**最佳实践**：
1. 执行前先 `SELECT COUNT(*)` 确认受影响行数
2. 迁移接口默认 `StopHttp=1`，仅管理员可运行；保留版本和审计记录
3. 新字段应从一开始就统一使用 Key≠Value 格式（英文 key + 中文 label），避免后续迁移

---

## 四、租户与项目映射隔离

官方 Skill 只维护平台通用机制，不记录任何客户名称、真实 `OsClient`、客户表名、接口 Key 或业务枚举。项目专有映射应保存在对应应用源码、租户私有配置或项目级 Skill 中，并遵循以下规则：

1. 每个映射注明事实源（字段 KeyValue、数据源引擎或接口引擎）和更新时间。
2. 动态选项优先实时读取；允许缓存时，缓存 Key 必须包含 `OsClient` 和配置版本。
3. 后台字段配置修改后刷新字段/数据源缓存，前端不得长期保留另一份无版本的硬编码字典。
4. 历史值兼容只放在受影响项目中；迁移完成后仍保留审计与回滚说明。
5. 示例统一使用 `demo`、`biz_*` 等虚构名称，禁止把客户项目复制进官方文档、官方 Skill 或平台 AI 公共知识库。

---

## 五、接口引擎 OsClient 传递规范

### UniApp 调用 `/apiengine/xxx` 时

```js
// ✅ 正确：OsClient 通过请求头传递，URL 不需要附加 --OsClient-- 后缀
function withOsClient(url) {
  if (url.includes('/apiengine/')) {
    return url; // OsClient 已在 header 中
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}OsClient=${encodeURIComponent(OS_CLIENT)}`;
}

// 请求头中包含：
// { OsClient: OS_CLIENT, Token: 'xxx', ... }

// ❌ 不要在已经携带租户请求头时，再把租户写死到 URL
// /apiengine/order-query--OsClient--demo--
// 这种写法在路由匹配时可能出错，导致 404 或参数丢失
```

**结论**：`callEngine()` 系列函数已在请求头中传递 `OsClient` 时，无需在 URL 中重复传递。对于需要 query 参数识别租户的端点，使用运行期变量 `?OsClient=${encodeURIComponent(OS_CLIENT)}`，不得写死真实租户。
