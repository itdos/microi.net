Form Control Data SourceForm control data sources currently support multiple modes! [insert picture description here](https://static.itdos.com/upload/img/csdn/04a0857b9c684fa7b2c06d080f3824f7.png#pic_center)

Common Data SourceCurrently, only one form of Value is supported for ordinary data.
Platform is extending the common data source in the form of Key-Value
In this way, there is no need to use interface engine, data source engine and SQL data source to implement Key-Value data binding.

! [INSERT PICTURE DESCRIPTION HERE](https://static.itdos.com/upload/img/csdn/0083491c8cbe4bdc8fe4c6d22ce3f367.png#pic_center)Data Source EngineThis is very simple, select the corresponding custom data source engine can be

SQL data source* Support to open the remote search function
* Not turned on the front-end local search directly in the data source.
* After opening, each search is queried from the database, so the corresponding $Keyword $variable and limit paging must be configured
* SQL data sources support the use of [\$CurrentUser in SQL. Field name \$] related variables, such as [\$CurrentUser. Id\$, \$CurrentUser. Account\$】 etc.
* * * Because sys_user tables are also driven by the form engine, any fields you add to sys_user table in form design can be CurrentUser in [\$. If you add a field [Wife], you can [\$CurrentUser. Wife\$】 Access * *

! [insert picture description here](https://static.itdos.com/upload/img/csdn/1f7491f7bb624d7cb87d1e7d68c097bd.png#pic_center)Dynamically bind data sources through other fields* For example, you first select the drop-down box control [Department (Dept)] in the form, and then bind only the personnel data of the current department in the drop-down box control [Contact (Contact)]
* At this time, only the data source of [Contact] needs to be configured as empty.
* Then enter the following V8 engine code in the [value change event] of the [department] control]```javascript
//获取选中部门中的人员数据
var deptId = V8.ThisValue.Id;//或者V8.Form.Dept.Id
if(deptId){//如果选择了部门
	var contactResult = await V8.FormEngine.GetTableData('sys_user', {
		_SelectFields:['Id', 'Name', 'Account'],//只查询哪些字段，提高性能
		_Wherer: [{ Name : 'DeptId', Value : deptId, Type : '=' }]
	});
	if(contactResult.Code != 1){
		V8.Tips('获取部门人员失败！', false);
	}else{
		V8.FieldSet('Contact', 'Data', contactResult.Data);
	}
}else{//如果清空了部门
	V8.FieldSet('Contact', 'Data', []);
}
```

* Of course, the above is just a basic example, in fact, there are more ways to play
* For example, using the interface engine V8.ApiEngine.Run()
* For example, use the data source engine V8.DataSourceEngine.Run()
* Relevant knowledge points used above:
* **How to use V8.FormEngine**:[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)
* **Usage of Where Condition**:[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
* **V8.Field front-end V8 functions**:[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

About Display and Storage Fields After Binding a Data Source* Some students are talking about selecting a customer in the drop-down box. They only need to store the customer Id. There is no need to store the customer name, because the customer name may change.
* In fact, the official recommend method of my code is to store the customer name after selecting a piece of data in the drop-down box. You need to drag another hidden field customer Id and assign the customer Id in the drop-down box value change event.
* The advantage is that the historical name is archived. For example, to add an order, we need to drop down and select the commodity. We need to store both the commodity name and the commodity Id. Otherwise, the user bought a pen and then changed the commodity name to a book. When the user checks the order, he will find that the commodity name in the order has become a book.
* After the customer name is modified, the latest customer name needs to be displayed in other associated data. When the customer name is modified in the customer list, the associated data can be updated synchronously through form events.