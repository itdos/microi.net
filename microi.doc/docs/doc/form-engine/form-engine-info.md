# 📝 表单引擎介绍

> **这篇文档可能会让读者对“表单引擎”有更新奇的看法：“原来表单引擎还能这样玩？”**

---

## 🌟 “万物皆表单引擎”
> 这带来的“后果”是整个低代码平台只有**登录**、**桌面**是定制开发页面，其它所有页面均由表单引擎（或界面引擎）驱动

## “模块引擎”由表单引擎驱动
> 模块引擎即常规理解的“系统菜单配置”，包括了菜单基础配置、数据源配置、更多按钮配置、替换配置
> 优点：可以使用表单引擎去设计模块引擎，自由新增配置项
> 比如说前段时间刘老师需要给“菜单配置”新增一个“App是否显示”的配置项，10秒解决
<img src="https://static.itdos.com/upload/img/csdn/012ef3417a0edefe280ed22972b4bc32.png" alt="模块引擎菜单配置" />
<img src="https://static.itdos.com/upload/img/csdn/7197b448e310da3e0945937664f0047f.png" alt="菜单 App 是否显示配置" />

## “流程引擎”由表单引擎驱动
> 流程引擎的流程属性、节点属性也由表单引擎驱动
> 这带来的好处是开发者可自由新增流程、节点的可配置项
> 比如说我们想给节点属性新增一个自定义配置“”，仅需10秒
<img src="https://static.itdos.com/upload/img/csdn/812c3691ce7b2c7e9965accfc605891e.png" alt="流程节点属性扩展">

## “接口引擎”由表单引擎驱动
>* 接口引擎是Microi吾码平台的特色之一，在线使用javascript语法编写任何复杂的业务逻辑，适用于大型ERP、互联网等项目
>* 开发者可自由给接口引擎添加可配置项，如：接口调用频率限制？
<img src="https://static.itdos.com/upload/img/csdn/0fccb24ace37b9b36f8f9de801fb7d90.png" alt="接口引擎配置扩展">

## “SaaS引擎”由表单引擎驱动
> SaaS引擎包含了租户的数据库、阿里云、MinIO、Redis、MQ、搜索引擎等独立配置
> 开发者可自由新增配置，如：租户允许登录？
<img src="https://static.itdos.com/upload/img/csdn/a16ab7aabec6834dff731d4db4b457d2.png" alt="SaaS 引擎租户配置">

## “表单引擎”也由表单引擎驱动
> 重头戏来了：表单引擎也由表单引擎驱动！即表单引擎列表、表单属性、字段属性也是由表单引擎驱动
<img src="https://static.itdos.com/upload/img/csdn/f4ead7346e69b9d362e50d3aafb9dcfe.png" alt="表单引擎自驱配置">

## 记录深链接

模块地址可通过 `RecordId` 直接打开指定记录，包括当前列表分页之外的记录。打开前仍经过当前菜单与表单权限校验；记录已删除或不存在时，页面移除失效的 `RecordId`、返回列表并提示重新选择。权限、登录态或网络错误保留原链接并显示实际错误，不会将其误判为记录已删除。缓存的旧模块也不能把自己的记录 Id 写入新模块的地址。

## 默认表单 Banner

新增、编辑和查看表单默认共用一套紧凑 Banner。默认视觉以当前租户主题色约 50% 的混合强度
叠加深蓝灰渐变：比普通浅色卡片更有层次，但不会变成纯黑重色；文字、标签和统计卡片会自动
保持安全对比度，并适配浅色、深色和移动端。Banner 属于表单本身，因此全部配置都保存在 `diy_table`，不要写入
`sys_menu`。在表单设计器右侧【表单属性 → 表单 Banner】中可以配置：

| 表单属性 | 物理字段 | 说明 |
|---|---|---|
| 显示表单 Banner | `FormBannerEnabled` | 默认显示；只有显式关闭才隐藏。旧数据库没有该字段值时仍安全显示。 |
| Banner 标题字段 | `FormBannerTitleField` | 业务编号、名称或标题字段名。 |
| Banner 副标题字段 | `FormBannerSubtitleField` | 客户、项目、公司、分类、日期等辅助字段名。 |
| Banner 左侧图片字段 | `FormBannerImageField` | `ImgUpload` 字段名；支持单图、多图取首图。 |
| Banner 默认图标 | `FormBannerIcon` | 图片为空时使用的 Font Awesome 图标。 |
| Banner 背景字段 | `FormBannerBackgroundField` | 图片字段，或保存主题安全颜色/渐变的文本字段。 |
| Banner 右侧标签字段 | `FormBannerTagFields` | 逗号分隔字段名，或标签描述 JSON 数组。 |
| Banner 统计项 | `FormBannerMetrics` | 本地数值字段或接口引擎动态统计描述 JSON 数组。 |

### 存量表的智能默认

上述字段全部为空不是“空白 Banner”。运行时会按真实 `diy_field` 智能选择：自动编号、
标题、名称、单号作为标题；客户、项目、公司等作为副标题；第一个图片上传字段作为左侧
图片；下拉、单选、开关、树和部门等选项字段作为标签；仅把金额、合计、数量、成本、余额、
评分、比率、进度等具有明确业务口径的数值字段作为统计项。`Id`、排序、启用、状态、版本、
分页和本页加载量等技术数字不会进入 Banner。因此升级前创建的表不需要逐表补配置。显式保存 `[]` 可关闭自动标签或自动
统计，显式关闭 `FormBannerEnabled` 才隐藏整块 Banner。

使用 MCP/AI 创建新系统时，Manifest 的 `tables[].formBanner` 会写入同一组物理字段；
未显式指定时，生成器仍会基于新字段写入可用默认值，不会生成一块空 Banner。逐步建模
完成字段后可调用 `microi_configure_form_banner`，它会读取真实字段、写入并回读校验。

### 标签和统计 JSON

标签既可简单填写 `Status,OrderType`，也可精细配置：

```json
[
  { "Field": "Status", "Label": "状态", "Tone": "success", "Icon": "fas fa-circle", "ShowLabel": true },
  { "Field": "OrderType", "Label": "订单类型" }
]
```

统计项可以直接读取当前表单，也可以调用接口引擎：

```json
[
  { "Field": "Amount", "Label": "订单金额", "Prefix": "¥", "Icon": "fas fa-coins" },
  {
    "Key": "Pending",
    "Label": "待处理",
    "ApiEngineKey": "order-banner-metrics",
    "ValuePath": "Data.Pending",
    "DefaultValue": 0,
    "RefreshSeconds": 30,
    "ParamMap": { "CustomerId": "Form.CustomerId" }
  }
]
```

同一个 `ApiEngineKey` 的多个统计项会合并为一次请求，避免 N+1。接口会同时收到
`TableId`、`TableName`、`RecordId`、`SysMenuId`、`Form`、`MetricKeys` 和 `Metrics`；
推荐返回 `{ "Code": 1, "Data": { "Pending": 3 } }`，再用 `ValuePath` 取值。
统计必须来自真实字段或真实接口口径，禁止使用随机数和固定演示数字。未显式配置统计时，
运行时最多展示 3 个高价值指标；如果表单存在 `TableChild`，会在当前菜单、父表、父字段、
父记录的授权上下文中，对完整关联子表数据计算行数及有业务语义的数值字段合计，而不是只统计
当前分页。没有可靠指标时会直接隐藏统计区，不用 `0` 填充没有意义的卡片。显式配置的
`FormBannerMetrics` 或接口引擎统计始终优先。

旧版模块视图的 Hero 仍可兼容迁移标题、图片和背景，但模块列表总数、分类数量等全局统计不会
再带入单条记录 Banner。只有 `Source=Field`、明确标记记录作用域，或接口参数引用当前
`Form/RecordId` 的指标才会迁移；其余情况自动回到上述当前记录/授权子表规则。

### 图片与背景文件

- 图片字段继续保存吾码上传控件原始值，不能把临时授权 URL 写回业务表。
- 单图可为路径字符串或文件对象；多图数组取第一张有效图片。
- 公开文件通过平台文件服务器路径解析；私有图片必须携带当前表、记录、字段和菜单上下文，
  由平台获取短期授权地址，不能在前端拼接私有 URL。
- 未配置背景或字段为空时使用当前主题色约 50% 混合强度的深色渐变；背景图片加载失败也会安全回退。
- 自定义背景图片上自动叠加深色安全遮罩，避免浅色图片导致标题和统计不可读。
- 统计卡片使用轻量半透明背景和柔和阴影分层，不依赖密集边框；窄屏自动从横向排列降为两列或单列。

### 固定审计字段不是异常字段

平台表固定包含 `Id`、`CreateTime`、`UpdateTime`、`UserId`、`UserName`、`IsDeleted`。这些字段必须同时存在物理列和 `diy_field` 元数据；它们属于正常表单字段，不应出现在设计器【异常字段修复】列表。

表单属性【显示默认字段】对应 `diy_table.DisplayDefaultField`，默认关闭时只是隐藏上述字段，并不删除元数据。打开后可以在设计器中查看和配置。进入异常字段页时，平台会在租户级分布式锁内为“物理列已存在、元数据缺失”的固定字段自动补齐或恢复元数据，并刷新共享缓存；不会重复执行 DDL。

MCP 可用 `microi_repair_audit_fields` 按 `tableId` 或 `tableName` 修复任意已有表，适合直接说“修复某表的审计字段异常”。新建表时 `microi_create_table` 会一次创建六个固定物理列及其 `diy_field` 元数据。列表中的创建人、创建时间、修改时间也与普通字段一样支持点击列头打开高级搜索。

## 还有更多如任务调度、MQ等均由表单引擎驱动
> 后期再补充

## 黑科技
## 拓展表单组件
> 表单引擎组件库支持二次开发自由扩展，比如说我想增加一个“显示天气”组件
<img src="https://static.itdos.com/upload/img/csdn/9a37d32ab119cf8d9a8eee9230d916c2.png" alt="扩展天气表单组件">
## 定制表单组件
> 表单设计里面可以任意嵌入自己开发的vue组件
> 嵌入的vue组件也能通过一句代码&lt;DiyForm TableId="1" /&gt;来调用表单引擎
<img src="https://static.itdos.com/upload/img/csdn/e67595311cdb3119244fc6ed0edb3a93.png" alt="定制 Vue 表单组件">

## 二次开发引用表单组件
> 如图：定制开发一个比较复杂的页面，均可以通过一句代码来调用表单引擎设计好的表单进行编辑或新增
<img src="https://static.itdos.com/upload/img/csdn/caa80acf3b86e28ff78cd74514982a36.png" alt="二次开发引用表单组件">

## 强大的V8.FormEngine
* 见CSDN文章：[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)

## 丰富的V8事件
> 平台提供了非常丰富的前端事件、后端事件、键盘事件、值变更事件等等
> 比如说表单提交前在“前端事件”中判断哪些字段必填、哪些字段填写不符合规则
> 比如说表单提交前在“后端事件”中判断更严格的数据校验，防止通过postman调用接口绕开前端验证
> 相关CSDN文章：[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## 动态关联表单
> 比如说商品信息中，我的商品可能是饮水机、也可能是电脑
> 而饮水机我需要填写出水模式、出水龙头、制水能力等信息
> 而电脑我需要填写CPU、内存、显卡等信息
> 此时就可以用到动态关联表单，为商品分类设计多张表单引擎，然后动态调用
<img src="https://static.itdos.com/upload/img/csdn/a405352e6078d8868a6e42d7a12aca31.png" alt="动态关联表单示例">

