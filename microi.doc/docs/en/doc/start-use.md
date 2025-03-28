# Quickly get started
## Introduction
* Different from the new menu, next step, next step and next step of other low-code platforms, a module can be created. Microi code is oriented to developers and uses the traditional development thinking process to create modules.
* Method 1: First create a table in the platform [Form Engine], then design the form, then create a module and associate the form.
* 方式2：先在【数据库管理工具（如Navicat）】中创建物理表、再到平台【表单引擎】加载物理表、再设计表单、再创建模块并关联表单
* 一张物理表可以被多个【模块引擎】进行关联设计模块
* A physical table can be approved by multiple [process engines] for associated processes.
* A physical table can be associated by multiple [report engines] to design virtual reports.
<img src="https://static.itdos.com/upload/img/csdn/9ae60bcfddfb3ed574297e510c4d358b.jpeg" style="margin: 5px;">


## Method 1: Create a physical table
* 进入【表单引擎】模块，新增一条数据即会自动往数据库新建一张物理表
* When there are multiple databases, you can optionally specify which database to create the table in (if you don't select it, it is the main database)

## Method 2: Create a physical table
* Enter [Database Management Tools (such as Navicat)] to add a physical table and add required fields
* If it is the main library: enter the platform [form engine], select the physical table just created in the [non-Diy table] drop-down box, and click [load as Diy table], then the table will automatically generate a piece of data
* If it is an extended library: enter the platform [database extension], add or view the data in the extended library, select the newly created physical table from the [non-Diy table] drop-down box, and click [load as Diy table]. at this time, the platform [form engine] will automatically generate a data

## 3, Design Forms
* View the data created in the form engine, and click [Design] in the operation bar to enter the form designer.
* Each drag of a field control immediately adds a physical field to the database, and each subsequent save modifies the field.

## 4. Create a menu (module)
* Enter [Module Engine], add a new data, select the open method as [Diy], select the physical table just created, and select the template as [Search Table] or [Search Card] (more templates can be expanded)
* For more configuration and gameplay, see the platform document [Module Engine. md]]

## 5. Enter the menu just created
* After entering the menu, you can see that the functions of adding, deleting, modifying and checking are all ready.
* If you can't see the menu, it may be an error in automatically assigning permissions to the admin role, or other roles do not have permissions to view. Go to the platform [Role Management] to configure the permissions.

