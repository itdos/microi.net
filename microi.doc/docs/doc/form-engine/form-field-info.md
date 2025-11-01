# 表单、字段属性
## 表单属性
### 前端进入表单V8事件
>* 可以做一些默认值处理

### 前端提交表单前V8事件
>* 可以做一些表单验证，提升用户体验
>* 可通过V8.Result = { Code : 0, Msg : '错误信息' };阻止表单继续提交
>* 如果直接通过调用接口的方式来进行增删改，此事件V8代码并不会执行

### 前端离开表单后V8事件
>* 一般建议使用【服务器端表单提交后V8事件】
>* 此事件可以做一些特殊业务逻辑处理

### 服务器端数据处理V8事件
>* 该事件会在获取列表数据后每一行执行、获取表单数据后执行。
>* 已封装对象：
>* a）V8.RowIndex：列表数据的行索引，0开始
>* b）V8.Form：列表数据每行对象、表单数据对象
>* c）V8.NotSaveField：指定哪些字段在编辑时不保存
>* d）V8.CacheData：用于缓存数据
>* 可以实现某些字段脱敏，如：V8.Form.价格 = "***";此时一定要设置：V8.NotSaveField = ["价格"];否则在修改数据时会将***写到数据库。
>* 写法：
```javascript
var listData = [];
//如果是第一行数据、或是表单数据，从数据库中获取数据
if(V8.RowIndex == 0 || V8.RowIndex == null){
    listData = V8.Db.FromSql("select * from table").ToDataTable();
    //将数据缓存起来，第二行还要用到，没必要再从数据库取一次。
    V8.CacheData = listData;
}else{
    listData = V8.CacheData;
}
//获取第一条数据的Id值
var id = listData.Rows[0]["Id"];
//获取总共多少条数据
var rowsCount = listData.Rows.Count;
全局服务器端V8引擎代码
在系统设置-->全局服务器端v8引擎代码中新增：
//增加一个自定义全局变量：TestParam1
V8.Param.TestParam1 = "abc";
//增加一个全局自定义方法：TestAction1
V8.Action.TestAction1 = function(){
        V8.Form["Price"] = "***";
        V8.NotSaveField = ["Price"];
}
在其它服务器端V8引擎代码事件中调用：
V8.Action.TestAction1();
V8.Form.Beizhu = V8.Param.TestParam1;
```

### 服务器端表单提交前V8事件
>* 此事件在事务中执行
>* 可通过V8.Result = { Code : 0, Msg : '错误信息' };阻止表单继续提交，回滚事务
>* 注意：目前只要给V8.Result赋值了{}对象，就会阻止表单提交、回滚事务，无论Code值是什么。
>* 注意：如果直接通过前端调用接口的方式来进行增删改，此事件V8代码也会执行，但如果是在后端V8代码中调用V8.FormEngine进行增删改，此事件不会执行

### 服务器端表单提交后V8事件
>* 此事件仍在事务中执行，如果要获取当前表单提交后的数据，需要使用V8.DbTrans对象来获取
>* 可通过V8.DbTrans.Rollback()和V8.Result = { Code : 0, Msg  '错误信息' };回滚表单的提交事务
>* 注意：只要给V8.Result赋值了{}对象，就会回滚事务，无论Code值是什么。
>* 注意：如果直接通过前端调用接口的方式来进行增删改，此事件V8代码也会执行，但如果是在后端V8代码中调用V8.FormEngine进行增删改，此事件不会执行

### 服务器端表单提交后V8事件（事务提交后）
>* 平台即将增加此事件，以在事务提交后执行相关业务逻辑

## 字段属性
### 绑定角色
>* 当字段绑定了角色时，只有该角色在查看表单时才能看到此字段