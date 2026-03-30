# 📋 复制模块到其它数据库

> 在 A 数据库配置好的模块，如何复制到 B 数据库？提供以下两种方式。

---

## 🛒 方式一：通过 Microi 应用商城（推荐）

A 项目上传数据库包到应用商城，B 项目到应用商城下载并安装应用。

---

## 🔧 方式二：通过 Navicat 提取 SQL 语句

### 步骤 1：获取 diy_table 表数据

```sql
SELECT * FROM diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
```

### 步骤 2：提取 INSERT 语句

选中所有数据 → 鼠标右键 → **复制为** → **Insert 语句**：

![提取INSERT语句](https://static.itdos.com/upload/img/csdn/7e89e2e0ce2443a5bde99e7d5a612761.jpeg#pic_center)

### 步骤 3：在 B 数据库执行

将拿到的 SQL 语句在 B 数据库执行即可。

::: tip 💡 注意
需要去掉 `INSERT INTO` 后的数据库名称前缀。
:::

### 步骤 4：重复以上步骤导出字段和模块数据

```sql
-- 获取上面两张表的所有字段数据
SELECT * FROM diy_field 
WHERE TableID IN (
    SELECT Id FROM diy_table WHERE `Name` IN ('diy_lang', 'diy_project') AND IsDeleted=0
) AND IsDeleted=0

-- 获取模块引擎数据（用于复制模块）
SELECT * FROM sys_menu WHERE `Name` IN ('多语言管理', '项目管理')
```

::: warning ⚠️ 别忘了
完成后记得到 **角色管理** 中给账号设置好「多语言管理」和「项目管理」对应的菜单模块权限。
:::