# Manifest 声明交付的可复现检查

本目录检验真实 MCP 注册处理器的写前校验、会话引用、关系解析、微服务绑定和独立验收回执。
客户端边界使用确定性替身，**不连接数据库、不调用模型，也不是远端业务 E2E**。
它回答“非法声明会不会被忽略、先写一部分或后写覆盖”，不以 JSON 能解析代替安全落地。

## 从公开源码复跑

建议使用受支持的 Node.js 22 或 24；本机另保留 Node 20.20 兼容运行记录。公开仓内包含所需的 `microi.mcp` 源码与锁文件：

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

## 运行器版本与实际结果

[Windows / Node 20 的首次记录](results/2026-10-26-windows-node20.json)使用运行器 1.0.0。
首次公开矩阵中，Node 22 两系统通过，Node 24 两系统失败；本机 Node 24.22.1 复现了
“子测试退出 0，但总账无法解析”的同一情况，没有把未知计数当作成功。

原因是 Node 23 起非 TTY 默认报告器由 TAP 改为 spec，参见[官方说明](https://nodejs.org/docs/latest-v24.x/api/test.html#test-reporters)。
1.0.1 明确指定 TAP，并核对运行器本身和被测源码的前后哈希；完整计数及所有失败/跳过门槛保持不变。
旧失败及旧结果保留，后续以绑定实际提交的公共 CI 结果判断组合是否通过。

本机 Node 24 的[修复前记录](results/2026-10-26-windows-node24-before.json)保留未知计数和失败退出；
[修复后记录](results/2026-10-26-windows-node24-after.json)为 54/54，通过显式 TAP 输出获得完整计数。
两者使用相同正式处理器与责任测试，运行器版本和哈希分别记录，不能把格式修复解释为新增业务覆盖。

1.0.2 另绑定 MCP 的 `package.json` 与 `package-lock.json`，依赖声明或锁文件在执行中变化也拒绝通过。
依赖升级后的 [Node 20](results/2026-10-26-windows-node20-protocol102.json)
与 [Node 24](results/2026-10-26-windows-node24-protocol102.json) 记录均为 54/54。
依赖安全回归和完整 349 项 MCP 回归单独列在[依赖核验](../compatibility/README.md#2026-10-26-mcp-生产依赖公告修复)，不混入本运行器的责任计数。
