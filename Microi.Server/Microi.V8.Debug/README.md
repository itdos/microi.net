# Microi V8引擎本地调试工具

本地调试 Microi 接口引擎 JavaScript 代码的工具，支持：

- 📥 从数据库全量/增量拉取接口引擎代码
- 📤 本地修改自动同步到数据库
- ⚠️ 冲突检测与提示
- 💡 完整的 V8 API 智能提示

## 快速开始

### 1. 安装依赖

```bash
cd Microi.V8.Debug
npm install
```

### 2. 启动后端（调试模式）

确保后端以 Development 环境启动：

```bash
cd Microi.net.Api
dotnet run --environment Development
```

或使用 VS Code 调试器启动（推荐，可以断点调试 C# 代码）

### 3. 首次拉取

```bash
npm run pull
```

这将从数据库拉取所有接口引擎代码到 `api-engines/` 目录。

### 4. 启动监听模式

```bash
npm run watch
```

启动后：
- 修改 `api-engines/` 下的 `.js` 文件会自动同步到数据库
- 数据库的变更会定期检查并提示

## 目录结构

```
Microi.V8.Debug/
├─ api-engines/               # 接口引擎代码（按 OsClient/Category 分类）
│  └─ {OsClient}/
│     └─ {Category}/
│        └─ {ApiEngineKey}.js
├─ typings/
│  └─ v8-engine.d.ts          # V8 API 类型定义（智能提示）
├─ sync.js                    # 同步脚本
├─ package.json
├─ jsconfig.json              # JS 配置（启用类型提示）
├─ .sync-config.json          # 同步配置（自动生成）
└─ .sync-meta.json            # 同步元数据（不要手动修改）
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `npm run sync` | 交互式菜单 |
| `npm run pull` | 全量拉取接口引擎代码 |
| `npm run watch` | 启动监听模式（自动同步） |

### 命令行参数

```bash
node sync.js --help
node sync.js --pull --url http://localhost:5000 --osclient iTdos
```

## 配置说明

首次运行后会生成 `.sync-config.json`：

```json
{
  "apiBaseUrl": "http://localhost:5000",
  "osClient": "iTdos",
  "pollInterval": 5000
}
```

- `apiBaseUrl`: 后端 API 地址
- `osClient`: 默认 OsClient（留空则使用后端默认值）
- `pollInterval`: 数据库变更检查间隔（毫秒）

## 代码编辑

### 智能提示

打开任意 `.js` 文件，输入 `V8.` 即可获得完整的 API 提示：

```javascript
// 示例：获取用户列表
var result = V8.FormEngine.GetTableData({
    FormEngineKey: 'sys_user',
    PageIndex: 1,
    PageSize: 20,
    _Where: [
        { Name: 'IsDeleted', Value: '0', Type: '=' }
    ]
});

if (result.Code === 1) {
    V8.Result = {
        Code: 1,
        Data: result.Data,
        Total: result.Total
    };
} else {
    V8.Result = result;
}
```

### 断点调试

1. 在 VS Code 中以调试模式启动后端
2. 在 `FormEngine.cs`、`ApiEngine.cs` 等文件中设置断点
3. 修改本地 `.js` 文件并保存
4. 调用对应的接口，断点将被触发

## 冲突处理

当同时满足以下条件时会触发冲突提示：
1. 本地文件有未同步的修改
2. 数据库中的代码也被更新

冲突选项：
- **保留本地版本**：保持本地修改，稍后手动上传
- **使用数据库版本**：放弃本地修改，使用数据库代码
- **跳过**：暂时不处理

## 注意事项

1. **仅在开发环境使用**：V8DebugController 仅在 Development 环境或调试器附加时可用
2. **不要手动修改 `.sync-meta.json`**：此文件记录同步状态
3. **文件头部注释**：自动生成的头部注释会在同步时被忽略
4. **Git 提交**：`api-engines/` 目录已配置纳入版本控制

## 故障排除

### 无法连接后端

```
❌ 无法连接到后端服务
```

检查：
1. 后端是否已启动
2. 端口是否正确（默认 5000）
3. 防火墙设置

### 后端未处于调试模式

```
❌ 后端未处于调试模式
```

解决方法：
1. 设置环境变量 `ASPNETCORE_ENVIRONMENT=Development`
2. 或使用 VS Code/Visual Studio 调试器启动
