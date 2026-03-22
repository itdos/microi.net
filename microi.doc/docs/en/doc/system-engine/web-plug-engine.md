# 🧩Data Source Engine

> **It mainly provides data sources, supporting V8, SQL, and common data sources.**

---

## 📌Preface

- The data source engine primarily provides data sources. Essentially, it is similar to the interface engine, with the addition of two modes: SQL data sources and regular data sources.
- When the type is [V8 Data Source], there is no difference from [Interface Engine]

## SQL data source
>* Enter SQL statements directly in the code editor; supports the $CurrentUser.*$ variable.
>* The advantage is that, unlike with the interface engine where you have to use V8.Db.FromSql() to execute SQL statements, you can write SQL directly. This approach is preferred by many implementation engineers.
>* Example code:
```sql
SELECT * FROM tableName WHERE UserId = '$CurrentUser.Id$'
```

## Common data source
>* Enter JSON data directly in the code editor
>* The advantage is extreme performance: it bypasses the V8 engine’s underlying layers and returns data directly, making it ideal for storing basic data such as nationwide province, city, and district address information.
>* Example code:
```json
[{ Id : 1, Name : '张三' }, { Id : 2, Name : '李四' }]
```
```json
{ Id : 1, Name : '张三' }
```

## V8 Data Source
>* At this point, it is no different from the interface engine.
