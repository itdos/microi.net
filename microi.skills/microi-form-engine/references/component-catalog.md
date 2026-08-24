# 表单组件目录

控件名称以
`Microi.Client/src/views/form-engine/diy-field-component/diy-component-list.json`
为当前事实源；物理类型以服务器/MCP 允许类型为准。

## 基础输入

| Component | 用途 | 推荐物理类型 |
|---|---|---|
| `Text` | 单行文本 | `varchar(200)` |
| `Guid` | GUID/只读标识 | `varchar(50)` |
| `Textarea` | 多行文本 | `mediumtext` |
| `NumberText` | 整数/金额/小数 | `int` 或 `decimal(18,2)` |
| `DateTime` | 日期时间选择 | `varchar(25)` |
| `Select` | 下拉单选 | `varchar(50)` |
| `MultipleSelect` | 下拉多选 | `varchar(500)` 或 `mediumtext` |
| `Radio` | 单选 | `varchar(50)` |
| `Checkbox` | 多选 | `varchar(500)` 或 `mediumtext` |
| `Switch` | 0/1 开关 | `int` |
| `Rate` | 评分 | `int` |
| `Progress` | 进度展示/输入 | `int` |
| `Slider` | 滑块 | `int` 或 `decimal(18,2)` |
| `ColorPicker` | 颜色 | `varchar(50)` |
| `AutoNumber` | 自动编号 | `varchar(200)` |
| `Button` | 表单动作按钮 | 通常 `varchar(50)`，不承载核心业务值 |

## 布局与内容

| Component | 用途 | 规则 |
|---|---|---|
| `Divider` | 分割线 | 布局字段，不进入关键查询 |
| `CollapseGroup` | 局部分组折叠 | 先读 `microi-form-layout` |
| `Tabs` | 字段级页签布局 | 整体多分区优先 `diy_table.Tabs` |
| `Alert` | 提示说明 | 不承载业务状态 |
| `StaticText` | 静态文本 | 不承载业务状态 |
| `Html` | 可信 HTML 展示 | 必须净化，不拼接不可信内容 |
| `RichText` | 富文本 | `mediumtext`；输出需净化 |
| `CodeEditor` | 代码/JSON/SQL 编辑 | `mediumtext`；通常 `FormWidth=24`；长配置表单使用 `Config.CodeEditor.DisplayMode=Dialog`，默认只渲染“编辑代码（N字）”按钮；代码工作台可用 `Inline` |
| `JsonTable` | JSON 表格 | `mediumtext`；定义结构与大小上限 |

## 文件与高级输入

| Component | 用途 | 推荐物理类型 |
|---|---|---|
| `ImgUpload` | 图片上传 | `mediumtext` |
| `FileUpload` | 文件上传 | `mediumtext` |
| `Autocomplete` | 自动完成 | `varchar(200)` |
| `TagInput` | 标签集合 | `varchar(500)` 或 `mediumtext` |
| `Transfer` | 穿梭框多选 | `mediumtext` |
| `Cascader` | 级联选择 | `varchar(500)` |
| `Address` | 省市区地址 | `varchar(500)` |
| `Department` | 部门选择 | `varchar(50)` |
| `SelectTree` | 树形选择 | `varchar(50)` 或 `varchar(500)` |
| `TreeCheckbox` | 树形权限多选 | `mediumtext` |

## 关联、地图与扩展

| Component | 用途 | 关键约束 |
|---|---|---|
| `OpenTable` | 弹出列表选择 | 配置保存字段、显示字段和固定查询范围 |
| `JoinTable` | 关联集合展示 | 查询与权限在服务端完成 |
| `JoinForm` | 嵌入一个独立记录的完整表单 | 主表字段保存一个目标 Id；目标表不能与当前表相同 |
| `TableChild` | 主表内嵌 0..N 条明细列表 | 独立子表、子表真实外键、隐藏子菜单、回查索引 |
| `Map` | 点位 | 高德/百度/腾讯；`Config.MapCompany=System/AMap/Baidu/Tencent`；凭据只进租户“安全与服务接入”，不得写字段配置或公开 SysConfig |
| `MapArea` | 区域 | 与 `Map` 共用供应商安全配置；`mediumtext` 保存 `Paths`，限制路径、点数和体积 |
| `Qrcode` | 二维码卡片展示 | 优先 `IsVirtual=1`；扫码原文另存普通 `varchar` 字段 |
| `FontAwesome` | 图标选择 | `varchar(200)` |
| `DevComponent` | 主前端定制 Vue 控件 | 仅用于长期复用且标准控件无法满足的场景 |

### `Map / MapArea` 运行时与安全边界

- 渲染事实源是 `Microi.Client/src/views/form-engine/diy-field-component/diy-map.vue`；公共错误分类与安全配置请求在同目录 `map-runtime.js`。
- 字段只保存 `Config.MapCompany`，值为 `System / AMap / Baidu / Tencent`。禁止把 Key、securityJsCode、Secret 或代理凭据写入 `diy_field.Config`、V8 前端事件、公开 `sys_config` 投影或前端构建变量。
- 租户凭据使用 `mci_system_setting` 的 `Map.*` 模板，在“系统设置 → 安全与服务接入”由超级管理员维护。运行时由可信后端按 DiyToken 租户和当前供应商做白名单投影，只返回一家的 `ClientKey`，必须 `no-store` 并拒绝访问密钥会话。
- 旧 `sys_config.AMapKey / AMapSecret / BaiduAK` 仅在对应新设置未启用时兼容回退。不要为迁移直接重新公开这些字段。
- 旧字段 `Config` 中的 `MapKey / MapSecret / AMapKey / AMapSecret / BaiduAK / TencentMapKey` 等明文属性不属于运行时配置；设计器保存地图配置时必须清除。迁移顺序固定为“先写入并启用租户 `Map.*` Secret，再清理字段元数据”。
- 浏览器 JS Key 天然可见，必须配置供应商域名/Referer 白名单；高德生产环境优先配置 `Map.AMap.ServiceHost`，存在代理时不得再返回 `SecurityJsCode`。
- 加载中、缺少 Key、运行时接口不匹配、SDK 网络/超时/鉴权/域名/WebGL/容器尺寸错误必须在控件区域显示明确原因码和重试入口，禁止只 `console.warn/error` 后留下空白地图。
- `Map` 保持 `{Name}_Lng / {Name}_Lat / {Name}.{Address,Center,Zoom}`；`MapArea` 保持 `{Name}.{Paths,Center,Zoom}`。三家供应商切换不得改变持久化格式。

### `JoinForm` 不是子表

- `JoinForm` 渲染 `diy-form`，通过 `Config.JoinForm.JoinFieldName` 从当前表单取出一个
  目标记录 Id（也可用固定 `Id` / `_SearchEqual`），因此表达的是“这一条记录关联哪一条
  独立记录”。当前表和目标表相同会被组件判为无效并拒绝渲染。
- `TableChild` 渲染 `diy-table`，通过 `Config.TableChildFkFieldName` 把子表列表限定在
  当前父记录，并依赖 `TableChildTableId` 与 `TableChildSysMenuId` 完成列表和行级增删改。
- `TableChild` 控件字段通常不承担关系存储；真正的关系列位于子表，例如
  `order_detail.OrderId`。不得创建主表 `DetailId` 后用 `JoinForm` 冒充明细。
- 生成前先问“一个父记录最多有几条目标记录”：答案可能大于 1 就选 `TableChild`；只有
  明确恰好一个目标 Id 且需要嵌入完整目标表单时才选 `JoinForm`。不确定时先询问，不写入。

### `Qrcode` 的数据契约

- 字段 `Config.Qrcode` 只保存 `DisplayWidth`、`ShowDownload`、`DownloadText` 等外观项，
  不指定扫码内容。表单运行态必须通过
  `V8.FieldSet('<字段名>', 'DataAppend', payload)` 提供数据。
- `payload.Code` 为必填扫码原文，兼容小写 `code`；可选 `title`、`titleValue`、
  `fields:[{Label,Value}]`（或旧版 `DataConfig:[{label,key}]`）、`Color`、
  `CardColor`、`FileName/fileName`、`createTime`。
- 在 `InFormV8` 中设置时必须跳过 `V8.LoadMode === 'Design'`，否则设计器保存可能把
  运行态 `DataAppend` 固化到字段模型。
- 表单控件会生成 PNG Data URL 并回写控件值以兼容旧页面。纯展示字段优先设
  `IsVirtual=1`；若历史表已有物理字段，则通过 `V8.NotSaveField` 排除保存。不要把 Base64
  图片写入短 `varchar`。需要持久化时保存原始 URL/编号，再把它传给 `Code`。
- 列表二维码列直接渲染原始字段值；表单二维码卡片读取 `DataAppend.Code`，两种场景不得
  混为同一输入协议。
- 二维码中的 URL 仍需服务端鉴权，不得嵌入 DiyToken、访问密钥或长期业务秘密。

```js
if (V8.LoadMode !== 'Design') {
  V8.FieldSet('Qrcode116', 'DataAppend', {
    Code: V8.Form.OrderNo || V8.Form.Id || 'https://microi.net',
    title: '订单二维码',
    titleValue: V8.Form.OrderNo || '',
    fields: [{ Label: '客户：', Value: V8.Form.CustomerName || '' }],
    FileName: '订单-' + (V8.Form.OrderNo || '二维码')
  });
}
```

## 官网历史名称

中文官网可能仍展示 `PhoneSMS`、`Timeline` 等历史/业务扩展控件。生成新字段前
必须在当前 `diy-component-list.json`、目标租户 `diy_field.Component` 和实际客户端
中核对；未出现在当前控件清单的名称不得仅凭旧文档直接生成。

## 常用配置键

这些是 `diy_field.Config` 内的配置路径，不是可调用函数；保存后必须回读
`Config` 并刷新 Schema 缓存：

| 组件族 | 常用配置路径 |
|---|---|
| Textarea | `Textarea.DefaultRows` |
| TagInput | `TagInput.Placeholder`、`TagInput.Options`、`TagInput.MaxCount` |
| Transfer | `Transfer.LeftTitle`、`Transfer.RightTitle`、`Transfer.Filterable`、`Transfer.Options` |
| AutoNumber | `AutoNumber.DataRule`、`AutoNumber.CreateRule`，以及 `AutoNumberFixed`、`AutoNumberLength`、`AutoNumberFields` |
| Button | `Button.Type`、`Button.Icon`、`Button.Size`、`Button.PreviewCanClick`、`Button.RefreshTableAfterClick`、`Button.Loading`（`V8.FieldSet` 时使用 `Config.Button.Loading`） |
| Divider / StaticText | `Divider.Icon`、`StaticText.Content` |
| OpenTable | `OpenTable.BtnName`、`OpenTable.MultipleSelect`、`OpenTable.BeforeOpenV8`、`OpenTable.SubmitV8` |
| CodeEditor / JsonTable | `CodeEditor.Height`、`JsonTable.Columns`、`JsonTable.Columns[].Config` |
| JoinForm | `JoinForm.TableId`、`JoinForm.TableName`、`JoinForm.JoinFieldName`、`JoinForm.FormMode`、`JoinForm.Id`、`JoinForm._SearchEqual` |
| TableChild | Config 根节点的 `TableChildTableId`、`TableChildSysMenuId`、`TableChildFkFieldName`；`TableChild.PrimaryTableFieldName`（默认 `Id`）及分页/导入选项 |
| ImgUpload | `ImgUpload.Limit/Multiple/MaxCount/Tips/Preview/MaxSize/SaveFullPath`；`ImgUpload.Crop.Enabled` 仅表示默认开启，另有 `Mode=free/fixed/select`、`Ratio`、`CustomWidth/CustomHeight`、`AllowZoom/AllowRotate/AllowFlip`；运行时在上传面板内提供裁剪开关，裁剪弹层提供“不裁剪直接上传”；导出时会按最大图片数展开列 |
| FileUpload | `FileUpload.Limit/Multiple/MaxCount/Tips/MaxSize/SaveFullPath`，以及 Office 预览/编辑/版本配置；文件不使用 `ImgUpload.Preview/Crop` |
| RichText | `RichText.Limit`；`Image.Enabled/MaxSize/MaxCount/Preview/CompressMaxSize/CompressMaxWidth`；`Video.Enabled/MaxSize/MaxCount`；`File.Enabled/MaxSize/MaxCount/Accept`；私有正文存稳定标识而不是临时 URL |
| Qrcode | `Qrcode.DisplayWidth`、`Qrcode.ShowDownload`、`Qrcode.DownloadText`；扫码内容使用运行态 `DataAppend.Code` |

其余选择、树、上传、关联和布局选项以当前字段设计器和
`microi-db-schema/references/form-component-options.md` 为事实源；不要凭旧截图
发明配置键。

### `ImgUpload / FileUpload` 生成与运行时规则

```json
{
  "ImgUpload": {
    "Limit": true,
    "Multiple": true,
    "MaxCount": 6,
    "Tips": "支持 JPG、PNG、WebP",
    "Preview": true,
    "MaxSize": 10,
    "SaveFullPath": false,
    "Crop": {
      "Enabled": true,
      "Mode": "select",
      "Ratio": "16:9",
      "CustomWidth": 1,
      "CustomHeight": 1,
      "AllowZoom": true,
      "AllowRotate": true,
      "AllowFlip": true
    }
  }
}
```

- `Limit=true` 表示字段配置为私有桶，`false` 表示配置为公有桶；最终访问仍服从后端租户权限和上传安全策略。
- `Multiple=true` 时 `MaxCount` 必须是正整数；`MaxSize` 单位为 MB。`Preview` 未配置时按 `true` 压缩，普通列表、卡片、商品图不要关闭。
- `Crop.Enabled` 只决定运行时裁剪开关的初始状态；`false` 或缺失时用户仍可在紧凑上传面板主动开启。裁剪前原图始终进入 HDFS 私有桶，业务字段只保存展示图元数据。
- 图片和文件都把拖放提示、存储范围、单/多文件、最大数量、处理方式和最大体积合并到同一个紧凑面板；不要在字段外再生成重复说明卡片。

### `RichText` 生成与运行时规则

```json
{
  "RichText": {
    "EditorProduct": "WangEditor",
    "Limit": true,
    "Image": {
      "Enabled": true,
      "MaxSize": 20,
      "MaxCount": 10,
      "Preview": true,
      "CompressMaxSize": 500,
      "CompressMaxWidth": 1920
    },
    "Video": { "Enabled": true, "MaxSize": 200, "MaxCount": 3 },
    "File": { "Enabled": true, "MaxSize": 100, "MaxCount": 10, "Accept": "" }
  }
}
```

- 公开公告、商品详情等匿名网页内容显式用 `Limit=false`；内部公告、合同说明等用 `true`。旧字段缺失时默认私有，不能由 AI 猜成公有。
- `MaxSize` 单位 MB，`CompressMaxSize` 单位 KB。图片压缩开启时原图仍先进入 HDFS 私有桶，正文只引用展示图。
- 私有正文只保存 `/__microi_richtext_private__/...` 稳定标识；运行时携带当前菜单、表、记录和字段上下文换取短效代理 URL，禁止把临时 Token/Ticket 回写字段。
- 普通文件通过富文本工具栏附件入口插入 `a.href`；私有授权只接受真实 `img/video/source.src` 与 `a.href` 的精确路径，不接受正文文字、`data-*` 或脚本标签。
- RichText 通常使用 `FormWidth=24`，配置摘要保持单行紧凑，不要再生成独立的大说明卡。

## 宽度与重字段

- 普通 Text、Select、NumberText、DateTime 默认不写 `FormWidth`。
- Textarea、RichText、CodeEditor、JsonTable、上传、子表、地图、布局和定制组件通常 `FormWidth=24`。
- 列表默认隐藏上传、富文本、地图、子表、布局等重字段；按需在详情中加载。
