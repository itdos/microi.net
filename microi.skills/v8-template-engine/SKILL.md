# Microi V8 模板引擎（表格/表单 V8 模板）

你正在为 Microi 吾码平台编写 **表格 V8 模板引擎**、**表单 V8 模板引擎** 代码。模板引擎用于在数据渲染后自定义最终展示效果（颜色、徽章、图片、HTML），是表单引擎的高级特性。

## 核心规则

- 模板引擎绑定在【表单属性】的【表格 V8 模板引擎】或【表单 V8 模板引擎】
- 通过给 `V8.Result` 赋值字符串（HTML 或纯文本）来控制最终渲染结果
- 在 **表格模板** 中：每行数据都会执行一次，`V8.Form` 是当前行数据
- 注意：`V8.Form` 此时只能访问到【模块引擎】配置的【查询列】字段；若查询列为空则可访问全部字段
- 支持 `bootstrap`、`element-ui` 样式类名
- `V8.EventName` 可能为 `TableTemplateEngine` 或 `FormTemplateEngine`

## 状态徽章（Bootstrap 样式）

```javascript
var value = V8.Form.Zhuangtai;
if (V8.IsNull(value)) {
  V8.Result = '';
} else {
  var classStr = 'badge-primary';
  if (value === '禁用')      classStr = 'badge-danger';
  else if (value === '未通过') classStr = 'badge-warning';
  else if (value === '待审核') classStr = 'badge-info';
  else if (value === '通过')   classStr = 'badge-success';
  V8.Result = '<span class="badge badge-pill ' + classStr + '">' + value + '</span>';
}
```

可用 Bootstrap 徽章类：`badge-primary`, `badge-secondary`, `badge-success`, `badge-danger`, `badge-warning`, `badge-info`, `badge-light`, `badge-dark`

## 内联样式（颜色高亮）

```javascript
// 不同业务状态显示不同字体颜色
if (V8.Form.XuqiuLX === '合并') {
  V8.Result = '<span style="color:blue;">' + V8.Form.XuqiuDDH + '</span>';
} else if (V8.Form.HebingID) {
  V8.Result = '<span style="color:#999;">' + V8.Form.XuqiuDDH + '</span>';
} else {
  V8.Result = V8.Form.XuqiuDDH;
}
```

## 单图列渲染

```javascript
var html = '';
var fileServer = V8.SysConfig.FileServer;
if (!V8.IsNull(V8.Form.GongsiLOGO)) {
  html = '<image src="' + fileServer + V8.Form.GongsiLOGO + '" '
       + 'mode="widthfix" '
       + 'style="height:40px;width:40px;object-fit:cover;margin:5px 0;" />';
}
V8.Result = html;
```

## 多图列渲染（带点击放大）

```javascript
var html = '';
var fileServer = V8.SysConfig.FileServer;
if (!V8.IsNull(V8.Form.TupianMS) && V8.Form.TupianMS.indexOf('[') !== -1) {
  var imgs = JSON.parse(V8.Form.TupianMS);
  imgs.forEach(function(item) {
    html += '<img onclick="window.open(\'' + fileServer + item.Path + '\')" '
         +  'src="' + fileServer + item.Path + '" '
         +  'style="width:40px;height:40px;object-fit:cover;margin:5px 5px 5px 0;cursor:pointer;" />';
  });
}
V8.Result = html;
```

## 进度条渲染

```javascript
var percent = V8.Form.Progress || 0;
var color = '#67C23A';
if (percent < 30) color = '#F56C6C';
else if (percent < 70) color = '#E6A23C';

V8.Result =
  '<div style="width:100%;background:#eee;border-radius:4px;height:16px;position:relative;">'
  + '<div style="width:' + percent + '%;background:' + color + ';height:100%;border-radius:4px;"></div>'
  + '<span style="position:absolute;left:50%;top:0;transform:translateX(-50%);color:#333;font-size:12px;line-height:16px;">' + percent + '%</span>'
  + '</div>';
```

## 多字段合并显示

```javascript
// 联系人姓名 + 电话脱敏
var name = V8.Form.LianxiR || '';
var phone = V8.Form.LianxiPhone || '';
if (phone.length === 11) phone = phone.substring(0, 3) + '****' + phone.substring(7);
V8.Result = '<div><b>' + name + '</b><br/><small style="color:#999;">' + phone + '</small></div>';
```

## 条件性图标

```javascript
var html = V8.Form.Title || '';
if (V8.Form.IsHot === 1) html += ' <i class="fas fa-fire" style="color:#F56C6C;"></i>';
if (V8.Form.IsNew === 1) html += ' <span class="badge badge-danger">NEW</span>';
V8.Result = html;
```

## 与字段值变更事件配合（动态计算）

```javascript
// 表格模板中根据多个字段计算
var price = parseFloat(V8.Form.Price) || 0;
var discount = parseFloat(V8.Form.Discount) || 1;
var total = (price * discount).toFixed(2);
var color = total > 1000 ? '#F56C6C' : '#67C23A';
V8.Result = '<span style="color:' + color + ';font-weight:bold;">¥' + total + '</span>';
```

## 常见错误

❌ 不要在模板中调用 `V8.FormEngine`（每行都查 → N+1 性能问题），如必须查请用 `V8.CacheData`（仅 DataFilterV8 支持）  
❌ 不要返回非字符串到 `V8.Result`（必须是字符串）  
❌ 模板中 `V8.Form` 默认只有【查询列】字段；缺字段就要去模块引擎补查询列  
❌ 不要在模板里写复杂业务逻辑（应放到接口引擎或 DataFilterV8）  

## 与 DataFilterV8 的区别

| | DataFilterV8（后端） | 模板引擎（前端） |
|---|---|---|
| 运行端 | 服务器 | 浏览器 |
| 用途 | 加工数据、脱敏、补字段 | 渲染 HTML 样式 |
| 输出 | `V8.Form.字段 = ...` | `V8.Result = '<html>...</html>'` |
| 字段范围 | 全部数据 | 仅查询列 |
| 性能 | 每行执行（可用 `V8.CacheData`） | 浏览器渲染时执行 |
