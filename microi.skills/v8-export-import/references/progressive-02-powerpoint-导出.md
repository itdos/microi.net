# v8-export-import 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-export-import-007 sha256=d2958751b32d5143693cbdb6fb72aeca97f450c80c360aa7d826d4f6595c0ab1 -->
## PowerPoint 导出

PowerPoint 的幻灯片尺寸、图片/表格位置与宽高单位均为英寸，默认画布为 16:9（13.333 × 7.5）。

```javascript
var pptResult = V8.Office.ExportPowerPoint({
  Title: '季度经营汇报',
  Author: V8.CurrentUser.Name,
  Subject: '季度复盘',
  Company: '吾码',
  SlideWidth: 13.333,
  SlideHeight: 7.5,
  FontFamily: 'Microsoft YaHei',
  BackgroundColor: 'FFFFFF',
  TitleColor: '17365D',
  TextColor: '222222',
  TitleFontSize: 28,
  BodyFontSize: 18,
  ShowSlideNumber: true,
  Slides: [
    {
      Layout: 'TitleSlide',
      Title: '季度经营汇报',
      Subtitle: DateNow('yyyy-MM-dd')
    },
    {
      Layout: 'TitleAndContent',
      Title: '核心结论',
      Bullets: ['收入保持增长', '重点客户续约稳定'],
      TextItems: [
        { Text: '风险：回款周期延长', Bullet: true, Level: 0, Bold: true, FontColor: 'C00000' }
      ],
      Tables: [{
        Headers: ['指标', '本期', '目标'],
        Rows: [['销售额', '128万', '120万']],
        X: 0.7, Y: 4.0, Width: 11.9, Height: 2.2,
        HeaderBackgroundColor: '17365D'
      }]
    },
    {
      Title: '趋势图',
      Images: [{
        FileByteBase64: chartBase64,
        FileName: 'trend.png',
        ContentType: 'image/png',
        X: 1.2, Y: 1.5, Width: 10.9, Height: 5.2
      }]
    }
  ]
});
if (pptResult.Code !== 1) return pptResult;
return {
  Code: 1,
  Data: {
    FileName: '季度经营汇报.pptx',
    ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    FileByteBase64: System.Convert.ToBase64String(pptResult.Data)
  }
};
```

`Layout` 支持 `TitleSlide`、`TitleAndContent`。单页支持独立覆盖 `BackgroundColor/TitleColor/TextColor/TitleFontSize/BodyFontSize`。`TextItems` 支持 `Text/Level/Bullet/Bold/Italic/FontSize/FontColor/Alignment`；表格支持位置、尺寸、列宽、表头/单元格颜色；图片支持 Base64/data URI、位置和尺寸。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-008 sha256=4dcd566dd9c5b38703831c67cc5cc2f2a99b0e7121fe2d2be2c068cfc8f739c3 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-009 sha256=76d08b493419719094a95a5b760a83ae09b136bd54d66d2362efd428dea03ff8 -->
## 接收并下载文件（HTTP 链接转 Excel）

```javascript
// 从 URL 下载图片插入 Excel 等场景
var resp = V8.Http.GetResponse({
  Url: 'https://static.itdos.com/path/file.png'
});
var bytes = resp.RawBytes;            // .NET byte[]
var base64 = System.Convert.ToBase64String(bytes);
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-export-import-010 sha256=0df463f76ba60100c087364b48dab1886d1315b093577ea9485471b34a7a3f6c -->
## 子表导入自动关联主表

当单独导入 `TableChild` 子表时，Excel 经常没有主表 Id，只带项目编号、客户名称等业务字段。默认导入引擎支持通过子表控件配置批量反查主表，并自动补齐子表外键。

本节只适用于“主表 1:N 子表”；单条独立记录关联应使用 `JoinForm`，不能把明细导入模型
设计成 `JoinForm`。在主表 `TableChild` 字段的 `Config` 中配置，其中子表、菜单和外键
位于 Config 根节点，导入选项位于 `Config.TableChild`：

```json
{
  "TableChildTableId": "子表 diy_table.Id",
  "TableChildSysMenuId": "子表 sys_menu.Id",
  "TableChildSysMenuName": "项目成品清单",
  "TableChildFkFieldName": "XiangmuId",
  "TableChild": {
    "PrimaryTableFieldName": "Id",
    "ImportAutoFillFk": true,
    "FieldRelations": [
      ["Code", "XiangmuBM", true],
      ["Name", "XiangmuMC"]
    ]
  }
}
```

配置含义：

- 根节点 `TableChildTableId` / `TableChildSysMenuId` / `TableChildFkFieldName` 必须是
  回读后的真实子表、隐藏子菜单和子表物理外键，不能猜 Id，也不能放进内层
  `Config.TableChild`。
- `ImportAutoFillFk`：是否在导入子表时自动补齐 Config 根节点指定的
  `TableChildFkFieldName`；默认建议开启。
- `FieldRelations`：每项为 `[主表字段, 子表/Excel字段, 是否参与导入匹配]`。全部关系用于新增回写和导入回填；第三位为 `true` 的关系用于反查主表，多项为 `true` 时作为组合条件匹配。
- 不要把所有回填关系都标为 `true`。例如 Excel 只保证有项目编号时，`["Code","XiangmuBM",true]` 负责匹配，`["Name","XiangmuMC"]` 只在找到主表后补名称。
- 后端继续读取旧版 `ImportParentMatchFieldName` / `ImportChildMatchFieldName`、`ImportRelations`、`ImportBackfillFields` 和根节点 `TableChildCallbackField`；新版前端会合并去重为 `FieldRelations`，并在字段下次保存时清除旧键。

运行规则：

- 只有子表外键为空时才补齐；Excel 已传外键时不覆盖。
- `FieldRelations` 回填只有在子表对应字段为空时才写入；Excel 已传该字段值时不覆盖。
- 导入前按业务字段批量查询主表，避免逐行查询。
- 从主表表单内、左右树形页面或 `V8.OpenAnyTable` 带主表条件打开子表后导入时，即使 Excel 没有匹配字段，也可以通过固定主表 Id 查询主表并回填子表外键和全部 `FieldRelations`。
- 如果业务字段为空、主表找不到或匹配到多条主表，当前行不自动补齐，并写入导入进度/后台日志，避免错误关联。
- 示例：项目主表 `xiangmuguanli.Code` 匹配用料清单 `yongliaoqqingdan.XiangmuBM`，自动写入 `yongliaoqqingdan.XiangmuID`。
- 示例：项目主表 `xiangmuguanli.Name` 回填成品清单 `xiangmugoujianqd.XiangmuMC`，保证导入模板缺少项目名称列时列表仍显示正常。

<!-- /microi-progressive:chunk -->
