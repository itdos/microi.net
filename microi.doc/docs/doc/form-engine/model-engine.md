# 模板引擎
## 介绍
> 模板引擎目前应用在表单属性中的【表格V8模板引擎】、【表单V8模板引擎】，用于处理最终渲染后的数据。

## 例子

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
## 支持 `bootstrap`、`element-ui`样式

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

## 单张图片列表显示

```js
var html = '';
var fileServer = V8.SysConfig.FileServer;
if(!V8.IsNull(V8.Form.GongsiLOGO)){
  html = `<image src="${fileServer + V8.Form.GongsiLOGO}" 
                  mode="widthfix" 
                  style="height:40px;width:40px;object-fit: cover;margin-top:5px;margin-bottom:5px;" / >`;
}
V8.Result = html;
```

## 多张图片列表显示

```js
var html = '';
var fileServer = V8.SysConfig.FileServer;
if(!V8.IsNull(V8.Form.TupianMS) && V8.Form.TupianMS.indexOf('[')!=-1){
  var TupianMS = JSON.parse(V8.Form.TupianMS)
  TupianMS.forEach(item=>{
    //html = html + `<img src="${fileServer + item.Path}" style="width:40px;height:40px;object-fit: cover;margin-top:5px;margin-bottom:5px;" / >`;
    html = html + `<div class="img-container">
    <img onclick="window.open('${fileServer + item.Path}')" 
          class="small-img" src="${fileServer + item.Path}" 
          style="width:50px;height:40px;object-fit: cover;margin-top:2px;margin-bottom:2px;margin-left:5px;">
    <div class="overlay" style="top:-200px;z-inde:99999">
      <img class="large-img" src="${fileServer + item.Path}">
    </div>
​    </div>`
  })
  html = `<view style="display:flex;align-items: center;justify-content: flex-start;">` + html + `</view>`
}
V8.Result = html;
```
## 链接跳转
```js
if(V8.Form.SuoshuKH && V8.Form.SuoshuKH.KehuMC){
  V8.Result = `<a href="/#/kehu?FormDataId=${V8.Form.KehuID}" target="_blank">${V8.Form.SuoshuKH.KehuMC}</a>`;
}
```