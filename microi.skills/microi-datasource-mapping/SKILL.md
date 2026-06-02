# microi-datasource-mapping — 数据源 Key/Value 映射规范

## 一、后台字段数据源的两种模式

Microi 低代码平台中，`Select / Radio / Checkbox` 等选项组件支持两种数据源配置方式：

| 模式 | 格式 | DB 存储值 | 前端显示值 | 示例 |
|------|------|-----------|-----------|------|
| **Key ≠ Value**（推荐） | `"key1\|label1,key2\|label2"` | key (如 `"VIP"`) | label (如 `"VIP会员"`) | `"VIP\|VIP会员,普通会员\|普通会员"` |
| **Key = Value**（简单） | `"值1,值2,值3"` | 原始值 (如 `"普通会员"`) | 原始值 (如 `"普通会员"`) | `"普通会员,VIP"` |

> ⚠️ 注意：若误将 Key 与 Value 设置为相同中文，后台和 DB 中存的就是中文字符串（如 `Level='普通会员'`）。

---

## 二、移动端前端显示枚举值的规范

移动端（UniApp）不能直接复用后台 diy_field 的 Config 数据源，必须在 JS 中手写映射函数：

```js
// ✅ 正确做法：手写完整的枚举映射
function rewardTypeLabel(type) {
  return ({
    Direct: '直推奖',
    Team: '团队奖',
    GrabDirect: '抢购直推奖',
    GrabTeam: '抢购团队奖',
    // ... 所有已知类型
  })[type] || type; // 未知类型显示原始英文 key
}

// ✅ 会员等级 —— 支持历史遗留英文 key
export function memberLevelLabel(level) {
  const v = String(level ?? '').trim();
  const lv = v.toLowerCase();
  if (lv === 'vip' || lv === 'vip会员' || lv === 'vipmember') return 'VIP';
  if (lv === 'normal' || lv === 'member' || lv === 'free' || lv === 'basic' || v === '普通会员' || v === '') return t('普通会员');
  return v || t('普通会员'); // 其他已知中文直接返回
}
```

**原则**：
- 映射函数兜底 `|| type` —— 未知类型显示原始 key，方便发现新枚举值再补充
- **不要** 用 `|| '未知'` 作为兜底，否则后台新增类型后移动端会显示"未知"而不是英文 key（更难排查）

---

## 三、历史遗留数据迁移

当后台 Select 字段的 Key 发生变更时（如从英文 `Normal` 改为中文 `普通会员`），DB 中已存入的旧 key 不会自动更新。需要手动执行迁移：

```js
// 接口引擎：一次性数据迁移
var affected = V8.Db.FromSql(
  "UPDATE mall_member SET Level='普通会员', UpdateTime=NOW() WHERE Level='Normal' AND IFNULL(IsDeleted,0)=0"
).ExecuteNonQuery();
return { Code: 1, Msg: '迁移完成，共更新 ' + affected + ' 条', Data: { Updated: affected } };
```

**最佳实践**：
1. 执行前先 `SELECT COUNT(*)` 确认受影响行数
2. 迁移引擎用完后保留（不删除），以备历史回溯
3. 新字段应从一开始就统一使用 Key≠Value 格式（英文 key + 中文 label），避免后续迁移

---

## 四、乐闪购（lsg）已确认的枚举映射

### 会员等级 (mall_member.Level)
| DB 存储值 | 显示文本 | 说明 |
|----------|---------|------|
| `VIP` | VIP | 正常值 |
| `普通会员` | 普通会员 | 正常值（Key=Value 模式） |
| `Normal` | 普通会员 | 历史遗留值，已通过 SQL 迁移为"普通会员" |

### 奖励类型 (mall_reward_log.RewardType)
| DB 存储值 | 显示文本 |
|----------|---------|
| `Direct` | 直推奖 |
| `Team` | 团队奖 |
| `Static` | 静态奖 |
| `Recommend` | 推荐奖 |
| `RecommendListingFee` | 上架服务费推荐奖 |
| `GrabDirect` | 抢购直推奖 |
| `GrabTeam` | 抢购团队奖 |
| `GrabIndirect` | 抢购间推奖 |
| `GrabBoth` | 抢购联合奖 |
| `TeamLevel` | 团队层级奖 |
| `Management` | 管理奖 |
| `Register` | 注册奖 |
| `ShareReward` | 分享奖 |
| `Appointment` | 约单奖 |
| `AppointmentDiff` | 约单差价奖 |
| `Platform` | 平台奖 |
| `Rebate` | 返佣奖 |
| `Other` | 其它 |

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
// { OsClient: 'lsg', Token: 'xxx', ... }

// ❌ 错误（旧写法）：URL 路径附加 --OsClient--lsg-- 后缀
// /apiengine/mall_buy_order_mobile_query_v3--OsClient--lsg--
// 这种写法在路由匹配时可能出错，导致 404 或参数丢失
```

**结论**：`callEngine()` 系列函数已在请求头中传递 `OsClient`，无需在 URL 中重复传递。对于非 apiengine 端点（如 `/api/formengine/`、`/api/HDFS/`），URL query 中的 `?OsClient=lsg` 仍然需要。
