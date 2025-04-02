# テンプレートエンジン
## 紹介
> 現在、フォームエンジン内のテーブルV8テンプレートエンジンとフォームV8テンプレートエンジンは、最終的にレンダリングされたデータを処理するために使用されています。

例：

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
このテンプレートエンジンは `bootstrap` と `element-ui` のスタイルをサポートしています。

よく使われる `bootstrap` スタイル ：
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