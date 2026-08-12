---
name: microi-left-right-layout
description: Microi 吾码模块引擎“树形+表格/表单”左右结构配置规范。用于通过 MCP、模块引擎或源码配置 `diy_LeftJoinRightView`，把项目、分类、组织等主数据作为左树，并用主外键过滤右侧列表；覆盖字段语义、初始化 V8、移动端自适应、幂等写入和回读验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi 左右树表配置规范

当需求是“左侧按项目/分类导航，右侧显示该节点的数据列表或表单”时，使用模块组件 `/diy/left-right/LeftTreeJoinRightForm`，配置表为 `diy_LeftJoinRightView`。不要为每个业务菜单复制定制 Vue 页面。

## 适用与禁用场景

- 适用：项目及其成品、用料、请购、提料、锁料、文档，分类及商品，组织及人员。
- 左侧必须是稳定的主数据；右侧必须能通过明确的主外键过滤。
- 左右两边没有关联字段、左侧仅是装饰性筛选，或数据量极大却没有分页/搜索方案时，不应直接套用。

## 模块配置

目标 `sys_menu` 必须配置：

```json
{
  "ComponentName": "树形+表格",
  "ComponentPath": "/diy/left-right/LeftTreeJoinRightForm"
}
```

同一菜单只能有一条有效的 `diy_LeftJoinRightView` 配置。创建前先按 `GuanlianCD Like 菜单Id` 回读并复用，禁止重复插入。

## `diy_LeftJoinRightView` 字段

| 字段 | 必填 | 含义与写法 |
| --- | --- | --- |
| `GuanlianCD` | 是 | 当前右侧业务菜单链，JSON 数组；末级必须是当前 `sys_menu.Id`。 |
| `ShuxingGLCD` | 是 | 左侧主数据菜单链，JSON 数组；末级对应左表模块。 |
| `GuanlianBD` | 是 | 左侧主表名，例如 `xiangmuguanli`。 |
| `FubiaoGLZD` | 是 | 左表参与关联的字段，通常为 `Id`。 |
| `ZibiaoGLZD` | 右表格必填 | 右表外键，例如 `XiangmuID`、`ProjectId`、`Guid`。必须以实时表结构为准。 |
| `GuanlianPPLJ` | 右表格必填 | 匹配操作符，普通主外键使用 `=`。 |
| `ZuobianZSZJ` | 是 | 左侧组件，通常为 `树形控件`。 |
| `YoubianZSZJ` | 是 | `表格`、`表单` 或 `表单/表格`。 |
| `ShuxianSZDM` | 是 | 左树显示字段，必须与初始化结果的属性名一致。 |
| `ChushiHDM` | 是 | 初始化 V8。必须读取 `V8.Form._PageIndex/_PageSize/inputText`，最终返回 `Data` 和 `DataCount`。 |
| `ZuoyouXSZB` | 否 | 24 栅格比例，例如 `6/18`、`4/20`，中间 `/` 必须保留。 |
| `ShubiaoT` | 否 | 左树标题，例如 `项目目录`。 |
| `ShumoHSS` | 否 | 模糊搜索开关。 |
| `ShuxiaLSS` | 否 | 搜索字段下拉开关。 |
| `ShusouSAN` | 否 | 搜索按钮开关。 |
| `ShushuaX` | 否 | 刷新按钮开关。 |
| `ShudingJXZ` | 否 | 是否允许新增顶级树节点。 |
| `ShuxinZ`、`ShubianJ`、`ShushanC` | 否 | 树节点新增、编辑、删除开关。只在业务允许时开启。 |
| `ShujieDDJSJ` | 否 | 节点点击 V8；可读取 `V8.Form`，异步结果写入 `V8.Result`。 |
| `YincangBSF` | 否 | 节点命中该字段时隐藏右侧区域。 |
| `TanchuangLX`、`TanchuangDX` | 否 | 树节点维护弹窗类型和尺寸。 |
| `LanjiaZ`、`LanjiaZDM` | 否 | 懒加载开关和代码；大树优先使用。 |

## 初始化 V8 与分页契约

左树按数据表对待，默认每页 20 条，允许 10/20/50/100 条切换。无论当前只有多少数据，都不能用 `_PageSize:500` 一次拉完整主表。搜索时把页码重置为 1，并在服务端按关键字过滤后返回真实总数。

```js
var form = V8.Form || {};
var pageIndex = Math.max(1, parseInt(form._PageIndex || 1, 10));
var pageSize = Math.min(100, Math.max(1, parseInt(form._PageSize || 20, 10)));
var keyword = String(form.inputText || '').trim();
var query = {
    _SelectFields: ['Id', 'Code', 'Name'],
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC',
    _PageIndex: pageIndex,
    _PageSize: pageSize
};

if (keyword) {
    query._Where = [
        ['Code', 'Like', keyword],
        ['OR', 'Name', 'Like', keyword]
    ];
}

var result = await V8.FormEngine.GetTableData('xiangmuguanli', query);

if (result.Code !== 1) {
    V8.Result = result;
    return;
}

V8.Result = {
    Code: 1,
    Data: (result.Data || []).map(function (item) {
        return {
            Id: item.Id,
            TreeTitle: [item.Code, item.Name].filter(Boolean).join(' '),
            Code: item.Code,
            Name: item.Name
        };
    }),
    DataCount: Number(result.DataCount || 0),
    PageIndex: pageIndex,
    PageSize: pageSize
};
```

对应配置为 `ShuxianSZDM=TreeTitle`、`FubiaoGLZD=Id`。右侧新增时，组件会通过 `ParentDataAppend` 把父节点、父键和 `ZibiaoGLZD` 传给表格；业务字段仍需由表单事件兜底校验。

加载请求期间必须显示明确的“正在加载项目...”状态，不能先渲染“暂无数据”；多次搜索或翻页并发返回时，只应用最后一次请求，防止旧结果覆盖新页。

## MCP 实施顺序

1. 调用实时 Schema/模块查询，确认左右表、菜单 Id、主键、外键和已有配置。
2. 读取一个已正常运行的左右结构作为基线，只复用结构，不复制租户或业务字段。
3. 按当前菜单回读 `diy_LeftJoinRightView`；有记录则更新，无记录才新增。
4. 更新模块 `ComponentName`、`ComponentPath`，随后回读模块和配置行。
5. 验证“全部”、单节点切换、右表筛选、右侧新增自动关联、刷新和搜索。

## 移动端要求

- `<=767px` 时不在列表上方直接堆放左树。右侧业务列表占满宽度，顶部显示当前项目和“项目目录”按钮。
- 点击“项目目录”后，从左向右打开全高抽屉；推荐宽度 `88%`，保留一段遮罩用于快速关闭。抽屉必须支持关闭按钮、点击遮罩和 Esc 关闭。
- 左树在抽屉内独立滚动，搜索、分页和每页条数选择都必须可操作；关闭抽屉后右表筛选状态不得丢失。
- 右表与页面使用正常纵向滚动，禁止祖先容器 `overflow:hidden` 截断内容。
- 右侧卡片、表格 Tab、列表卡片在移动端必须使用 `height:auto` 和 `overflow:visible`；底部操作栏不得盖住最后一条数据。
- 至少验收桌面 1440x900、手机 390x844；在手机上分别滚动左树和整页到末尾。

## 验收清单

- 当前菜单只匹配一条配置，模块路径正确。
- 左树标题无 `undefined`、`{}`、空白重复项。
- 点击“全部”清空右侧外键条件；点击节点只显示该节点数据。
- 右侧新增数据自动写入正确外键，切换节点后不会串数据。
- 普通用户不出现仅管理员可用的“页面配置”。
- 桌面左树每页默认 20 条，可翻页并切换 10/20/50/100；加载时不出现错误的空状态。
- 手机初始不显示树，抽屉打开/节点选择自动关闭/遮罩关闭均正常；列表与操作区可滚动到底，无横向挤压和固定高度裁切。
