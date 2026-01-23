# extended database

## Introduction
> * Platform support in`数据库管理`Add more database connection strings in
> *`表单引擎`When creating a table, you can choose which one to create.`数据库`
> *`接口引擎`can be used in`V8.Dbs.DbKey`Access the specified`数据库`

## Extended Database Objects V8.Dbs.DbKey
> * access to multi-database (extended library) objects, extended library management see:[https://web.microi.net/#/database](https://web.microi.net/#/database)
> * note: the [DbKey] field is missing in the table above the old database version. you need to update the database, add it manually, or wait for the application store to go online and install the [database management] application.
> * Example: When accessing the Oracle extension library, the value of DbKey is OracleDB1, where the V8.Dbs.OracleDB1 object is equivalent to the V8.Db object.
```js
var dataList = V8.Dbs.OracleDB1.FromSql('').ToArray();

//扩展数据库的事务用法
var emptyExTrans = V8.Dbs.EmptyEx.BeginTransaction();
var count = emptyExTrans.FromSql("delete from diy_extend_test where Id='49ec484d-a2cf-47fe-b498-6efb2bf9f99d'").ExecuteNonQuery();
//emptyExTrans.Commit();//提交事务
emptyExTrans.Rollback();//回滚事务
emptyExTrans.Close();//释放事务对象
return { Code : 1, Data : count };
```
> * known problem: after adding the extension library to the platform, the docker container of the api needs to be restarted before it takes effect.