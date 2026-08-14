# 📦 模块引擎

> **包含模块配置、数据源配置、接口替换、动态按钮等配置**

![module-engine](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## 模块配置

### 用户级登录后首页

每个系统账号都可在 PC 右上角头像菜单的【个人设置】中选择“登录后首页”。设置保存在 `sys_user.DefaultIndexUrl`，而系统级默认首页仍保存在 `sys_config.DefaultIndexUrl`。

登录跳转优先级固定为：当前用户 `sys_user.DefaultIndexUrl` → 系统 `sys_config.DefaultIndexUrl` → 登录接口返回的菜单首页 → 当前用户第一个可访问模块。个人值支持 `/route`、`#/route`、`/#/route`，保存时统一规范为站内路由；外部网址、登录页和访问密钥兑换页不能保存。客户端会用当前动态菜单再次校验权限，菜单被撤权或删除时自动回退，不会停在 404 或空白页。

管理员也可在【系统账号】表单的“个人设置”页签维护该字段。MCP 维护账号数据时使用同名字段 `DefaultIndexUrl`；留空表示继承系统默认值。

## 左侧菜单统计角标

对库存预警、待审批、未读消息、待回款等需要用户持续关注的菜单，可在模块引擎配置：

| 物理字段 | 说明 |
| --- | --- |
| `MenuBadgeEnabled` | 是否在左侧菜单右侧显示统计角标；默认关闭。 |
| `MenuBadgeApiEngineKey` | 统计接口引擎 Key；开启角标时必填。 |

前端按菜单调用一次接口引擎，并携带 `_SysMenuId`、`SysMenuId`、`OsClient`。接口使用统一返回协议：

```js
// MenuBadgeApiEngineKey = inventory_warning_badge
var countResult = V8.FormEngine.GetTableDataCount('diy_product', {
  _Where: [['Stock', '<', 10]]
});
return {
  Code: 1,
  Data: { Value: Number(countResult.Data || 0) }
};
```

`Data.Value=0` 时默认不显示，超过 99 显示 `99+`；统计失败只隐藏角标，不阻断菜单导航。客户端对同一用户、菜单和接口结果做短缓存并定时刷新。接口引擎必须继续执行当前租户和当前用户的数据权限，不能为了统计总数改成匿名接口或绕开模块权限。

以下菜单通常应主动考虑角标：待办/待审批、库存或余额预警、未读消息、逾期合同、待付款/待回款、失败任务。普通资料维护、低频设置、无明确行动含义的总数不建议配置，以免侧栏充满噪声。

## 跨端统一视图

跨端视图属于模块引擎，因为同一张表可能被多个 `sys_menu` 以不同角色、业务场景和卡片样式复用。配置保存在 `sys_menu` 的专用物理字段中，不放在 SaaS 引擎、`diy_table` 或 `DiyConfig`：

| 物理字段 | 说明 |
| --- | --- |
| `EnableViewSchema` | `1` 启用 Detail/Edit 自定义表单视图；不控制 List/Card 展示配置。 |
| `ViewSchemaVersion` | 可选的协议语义版本；为空时默认 `1.0`。 |
| `ViewConfigVersion` | 可选的配置递增版本；为空时默认 `1`，后续变更自动递增。 |
| `ViewSchema` | Detail、Edit、List、Card 的版本化 JSON。 |

所有顶层 PC 数据模块默认使用紧凑的新列表外观，即使 `EnableViewSchema=0`，也会显示以模块名称为标题的模块头部；子表、关联表和嵌入表不会重复显示。模块头部在**页面多 Tab（PageTabs）上方**渲染，固定信息层级为“模块标题/副标题/动态指标 → 页面多 Tab → 查询与表格”。无指标时头部高度为 `44px`，含指标时为 `58px`，连同区块间距的总纵向占用约为 `50px / 64px`，不能为了视觉效果挤占低分辨率电脑的表格首屏。`Scene=List/Card` 的标题与统计、PC 复合列和移动端卡片只要存在有效配置就直接生效；`EnableViewSchema` 仅控制 `Scene=Detail/Edit` 的自定义表单视图。移动端继续由固定导航栏显示模块名，只有配置了动态指标时才追加指标区，避免重复标题和空白占位。

模块头部只允许一次性入场和一次性轻量光效，不得使用持续循环的位移、呼吸、渐变或阴影动画。所有动效必须支持 `prefers-reduced-motion: reduce`：命中时关闭动画与过渡，保证低性能终端、无障碍用户和长时间停留页面不会卡顿。

模块引擎表单的“跨端视图”页签提供“模块展示设计器”，可视化配置标题与指标、PC 复合列和移动卡片，并提供独立的“自定义表单视图 JSON”编辑 Detail/Edit。高级 JSON 保留完整协议、角色优先级和未知扩展字段。设计器保存时会同步 `EnableViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion` 和 `ViewSchema`；两个版本字段允许为空，读取时使用上述默认值。

`diy_table.DiyConfig`、`diy_field.DiyConfig`、`sys_menu.DiyConfig` 均已废弃。旧字段只保留历史读取兼容，新功能必须增加专用物理列，并通过 `diy_field` 元数据提供设计控件。

### 视图结构

```json
{
  "Views": [
    {
      "Key": "customer-detail",
      "Scene": "Detail",
      "Device": "All",
      "RoleIds": [],
      "Priority": 10,
      "Layout": {
        "Hero": {
          "TitleField": "KehuMC",
          "ImageField": "Logo",
          "StatusField": "KehuHZ",
          "MetaField": "KehuLX",
          "Metrics": [
            { "Label": "设备", "Field": "ShebeiSL", "Suffix": "台" }
          ]
        },
        "Actions": [
          {
            "Key": "orders",
            "Label": "合同订单",
            "ActionType": "OpenList",
            "ModuleEngineKey": "orders",
            "ParamMap": { "KehuID": "$form.Id" }
          }
        ],
        "Blocks": [
          {
            "Key": "basic",
            "Type": "ResponsiveSection",
            "Title": "客户信息",
            "Columns": 3,
            "DefaultExpanded": true,
            "Fields": ["KehuMC", "KehuLX", "LianxiDH"]
          }
        ]
      }
    }
  ]
}
```

- `Scene`：`Detail`、`Edit`、`List`、`Card`。
- `Device`：`PC`、`Mobile`、`All`。
- `RoleIds`：空数组表示所有已获模块权限的角色；配置角色后优先选择角色专属视图。
- `Priority`：同场景、同终端命中多个视图时选择优先级更高者。
- 没有新视图、配置损坏或客户端暂不支持某个区块时，必须回退到现有 `sys_menu + diy_table + diy_field` 渲染，不能白屏。

### 列表页模块标题与动态指标

`Scene=List` 的 `Layout.Hero` 可以配置模块眉题、标题、说明和最多 6 个动态指标。指标来源有三类：`Source="DataCount"` 读取当前筛选条件下的总记录数，`Source="PageCount"` 读取本页已加载记录数，配置 `Field` 时读取列表返回的 `StatisticsFields`，配置 `ApiEngineKey + ValuePath` 时调用接口引擎。`DataCount/PageCount` 是前端已有列表结果，不产生额外统计请求：

```json
{
  "Key": "purchase-list",
  "Scene": "List",
  "Device": "PC",
  "Priority": 10,
  "Layout": {
    "Hero": {
      "Eyebrow": "PURCHASE CONTRACT",
      "Title": "采购合同",
      "Description": "统一查看合同金额、付款与入库状态",
      "Metrics": [
        {
          "Key": "totalCount",
          "Label": "总记录数",
          "Source": "DataCount",
          "Suffix": "条",
          "Tone": "primary"
        },
        {
          "Key": "contractCount",
          "Label": "数量",
          "ApiEngineKey": "purchase_contract_stats",
          "ValuePath": "Data.ContractCount",
          "Tone": "primary",
          "DefaultValue": 0,
          "RefreshSeconds": 60
        },
        {
          "Key": "unpaidAmount",
          "Label": "未付款",
          "ApiEngineKey": "purchase_contract_stats",
          "ValuePath": "Data.UnpaidAmount",
          "Prefix": "¥",
          "Tone": "danger"
        }
      ]
    }
  }
}
```

相同 `ApiEngineKey` 的指标会合并为一次请求；接口收到 `MetricKeys` 和当前模块、表、租户及筛选上下文，应该一次返回全部值：

```js
return {
  Code: 1,
  Data: {
    ContractCount: 176,
    UnpaidAmount: 13971000
  }
};
```

列表首次加载、筛选、翻页和刷新后会同步刷新指标；配置 `RefreshSeconds` 时还会按最短周期刷新。禁止每个指标或每一行各查一次数据库；同一模块的指标应由一个聚合接口批量计算。模块 Hero 始终位于 PageTabs 上方；是否配置 PageTabs 都不能改变该顺序或重复渲染标题。

### PC 复合列：多行值与右侧状态

`Scene=List` 的 `Layout.List.Columns` 可把一个查询列声明为复合列。`Field` 是主字段，`Lines` 在下方显示多个附加字段，`TrailingFields` 在右侧显示图标、状态或预警：

```json
{
  "List": {
    "Density": "Comfortable",
    "Columns": [
      {
        "Field": "ContractName",
        "MinWidth": 260,
        "Lines": [
          { "Name": "Signer", "Label": "签约", "ShowLabel": true, "Tone": "info" },
          { "Name": "CustomerName", "Icon": "fas fa-building", "Color": "#64748b" }
        ],
        "TrailingFields": [
          { "Name": "StockWarning", "Icon": "fas fa-triangle-exclamation", "Tone": "danger" }
        ]
      }
    ]
  }
}
```

字段声明支持 `Label`、`ShowLabel`、`Icon`、`Tone`、`Color`、`Prefix`、`Suffix`、`FontWeight` 和 `AsName`。若该 `diy_field` 配置了【表格 V8 模板引擎】，主值、附加行和右侧字段都会复用净化后的模板结果。运行时会把引用字段并入 `_SelectFields`；自定义查询接口仍必须识别该参数并返回这些字段。

### 移动端业务卡片

`Scene=Card, Device=Mobile` 的 `Layout.Card` 支持头像、顶部标签、标题、副标题、右侧金额/状态、正文、元信息和底部标签：

```json
{
  "Key": "sales-contract-mobile",
  "Scene": "Card",
  "Device": "Mobile",
  "Layout": {
    "Card": {
      "Preset": "Business",
      "AvatarTextField": "CustomerName",
      "TitleField": "ContractName",
      "TopFields": [
        { "Name": "DeliveryStatus", "DisplayStyle": "Tag", "Tone": "warning" },
        { "Name": "Category", "DisplayStyle": "Tag", "Tone": "success" }
      ],
      "SubtitleFields": ["CustomerName", "OwnerName"],
      "RightFields": [
        { "Name": "Amount", "Prefix": "¥", "Tone": "primary", "FontWeight": "700" },
        { "Name": "UnpaidAmount", "Prefix": "未 ¥", "Tone": "danger" }
      ],
      "Fields": ["SignDate"],
      "MetaFields": ["ContractNo", "CreateUserName"],
      "BottomFields": [
        { "Name": "AttachmentCount", "Icon": "fas fa-paperclip", "ShowLabel": true }
      ],
      "HideIndex": true,
      "ShowCreateTime": true
    }
  }
}
```

未配置 Card 视图时继续兼容 `MobileListFields`、`CardTitleTagFields`、`CardBottomTagFields`。移动端卡片会保留至少 40 至 44px 的触控目标、清晰的选择状态和底部批量操作条；不要通过业务定制 CSS 写死表名、菜单名或字段名。

卡片字段引用配置 `ShowLabel=true` 时，移动端会优先使用字段对象显式配置的 `Label`；未显式配置时，从当前模块已授权加载的 `diy_field.Label` 自动补充。`ShowLabel=false` 明确隐藏标签，未配置 `ShowLabel` 时继续兼容历史显式 `Label` 行为。

小程序列表卡片内容区按实际配置字段展示，不再固定截取前四行；空值和与标题、状态、顶部标签重复的字段仍按客户端去重规则隐藏。

仅使用旧式 `MobileListFields`、`CardTitleTagFields`、`CardBottomTagFields` 时，小程序以这三组配置作为卡片字段顺序的事实源：优先采用配置项自身的 `Label`，并将三组字段全部并入列表查询，避免底部字段因不在普通列表列中而缺失。此时旧的跨端 ViewSchema 不再覆盖卡片标题、正文和标签区域；底部字段无值时仍不渲染，并回退显示创建/更新时间。

### 按钮统计角标

`PageTabs`、`MoreBtns`、`PageBtns`、`BatchSelectMoreBtns`、`ExportMoreBtns`、`FormBtns` 的对象都可增加：

```json
{
  "Id": "01K...",
  "Name": "附件",
  "ShowRow": true,
  "BadgeEnabled": true,
  "BadgeApiEngineKey": "contract_button_counts",
  "BadgeValuePath": "Data.Rows.{RowId}.01K...",
  "BadgeTone": "primary",
  "BadgeMax": 99,
  "BadgeShowZero": false
}
```

前端按当前页的 `Ids`、`ButtonKeys` 和 `SysMenuId`，以“每个不同接口引擎一次请求”的方式批量取数。若不配置 `BadgeValuePath`，推荐返回：

```js
return {
  Code: 1,
  Data: {
    Buttons: { '01K...': 12 },
    Rows: {
      'row-id-1': { '01K...': 2 },
      'row-id-2': { '01K...': 0 }
    }
  }
};
```

`Buttons` 用于 PageTabs 和页面级按钮，Key 优先使用稳定 `Id`；`Rows` 用于行按钮。行按钮配置 `BadgeField` 时直接读取当前行已查询字段；PageTabs/页面按钮配置 `BadgeField` 时读取模块 `StatisticsFields` 的页面汇总值，因此还要把该字段加入模块“统计列”。这两种字段模式都不调用接口引擎。严禁在每一行渲染时单独调用统计接口；附件、日志、子表等数量应一次批量聚合。接口失败时只隐藏角标，不阻断页签切换、按钮点击或列表加载。

### 标准视图区块

数据控件继续由 `diy-field-component` 负责，例如 Text、Select、ImgUpload、Map、RichText。以下区块不代表数据库字段，独立存放在 `form-view-blocks`：

| 区块 | 用途 |
| --- | --- |
| `EntityHero` | 背景、图片、标题、副标题、状态徽标与关键指标。 |
| `MetricStrip` | 字段值、关联数量、聚合结果或接口引擎指标。 |
| `ActionGrid` | 图标化快捷入口和业务动作。 |
| `ResponsiveSection` | PC 1 至 4 列、移动端单列的详情分组与折叠。 |

详情模式使用只读详情渲染器，不把所有字段伪装成禁用输入框；编辑模式继续复用完整表单控件、校验、数据源和后端表单事件。未被视图区块显式引用的 PC 字段必须进入兜底分组，保证字段完整度不低于原表单。

### 跨端动作

小程序不会下载或执行 `V8Code`。跨端按钮使用声明式动作：

- `ActionType`：`ApiEngine`、`OpenDetail`、`OpenList`、`OpenForm`、`Navigate`、`Dial`、`Scan`、`Map`、`Refresh`、`Back`、`Copy`。
- `ParamMap`：支持 `$form.Field`、`$user.Field`、`$menu.Field` 白名单绑定。
- `VisibleWhen`：字段、操作符和值组成的声明式显隐条件，不使用 `eval`。
- `Confirm`、`SuccessMessage`、`SuccessActions`：确认、成功提示和后续刷新/跳转。
- 涉及校验、事务、跨表写入和数据权限的逻辑必须放到接口引擎或 `SubmitBeforeServerV8` / `SubmitAfterServerV8`。

PC 可继续兼容历史按钮 V8，但跨端视图只向小程序输出规范化后的安全动作。客户端调用时携带当前授权模块的真实 `_SysMenuId`；接口引擎仍在服务端可信执行链中运行。

## 打开方式
### **Diy**
>* 以表单引擎渲染，打开是一个表格

### **Component**
>* 以定制vue组件打开，需要填写定制组件路径

### **Iframe**
>* 以iframe模式打开
```
//如要打开百度，则需要设置url地址为：/iframe/https://baidu.com
//可以在地址中跟上系统当前登录用户的token值，如：/iframe/https://baidu.com?token=$V8.CurrentToken$
```
#### 地址接口引擎
>* 当打开方式选择为**Iframe**时，可选择动态返回地址的接口引擎，以实现第三方系统的单点登录
::: details 展开查看 JavaScript 代码（22 行）
```js
//先取缓存
var cacheTokenKey = `Microi:${V8.OsClient}:IotToken-meslogin-jwlrd`;
var cacheToken = V8.Cache.Get(cacheTokenKey);
if(cacheToken){
  return { Code : 1, Data : 'https://第三方系统apibase/mg-ui/#/auto-login?token=' + cacheToken }
}
var result = V8.Http.Post({
  Url : 'https://第三方系统apibase/api/third/findAccessToken',
  PostParam : {
    userName : '账号',
    password : '密码',
  },
  // ParamType : 'json',
})
var resultObj = JSON.parse(result);
if(resultObj.code == 0 && resultObj.data && resultObj.data.token)//表示成功
{
  //缓存token
  V8.Cache.Set(cacheTokenKey, resultObj.data.token, '3.00:00:00');//缓存3天
  return { Code : 1, Data : 'https://第三方系统apibase/mg-ui/#/auto-login?token=' + resultObj.data.token};
}
return { Code : 0, Data : resultObj, Msg : result };
```
:::

### **SecondMenu**
>* 含子菜单的上级菜单

### **Report**
>* 虚拟报表

## 树形+表格（左右结构）

适用于“左侧按项目、分类或组织导航，右侧显示关联数据列表/表单”的业务页面。目标菜单使用组件模式：

```json
{
  "ComponentName": "树形+表格",
  "ComponentPath": "/diy/left-right/LeftTreeJoinRightForm"
}
```

页面配置保存在 `diy_LeftJoinRightView`。同一菜单应只有一条有效配置，保存前按【关联菜单】回读并复用，避免重复配置造成命中不确定。

### 核心配置

| 配置项 | 说明 |
| --- | --- |
| `GuanlianCD`（关联菜单） | 当前右侧业务菜单链，末级为当前菜单 `sys_menu.Id`。 |
| `ShuxingGLCD`（树形关联菜单） | 左侧主数据菜单链。 |
| `GuanlianBD`（关联表单） | 左侧主表，例如 `xiangmuguanli`。 |
| `FubiaoGLZD`（父表关联字段） | 左表关联键，通常为 `Id`。 |
| `ZibiaoGLZD`（子表关联字段） | 右表外键，例如 `XiangmuID`、`ProjectId`；必须以实时表结构为准。 |
| `GuanlianPPLJ`（关联匹配逻辑） | 普通主外键使用 `=`。 |
| `ZuobianZSZJ` / `YoubianZSZJ` | 左侧通常为 `树形控件`；右侧可选 `表格`、`表单`、`表单/表格`。 |
| `ShuxianSZDM`（树显示字段名） | 必须和初始化 V8 返回对象的属性名一致。 |
| `ChushiHDM`（初始化代码） | 读取 `V8.Form._PageIndex/_PageSize/inputText` 获取左树当前页，最终返回 `Data` 和 `DataCount`。 |
| `ZuoyouXSZB`（左右显示占比） | 24 栅格比例，例如 `6/18`，`/` 是必要分隔符。 |
| `ShubiaoT` | 左侧标题。 |
| `ShumoHSS`、`ShuxiaLSS`、`ShusouSAN`、`ShushuaX` | 模糊搜索、搜索字段下拉、搜索按钮、刷新按钮。 |
| `ShudingJXZ`、`ShuxinZ`、`ShubianJ`、`ShushanC` | 顶级新增、节点新增、编辑、删除；仅在业务允许时开启。 |
| `ShujieDDJSJ`、`JiedianANXSSJ` | 节点点击事件、节点按钮显示事件 V8。 |
| `YincangBSF` | 节点值命中时隐藏右侧区域。 |
| `TanchuangLX`、`TanchuangDX` | 树节点维护弹窗类型与大小。 |
| `LanjiaZ`、`LanjiaZDM` | 大数据树懒加载开关与代码。 |

左树也必须分页。组件默认每页 20 条，允许切换 10/20/50/100 条；搜索会回到第一页。初始化代码示例：

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

此时配置 `ShuxianSZDM=TreeTitle`、`FubiaoGLZD=Id`。右侧表格根据 `ZibiaoGLZD = 当前节点.Id` 查询；点击【全部】时清除关联条件。

加载期间组件显示“正在加载项目...”，不会先显示“暂无数据”；并发搜索/翻页只接受最后一次请求结果，避免旧页覆盖新页。禁止用大 `_PageSize` 一次拉取完整项目表。

### 移动端与验收

- 手机端不把左树堆在数据列表顶部。右侧列表占满页面，顶部“项目目录”按钮从左侧打开宽度 `88%`、高度 100% 的树形抽屉。
- 抽屉带遮罩、关闭按钮并支持点击遮罩或 Esc 关闭；选择节点后自动关闭，同时保留筛选结果。
- 左树在抽屉内独立滚动，搜索、分页、每页条数切换均可操作。
- 禁止用固定高度或祖先 `overflow:hidden` 截断卡片、分页、底部按钮。
- 至少验证桌面 1440x900 与手机 390x844：20 条分页、切换每页条数、搜索、节点筛选、全部、刷新、抽屉打开/关闭、右侧新增自动写入外键，以及树和列表都能滚动到底。

## 数据源配置
>* **关联表**：join哪些表，设置表的别名

>* **查询列**：select哪些字段

>* **不显示列**：有些id字段select后不需要显示在表格上

>* **可排序列**：哪些字段可以排序

>* **默认排序列**：默认多字段排序

>* **可搜索列**：哪些字段可以被搜索

>* **统计列**：哪些字段需要统计

>* **开启表内编辑**：开启表内编辑后，还需设置可编辑列

>* **Join关联**：自由编写关联表的条件

>* **Where条件**：自由编写where条件，实现权限控制
示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：

(A.UserId = '$CurrentUser.Id$' OR (B.Level > $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))

注意：默认选择的DIY表已经占用了表别名A。

可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$CurrentUser.DeptCode$、$yyyy$、$yyyy-MM$（日期格式依次类推）

>* **导入模板**：提前做好导入模板让用户下载

>* **表格分页序号递增**：非第一页序号继承页码

## 接口替换
>* **查询接口替换**
>* 所有的接口替换地址均支持$ApiBase$、$CsClient$变量，自动从系统设置中获取

>* **[新增]模式**
>支持**弹窗**和**表内**

>* **导入接口替换**
::: details 展开查看 JavaScript 代码（53 行）
```js
//可以使用接口引擎实现导入接口，一旦替换了导入接口，那么导入进度（redis）也一定要设置
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记正在导入哪张表！' }
}
//判断当前表是否正在导入中，防止重复导入
var isImportingKey = `Microi:${V8.OsClient}:ImportTableDataStart:${V8.Param.TableId}`;
var importStepKey = `Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`;
var importStepList = [];
if(V8.Cache.Get(isImportingKey) == '1'){
    return { Code : 0, Message : '注意：有数据正在导入！请导入结束后再操作。若进度异常，请联系系统管理员！' }
}
V8.Cache.Set(isImportingKey, '1');//标记正在导入

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + '：正在读取文件数据...');
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

//获取excel数据
var filesByteBase64 = V8.FilesByteBase64;
var base64String = Object.values(filesByteBase64)[0];
var dataList = V8.Office.ExcelToList({
  FileByteBase64 : base64String,
  SheetIndex : 0//取第一张表
});
dataList.Data.forEach(item => {
  item.AAA = 111;
});

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + "：已读取【" + dataList.Data.length + "】条数据！");
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【0】条数据...`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

dataList.Data.forEach((item, index) => {
  //循环导入数据
  var addResult = V8.FormEngine.AddFormData('tableName', item, V8.DbTrans);
  if(addResult.Code != 1){
    //返回错误结果，平台会自动回滚事务（禁止手动调用V8.DbTrans.Rollback()）
    V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
    //写进度
    importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入出现错误：${addResult.Msg}。已回滚！`);
    V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
    return { Code : 0, Msg : addResult.Msg };//平台识别到Code!=1，自动回滚事务
  }
  //写进度（覆盖上一条）
  importStepList[importStepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【${index+1}】条数据...`;
  V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
});
//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入成功，已结束！`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
return { Code : 1 };
```
:::

>* **导入进度接口替换**
```js
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记要获取哪张表的导入进度！' }
}
//获取进度
var importStepStr = V8.Cache.Get(`Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`);
return { Code ：1, Data : JSON.parse(importStepStr) };
```

>* **导出接口替换**：见相关文章：
>[Microi吾码-自定义导出Excel](https://microi.blog.csdn.net/article/details/143619083)
>[micori吾码-使用接口引擎实现自定义导出excel](https://microi.blog.csdn.net/article/details/143849425)

## 动态按钮
>* **表单更多按钮**

>* **行更多按钮**

>* **更多导出按钮**

>* **批量选择更多按钮**
添加至少一个批量选择更多按钮后，数据列表会自动打开批量勾选功能
```js
//批量删除数据
var selectData = V8.SelectedData;
if(selectData.length == 0){
  V8.Tips('请选择要删除的数据！', false);
  return;
}
V8.ConfirmTips(`确认批量删除选中的[${selectData.length}]条数据？`, async function(){
  var ids = selectData.map(item => { return item.Id });
  var result = await V8.FormEngine.DelFormData('diy_order', {
    Ids : ids
  });
  if(result.Code != 1){
    V8.Tips('删除失败：' + result.Msg, false);
    return;
  }
  V8.Tips('删除成功！');
  V8.RefreshTable({ _PageIndex : 1 })
});
```

>* **页面更多按钮**

>* **页面多Tab**

页面多Tab支持两种动态模式：

页面多 Tab 位于模块 Hero 下方、查询工具栏上方；Hero 与页签不能互换顺序。这样切换筛选页签时模块名称和全局指标保持稳定，页签只表达当前模块的数据分组。

- 不配置【关联模块】：在当前模块执行 `V8Code`，通常使用 `V8.SearchSet(...)` 切换筛选条件。
- 配置【关联模块】：保存目标 `sys_menu.Id` 到 `TargetSysMenuId`。点击后替换当前路由并完整加载目标模块；目标菜单可以设置 `Display=0、AppDisplay=0` 隐藏导航入口，但仍需给当前角色分配菜单权限。

每个 PageTab 还可配置 `BadgeEnabled` 和 `BadgeApiEngineKey` 显示数字角标；`BadgeValuePath` 可直接指定返回路径，例如 `Data.Buttons.pending-tab`。同一接口引擎会按页签合并调用，并收到 `ButtonKeys`、当前筛选条件和模块上下文，适合“待办 12 / 已完成 86 / 异常 3”这类可行动统计。若使用 `BadgeField`，它读取模块“统计列”的页面汇总值；不要在 Tab 的 `V8Code` 中再次单独请求数量。

关联模块适合一个业务入口下不同页签分别使用不同 `diy_table`、字段、列表模板、查询接口替换或按钮配置的场景。所有关联模块建议配置同一组 PageTabs，才能从任意页签无感切回其它模块；不要在前端 mixin 中按菜单名或表名写死数据源。

```json
[
  {
    "Id": "01K...",
    "Sort": 10,
    "Name": "本地记录",
    "TargetSysMenuId": "目标sys_menu.Id",
    "IsVisible": true,
    "BadgeEnabled": true,
    "BadgeApiEngineKey": "module_tab_counts",
    "BadgeValuePath": "Data.Buttons.01K...",
    "BadgeTone": "danger",
    "BadgeRefreshSeconds": 60
  }
]
```

## 平台支持的URL参数
>* ShowClassicTop：若设置为0，则不显示经典顶部内容。默认值为1
>* ShowClassicLeft：若设置为0，则不显示经典左侧菜单。默认值为1
>* FormDataId：数据列表默认打开哪一条数据
```js
https://os.itdos.com/#/notice?ShowClassicTop=0&ShowClassicLeft=0&FormDataId=b8348d26-b395-4313-b97d-6e41f9ff5270
```
