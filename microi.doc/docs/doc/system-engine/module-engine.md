# 模块引擎
## 介绍
>模块引擎包含了模块配置、数据源配置、接口替换、动态按钮等配置

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## 模块配置
## 打开方式
>* **Diy**：以表单引擎渲染，打开是一个表格

>* **Component**：以定制vue组件打开，需要填写定制组件路径

>* **Iframe**：以iframe模式打开

>* **SecondMenu**：含子菜单的上级菜单

>* **Report**：虚拟报表

## 数据源配置
>* **关联表**：join哪些表，设置表的别名

>* **查询列**：select哪些字段

>* **不显示列**：有些id字段select后不需要显示在表格上

>* **可排序列**：哪些字段可以排序

>* **默认排序列**：默认多字段排序

>* **可搜索列**：哪些字段可以被搜索

>* **统计列**：哪些字段需要统计

>* **开启表内编辑**：开启表内编辑后，还需设置可编辑列

>* **Join关联**：自由编写关联表的条件

>* **Where条件**：自由编写where条件，实现权限控制

>* **导入模板**：提前做好导入模板让用户下载

>* **表格分页序号递增**：非第一页序号继承页码

## 接口替换
>* **查询接口替换**

>* **[新增]模式**
>支持**弹窗**和**表内**

>* **导入接口替换**
```js
//可以使用接口引擎实现导入接口，一旦替换了导入接口，那么导入进度（redis）也一定要设置
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记正在导入哪张表！' }
}
//判断当前表是否正在导入中，防止重复导入
var isImportingKey = `Microi:${V8.OsClient}:ImportTableDataStart:${V8.Param.TableId}`;
var importStepKey = `Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`;
var importStepList = [];
if(V8.Cache.Get(isImportingKey) == '1'){
    return { Code : 0, Message : '注意：有数据正在导入！请导入结束后再操作。若进度异常，请联系系统管理员！' }
}
V8.Cache.Set(isImportingKey, '1');//标记正在导入

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + '：正在读取文件数据...');
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

//获取excel数据
var filesByteBase64 = V8.FilesByteBase64;
var base64String = Object.values(filesByteBase64)[0];
var dataList = V8.Office.ExcelToList({
  FileByteBase64 : base64String,
  SheetIndex : 0//取第一张表
});

//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + "：已读取【" + dataList.Data.length + "】条数据！");
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【0】条数据...`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));

dataList.Data.forEach((item, index) => {
  //循环导入数据
  var addResult = V8.FormEngine.AddFormData('tableName', item, V8.DbTrans);
  if(addResult.Code != 1){
    V8.DbTrans.Rollback();//回滚
    V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
    //写进度
    importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入出现错误：${addResult.Msg}。已回滚！`);
    V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
    break;
  }
  //写进度（覆盖上一条）
  importStepList[importStepList.length - 1] = DateNow('yyyy-MM-dd HH:mm:ss') + `：已导入【${index+1}】条数据...`;
  V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
});
V8.DbTrans.Commit();//提交
//写进度
importStepList.push(DateNow('yyyy-MM-dd HH:mm:ss') + `：导入成功，已结束！`);
V8.Cache.Set(importStepKey, JSON.stringify(importStepList));
V8.Cache.Set(isImportingKey, '0');//取消标记正在导入
return { Code : 1 };
```

>* **导入进度接口替换**
```js
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记要获取哪张表的导入进度！' }
}
//获取进度
var importStepStr = V8.Cache.Get(`Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`);
return { Code ：1, Data : JSON.parse(importStepStr) };
```

>* **导出接口替换**：见相关文章：
>[Microi吾码-自定义导出Excel](https://microi.blog.csdn.net/article/details/143619083)
>[micori吾码-使用接口引擎实现自定义导出excel](https://microi.blog.csdn.net/article/details/143849425)

## 动态按钮
>* **表单更多按钮**

>* **行更多按钮**

>* **更多导出按钮**

>* **批量选择更多按钮**

>* **页面更多按钮**

>* **页面多Tab**
