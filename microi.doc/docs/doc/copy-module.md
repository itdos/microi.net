# 在A数据库配置好的两个模块，如何复制到B数据库
# 有两种方式
## 第1种：通过Microi应用商城
> A项目上传数据库包到应用商城，B项目到应用商城下载并安装应用
> 此方法目前暂不推荐，一是上传审核问题，二是应用商城系统目前还不够完善
## 第2种：通过Navicat提取相关sql语句
>2.1、获取diy_table表数据
```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```
>2.2、然后通过如图提取insert语句（选中所有数据，鼠标右键复制为-->Insert语句）

![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/7e89e2e0ce2443a5bde99e7d5a612761.jpeg#pic_center)
>2.3、将拿到的sql语句放到B数据库执行即可（注意要去掉 INSERT INTO 后的数据库名称.）

>以上3个步骤，通过下面的sql获取到数据后再做两次即可，方法同理

```sql
//获取上面两张表的所有字段数据
select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
//获取模块引擎数据（用于复制模块）
select * from sys_menu where `Name` In('多语言管理', '项目管理')
```

>最近记得去角色管理处给帐号设置好【多语言管理】和【项目管理】对应的菜单模块权限。