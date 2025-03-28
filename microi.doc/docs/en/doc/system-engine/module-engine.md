# Module Engine
## 介绍
> The module engine includes module configuration, data source configuration, interface replacement, dynamic buttons and other configurations.

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/a1501c7cf43c402eb961952ec2619f43.png#pic_center)
## Module Configuration
## Open mode
> * **Diy**: Render with form engine, open is a table

> * **Component**: to open the custom vue component, you need to enter the custom component path.

> * **Iframe**: Open in iframe mode

> * **SecondMenu**: Superior menu with submenu

> * **Report**: Virtual Report

## Data Source Configuration
> * **Associate Table**: which tables are joined. Set the table alias.

> * **Query columns**:select which fields

> * **Do not display columns**: some id fields do not need to be displayed on the table after select

> * **Sortable Columns**: Which fields can be sorted

> * **Default Sort Column**: The default multi-field sort

> * **Searchable Columns**: Which fields can be searched

> * **Statistics Columns**: which fields need statistics.

> * **Enable intra-table editing**: After enabling intra-table editing, you need to set editable columns.

> * **Join Association**: conditions for freely writing the associated table

> * **Where condition**: You can freely write a where condition to control permissions.

> * **Import Template**: prepare the import template in advance for users to download

> * **Table Paging Sequence Number Increment**: Non-first page sequence number inherits page number

## Interface Replacement
> * **Replace query interface**

> * **[New] Mode**
> Support **pop-up** and **table**

> * **Import interface replacement**
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

> * **Import progress interface replacement**
```js
if(!V8.Param.TableId){
    return { Code : 0, Message : '必须指定一个TableId，以标记要获取哪张表的导入进度！' }
}
//获取进度
var importStepStr = V8.Cache.Get(`Microi:${V8.OsClient}:ImportTableDataStep:${V8.Param.TableId}`);
return { Code 1, Data : JSON.parse(importStepStr) };
```

> * **Export interface replacement**: see related articles:
>[Microi code-custom export Excel](https://microi.blog.csdn.net/article/details/143619083)
>[micori code-use interface engine to realize custom export excel](https://microi.blog.csdn.net/article/details/143849425)

## Dynamic button
> * **Form More Button**

> * **Row More Button**

> * **More Export Button**

> * **Batch Select More Buttons**

> * **Page More Buttons**

> * **Page Multi Tab**
