# 表单控件数据源
## 表单控件数据源目前支持多种模式

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/04a0857b9c684fa7b2c06d080f3824f7.png#pic_center)

## 普通数据源
>目前普通数据暂时只支持Value一种形式
>平台正在扩展Key-Value形式的普通数据源
>这样就不需要一定用接口引擎、数据源引擎、Sql数据源来实现Key-Value的数据绑定了

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/0083491c8cbe4bdc8fe4c6d22ce3f367.png#pic_center)
## 数据源引擎
>这个很简单，选择相应自定义的数据源引擎即可

## Sql数据源
>* 支持开启远程搜索功能
>* 未开启直接在数据源中前端本地搜索
>* 开启后每次搜索均从数据库查询，因此必须配置相应的$Keyword$变量以及limit分页
>* Sql数据源支持在Sql中使用【\$CurrentUser.字段名\$】相关变量，如【\$CurrentUser.Id\$、\$CurrentUser.Account\$】等
>* **由于sys_user表也由表单引擎驱动，因此您在表单设计中为sys_user表新增的任何字段，均能在【\$CurrentUser.字段名\$】中访问，如您添加了一个字段[Wife]，可以【\$CurrentUser.Wife\$】访问**

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/1f7491f7bb624d7cb87d1e7d68c097bd.png#pic_center)
## 通过其它字段来动态绑定数据源
>* 比如说您在表单中先选择了下拉框控件【部门（Dept）】，然后在下拉框控件【联系人（Contact）】仅绑定选择当前部门的人员数据
>* 此时只需要给【联系人】的数据源配置为空即可
>* 然后在【部门】控件的【值变更事件中输入以下V8引擎代码】
```javascript
//获取选中部门中的人员数据
var deptId = V8.ThisValue.Id;//或者V8.Form.Dept.Id
if(deptId){//如果选择了部门
	var contactResult = await V8.FormEngine.GetTableData('sys_user', {
		_SelectFields:['Id', 'Name', 'Account'],//只查询哪些字段，提高性能
		_Where: [
			['DeptId', '=', deptId]
		]
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
> * 当然以上只是基础示例，实际上还有更多玩法
> * 比如说使用接口引擎V8.ApiEngine.Run()实现
> * 比如说使用数据源引擎V8.DataSourceEngine.Run()实现
> * 以上用到的相关知识点：
> * **V8.FormEngine的使用方法**：[https://microi.blog.csdn.net/article/details/143623519](https://microi.blog.csdn.net/article/details/143623519)
> * **Where条件的用法**：[https://microi.blog.csdn.net/article/details/143582519](https://microi.blog.csdn.net/article/details/143582519)
> * **V8.Field前端V8函数**：[https://microi.blog.csdn.net/article/details/143623205](https://microi.blog.csdn.net/article/details/143623205)

## 关于绑定数据源后的显示字段和存储字段
>* 有同学在讲下拉框选择一个客户，只需要存储客户Id即可，没必要存储客户名称，因为客户名称可能会变更
>* 实际上吾码官方推荐的做法是下拉框选择一条数据后应该是存储客户名称，需要再拖一个隐藏字段客户Id，在下拉框值变更事件中对客户Id进行赋值
>* 优点是历史名称存档，比如说新增一个订单需要下拉选择商品，我们既需要存储商品名称、也需要存储商品Id，否则用户购买了一只笔，后来商品名称改成了书，用户去查看订单会发现订单中的商品名称变成了一本书
>* 而客户名称修改后确实需要在其它关联数据显示最新的客户名称，可以在客户列表修改名称时，通过表单事件对关联数据进行同步更新即可
