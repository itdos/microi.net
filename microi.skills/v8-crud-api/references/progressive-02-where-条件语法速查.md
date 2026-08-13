# v8-crud-api 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-crud-api-015 sha256=f68c7713878a84a265a5185940d25db21525e73a7dba6d05ba6f82030b96e60a -->
## _Where 条件语法速查

```javascript
// 等于
[['Field', '=', value]]

// 模糊查询
[['Name', 'Like', '张']]      // %张%
[['Name', 'StartLike', '张']] // 张%
[['Name', 'EndLike', '三']]   // %三

// AND / OR
[['A', '=', 1], ['AND', 'B', '>', 10]]
[['A', '=', 1], ['OR', 'B', '=', 2]]

// IN / NotIn
[['Id', 'In', ['id1', 'id2', 'id3']]]
[['Status', 'NotIn', [0, -1]]]

// NULL
[['Field', '=', null]]    // IS NULL
[['Field', '<>', null]]   // IS NOT NULL

// 分组（括号）
[['Name', 'Like', '张'], ['AND', '(', 'Age', '>', 18], ['OR', 'Status', '=', 1, ')']]

// 日期范围
[['CreateTime', '>=', '2024-01-01'], ['AND', 'CreateTime', '<', '2024-02-01']]
```

**支持的操作符：** `=`, `==`, `<>`, `!=`, `>`, `>=`, `<`, `<=`, `Like`, `NotLike`, `StartLike`, `EndLike`, `In`, `NotIn`

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-016 sha256=6fe2c6360151a569c46bdc2234b622f7ae8a2f3f76376fda5d90b2ab10ac4e51 -->
## 注意事项

- `_Where` 是参数化查询，自动防 SQL 注入，**不要拼接 SQL 字符串**
- `AddFormData` 不需要传 `Id`，后端自动生成 GUID
- `UptFormData` 必须包含 `Id` 字段
- 如需触发表单 V8 事件，在参数中加 `_InvokeType: 'Client'`
- 返回值中 `Code: 1` 表示成功，`Code: 0` 表示失败，`Code: 2` 表示数据不存在
- 分页参数使用 `_PageIndex` 和 `_PageSize`（带下划线前缀）
- 列表返回总数字段为 `result.DataCount`（非 Total）
<!-- /microi-progressive:chunk -->
