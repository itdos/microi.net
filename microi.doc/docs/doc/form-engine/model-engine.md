# 📦 模板引擎

> **用于处理最终渲染后的数据，如根据字段值显示不同颜色的背景**

---

## 📌 介绍

`模板引擎` 目前应用在 `表单属性` 中的【`表格 V8 模板引擎`】、【`表单 V8 模板引擎`】：

<img src="https://static.itdos.com/upload/img/csdn/ScreenShot_2026-01-11_120812_139.png" alt="表格与表单模板引擎预览" style="margin: 5px;">

---

## 💡 例子

::: tip 注意
此处的 `V8.Form` 只能访问到【模块引擎】配置的【查询列】字段值，若查询列配置为空，则能访问所有字段值。
模板结果会经过 DOMPurify 净化，`script`、`iframe`、`onclick/onerror` 和 `javascript:` 等危险内容会被移除。业务文本和 URL 必须先转义；点击跳转使用 `<a href>`，不要使用内联事件。
:::
::: details 展开查看 JavaScript 代码（28 行）
```js
var escapeHtml = function(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
//使用bootstrap样式
var value = V8.Form.Zhuangtai;
if(V8.IsNull(value)){
    V8.Result = '';
}else{
    var classStr = 'badge-primary';
    if(value == '禁用'){
        classStr = `badge-danger`;
    }
    else if(value == '未通过'){
        classStr = `badge-warning`;
    }
    else if(value == '待审核'){
        classStr = `badge-info`;
    }
    var html = `<span class="badge badge-pill ${classStr}">${escapeHtml(value)}</span>`;
    V8.Result = html;
}

//使用style
if(V8.Form.XuqiuLX == '合并'){
  V8.Result = `<span style="color:blue;">${escapeHtml(V8.Form.XuqiuDDH)}</span>`;//显示蓝色
}
else if(V8.Form.HebingID){
  V8.Result = `<span style="color:#999;">${escapeHtml(V8.Form.XuqiuDDH)}</span>`;//显示灰色
}else{
  V8.Result = escapeHtml(V8.Form.XuqiuDDH);//默认
}
```
:::
## 支持 `bootstrap`、`element-ui`样式

常用 `bootstrap` 样式：
![alt text](https://microi.net/doc/bootstrap.jpg)

```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-light">Light</span>
<span class="badge badge-dark">Dark</span>

```

## 单张图片列表显示

```js
var escapeHtml = function(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
var html = '';
var fileServer = V8.SysConfig.FileServer;
if(!V8.IsNull(V8.Form.GongsiLOGO)){
  var imageUrl = escapeHtml(fileServer + V8.Form.GongsiLOGO);
  html = `<img src="${imageUrl}" alt="公司图片"
               style="height:40px;width:40px;object-fit:cover;margin:5px 0;" />`;
}
V8.Result = html;
```

## 多张图片列表显示

```js
var escapeHtml = function(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
var html = '';
var fileServer = V8.SysConfig.FileServer;
if(!V8.IsNull(V8.Form.TupianMS) && V8.Form.TupianMS.indexOf('[')!=-1){
  var TupianMS = JSON.parse(V8.Form.TupianMS)
  TupianMS.forEach(item=>{
    var imageUrl = escapeHtml(fileServer + item.Path);
    html += `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer">
      <img src="${imageUrl}" alt="附件图片"
           style="width:50px;height:40px;object-fit:cover;margin:2px 0 2px 5px;" />
    </a>`;
  })
  html = `<div style="display:flex;align-items:center;justify-content:flex-start;">` + html + `</div>`
}
V8.Result = html;
```
## 链接跳转
```js
var escapeHtml = function(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
if(V8.Form.SuoshuKH && V8.Form.SuoshuKH.KehuMC){
  var href = '/#/kehu?FormDataId=' + encodeURIComponent(V8.Form.KehuID || '');
  V8.Result = `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(V8.Form.SuoshuKH.KehuMC)}</a>`;
}
```

## 与模块引擎复合列/移动卡片配合

只需要“主标题 + 多行副信息 + 右侧图标/低库存”时，优先使用模块引擎“跨端视图”中的
“模块展示设计器”，它会生成 `ViewSchema.Layout.List.Columns` 的
`Field/Lines/TrailingFields`；移动端在卡片页签配置
`TopFields/RightFields/MetaFields/BottomFields`。需要复杂条件 HTML
时再给相应字段配置表格 V8 模板。复合列和卡片会自动复用字段模板结果，但引用字段仍需
出现在查询列中。

## Key-Value 状态与分类字段

状态、分类、类型、开关等低基数 Key-Value 字段，建议用表格 V8 模板渲染语义化标签，而不是把所有值显示成同一种文字。正常/启用/成功可用 `success`，待处理/预警用 `warning`，禁用/失败/异常用 `danger`，普通分类用 `primary/info/secondary`；颜色必须表达稳定语义，不能仅为了花哨随机分配。

模板需要同时兼容数据库 Key 和显示 Label，并对未知值降级为“未映射（原始值）”，不能静默显示为空。输出业务值前仍要执行 HTML 转义，模板只负责视觉展示，不应发起接口请求、修改数据或通过内联事件执行业务动作。复合列和移动卡片引用该字段时会复用模板结果，因此字段仍须加入模块查询列。
