# 🧩 所有表单组件

> **本篇对 Microi吾码平台所有表单组件进行介绍**

---

## 通用配置项速查

表单字段的配置主要存储在 `diy_field.Config`。以下配置项为 AI 生成字段、人工设计字段时必须优先理解的通用约定：

| 配置项 | 说明 |
| --- | --- |
| `DataSource`、`Data` | 选项/下拉/树/级联的数据来源。`Select`、`MultipleSelect`、`Radio`、`Checkbox` 必须配置数据源，否则表单为空。 |
| `Sql`、`DataSourceSqlRemote` | SQL 数据源与远程搜索。远程搜索时注意 `$Keyword$` 过滤和 `limit`。 |
| `SelectLabel`、`SelectSaveField`、`SelectSaveFormat` | 显示字段、保存字段、保存格式。用于下拉、树、级联、关联选择等组件。 |
| `EnableSearch` | 是否作为列表搜索条件。 |
| `V8Code`、`V8CodeBlur` | 值变更、失焦等前端 V8 事件代码，代码应格式化保存。 |
| `TextIcon`、`TextIconPosition`、`TextApend`、`TextApendPosition` | 文本类输入框图标、前后缀。 |
| `DateTimeType` | 日期控件类型，例如 `date`、`datetime`。 |
| `ImgUpload`、`FileUpload`、`Upload` | 上传数量、大小、私有文件、上传前后 V8 等配置。 |
| `OpenTable`、`JoinForm`、`JoinTable` | 弹表选择、关联表单、关联表配置。 |
| `TableChild` | 子表配置，包含关联子表、外键、导入匹配、导入回填等。 |

## 单行文本 Text

### 插槽按钮

开启【插槽按钮】后，输入框的前缀或后缀文字会变成按钮。按钮行为统一配置在【插槽按钮V8代码】，不再配置“弹出表格Id”。点击时可使用：

- `V8.EventName === 'FieldSlotButtonClick'`
- `V8.ThisValue`：当前文本框值
- `V8.Event`：原生点击事件
- `V8.Form`、`V8.Field`：当前表单及字段上下文

```js
// 打开任意列表
V8.OpenAnyTable({
  TableName: 'sys_user',
  Title: '选择用户'
});

// 也可以打开表单或调用接口引擎
// V8.OpenAnyForm({ TableName: 'sys_user', Id: V8.ThisValue, FormMode: 'View' });
// var result = await V8.ApiEngine.Run('my-api', { Value: V8.ThisValue });
```

【禁用插槽按钮】只禁用按钮本身，不改变文本框的只读状态。它适合按权限或业务状态禁止按钮操作，因此保留；底层继续兼容历史配置键 `ReadOnlyButton`。

若要限制单行文本只允许输入数字、身份证号、手机号、纯字母等，可通过字段的值变更 V8 事件、表单提交前 V8 事件进行限制：
```js
//Phone字段属性的【值变更V8事件】
V8.Form.Phone = V8.Form.Phone.replace(/\D/g, '');//输入框只能输入数字

//表单提交前V8事件（前后端V8事件均可）
if(V8.Form.Phone.length != 11){
  return { Code : 0,  Msg : '请输入正确的手机号码' };
}
```

## 多行文本 Textarea
>* 多行文本，不限制字数

## 富文本 RichText
>* 富文本编辑器支持图片、视频和普通文件附件，并在编辑器上方用一行紧凑摘要显示当前存储与大小策略。
>* 控件配置可以统一选择公有桶或私有桶，并分别开关图片、视频、文件上传及设置单个大小、单次数量；图片还支持服务端压缩目标体积和最大宽度。旧字段没有这些配置时安全默认为私有桶，图片默认压缩到约 `500 KB`、最长边 `1920 px`。
>* 官网公告、商品详情等需要被匿名网页直接读取的正文应由平台超级管理员显式配置 `Limit=false`；内部通知、合同说明等使用 `Limit=true`。普通交互式帐号不能用前端配置绕过后端强制私有策略。
>* 私有正文不会把 30 分钟短效 URL 或 Token 保存进数据库，而是保存稳定对象标识；每次重新打开记录时，组件按当前菜单、表、记录和字段权限换取新的审计代理地址，所以旧临时地址过期不影响再次预览。外部网站不会获得这段权限上下文，因此要公开展示的正文必须使用公有桶。

推荐配置示例：

```json
{
  "RichText": {
    "EditorProduct": "WangEditor",
    "Limit": false,
    "Image": {
      "Enabled": true,
      "MaxSize": 20,
      "MaxCount": 10,
      "Preview": true,
      "CompressMaxSize": 500,
      "CompressMaxWidth": 1920
    },
    "Video": { "Enabled": true, "MaxSize": 200, "MaxCount": 3 },
    "File": { "Enabled": true, "MaxSize": 100, "MaxCount": 10, "Accept": ".pdf,.docx,.xlsx" }
  }
}
```

`MaxSize` 单位为 MB，`CompressMaxSize` 单位为 KB。图片压缩开启时，展示图遵循这里的目标值，压缩前原图仍先保存到 HDFS 私有桶；正文只保存展示图引用，不暴露原图路径。普通附件通过编辑器工具栏的“上传附件”插入安全链接。

## 文本联想 Autocomplete
>* 输入联想查询下拉选择，也可自定义输入

## 关联Id Guid
>* 一般用于存储string类型的guid值

## 数字 NumberText
>* 默认int类型，如果开启了小数点，记得手动将类型修改为decimal类型，如果4位小数点就是decimal(12,4)，2位小数点就是decimal(12,2)

## 单选框 Radio
>* 常用的单选框

## 复选框 Checkbox
>* 数据库存储为json字符串

## 下拉单选 Select
>* 常用的下拉选择

## 下拉复选 MultipleSelect
>* 数据库存储为json字符串

## 开关 Switch
>* 开关组件默认为int类型，打开1，关闭0（很老的版本默认是bit类型，建议更换为int类型）
>* __<span class="mci-doc-danger">开关组件不能是varchar类型，否则不管数据库存的是"1"或者"0"，都会显示打开</span>__

## 日期时间 DateTime
>* 建议使用varchar类型，主要原因是日期支持各种格式设置

## 图片上传 ImgUpload
>* 默认不允许匿名访问
>* 新增/编辑表单把拖放上传区和当前配置合并成一个紧凑面板，直接显示公有/私有桶、单图/多图与最大数量、压缩状态、最大体积；裁剪开关也位于同一面板内，位置不受字段 Label 的 `left/top/right` 布局影响。
>* 控件配置中的“默认开启裁剪”只决定表单用户进入当前表单时裁剪开关的初始状态，用户仍可按本次上传自行开启或关闭。
>* 裁剪工作台支持自由裁剪、固定比例、用户可选比例和自定义宽高比，并可单独开关缩放、旋转、镜像工具；用户也可点击“不裁剪直接上传”，该动作会继续上传而不是取消选图。
>* 实际应用裁剪时，裁剪图用于业务展示；裁剪前的未改动原图会先写入当前租户 HDFS 私有桶。原图真实路径不会写入业务字段或返回给普通前端。
>* 上传前V8事件可通过`V8.ThisValue`访问到属性
```js
{
  name : "WX20220109-155433@2x.png",
  size : 952063,
  type : "image/png"
}
```
>* 上传后可通过`V8.Form.字段名`访问到图片URL地址、Name等

AI/MCP 创建图片字段时应写入 `diy_field.Config.ImgUpload`，推荐完整配置如下：

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
      "CustomWidth": 7,
      "CustomHeight": 5,
      "AllowZoom": true,
      "AllowRotate": true,
      "AllowFlip": true
    }
  }
}
```

`Limit=true` 表示配置为私有桶，`false` 表示配置为公有桶；`Multiple=true` 时必须同时给出合理的 `MaxCount`；`Preview` 表示图片压缩，未配置时也默认开启；`MaxSize` 单位为 MB。`Crop.Enabled` 表示“默认开启裁剪”，不是裁剪能力总开关。`Mode=free` 表示自由构图；`fixed` 将 `Ratio` 锁定为设计器指定比例；`select` 允许用户在裁剪时切换自由、1:1、4:3、3:4、16:9、9:16、3:2、2:3 与自定义比例。旧字段没有 `Crop` 时运行时开关默认关闭，但用户仍可主动开启裁剪。

多图模式下，Element Plus 会逐张发起上传，而 HDFS 接口在 `Multiple=true` 时仍可能为每次请求返回 `Data: [{...}]`。客户端必须同时兼容 `Data` 对象与单元素数组，逐张替换对应 `uid` 占位项，不能因读取不到数组中的 `Path` 而出现“接口成功但图片不回显”。

## 文件上传 FileUpload
>* 默认不允许匿名访问
>* V8事件同`图片上传 ImgUpload`
>* 与图片上传共用紧凑的拖放/配置二合一面板，显示公有/私有桶、单文件/多文件与最大数量、保留原文件、最大体积。常用配置为 `FileUpload.Limit/Multiple/MaxCount/Tips/MaxSize/SaveFullPath`；文件上传不使用图片压缩或裁剪配置。

## 评分 Rate
>* 评分组件，默认int类型，数据库存储为int类型

## 颜色选择 ColorPicker
>* 颜色选择组件，默认varchar类型，数据库存储为rgb颜色值

## 分割线 Divider
>* 分割表单，不产生物理字段

## 按钮 Button
>* 按钮组件，支持V8代码

## HTML
>* HTML组件，支持自定义HTML代码

## 自动编号 AutoNumber
>* 自带分布式锁的自动编号，支持自定义前缀

## 子表格 TableChild
>* 非常常用的子表
>* 常用配置：
```json
{
  "TableChildTableId": "子表 diy_table.Id",
  "TableChildSysMenuId": "子表菜单 sys_menu.Id",
  "TableChildSysMenuName": "子表菜单名称",
  "TableChildFkFieldName": "XiangmuID",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "DisablePagination": false,
    "NoneDefaultHeight": false,
    "ImportAutoFillFk": true,
    "FieldRelations": [
      ["Code", "XiangmuBM", true],
      ["Name", "XiangmuMC"]
    ]
  }
}
```
>* `TableChildFkFieldName`：子表保存主表关联值的字段。
>* `TableChild.PrimaryTableFieldName`：主表被关联字段，默认 `Id`。
>* `ImportAutoFillFk`：导入子表 Excel 时自动补齐子表外键。
>* `FieldRelations`：每项格式为 `[主表字段, 子表字段, 是否参与导入匹配]`。全部关系用于新增回写和导入回填；第三位 `true` 表示用子表/Excel 值反查主表，多项 `true` 表示组合匹配。
>* 上例只用 `Code -> XiangmuBM` 匹配主表，`Name -> XiangmuMC` 只负责回填，避免 Excel 缺少名称时组合匹配失败。
>* 旧版 `TableChildCallbackField`、`ImportRelations`、`ImportBackfillFields` 和单字段匹配配置仍兼容读取；新版前端会合并去重，并在字段下次保存时清除旧键。
>* 在主表详情子表区域、左右树形页面或通过 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有主表关联列，也应由前端把固定主表关系传给 `/api/FormEngine/ImportDiyTableRow`，后端再补齐外键和 `FieldRelations` 回填列。
>* 子表回查索引必须匹配真实物理隔离方式：物理表有 `OsClient` 时要求以 `(OsClient, 外键)` 开头；独立租户表没有该列时要求以 `(外键)` 开头。物理字段或索引读取失败时配置应拒绝，不能新增无业务语义的 `OsClient` 列规避校验。

## 地图(点) Map

`Map` 用于搜索、点击或拖动标注点，保存经纬度和地址；支持高德、百度、腾讯三种浏览器地图。字段双击配置中的 `Config.MapCompany` 可选：

- `System`：跟随租户“系统设置 → 安全与服务接入”的 `Map.Provider`，推荐使用。
- `AMap`：高德地图。
- `Baidu`：百度地图。
- `Tencent`：腾讯地图。

地图凭据不能写在字段 `Config`、前端源码或公开 `V8.SysConfig` 中。由超级管理员在“安全与服务接入”填写并启用：

| 设置 Key | Secret | 说明 |
|---|:---:|---|
| `Map.Provider` | 否 | 系统默认供应商：`AMap`、`Baidu`、`Tencent` |
| `Map.AMap.JsApiKey` | 是 | 高德 Web JS API Key |
| `Map.AMap.SecurityJsCode` | 是 | 高德 JS API 2.0 安全密钥；未使用安全代理时填写 |
| `Map.AMap.ServiceHost` | 否 | 高德安全代理 `serviceHost`；配置后后端不会把 `SecurityJsCode` 返回浏览器 |
| `Map.Baidu.JsApiKey` | 是 | 百度 JavaScript API AK |
| `Map.Tencent.JsApiKey` | 是 | 腾讯 JavaScript API GL Key |

升级前已经配置的 `sys_config.AMapKey`、`AMapSecret`、`BaiduAK` 会继续作为兼容回退；租户启用新的私密设置后，以新设置为准。地图 JS SDK 的客户端 Key 在浏览器网络面板中天然可见，因此 Secret 表示“数据库密文保存、管理列表掩码”，不能代替供应商的域名/Referer 白名单。高德生产环境优先使用 `serviceHost` 安全代理。

旧设计器曾把 `MapKey / MapSecret` 等凭据写进字段 `Config`。新版运行时不会读取这些字段；管理员在设计器中重新保存地图配置时会自动移除已知的历史凭据属性，只保留供应商选择。正式迁移凭据时应先在“安全与服务接入”保存并启用对应 `Map.*` 设置，再清理旧字段元数据，避免在迁移窗口内中断地图。

控件先显示加载状态；缺少 Key、后端版本不匹配、SDK 网络失败、超时、Key/安全密钥无效、域名未授权、WebGL 不可用或容器没有尺寸时，不会再留下空白区域，而会在地图区域直接显示原因码、处理建议和“重新加载”按钮。接口只按当前供应商返回一份最小配置，响应为 `no-store`，访问密钥会话不能读取。

点位数据继续兼容原格式：经度保存到 `{字段名}_Lng`，纬度保存到 `{字段名}_Lat`，地址、视野中心和缩放级别保存在 `{字段名}` 对象的 `Address`、`Center`、`Zoom` 中。

## 地图(区域) MapArea

`MapArea` 与 `Map` 使用同一供应商和安全配置。编辑模式可开始/停止绘制、右键结束当前折线并清除重画；查看模式只展示结果。路径保存在 `{字段名}.Paths`，格式为二维点集 `[[{ lng, lat }, ...], ...]`，同时保存 `Center` 与 `Zoom`。应按业务限制路径数量和点数，避免把超大轨迹直接放入表单字段。

## 级联选择器 Cascader
>* 自定义级联选择器

## 组织机构 Department
>* 平台组织机构选择

## 地址 Address
>* 省市区联动

## 手机验证码 PhoneSMS
>* 手机验证码组件，支持发送短信验证码

## 进度条 Progress
>* 显示进度，数据库存储数字

## 时间线 Timeline
>* 时间线组件

## 图标库 FontAwesome
>* 集成FontAwesome

## 二维码 Qrcode

`Qrcode` 是表单中的二维码卡片展示控件。字段设置里的“显示宽度、显示下载按钮、下载按钮文案”只控制外观；真正要编码的内容必须放在字段运行态的 `DataAppend.Code` 中。`Code` 可以是网址、编号或任意需要扫码得到的文本。

最常用的做法是在当前表的【进入表单前端 V8 事件（InFormV8）】中设置：

```js
// 设计器保存字段时不要把运行态数据固化进字段配置。
if (V8.LoadMode !== 'Design') {
  var code = V8.Form.OrderNo || V8.Form.Id || 'https://microi.net';
  V8.FieldSet('Qrcode116', 'DataAppend', {
    Code: code,                         // 必填：二维码实际内容
    title: '订单二维码',                // 可选：卡片标题
    titleValue: V8.Form.OrderNo || '',  // 可选：标题右侧值
    fields: [                           // 可选：二维码下方说明
      { Label: '客户：', Value: V8.Form.CustomerName || '' },
      { Label: '状态：', Value: V8.Form.StatusName || '' }
    ],
    Color: '#000000',                   // 可选：二维码颜色
    CardColor: '#3161a6',               // 可选：卡片头尾颜色
    FileName: '订单-' + (V8.Form.OrderNo || '二维码'),
    createTime: false                   // 下载文件名是否追加时间戳
  });
}
```

兼容旧配置时，说明项也可写为 `DataConfig: [{ label:'客户：', key:'张三' }]`；`code`、`fileName` 小写写法同样支持。字段专项配置对应：

```json
{
  "Qrcode": {
    "DisplayWidth": 400,
    "ShowDownload": true,
    "DownloadText": "下载二维码"
  }
}
```

使用时注意：

- `DataAppend.Code` 为空时不生成二维码；仅设置 `Config.Qrcode` 不会自动猜测业务字段。
- 表单中的 `Qrcode` 会生成 PNG Data URL 并回写当前字段以兼容历史代码。纯展示场景应将二维码字段设为 `IsVirtual=1`，或在进入表单事件中把该字段加入 `V8.NotSaveField`，不要用短 `varchar` 保存整张 Base64 图片。
- 若需要保存扫码原文，另建普通 `varchar` 字段保存网址/编号，再把该值传给 `DataAppend.Code`。列表中的二维码列直接把该普通字段值渲染为二维码即可。
- 批量下载可在可信前端 V8 中调用 `await window.downloadQRCode(payloadList)`；每项 payload 与上例结构相同。文件名会自动移除 Windows 非法字符。
- 二维码只能承载内容，不会自动赋予访问权限。扫码后的 URL 仍必须执行正常登录、菜单、表和数据范围校验，禁止把 Token 或长期密钥写入二维码。

## 定制组件 DevComponent
>* 自定义定制开发的组件嵌入到表单中

## 弹出表格 OpenTable
>* 弹出数据列表，选择数据提交后触发事件
>* 弹出前V8引擎代码
```js
//设置查询条件，[V8.Field.XuanzeGLSP]为[弹出表格]控件的[字段名]
V8.OpenTableSetWhere(V8.Field.XuanzeGLSP, [
  ['ShangpinMC', 'Like', '商用直饮机']
]);
```
>* 提交V8事件引擎代码
::: details 展开查看 JavaScript 代码（38 行）
```js
//-------前端代码-------
var selectData = V8.TableRowSelected;//获取选中的数据
var selectIds = selectData.map(item => item.Id);//接口引擎只要Id
var result = await V8.ApiEngine.Run('add-gylx-rwz', {
    GongyiLCID: V8.Form.Id, //关联主表Id
    RenwuZIds: selectIds
});
if(result.Code == 1){
    V8.Tips('添加成功！');
    V8.TableRefresh(V8.Field.GongxuLB, {});//刷新子表
}else{
    V8.Tips('添加失败：' + result.Msg, false);
}

//-------接口引擎[add-gylx-rwz]代码-------
if(!V8.Param.GongyiLCID || !V8.Param.RenwuZIds || V8.Param.RenwuZIds.length == 0){
  return { Code : 0, Msg : '参数错误！' };
}
//先查询任务栈列表数据
var renwuzhanList = V8.FormEngine.GetTableData('diy_APSsczx', {
  Ids : V8.Param.RenwuZIds
});
if(renwuzhanList.Code != 1 || renwuzhanList.Data.length == 0){
  return { Code : 0, Msg : '未查询到任务栈列表数据！'  + (renwuzhanList.Msg || '') };
}
//循环插入
for(var i = 0; i < renwuzhanList.Data.length; i++){
  var item = renwuzhanList.Data[i];
  var addResult = V8.FormEngine.AddFormData('diy_APSgylxsczx', {
    ...item,
    Id : '', //重置子表Id
    GongyiLCID : V8.Param.GongyiLCID //关联主表Id
  }, V8.DbTrans);//带事务
  if(addResult.Code != 1){
    return addResult;//会自动回滚事务，因为Code != 1
  }
}
return { Code : 1 };//会自动提交事务，因为Code == 1
```
:::

## 关联表单 JoinForm
>* 一般用于自定表单模板

## 代码编辑器 CodeEditor
>* 支持代码联想、代码缩进、语法高亮、代码折叠等等
>* `Config.CodeEditor.DisplayMode` 支持 `Inline`（表单内直接显示编辑器，默认兼容模式）和 `Dialog`（只显示 `编辑代码（N字）` 按钮，点击后打开平台统一大圆角代码弹层）。配置入口为【表单设计 → 控件配置 → 默认显示方式】。
>* 配置类长表单或同一 Tab 含多个代码字段时优先使用 `Dialog`，避免 Monaco 编辑器长期占满表单；代码密集型工作台可按字段显式使用 `Inline`。`CodeEditor.Height` 继续控制内联编辑器和弹层编辑区域的建议高度。

## 下拉树 SelectTree

数据量较大时，在【表单设计 → 选择父级等下拉树字段 → 控件配置】选择 SQL 数据源，开启“动态加载”，将“每页条数”设为 `50`。对应配置为 `Config.SelectTree.Lazy=true`、`Config.SelectTree.PageSize=50`；支持 1–200，0 保持原有行为。

- 根节点点击下拉框后才请求，使用“上一页 / 下一页”翻页；展开分支只加载直接子级，超过一页时点击“加载更多子级”。
- 开启“可搜索”后按显示字段搜索整个数据源，能找到尚未加载的分支。原有已选值按存储字段单独回填，不要求它位于当前页，也不会被插入根节点。
- `SelectSaveField`、`SelectLabel` 分别配置存储列、显示列，`SelectTree.ParentField` 配置父级列；数据源需要返回这三列。父级空值、空 GUID、空 ULID 表示根节点。
- 分页查询保留字段 SQL 的过滤条件、当前用户及 `$V8.Form.字段名$` 替换和元数据权限校验。SQL 应使用可作为子查询的 SELECT（需要复杂排序/CTE 时可封装为数据库视图）；分页按存储列稳定排序，不要在源 SQL 中截断全体分类。
- 分页多选逐项选择，不自动勾选尚未加载的子级。普通静态树、自定义 `LazyLoad` 回调和未启用分页的既有字段继续使用原有逻辑。
- SQL 字段接口继续使用 `GetDiyFieldSqlData`，支持 `_ParentValue`、`_PageIndex`、`_PageSize`、`_Keyword`，返回 `DataAppend.HasMore`；`_SelectTreeValues` 用于按存储列回填选中值，每次最多 200 项。

## JSON表格 JsonTable
>* 支持 JSON 数据的表格展示与编辑，字段值保存为结构化 JSON。
>* 配置来源为 `diy_field.Config.JsonTable`，事实源组件是 `Microi.Client/src/views/form-engine/diy-field-component/diy-jsontable.vue`。
>* 必须配置 `Columns`，否则前端只能显示空表。

常用根配置：

| 配置项 | 说明 |
| --- | --- |
| `Columns` | 列配置数组。 |
| `DataSource` | 批量导入/候选数据源类型：`KeyValue`、`Sql`、`DataSource`、`ApiEngine` 等。 |
| `Sql` | SQL 数据源语句；远程搜索时建议带 `$Keyword$` 和 `limit`。 |
| `DataSourceId` | 数据源引擎 Key/Id。 |
| `ApiEngineKey` / `DataSourceApiEngineKey` | 接口引擎 Key。根节点保存为 `ApiEngineKey`，列级配置可使用 `DataSourceApiEngineKey`。 |
| `SelectLabel` | 候选数据展示字段。 |
| `DataSourceSqlRemote` | 是否远程搜索。数据量大时必须启用。 |
| `KeyValueList` | 静态键值数据，格式为 `[{ "Key": "A", "Value": "选项A" }]`。 |

`Columns[]` 每列配置：

| 配置项 | 说明 |
| --- | --- |
| `Id` | 列唯一 Id。 |
| `Sort` | 列排序。 |
| `Label` | 列标题，必填。 |
| `Key` | JSON 行对象属性名，必填。 |
| `Component` | 列编辑控件，支持 `Text`、`Number`、`Textarea`、`Password`、`Select`、`MultipleSelect`、`Radio`、`Checkbox`、`Switch`、`Cascader`、`SelectTree`、`DateTime`、`Rate`、`ColorPicker`、`Progress`、`AutoNumber`、`Autocomplete`、`Address`、`Department`、`Map`、`ImgUpload`、`FileUpload`、`RichText`、`CodeEditor`、`Html`、`Fontawesome`、`Qrcode`、`Divider`、`Button`。 |
| `Width` / `MinWidth` | 固定宽度 / 最小宽度。 |
| `Required` | 是否必填。 |
| `Visible` | 是否显示。 |
| `DefaultValue` | 新增行默认值。 |
| `Placeholder` | 占位提示。 |
| `Readonly` | 是否只读。 |
| `Config` | 列级控件配置。选择类列常用 `DataSource`、`Sql`、`DataSourceId`、`DataSourceApiEngineKey`、`DataSourceSqlRemote`、`SelectLabel`、`SelectSaveField`、`SelectSaveFormat`、`EnableSearch`。 |
| `Data` / `KeyValueList` | 列级静态选项。 |

配置示例：

```json
{
  "JsonTable": {
    "Columns": [
      {
        "Id": "col-material",
        "Sort": 1,
        "Label": "材料名称",
        "Key": "MaterialName",
        "Component": "Text",
        "MinWidth": 160,
        "Required": true,
        "Visible": true,
        "Placeholder": "请输入材料名称"
      },
      {
        "Id": "col-status",
        "Sort": 2,
        "Label": "状态",
        "Key": "Status",
        "Component": "Select",
        "MinWidth": 120,
        "Visible": true,
        "Config": {
          "DataSource": "KeyValue",
          "SelectLabel": "Value",
          "SelectSaveField": "Key",
          "SelectSaveFormat": "Text"
        },
        "KeyValueList": [
          { "Key": "draft", "Value": "草稿" },
          { "Key": "confirmed", "Value": "已确认" }
        ]
      }
    ]
  }
}
```

## 组件配置项补充表

| 组件 | 常用配置项 |
| --- | --- |
| Text / Textarea | `TextShowPassword`、`TextIcon`、`TextApend`、`Textarea.DefaultRows` |
| NumberText / Slider / Rate / Progress / ColorPicker | `NumberTextStep`、`NumberTextPrecision`、`NumberTextMath`、`NumberTextBtn`、`NumberTextBtnPosition`、滑块/评分/进度/颜色值配置 |
| Select / MultipleSelect / Radio / Checkbox | `DataSource`、`Data`、`Sql`、`DataSourceId`、`DataSourceApiEngineKey`、`SelectLabel`、`SelectSaveField`、`SelectSaveFormat` |
| Autocomplete / TagInput / Transfer | 联想数据源、`TagInput.Placeholder`、`TagInput.Options`、`TagInput.MaxCount`、`Transfer.LeftTitle`、`Transfer.RightTitle`、`Transfer.Filterable`、`Transfer.Options` |
| AutoNumber | `AutoNumberFixed`、`AutoNumberLength`、`AutoNumberFields`、`AutoNumber.DataRule`、`AutoNumber.CreateRule` |
| Button | `Button.Type`、`Button.Icon`、`Button.Size`、`Button.PreviewCanClick`、`Button.RefreshTableAfterClick` |
| Divider / CollapseGroup / Tabs / Alert / StaticText | `DividerPosition`、`Divider.Icon`、`CollapseGroup.*`、`FieldTabs.*`、`Alert.*`、`StaticText.Content` |
| ImgUpload / FileUpload | `Limit`、`Multiple`、`Tips`、`MaxCount`、`ShowFileList`、`Preview`、`MaxSize`、`Upload.*V8`；ImgUpload 另支持 `Crop.Enabled/Mode/Ratio/CustomWidth/CustomHeight/AllowZoom/AllowRotate/AllowFlip` |
| Cascader / SelectTree / Department / Address / TreeCheckbox | `Lazy`、`Filterable`、`Value`、`Label`、`Children`、`ParentField`、`ParentFields`、`Multiple`、`EmitPath`、`TreeCheckbox.*` |
| OpenTable / JoinForm / JoinTable | `OpenTable.BtnName`、`OpenTable.MultipleSelect`、`OpenTable.BeforeOpenV8`、`OpenTable.SubmitV8`、`JoinForm.*`、`JoinTable.*` |
| CodeEditor / JsonTable / Html | `CodeEditor.Height`、`CodeEditor.DisplayMode=Inline/Dialog`、`JsonTable.Columns`、`JsonTable.Columns[].Config`、JSON/HTML 内容配置 |
| RichText | `RichText.Limit`；`Image.Enabled/MaxSize/MaxCount/Preview/CompressMaxSize/CompressMaxWidth`；`Video.Enabled/MaxSize/MaxCount`；`File.Enabled/MaxSize/MaxCount/Accept` |
| Map / MapArea / Qrcode / FontAwesome / DevComponent | `MapCompany=System/AMap/Baidu/Tencent`（凭据只在“安全与服务接入”维护）；`Qrcode.DisplayWidth`、`Qrcode.ShowDownload`、`Qrcode.DownloadText`（二维码内容由 `DataAppend.Code` 提供）；图标类名；`DevComponentName`、`DevComponentPath` |

`ImgUpload.Preview` 新配置默认开启；未配置时后端也按开启处理。展示图默认约 `500 KB`、最长边 `1920 px`，原图会先保存到 HDFS 私有桶。只有明确需要原始画质且已评估页面性能时才应关闭，列表、卡片和商品图不应关闭。
