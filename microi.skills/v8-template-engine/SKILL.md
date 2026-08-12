---
name: v8-template-engine
description: Microi V8 模板引擎指南。用于编写表格/表单模板渲染、V8.Result HTML/text 输出、行格式化、徽章、图片和自定义显示逻辑。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi V8 模板引擎（表格/表单 V8 模板）

你正在为 Microi 吾码平台编写 **表格 V8 模板引擎**、**表单 V8 模板引擎** 代码。模板引擎用于在数据渲染后自定义最终展示效果（颜色、徽章、图片、HTML），是表单引擎的高级特性。

## 核心规则

- 模板引擎绑定在【表单属性】的【表格 V8 模板引擎】或【表单 V8 模板引擎】
- 通过给 `V8.Result` 赋值字符串（HTML 或纯文本）来控制最终渲染结果
- 在 **表格模板** 中：每行数据都会执行一次，`V8.Form` 是当前行数据
- 注意：`V8.Form` 此时只能访问到【模块引擎】配置的【查询列】字段；若查询列为空则可访问全部字段
- 支持 `bootstrap`、`element-ui` 样式类名
- `V8.EventName` 可能为 `TableTemplateEngine` 或 `FormTemplateEngine`
- 表格模板同步执行，输出优先级是 `V8.Result` → JavaScript `return` → 原字段值；表单模板异步执行并以 `V8.Result` 为输出
- 模板结果通过 `v-safe-html`/DOMPurify 净化。`script`、`iframe`、`on*` 事件属性、`javascript:` 等危险内容会被剥离，禁止依赖内联点击事件
- 业务文本必须 HTML 转义后再拼接；权限、校验、状态写入等业务逻辑必须放后端

模板中需要拼 HTML 时，先定义安全转义函数：

```javascript
var escapeHtml = function (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
```

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
  V8.Result = '<span class="badge badge-pill ' + classStr + '">' + escapeHtml(value) + '</span>';
}
```

可用 Bootstrap 徽章类：`badge-primary`, `badge-secondary`, `badge-success`, `badge-danger`, `badge-warning`, `badge-info`, `badge-light`, `badge-dark`

## 内联样式（颜色高亮）

```javascript
// 不同业务状态显示不同字体颜色
if (V8.Form.XuqiuLX === '合并') {
  V8.Result = '<span style="color:blue;">' + escapeHtml(V8.Form.XuqiuDDH) + '</span>';
} else if (V8.Form.HebingID) {
  V8.Result = '<span style="color:#999;">' + escapeHtml(V8.Form.XuqiuDDH) + '</span>';
} else {
  V8.Result = escapeHtml(V8.Form.XuqiuDDH);
}
```

## 单图列渲染

```javascript
var html = '';
var fileServer = V8.SysConfig.FileServer;
if (!V8.IsNull(V8.Form.GongsiLOGO)) {
  html = '<img src="' + escapeHtml(fileServer + V8.Form.GongsiLOGO) + '" '
       + 'alt="公司Logo" '
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
    var url = escapeHtml(fileServer + item.Path);
    html += '<a href="' + url + '" target="_blank" rel="noopener noreferrer">'
         +  '<img src="' + url + '" alt="图片" '
         +  'style="width:40px;height:40px;object-fit:cover;margin:5px 5px 5px 0;" />'
         +  '</a>';
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
V8.Result = '<div><b>' + escapeHtml(name) + '</b><br/><small style="color:#999;">'
  + escapeHtml(phone) + '</small></div>';
```

模块引擎已有更轻量的声明式方案：`ViewSchema.Layout.List.Columns` 可用 `Field + Lines +
TrailingFields` 组成多行列，`Layout.Card` 可配置移动端顶部、右侧、正文、元信息和底部字段。
仅需要多字段排版、图标、`Tone/Color/Prefix/Suffix` 时优先使用声明式配置；需要复杂条件
HTML 时再给被引用的 `diy_field` 配置 `V8TmpEngineTable`。两种方式都会复用净化后的模板
结果，且所有引用字段仍必须在模块查询列或 `_SelectFields` 中。

## 条件性图标

```javascript
var html = escapeHtml(V8.Form.Title || '');
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

❌ 不要在模板中调用 `V8.FormEngine`（每行都查 → N+1 性能问题）；需要关联数据时在查询列、接口引擎或后端 `DataFilterV8` 预取，只有 `DataFilterV8` 才提供 `V8.CacheData`
❌ 不要依赖对象/数组的隐式字符串化；`V8.Result` 建议显式输出字符串
❌ 模板中 `V8.Form` 默认只有【查询列】字段；缺字段就要去模块引擎补查询列  
❌ 不要在模板里写复杂业务逻辑（应放到接口引擎或 DataFilterV8）  
❌ 不要输出 `onclick/onerror`、`script/iframe` 或 `javascript:` URL；DOMPurify 会剥离这些内容

## 与 DataFilterV8 的区别

| | DataFilterV8（后端） | 模板引擎（前端） |
|---|---|---|
| 运行端 | 服务器 | 浏览器 |
| 用途 | 加工数据、脱敏、补字段 | 渲染 HTML 样式 |
| 输出 | `V8.Form.字段 = ...` | `V8.Result = '<html>...</html>'` |
| 字段范围 | 全部数据 | 仅查询列 |
| 性能 | 每行执行（可用 `V8.CacheData`） | 浏览器渲染时执行 |
