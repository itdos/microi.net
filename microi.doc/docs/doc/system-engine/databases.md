# 扩展数据库

## 介绍
>* 平台支持在`数据库管理`中添加更多的数据库连接字符串
>* `表单引擎`在创建表时，可选择创建到哪一个`数据库`
>* `接口引擎`中可以使用`V8.Dbs.DbKey`访问指定的`数据库`

## 扩展数据库对象 V8.Dbs.DbKey
>* 访问多数据库（扩展库）的对象，扩展库管理见：[https://web.microi.net/#/database](https://web.microi.net/#/database)
>* 注意：老的数据库版本上面的表缺少【DbKey】字段，需要更新数据库、或手动添加、或等待应用商城上线【数据库管理】应用安装。
>* 示例：访问oracle扩展库，DbKey的值为OracleDB1，其中V8.Dbs.OracleDB1对象就等同于V8.Db对象。
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
>* 已知问题：在平台中添加扩展库后，需要重启api的docker容器才会生效