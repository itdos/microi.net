How to copy the two modules configured in database a to database BThere are two waysThe first: through the Microi application storeProject A uploads the database package to the application mall, and Project B downloads and installs the application in the application mall.
This method is not recommend for the time being. One is the upload audit problem, and the other is that the application mall system is not perfect yet.type 2: extract relevant SQL statements by Navicat2.1. Obtain diy_table table data```sql
select * from diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

2.2, and then extract the insert statement as shown in the figure (select all data and copy the right mouse button as-> insert statement)

! [insert picture description here](https://static.itdos.com/upload/img/csdn/7e89e2e0ce2443a5bde99e7d5a612761.jpeg#pic_center)2.3. Put the obtained SQL statement into the B database for execution (note that the database name after INSERT INTO should be removed.)

The above three steps, through the following SQL to obtain the data and then do it twice, the method is the same

```sql
//获取上面两张表的所有字段数据
select * from diy_field WHERE TableID IN(select Id from  diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0) AND IsDeleted=0
//获取模块引擎数据（用于复制模块）
select * from sys_menu where `Name` In('多语言管理', '项目管理')
```


Recently, I remember to go to the role management office to set up the menu module permissions corresponding to [multi-language management] and [project management] for the account.