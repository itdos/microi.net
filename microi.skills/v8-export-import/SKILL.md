---
name: v8-export-import
description: Microi V8 Excel 导入导出指南。用于使用 V8.Office.ExportExcel、ExcelToList、自定义表头、图片导出、文件响应和批量数据导入校验。
---

# Microi V8 Excel 导入导出

你正在为 Microi 吾码平台编写自定义 Excel 导入/导出代码。平台通过 `V8.Office` 提供 Excel 处理能力，源码在 `Microi.Office` 插件中。

## 核心 API

| 方法 | 说明 |
|------|------|
| `V8.Office.ExportExcel({...})` | 自定义动态导出 Excel（支持图片、多图列） |
| `V8.Office.ExcelToList({...})` | 解析上传的 Excel 文件为 JSON 数组 |
| `V8.Office.SendEmail({...})` | 发送邮件（HTML 内容） |

## 自定义导出 Excel（接口引擎）

平台默认导出仅支持表格已展示的字段。如需自定义（如列重排、合并、计算列、图片），用接口引擎替换【导出接口】。

```javascript
// 1. 查询数据（动态条件）
var dataResult = V8.FormEngine.GetTableData('diy_blog_test', {
  _Where: [['Xingming', 'Like', V8.Param.keyword || '']]
});
if (dataResult.Code !== 1) return dataResult;

// 2. 定义动态表头
var header = [
  { Name: 'Biaoti', Label: '标题', Component: 'Text' },
  { Name: 'Xingming', Label: '姓名', Component: 'Text' },
  {
    Name: 'ImgUpload57',
    Label: '公有单图',
    Component: 'ImgUpload',
    Config: '{"ImgUpload":{"Multiple":0,"Limit":0}}'
  },
  {
    Name: 'ImgUpload64',
    Label: '公有多图',
    Component: 'ImgUpload',
    Config: '{"ImgUpload":{"Multiple":1,"Limit":0}}'  // Multiple=1 自动多图分列
  }
];

// 3. 调用导出引擎
var excelResult = V8.Office.ExportExcel({
  OsClient: V8.OsClient,
  ExcelData: dataResult.Data,
  ExcelHeader: header
});
if (excelResult.Code !== 1) return excelResult;

// 4. 返回文件流（接口引擎必须开启【响应文件】配置）
return {
  Code: 1,
  Data: {
    FileName: '导出_' + DateNow('yyyyMMdd_HHmmss') + '.xls',
    ContentType: 'application/vnd.ms-excel',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};
```

### 表头配置项

| 字段 | 说明 |
|------|------|
| `Name` | 数据字段名（对应 `ExcelData[i].Name`） |
| `Label` | Excel 列标题 |
| `Component` | 组件类型，决定渲染方式：`Text`/`Select`/`Switch`/`ImgUpload`/`DateTime`/`NumberText` 等 |
| `Config` | 组件配置 JSON 字符串。`ImgUpload.Multiple=1` 时自动生成多列并合并；`Limit=0` 公有桶，`1` 私有桶（需临时URL） |

## 解析上传的 Excel（导入）

```javascript
// 接口引擎接收 V8.FilesByteBase64
var filesByteBase64 = V8.FilesByteBase64;
if (!filesByteBase64) return { Code: 0, Msg: '请上传 Excel 文件' };

var base64 = Object.values(filesByteBase64)[0];

// 解析第一张工作表为对象数组
var parsed = V8.Office.ExcelToList({
  FileByteBase64: base64,
  SheetIndex: 0
});
if (parsed.Code !== 1) return parsed;

var dataList = parsed.Data;  // [{ 列标题: 值, ... }, ...]
return { Code: 1, Data: dataList, DataCount: dataList.length };
```

## 完整导入模式（含进度跟踪）

模块引擎【导入接口替换】+【导入进度接口替换】可实现实时进度提示。

### 导入接口（替换默认导入）

```javascript
if (!V8.Param.TableId) {
  return { Code: 0, Msg: '必须指定 TableId 标记当前导入哪张表' };
}

var importingKey = 'Microi:' + V8.OsClient + ':ImportTableDataStart:' + V8.Param.TableId;
var stepKey      = 'Microi:' + V8.OsClient + ':ImportTableDataStep:'  + V8.Param.TableId;

// 防止重复导入
if (V8.Cache.Get(importingKey) === '1') {
  return { Code: 0, Msg: '有数据正在导入中，请稍后再试' };
}
V8.Cache.Set(importingKey, '1');

var stepList = [];
function pushStep(msg) {
  stepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + '：' + msg);
  V8.Cache.Set(stepKey, JSON.stringify(stepList));
}

pushStep('正在读取文件数据...');

// 解析 Excel
var base64 = Object.values(V8.FilesByteBase64)[0];
var parsed = V8.Office.ExcelToList({ FileByteBase64: base64, SheetIndex: 0 });
if (parsed.Code !== 1) {
  V8.Cache.Set(importingKey, '0');
  pushStep('文件解析失败：' + parsed.Msg);
  return parsed;
}

pushStep('已读取【' + parsed.Data.length + '】条数据');
pushStep('已导入【0】条数据...');

// 循环导入
for (var i = 0; i < parsed.Data.length; i++) {
  var row = parsed.Data[i];
  // 字段映射 / 校验
  row.AAA = 111;

  var addResult = V8.FormEngine.AddFormData(V8.Param.TableName, row, V8.DbTrans);
  if (addResult.Code !== 1) {
    V8.Cache.Set(importingKey, '0');
    pushStep('导入第 ' + (i + 1) + ' 条出错：' + addResult.Msg + '（已回滚）');
    return { Code: 0, Msg: addResult.Msg };  // 平台自动回滚事务
  }
  // 覆盖最后一条进度
  stepList[stepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + '：已导入【' + (i + 1) + '】条';
  V8.Cache.Set(stepKey, JSON.stringify(stepList));
}

pushStep('导入成功，已结束');
V8.Cache.Set(importingKey, '0');
return { Code: 1, Data: { Imported: parsed.Data.length } };
```

### 导入进度查询接口

```javascript
if (!V8.Param.TableId) return { Code: 0, Msg: '需要 TableId' };
var stepStr = V8.Cache.Get('Microi:' + V8.OsClient + ':ImportTableDataStep:' + V8.Param.TableId);
return { Code: 1, Data: stepStr ? JSON.parse(stepStr) : [] };
```

## 接收并下载文件（HTTP 链接转 Excel）

```javascript
// 从 URL 下载图片插入 Excel 等场景
var resp = V8.Http.GetResponse({
  Url: 'https://static.itdos.com/path/file.png'
});
var bytes = resp.RawBytes;            // .NET byte[]
var base64 = System.Convert.ToBase64String(bytes);
```

## 子表导入自动关联主表

当单独导入 `TableChild` 子表时，Excel 经常没有主表 Id，只带项目编号、客户名称等业务字段。默认导入引擎支持通过子表控件配置批量反查主表，并自动补齐子表外键。

在主表 `TableChild` 字段的 `Config.TableChild` 中配置：

```json
{
  "TableChild": {
    "TableChildTableId": "子表 diy_table.Id",
    "TableChildFkFieldName": "XiangmuID",
    "ImportAutoFillFk": true,
    "ImportRelations": [
      { "Parent": "Code", "Child": "XiangmuBM" }
    ],
    "ImportBackfillFields": [
      { "Parent": "Name", "Child": "XiangmuMC" }
    ]
  }
}
```

配置含义：

- `ImportAutoFillFk`：是否在导入子表时自动补齐 `TableChildFkFieldName`；默认建议开启。
- `ImportRelations`：主表字段与子表/Excel 字段的匹配关系，`Parent` 和 `Child` 可填字段名或字段标题。可配置多组，作为组合条件匹配。
- `ImportBackfillFields`：主表字段回填到子表字段的映射。用于 Excel 没有项目编号、项目名称、客户名称等冗余展示列时，在找到主表后自动把主表值写入子表列。
- 兼容旧配置：`ImportParentMatchFieldName` + `ImportChildMatchFieldName` 仍可使用，但新配置优先使用 `ImportRelations`。
- 兼容旧回写配置：根节点 `Config.TableChildCallbackField` 可保存同样的 JSON 数组；新导入逻辑会与 `Config.TableChild.ImportBackfillFields` 合并处理。

运行规则：

- 只有子表外键为空时才补齐；Excel 已传外键时不覆盖。
- `ImportBackfillFields` 只有在子表对应字段为空时才写入；Excel 已传该字段值时不覆盖。
- 导入前按业务字段批量查询主表，避免逐行查询。
- 从主表表单内或 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有匹配字段，也可以通过固定主表 Id 查询主表并回填子表外键和 `ImportBackfillFields`。
- 如果业务字段为空、主表找不到或匹配到多条主表，当前行不自动补齐，并写入导入进度/后台日志，避免错误关联。
- 示例：项目主表 `xiangmuguanli.Code` 匹配用料清单 `yongliaoqqingdan.XiangmuBM`，自动写入 `yongliaoqqingdan.XiangmuID`。
- 示例：项目主表 `xiangmuguanli.Name` 回填成品清单 `xiangmugoujianqd.XiangmuMC`，保证导入模板缺少项目名称列时列表仍显示正常。

## 安全 / 性能注意

- ❌ 不要在循环中逐条 `AddFormData` 而不传 `V8.DbTrans`：每条独立事务，性能差且部分失败会留脏数据
- ✅ 传 `V8.DbTrans` 让所有插入在同一事务，失败自动回滚
- ✅ 大文件（>1万行）建议拆批 `AddTableData` 批量插入
- ✅ 校验字段长度、类型、必填，防脏数据
- ✅ 接口引擎要返回文件，必须在配置中开启【响应文件】
- ✅ 进度 Key 用 `Microi:${V8.OsClient}:Category:Key` 命名，区分租户

### 复盘：应用包同步物理字段时直接 ALTER 导致安装异常

- 触发场景：目标租户安装或升级应用包时，已有长文本配置超过来源包的 `varchar(N)` 长度，或历史数值字段仍以空字符串保存，`MODIFY COLUMN` 分别报 `Data too long`、`Incorrect integer value: ''`。
- 根因：导入器把来源库物理字段定义直接覆盖到目标库，没有判断是否属于缩窄变更，也没有在文本转数值前兼容平台历史空值。
- 通用规则：物理字段同步必须只扩宽、不缩窄；目标库已有更宽文本类型或更大整数类型时保留目标类型。文本转数值前仅可把空字符串规范为 `NULL`，发现非空非数字值必须中止该字段迁移并报告数量，禁止静默转为 `0` 或截断数据。只要导入日志存在异常，就不得写入“安装成功”的应用版本记录。
- 自动化检查：准备“超长 JSON + 空字符串数值 + 非数字脏值”三类旧库样本，重复安装同一应用包；前两类应无异常且数据不丢失，第三类应明确失败且原数据保持不变。

### 复盘：重复字段与业务 Key 改名破坏应用包幂等安装

- 触发场景：应用包中同一张表出现两个同名字段时，第一次 `ADD COLUMN` 成功、第二次报 `Duplicate column name`；在线应用保留原 Id 但修改 `AppKey/MsKey` 后，目标库按新 Key 查不到记录，又用原 Id 执行 INSERT，报主键重复。
- 根因：安装器只在阶段开始时读取一次物理字段快照，新增后没有更新；同时只按业务 Key 判断在线应用是否存在，没有优先按稳定 Id 对齐，也没有迁移旧 Key 关联的微服务和页面。
- 通用规则：包内字段必须按 `TableId + lower(Name)` 去重，新增物理列后立刻更新内存快照；并发或历史残留造成的重复列错误需回查后按幂等跳过。在线应用、微服务及版本数据必须先按 Id、再按业务 Key 查找；Id 命中而 Key 变化时更新原记录并沿用原 Id，把关联页面统一迁移到新 Key，禁止再次 INSERT。
- 自动化检查：构造“同表重复字段”和“固定 AppId、AppKey 从 old-key 改为 new-key”两个包，连续安装至少两次；每次都应 `Code=1`，物理列、应用、微服务均只有一条，所有页面引用新 Key 且保留原关联 Id。

### 复盘：租户历史残留绕过 FormEngine 查询后触发主键和重命名冲突

- 触发场景：同一应用包在平台主租户、平台子租户和客户独立部署中表现不同；字段导入报 `diy_field.PRIMARY` 重复，字段改名报目标物理列已存在，旧版微服务包还可能调用不存在的 ZIP 哈希函数。
- 根因：导入器只用 FormEngine 判断记录是否存在，软删除、空 OsClient 或历史异常记录会被过滤，但物理主键仍在；字段重命名只判断元数据变化，没有在 DDL 前分别检查源列和目标列；修复只写入某个租户接口引擎，没有让全局升级器按导入器能力重新刷新。
- 通用规则：元数据 UPSERT 必须在 FormEngine 未命中时直查物理主键；同一逻辑字段应恢复后更新，真正的 Id 冲突应生成目标 Id 并建立包内引用映射。执行 `CHANGE COLUMN` 前必须检查源列存在且目标列不存在，目标列已存在时按幂等跳过。导入器修复必须同时更新官方资源、目标租户和自动升级能力检测，禁止只依赖全局版本号。
- 自动化检查：准备软删除主键、空租户主键、同表目标列已存在、旧导入器函数缺失四类租户快照；连续安装系统设置、首页数据包和含源码 ZIP 的微服务包两次，均应 `Code=1` 且版本记录只反映无异常安装。再把全局版本号设为高于修复版本、导入器降级，验证启动升级仍会按能力标记自动恢复导入器且不降低全局版本号。
