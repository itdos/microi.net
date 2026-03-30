# 📋DosResult Explanation

> The type returned by almost all interfaces on the server side is`DosResult`, it is recommended that the interface engine and server-side secondary development also use this format to return to the front end.

---

## 📖Data Structures

```javascript
{ 
    Code : 1,          // 状态码，值说明见下方表格
    Data : {},          // 可能是任何类型：{}、[]、string、int、null 等
    DataCount : 0,      // 数据列表时返回总数，用于分页
    Msg : '错误信息',    // 当 Code ≠ 1 时，一般包含错误信息
    DataAppend : {}     // 附加数据，如订单详情中的额外信息
}
```

---

## 📝Code Status Code Explanation

| Code | Explanation |
|---|---|
| **1** | ✅Request successful |
| **0** | ❌Request exception or validation failed, 'Msg' contains exception information |
| **2** | ⚠️ When getting a single piece of data ('GetFormData'), the data does not exist. Note: 'GetTableData' Code is still 1 even if no data is fetched |
| **1001** | 🔒The user logon identity has expired or a valid token was not passed in the header |
| **1002** | 🔒Logon authentication failed |
| **1003** | 🔒No verification code obtained or entered |
| **1004** | 🔒Graphical verification code error |
| **1005** | 📱If the balance of the third-party SMS verification code is insufficient or the software provider cannot send it, the client may temporarily allow the graphical verification code to replace it. |
| **1006** | ⚠The number of affected rows in the database is 0 (such as modifying/deleting non-existent data) |

::: tip💡Attention
From`Microi.net.dll v3.0.2`At first, if the number of rows affected by the database is 0 when deleting or modifying data, it is still returned.`Code=1`Success, and an additional return`DataCount`For the actual number of rows affected (the previous version returns.`Code=1006`).
:::
