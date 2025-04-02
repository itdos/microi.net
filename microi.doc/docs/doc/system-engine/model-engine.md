# 模板引擎
## 介绍
> 模板引擎目前在表单引擎中的表格V8模板引擎、表单V8模板引擎，用于处理最终渲染后的数据。

例子：

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
模板引擎支持 `bootstrap`、`element-ui`的样式。

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