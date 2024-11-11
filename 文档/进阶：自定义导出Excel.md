## 开源低代码平台-Microi吾码-简介
* 技术框架：.NET8 + Redis + MySql/SqlServer/Oracle + Vue2/3 + Element-UI/Element-Plus
* 平台始于2014年（基于Avalon.js），2018年使用Vue重构，于2024年10月29日开源
* 试用地址：[https://microi.net](https://microi.net)
* Gitee开源地址：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* GitCode开源地址：[https://gitcode.com/microi-net/microi.net/overview](https://gitcode.com/microi-net/microi.net/overview)

## 自定义导出Excel
* 目前平台的通用导出功能是直接导出表格展现的字段以及内容，某些情况下并不满足复杂业务逻辑导出的需求，因此提供了两种自定义导出方式
* 2024-11-04开始支持导出单图、多图，且多图会自动生成列、合并列，通过计算定位自动浮在表格上对应的单元格
* 导出的ExportExcel()方法源码公开在【Microi.Office】插件源码中

## 效果图
<img src="https://static.itdos.com/upload/img/Excel导出带图片.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/Excel导出带图片2.jpeg" style="margin: 5px;">

## 使用接口引擎替换导出接口
```javascript
//新建一个接口引擎，代码如下：
//动态设置数据源
var dataListResult = V8.FormEngine.GetTableData('diy_blog_test', {
    _Where : [{ Name : 'Xingming', Value : '张三', Type : 'Like' }]
});
if(dataListResult.Code != 1){
    V8.Result = dataListResult; return;
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
  V8.Result = excelResult; return;
}
var excelByte = excelResult.Data;
//返回文件流。注意：接口引擎必须开启【响应文件】
V8.Result = {
  Code : 1,
  Data : {
    FileName : '测试接口引擎导出excel.xls',
    ContentType : 'application/vnd.ms-excel',
    FileByteBase64 : System.Convert.ToBase64String(excelByte)
  }
};
```
## 使用定制接口替换导出接口
```csharp
//按照常规C#开发接收前端的参数、获取数据、使用NPOI导出Excel即可，无特殊说明。
//具体代码可以参考【Microi.Office】中的【ExportExcel】方法，如对图片、样式、行列值的处理
```

## 平台预览图
<img src="https://static.itdos.com/upload/img/v4.x电脑端首页.jpeg" style="margin: 5px;">
