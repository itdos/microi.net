# Manifest 声明交付的可复现检查

本目录检验真实 MCP 注册处理器的写前校验、会话引用、关系解析、微服务绑定和独立验收回执。
客户端边界使用确定性替身，**不连接数据库、不调用模型，也不是远端业务 E2E**。
它回答“非法声明会不会被忽略、先写一部分或后写覆盖”，不以 JSON 能解析代替安全落地。

## 从公开源码复跑

需要 Node.js 20.20 或更新版本。公开仓内包含所需的 `microi.mcp` 源码与锁文件：

```sh
cd microi.mcp
npm ci --ignore-scripts --no-audit --no-fund
cd ..
node microi.benchmarks/manifest-delivery/verify.mjs --out /已有目录/新的结果.json
```

输出文件拒绝覆盖，省略 `--out` 则只输出 JSON。报告绑定测试清单、平台/Node/架构、
原始字节与统一 LF 的源码 SHA-256、执行前后源码一致性、完整计数和 TAP 摘要。
退出非零、少于责任用例数、零测试、跳过、取消、待办和计数缺失都失败关闭。

## 原问题和修复

旧的兼容读取会丢弃 `null`、字符串及空对象等错误资源；错误的集合类型也可能被当作未声明。
同一声明内重复表名、字段名或接口 Key 没有整体拒绝，可能导致前项写入或后项覆盖。
新增 11 项回归中，旧实现 9 项失败、2 项兼容检查通过；修复后这 11 项及直接相关回归全部通过。

新预检在兼容归一化之前核对原始声明，错误只返回原始项路径和固定原因；
合法的局部更新、相同大小写别名和不同表的同名字段保持兼容。
该门禁不代替服务端权限、跨资源事务或写后回读；网络错误及实际执行中失败仍须核对远端状态。

责任源码为 [`manifest-preflight.ts`](../../microi.mcp/src/manifest-preflight.ts)
与正式 [`advanced-tools.ts`](../../microi.mcp/src/advanced-tools.ts)，回归在相邻 `*.test.ts`。
工具发现可读取 `microi_get_manifest_schema.declarationPreflight.version=1`。
源码、打包工具、已加载 MCP、平台后端和客户安装是不同阶段，不能因源码存在声称旧进程已升级。

公开 CI 的系统/Node 组合以实际运行结果为准；Linux 或 Windows 上的 MCP 合约检查
不能当作后端数据库、CPU/OS 全矩阵或第三方认证。
