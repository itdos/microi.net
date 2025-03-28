# Quickly get started
## Introduction
* Different from the new menu, next step, next step and next step of other low-code platforms, a module can be created. Microi code is oriented to developers and uses traditional development thinking process to create modules.
* Method 1: First create a table in the platform [Form Engine], then design the form, then create a module and associate the form.
* Mode 2: First create a physical table in [Database Management Tools (such as Navicat)], then load the physical table in the platform [Form Engine], then design the form, create a module and associate the form.
* A physical table can be associated with multiple [module engines] to design modules
* A physical table can be approved by multiple [process engines] for associated processes.
* A physical table can be associated by multiple [report engines] to design virtual reports.
<img src="https://static.itdos.com/upload/img/csdn/9ae60bcfddfb3ed574297e510c4d358b.jpeg" style="margin: 5px;">


## 方式1：创建一张物理表
* 进入【表单引擎】模块，新增一条数据即会自动往数据库新建一张物理表
* 多数据库时可选择指定在哪个数据库创建表（不选择则是主库）

## 方式2：创建一张物理表
* 进入【数据库管理工具（如Navicat）】新增一张物理表，并新增需要的字段
* 如果是主库：进入平台【表单引擎】，在【非Diy表】下拉框中选择刚刚创建的物理表，点击【加载为Diy表】，此时表格会自动生成一条数据
* 如果是扩展库：进入平台【数据库扩展】，新增或查看扩展库那条数据，在【非Diy表】下拉框中选择刚刚创建的物理表，点击【加载为Diy表】，此时平台【表单引擎】会自动生成一条数据

## 3、设计表单
* 查看在表单引擎中创建的数据，操作栏点击【设计】，即可进入表单设计器
* 每拖一个字段控件则会立即往数据库添加一个物理字段，之后的每次保存都是修改字段

## 4、创建一个菜单（模块）
* 进入【模块引擎】，新增一条数据，选择打开方式为【Diy】，选择刚刚创建的物理表，选择模板为【搜索+表格】或【搜索+卡片】（可扩展更多模板）
* 更多配置玩法见平台文档【模块引擎.md】

## 5、进入刚刚创建的菜单
* 进入菜单后即可看到增、删、改、查功能已全部就绪
* 若看不到菜单，可能是自动给admin角色赋值权限出错，或其它角色无权限查看，去平台【角色管理】配置一下权限即可

