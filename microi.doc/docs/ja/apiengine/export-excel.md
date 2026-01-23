# Excelのカスタムエクスポート
> * 現在のプラットフォームの一般的なエクスポート機能は、表に表示されているフィールドとコンテンツを直接エクスポートすることで、複雑なビジネスロジックのエクスポートのニーズを満たしていない場合があるため、2つのカスタムエクスポート方法を提供しています
> * 2024-11-04は、単一図、複数図のエクスポートをサポートし始め、複数図は自動的に列を生成し、列を結合し、位置を計算することで自動的に表に対応するセルを浮かべる
> * エクスポートされたExportExcel() メソッドのソースコードは「Microi.Office」プラグインのソースコードに公開されています

# 効果図
<img src="https://static.itdos.com/upload/img/csdn/d6ed3d2de178154a778f4084e486872f.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/csdn/ef8a3fa4c7d2332134e85b55bb49b741.jpeg" style="margin: 5px;">

# エクスポートインターフェースをインターフェースエンジンに置き換えます
```javascript
//新建一个接口引擎，代码如下：
//动态设置数据源
var dataListResult = V8.FormEngine.GetTableData('diy_blog_test', {
    _Where : [[ 'Xingming', 'Like', '张三' ]]
});
if(dataListResult.Code != 1){
    return dataListResult;
}
var dataList = dataListResult.Data;
//动态设置表头，数据可来源于【diy_field】表，也可以自己组装，这里使用JOSN示例数据
var header = [{
  Name: 'Biaoti', Label : '标题', Component : 'Text'
},{
  Name: 'ImgUpload57', Label : '公有单图', Component : 'ImgUpload', 
  //传入Config.ImgUpload.Multiple=1会自动处理多图生成列、合并列，且通过计算定位自动浮在表格上对应的单元格
  Config : `{
    ImgUpload:{
      Multiple : 0,  //是否多图
      Limit : 0,  //公有还是私有
    }
  }`
},{
  Name: 'ImgUpload64', Label : '公有多图', Component : 'ImgUpload',
  Config : `{
    ImgUpload:{
      Multiple : 1,  //是否多图
      Limit : 0,  //公有还是私有
    }
  }`
}];
//导出excel。注：ExportExcel()方法的源码公开在【Microi.Office】插件源码中。
var excelResult = V8.Office.ExportExcel({
  OsClient : V8.OsClient,
  ExcelData : dataList,//传入动态数据源
  ExcelHeader : header,//传入动态表头
});
if(excelResult.Code != 1){
  return excelResult;
}
var excelByte = excelResult.Data;
//返回文件流。注意：接口引擎必须开启【响应文件】
return {
  Code : 1,
  Data : {
    FileName : '测试接口引擎导出excel.xls',
    ContentType : 'application/vnd.ms-excel',
    FileByteBase64 : System.Convert.ToBase64String(excelByte)
  }
};
```
# カスタムインタフェースを使用してエクスポートインタフェースを置き換える
```csharp
//按照常规C#开发接收前端的参数、获取数据、使用NPOI导出Excel即可，无特殊说明。
//具体代码可以参考【Microi.Office】中的【ExportExcel】方法，如对图片、样式、行列值的处理
```

