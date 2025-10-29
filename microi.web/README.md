## 使项目跑起来

> - 使用 nodejs v14.21.3、 npm v6.14.18。node14 下载地址：https://nodejs.org/download/release/latest-v14.x/
> - nvm use 14。如何安装 nvm：https://blog.csdn.net/qq973702/article/details/143821242
> - npm install nrm -g
> - nrm use taobao (📌 备注：如果 taobao 不行用 nrm use npmMirror)
> - npm install
> - npm run dev

## 若以上步骤出现 timeout 等未知错误，可以尝试下以下步骤：

> - 删除 node_modules
> - 删除 package-lock.json
> - 执行# npm cache clean --force
> - 重新执行#npm install 安装环境步骤

## 📌 切换后端接口地址方式 1

> - 在src目录创建 localConfig.json 文件
> - 内容如下：

```js
{
    "apiBaseUrl" : "你的后端接口地址，如：https://locahost:7266"
}
```

## 📌 切换后端接口地址方式 2

> - 在根目录创建.env 文件
> - 内容如下：

```js
VITE_APP_API_BASE_URL = 你的后端接口地址;
```

> - 访问地址：http://localhost:2009/?OsClient=test

## 可能出现的问题

> - 执行【nvm install 14】报错：error installing 14.21.3: open C:\Users\ADMINI~1\AppData\Local\Temp\nvm-npm-1352486587\npm-v6.14.18.zip: The system cannot find the file specified.
>   博主在 windows11 环境下，重新安装 nvm 老版本 v1.1.11 得已解决（不要使用最新版）：[https://github.com/coreybutler/nvm-windows/releases/tag/1.1.11](https://github.com/coreybutler/nvm-windows/releases/tag/1.1.11)

> - windows11 nvm 无法 use 14。
>   博主卸载最开始安装的 node18，重新安装 node14，再通过 nvm 切换 node 版本即可。

# Microi Web

## 定制组件目录
> - [/src/views/custom/]为所有客户的定制组件，理论上不用上传到仓库，主要做演示demo用，用户可主动删除里面的所有文件。

## 搜索缓存功能

### 功能说明

新增了搜索条件缓存功能，可以将 `param._Where` 临时存储在页面缓存中，键值使用 `param._Where.FormEngineKey`。这样每个搜索控件执行变更查询时就可以根据缓存获取兄弟查询条件，然后一并传给 `self.$emit("CallbackGetDiyTableRow", param)`。

### 主要特性

1. **自动缓存**: 当搜索控件执行查询时，会自动将搜索条件存储到 `sessionStorage` 中
2. **兄弟查询条件合并**: 每个搜索控件都会获取所有相关的兄弟查询条件并合并
3. **去重处理**: 避免重复的搜索条件
4. **缓存清理**: 当用户清除搜索时，会自动清除相关的缓存

### 使用方法

搜索缓存功能已经集成到以下组件中：

- `src/views/diy/diy-search.vue` - 传统搜索组件
- `src/views/diy/diy-search-v2.vue` - 新版搜索组件

### 工具函数

在 `src/utils/diy.common.js` 中新增了 `SearchCache` 工具对象，提供以下方法：

```javascript
// 存储搜索条件到缓存
DiyCommon.SearchCache.setSearchWhere(formEngineKey, whereConditions);

// 获取指定 FormEngineKey 的搜索条件
DiyCommon.SearchCache.getSearchWhere(formEngineKey);

// 获取所有 FormEngineKey 的搜索条件
DiyCommon.SearchCache.getAllSearchWhere(formEngineKeys);

// 清除指定 FormEngineKey 的搜索条件
DiyCommon.SearchCache.clearSearchWhere(formEngineKey);

// 清除所有 FormEngineKey 的搜索条件
DiyCommon.SearchCache.clearAllSearchWhere(formEngineKeys);

// 合并搜索条件，去重
DiyCommon.SearchCache.mergeSearchWhere(currentWhere, cachedWhere);
```

### 缓存键格式

缓存键格式为：`search_where_{FormEngineKey}`

例如：

- `search_where_user_table`
- `search_where_order_table`

### 注意事项

1. 缓存使用 `sessionStorage`，页面关闭后会自动清除
2. 每个 `FormEngineKey` 的搜索条件独立存储
3. 搜索条件会自动去重，避免重复查询
4. 清除搜索时会同时清除所有相关的缓存

## 表内编辑，子表数据可设置主表保存时候统一提交
在表内编辑模式下，当用户操作字段组件时，系统会自动给对应的数据行对象添加 `_DataStatus` 字段，用于标识当前数据的状态。
