# 模块引擎
## 介绍
>模块引擎包含了模块配置、数据源配置、接口替换、动态按钮等配置

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## 模块配置
## 打开方式
### **Diy**
>* 以表单引擎渲染，打开是一个表格

### **Component**
>* 以定制vue组件打开，需要填写定制组件路径

### **Iframe**
>* 以iframe模式打开
```
//如要打开百度，则需要设置url地址为：/iframe/https://baidu.com
//可以在地址中跟上系统当前登录用户的token值，如：/iframe/https://baidu.com?token=$V8.CurrentToken$
```

### **SecondMenu**
>* 含子菜单的上级菜单

### **Report**
>* 虚拟报表

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
示例[每个人只能查看自己的数据，或者上级可以查看同部门下级的数据]：

(A.UserId = '$CurrentUser.Id$' OR (B.Level > $CurrentUser.Level$ AND B.DeptCode LIKE '$CurrentUser.DeptCode$%'))

注意：默认选择的DIY表已经占用了表别名A。

可使用的变量名：$CurrentUser.Id$、$CurrentUser.Level$、$CurrentUser.DeptId$、$CurrentUser.DeptCode$、$yyyy$、$yyyy-MM$（日期格式依次类推）

>* **导入模板**：提前做好导入模板让用户下载

>* **表格分页序号递增**：非第一页序号继承页码

## 接口替换
>* **查询接口替换**
>* 所有的接口替换地址均支持$ApiBase$、$CsClient$变量，自动从系统设置中获取

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
添加至少一个批量选择更多按钮后，数据列表会自动打开批量勾选功能
```js
//批量删除数据
var selectData = V8.TableRowSelected;
if(selectData.length == 0){
  V8.Tips('请选择要删除的数据！', false); return;
}
V8.ConfirmTips(`确认批量删除选中的[${selectData.length}]条数据？`, async function(){
  var ids = selectData.map(item => { return item.Id });
  var result = await V8.FormEngine.DelFormData('diy_order', {
    Ids : ids
  });
  if(result.Code != 1){
    V8.Tips('删除失败：' + result.Msg, false); return;
  }
  V8.Tips('删除成功！');
  V8.RefreshTable({ _PageIndex : 1 })
});
```

>* **页面更多按钮**

>* **页面多Tab**

## 平台支持的URL参数
>* ShowClassicTop：若设置为0，则不显示经典顶部内容。默认值为1
>* ShowClassicLeft：若设置为0，则不显示经典左侧菜单。默认值为1
>* FormDataId：数据列表默认打开哪一条数据
```js
https://os.itdos.com/#/notice?ShowClassicTop=0&ShowClassicLeft=0&FormDataId=b8348d26-b395-4313-b97d-6e41f9ff5270
```