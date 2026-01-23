# Data Source Engine

## Foreword
> * The concept of the data source engine mainly provides data sources. Its essence is similar to that of the interface engine. Two modes of SQL data source and ordinary data source are additionally added.
> * When the [Type] of the data source engine is [V8 Data Source], there is no difference from [Interface Engine]

## SQL Data Source
> * directly enter SQL statements in the code editor. $CurrentUser.* $variables are supported
> * The advantage is that you don't need to use V8.Db.FromSql() to execute SQL statements like the interface engine, but write SQL statements directly. Some implementation engineers prefer this mode.
* Sample code:
```sql
SELECT * FROM tableName WHERE UserId = '$CurrentUser.Id$'
```

## Common Data Source
> * Enter json data directly in the code editor
> * The advantage is the extreme performance. There is no need to call the bottom layer of the V8 engine and directly return data, such as the storage of some basic data: data such as the addresses of provinces and cities across the country.
* Sample code:
```json
[{ Id : 1, Name : '张三' }, { Id : 2, Name : '李四' }]
```
```json
{ Id : 1, Name : '张三' }
```

## V8 Data Source
> * There is no difference from the interface engine at this time
