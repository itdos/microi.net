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

## 安全 / 性能注意

- ❌ 不要在循环中逐条 `AddFormData` 而不传 `V8.DbTrans`：每条独立事务，性能差且部分失败会留脏数据
- ✅ 传 `V8.DbTrans` 让所有插入在同一事务，失败自动回滚
- ✅ 大文件（>1万行）建议拆批 `AddTableData` 批量插入
- ✅ 校验字段长度、类型、必填，防脏数据
- ✅ 接口引擎要返回文件，必须在配置中开启【响应文件】
- ✅ 进度 Key 用 `Microi:${V8.OsClient}:Category:Key` 命名，区分租户
