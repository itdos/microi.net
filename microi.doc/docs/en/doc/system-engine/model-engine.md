# Template Engine
## Introduction
> Currently, the Table V8 Template Engine and Form V8 Template Engine in the form engine are used to process the final rendered data.

Example：

```js
if(V8.IsNull(V8.Form.Zhuangtai)){
    V8.Result = '';
}else{
    var classStr = 'badge-primary';
    if(V8.Form.Zhuangtai == '禁用'){
        classStr = `badge-danger`;
    }
    else if(V8.Form.Zhuangtai == '未通过'){
        classStr = `badge-warning`;
    }
    else if(V8.Form.Zhuangtai == '待审核'){
        classStr = `badge-info`;
    }
    var html = `<span class="badge badge-pill ${classStr}">${V8.Form.Zhuangtai}</span>`;
    V8.Result = html;
}
```
This template engine supports `bootstrap` and `element-ui` styles.

常用 `bootstrap` 样式：
![alt text](/doc/bootstrap.jpg)

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