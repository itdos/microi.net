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
| `CodeEditor` | 代码/JSON/SQL 编辑 | `mediumtext`；通常 `FormWidth=24` |
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
| `Map` | 点位 | `varchar(200)`/`mediumtext`，明确坐标格式 |
| `MapArea` | 区域 | `mediumtext`，限制点数/体积 |
| `Qrcode` | 二维码展示 | `varchar(500)` |
| `FontAwesome` | 图标选择 | `varchar(200)` |
| `DevComponent` | 主前端定制 Vue 控件 | 仅用于长期复用且标准控件无法满足的场景 |

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
| ImgUpload | `ImgUpload.Multiple`；导出时会按最大图片数展开列 |

其余选择、树、上传、关联和布局选项以当前字段设计器和
`microi-db-schema/references/form-component-options.md` 为事实源；不要凭旧截图
发明配置键。

## 宽度与重字段

- 普通 Text、Select、NumberText、DateTime 默认不写 `FormWidth`。
- Textarea、RichText、CodeEditor、JsonTable、上传、子表、地图、布局和定制组件通常 `FormWidth=24`。
- 列表默认隐藏上传、富文本、地图、子表、布局等重字段；按需在详情中加载。
