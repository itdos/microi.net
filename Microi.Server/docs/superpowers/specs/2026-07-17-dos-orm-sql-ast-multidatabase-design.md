# Dos.ORM 完整 SQL AST 与六数据库兼容架构设计

日期：2026-07-17
状态：待用户书面审查
范围：Microi.Server、Dos.ORM、本地六库集成测试、Microi.Client 端到端验收

## 1. 背景

Microi.Server 当前同时存在四类数据库差异实现：

1. Dos.ORM Provider 内的数据库类型分支和 SQL 字符串替换。
2. IMicroiORM、CodeFirst、SqlFunc、分页和 BulkCopy 各自生成 SQL。
3. Microi.Core、Microi.net、Microi.AI、Microi.Upgrade 等业务项目直接判断数据库类型并拼接方言 SQL。
4. 初始化、升级和内嵌资源中保存 MySQL 或 SQL Server 专用脚本。

审计快照显示，Dos.ORM 外有数百个 C# 文件，至少 22 个文件存在已确认的框架自有方言泄漏，并有代码直接构造 MySQL Provider 连接。当前没有 Dos.ORM 专用测试项目，也没有可运行的六数据库集成测试编排。

本设计采用用户选定的方案 3：完整 SQL AST 与编译器。所有框架自有数据库操作先表达为中性语义树，再由 Dos.ORM 内对应数据库编译器生成 SQL 和参数。数据库差异不得继续散落在业务项目中。

## 2. 目标

### 2.1 正式支持范围

首轮正式认证以下六种数据库：

- MySQL
- SQL Server
- Oracle
- PostgreSQL
- 达梦 DM8
- 人大金仓 KingbaseES V9

DatabaseType 中历史遗留的 Access、SQLite、SqlServer9 等枚举继续保持二进制和源码兼容，但不允许静默回退到 MySQL 或 SQL Server。未注册或缺少能力时必须明确失败。

### 2.2 完成定义

“100% 多数据库兼容”在本项目中的可验证定义是：

- 框架自有查询、写入、DDL、元数据、升级、租户生命周期和诊断 SQL 全部由 Dos.ORM AST 编译器产生。
- Dos.ORM 外不存在根据数据库类型改变 SQL 或数据库行为的分支。
- Dos.ORM 外不存在具体数据库 Provider 类型引用。
- 六个数据库对同一语义契约执行真实集成测试且没有 Skip。
- Microi.net.Api 在六种数据库配置下均可启动并完成核心 API 冒烟。
- Microi.Client 在六种数据库配置下均可完成真实登录、核心页面访问、网络守卫和截图验收。
- 新增数据库时只需增加 Dos.ORM 平台实现、编译器和测试数据，不修改业务项目。

### 2.3 非目标

- 不自动翻译用户自己编写的 V8.Db.FromSql 或 DataSource 原生 SQL。
- 不通过正则表达式把任意一种数据库 SQL 猜测性翻译为另一种数据库 SQL。
- 不把 PostgreSQL 或 Oracle 测试结果冒充 KingbaseES 或 DM8 认证结果。
- 不承诺所有数据库的 DDL 都能事务回滚；具体事务能力按数据库能力显式声明。

## 3. 总体架构

数据流固定为：

~~~text
业务意图 / ORM 表达式 / Schema 模型
                |
                v
           中性 SQL AST
                |
                v
       语义校验与能力校验
                |
                v
     六库 SqlCompiler 编译器
                |
                v
 DatabaseExecutionPlan(步骤 + 参数定义 + 分类)
                |
                v
 DriverAdapter + DbSession + Transaction
~~~

Dos.ORM 是唯一了解数据库类型、驱动、语法、参数、标识符、能力和版本差异的程序集。

### 3.1 数据库平台注册中心

每种数据库只注册一次：

~~~csharp
public interface IDatabasePlatform
{
    DatabaseType Type { get; }
    IReadOnlyCollection<string> Aliases { get; }
    IDbDriverAdapter Driver { get; }
    ISqlCompiler Compiler { get; }
    ITypeMapper Types { get; }
    ISchemaIntrospector Schema { get; }
    IBulkExecutor Bulk { get; }
    IDatabaseAdmin Admin { get; }
    IDatabaseDiagnostics Diagnostics { get; }
    INativeScriptExecutor NativeScripts { get; }
    IConnectionPolicy Connections { get; }
    DatabaseCapabilities Capabilities { get; }
}
~~~

DatabasePlatformRegistry 负责：

- DatabaseType 和字符串别名解析。
- Provider 和平台实例创建。
- 数据库版本能力探测。
- 连接串规范化。
- 普通连接、管理库连接和建删库连接的选择。
- 未注册数据库的快速失败。

DbProvider 只保留连接、命令、事务和驱动适配职责，不再自行改写 SQL。

## 4. SQL AST 类型系统

所有 AST 节点不可变，不保存数据库类型，不直接保存带方言的 SQL 片段。

### 4.1 语句节点

- SelectStatement
- InsertStatement
- UpdateStatement
- DeleteStatement
- UpsertStatement
- BulkInsertStatement
- CreateTableStatement
- AlterTableStatement
- DropTableStatement
- CreateIndexStatement
- DropIndexStatement
- CreateSchemaStatement
- CreateDatabaseStatement
- DropDatabaseStatement
- MetadataQueryStatement
- DiagnosticQueryStatement
- SqlBatch

SqlBatch 是命令序列，不等同于用分号拼接多条 SQL。执行计划显式携带 AtomicityRequirement。只有全部步骤支持事务且使用同一连接时才保持同一事务；DDL 隐式提交或 Admin 跨管理连接时，编译器必须拒绝 Required 原子批次，或生成明确标注 BestEffort/None 的分段计划，不能暗示这些步骤可以整体回滚。

### 4.2 查询结构节点

- TableSource、DerivedTableSource、JoinSource
- CommonTableExpression
- Projection、OrderBy、GroupBy、Having
- Pagination，包括 Offset/Limit 和 Keyset 两种中性语义
- RowLock
- Union、UnionAll、Intersect、Except

分页语义包含页码、页大小、偏移量和确定性排序要求。编译器分别生成 LIMIT/OFFSET、OFFSET/FETCH 或 Oracle 分页结构，业务层不能直接表达这些关键字。

通配列必须使用专门的 Wildcard 节点，不能把星号伪装成普通标识符。

### 4.3 表达式节点

- ColumnExpression
- ParameterExpression
- ConstantExpression
- BinaryExpression
- UnaryExpression
- FunctionExpression
- AggregateExpression
- CaseExpression
- CastExpression
- InExpression
- BetweenExpression
- ExistsExpression
- SubqueryExpression
- JsonExpression
- DateTimeExpression

ConstantExpression 只允许编译器控制的安全常量，例如 NULL、布尔字面量和排序方向。所有运行时动态值必须进入 ParameterExpression。

AST 只保存参数引用，真实值保存在独立 ParameterBag 中，避免缓存 AST 时意外缓存敏感值。

FunctionExpression 不接受任意供应商函数名字串。SemanticFunctionCatalog 为 concat、substring、length、current time、date add、date diff、cast、coalesce、round、JSON 读取、聚合等定义稳定的 SemanticFunctionId、参数类型、返回类型和 NULL 语义，再由方言 Lower 阶段映射。供应商扩展函数只能在 Dos.ORM 对应方言中注册。

### 4.4 标识符

SqlIdentifier 使用分段模型保存 catalog、schema、table、alias 和 column，不接受已经加引号的整体字符串。

IdentifierPolicy 显式描述：

- 引号字符。
- 未加引号对象的大小写折叠。
- 是否保留历史对象大小写。
- 最大长度。
- 保留字。
- 临时表命名。

Oracle 和 DM8 的历史大写对象、PostgreSQL 和 KingbaseES 的小写折叠必须通过真实旧库回归验证，不能简单地给所有名称统一加双引号。

### 4.5 参数

参数分成三层：

- ParameterDefinition：AST 中的逻辑名称和类型约束，不保存值。
- ParameterBag：一次调用的运行时值集合，不进入 AST fingerprint 或计划缓存。
- BoundParameter：执行实例中的有序绑定，包含下列信息和值。

BoundParameter 保存：

- 逻辑名称。
- 值。
- LogicalDbType。
- 长度、精度、小数位。
- 输入、输出和返回值方向。
- 是否可空。

编译器只分配参数占位符；IDbDriverAdapter 负责创建真实 DbParameter，并统一 GUID、Boolean、DateTime、DateTimeOffset、JSON、Binary、CLOB/BLOB 和空值处理。

参数命名不得依赖全局可变计数器。每次编译使用独立 SqlCompilationContext，确保并发安全和确定性快照。

## 5. 编译器

### 5.1 编译接口

~~~csharp
public interface ISqlCompiler
{
    DatabaseExecutionPlan Compile(SqlStatement statement, SqlCompilationOptions options);
}

public sealed class DatabaseExecutionPlan
{
    public IReadOnlyList<DatabasePlanStep> Steps { get; }
    public SqlResultShape ResultShape { get; }
    public SqlSafetyOrigin Origin { get; }
}
~~~

DatabasePlanStep 包含：

- SqlCommandStep：SQL 模板和无值 ParameterDefinition。
- BulkStep：原生 Bulk 或 AST Insert 分批计划。
- AdminStep：建删库、切换管理连接或导入导出。
- NativeScriptStep：仅用于用户提供并声明目标数据库的导入脚本，不允许承载平台升级或初始化逻辑。

执行时由 ParameterBag 生成 BoundParameter。缓存只保存无值模板，不能保存 BoundParameter。

编译分为以下八个明确阶段：

1. Bind：把现有 Field、WhereClip、FromSection 和表达式绑定为 AST 和字段元数据。
2. Normalize：归一化 NULL 比较、空 IN、逻辑树、别名、函数和分页。
3. Validate：校验类型、字段归属、写安全、标识符和可移植能力。
4. Lower：把高级语义降低为目标数据库 IR，例如 Oracle 版本分页、OUTPUT 或冲突处理。
5. Optimize：只做能够证明语义等价的常量折叠和批次规划。
6. AllocateParameters：按稳定遍历顺序分配参数、类型和批次。
7. Render：纯渲染 SQL，不再推断业务语义。
8. Plan：生成一个或多个 SqlCommandPlan、事务要求、ResultShape 和缓存信息。

缺少能力时抛出 UnsupportedDatabaseCapabilityException，异常必须包含数据库类型、版本、操作和原始调用上下文，不得降级成错误 SQL。

### 5.2 六库编译器

- MySqlCompiler
- SqlServerCompiler
- OracleCompiler
- PostgreSqlCompiler
- Dm8Compiler
- KingbaseEsCompiler

允许复用语法族基础实现：

- PostgreSqlCompiler 和 KingbaseEsCompiler 可共享 ANSI/PostgreSQL 家族基础类。
- OracleCompiler 和 Dm8Compiler 可共享 Oracle 家族基础类。
- 共享只表示复用默认实现；每个数据库必须拥有独立能力配置和覆盖测试。

### 5.3 能力模型

DatabaseCapabilities 至少覆盖：

- 分页语法和所需版本。
- RETURNING、OUTPUT、序列和 Identity。
- 原生 Upsert 或 Merge。
- JSON、窗口函数、CTE。
- 行锁、Skip Locked、Nowait。
- 多语句、多结果集。
- 最大参数数、最大 SQL 长度和批量限制。
- DDL 事务行为。
- Schema、Catalog 和建删库权限。
- 原生 Bulk API。

版本差异通过连接后的能力探测或显式测试配置确定，不在业务代码中判断版本字符串。

DM8 的 Oracle 兼容模式、KingbaseES 的 PostgreSQL/Oracle 兼容模式及数据库版本共同组成 DialectProfile。不能只凭 DatabaseType 推断实际语法能力。

## 6. 执行器

DbSession 增加 AST 执行入口，统一执行流程：

1. 从当前连接获得 IDatabasePlatform。
2. 编译 AST。
3. 由 DriverAdapter 创建命令和参数。
4. 绑定当前事务。
5. 执行并转换结果。
6. 在异常中附加命令类别和数据库信息，但不记录敏感参数值。

分页默认执行 Count AST 和 Data AST 两个独立命令，可共享同一事务或一致性快照。禁止假设所有驱动都支持以分号拼接两个查询。

Upsert 必须使用目标库原子能力；没有原子语义时只能使用显式锁与事务策略，或报告不支持。不得用先查后写的无锁降级伪装成原子 Upsert。

SQL Server 的 Upsert 不默认依赖 MERGE。实现必须选择可证明并发语义的事务方案，并用并发竞争集成测试验证。

Bulk 优先使用数据库原生 Bulk API；降级为 AST 批量 Insert 时必须遵守最大参数数、分批、当前事务和失败回滚。

## 7. 原生 SQL 边界

原生 SQL 是受控逃生舱，不属于 AST 自动翻译范围。

Dos.ORM 提供明确来源类型：

~~~csharp
SqlText.UserProvided(sql)
SqlText.LegacyAiGenerated(sql)
SqlText.LegacyUnknown(sql)
~~~

规则如下：

- V8.Db.FromSql 和 DataSource 用户输入标记为 UserProvided。
- 新 NL2SQL 不输出 SQL 字符串。模型输出有版本的 PortableQueryDocument 结构化 JSON，经 Schema 白名单、只读语义和类型校验后转换成 Select AST，再由目标数据库编译器生成 SQL。
- LegacyAiGenerated 只为迁移旧 NL2SQL 保留，属于调用者管理的当前数据库方言 SQL，不计入跨库兼容承诺；最终验收前平台默认路径必须清零。
- 现有 FromSql(string) 保持源码兼容，但标记为 LegacyUnknown；平台源码直接调用它会触发架构诊断。
- 原生 SQL 不做正则方言翻译。
- Dos.ORM 负责参数绑定、来源记录、事务、驱动多语句开关和审计。只读 DataSource 必须使用数据库只读账号或只读事务作为最终防线。
- 在没有对应数据库 Parser 的情况下，不承诺靠字符串或正则准确识别危险语句；需要语义级拒绝的原生 SQL 必须接入该数据库 Parser 并通过专项测试。

平台自有逻辑最终不允许通过 PlatformGenerated 原生字符串绕开 AST。

## 8. 兼容现有公开 API

完整 AST 不等于一次性删除所有旧入口。迁移期间使用兼容门面：

- FromSection、WhereClip、OrderByClip 和实体表达式降低为 Select/Expression AST。
- Insert、Update、Delete 降低为 DML AST。
- SqlFunc 只创建 FunctionExpression，不再根据 DatabaseType 返回字符串。
- CodeFirst 只生成中性 TableDefinition，再转换为 DDL AST。
- IMicroiORM 保留现有签名，由单一兼容适配器调用 AST、Schema 和 Metadata 能力。
- GetPaginationSql 等旧方法由编译器输出，禁止保留第二套实现。
- ProviderFactory 和 DbSession.CreateDbProvider 委托 DatabasePlatformRegistry。

旧 Provider 中的正则 SQL 替换只能作为 LegacyUnknown 原生 SQL 的临时兼容开关，并记录命中指标。平台迁移完成后默认关闭，不能影响 AST 编译结果。

迁移管线提供三种明确模式：

- Legacy：只执行旧字符串管线。
- Compare：旧、新管线都编译，只执行旧命令；记录规范化 SQL、参数和结果形状差异。写操作绝不双执行。
- Ast：只执行 AST 编译结果。

模块按 Legacy、Compare、Ast 顺序切换。只读语句可在隔离测试环境进行双执行结果对比，任何写语句都禁止双执行。

## 9. Schema、元数据、升级和资源

### 9.1 中性 Schema 模型

- TableDefinition
- ColumnDefinition
- IndexDefinition
- ForeignKeyDefinition
- LogicalDbType
- SchemaOperation
- MigrationPlan
- MigrationStep

SchemaIntrospector 将六库元数据统一为 TableMetadata、ColumnMetadata、IndexMetadata，不向业务层暴露 information_schema、sys.tables 或 all_tab_columns。

Schema diff 中的 rename、drop 和缩小字段长度属于破坏性操作。MigrationPlan 默认只生成预览，不自动执行 destructive step；只有显式确认的升级步骤可以应用。

### 9.2 升级资源

现有 MySQL 专用 DDL 和数据脚本按以下规则迁移：

- 表结构转为 SchemaOperation。
- 初始化数据转为 JSON 或强类型数据行，通过 AST Insert/Upsert 执行。
- 迁移步骤必须有稳定 Id、幂等判断和失败状态。
- 任一步失败都不得推进 ServerVersion。
- 同一旧库快照连续升级两次，第二次必须无副作用。

平台升级和初始化不保留厂商原生脚本例外。若某数据库功能无法由现有节点表达，必须在 Dos.ORM 增加中性语义节点或方言私有 Lowering 实现，并为六个 DialectProfile 提供明确实现或明确不支持错误；不得通过原生脚本绕过 AST。

## 10. Microi.Server 迁移边界

按依赖关系迁移以下区域：

1. Dos.ORM Provider、DbSession、Expression、FromSection、SqlSection、SqlFunc、CodeFirst、Upsert、BulkCopy、IMicroiORM。
2. Microi.Core 的 FormEngine、FormEngineLang、DataSource、角色权限、V8 MCP Blueprint、Flow、StateMachine、ProcessMining。
3. Microi.net 的租户生命周期、表单字段和平台内部 SQL。
4. Microi.AI 的订阅、额度、日志、NL2SQL 和内嵌表结构。
5. Microi.Upgrade 的升级逻辑和资源。
6. SystemMonitorController、EmptyDatabaseReleaseService 等直接 Provider 或诊断查询。

业务项目只允许读取、保存并把 DatabaseType 作为配置传给 Dos.ORM；不得根据它改变 SQL 或数据库操作。

## 11. 架构门禁

新增 Roslyn 诊断和物理文件扫描：

- MICROI_DB001：Dos.ORM 外存在影响 SQL、ADO.NET、DDL、连接或执行行为的数据库类型条件分支。
- MICROI_DB002：平台 SQL 执行数据流中存在方言字符串。
- MICROI_DB003：Dos.ORM 外引用具体数据库 Provider 类型。
- MICROI_DB004：原生 SQL 未声明来源。

扫描必须覆盖 Microi.Server 的真实物理文件，包括被根 .gitignore 忽略的 Microi.net 和 Microi.AI；只排除 bin、obj、自动生成文件。

迁移期间保存当前问题指纹基线，只允许减少，禁止新增或换位置规避。最终验收基线必须为空，不允许用永久文件白名单、pragma 或 GlobalSuppressions 关闭规则。

业务项目可以把 DatabaseType 作为普通配置读取、校验、展示、保存并原样传给 Dos.ORM。分析器通过语义数据流识别该窄边界，不用整文件白名单放行。

## 12. 实施阶段

### 阶段 0：基线冻结

- 创建测试项目和架构分析器。
- 为现有行为建立快照。
- 建立只减不增的问题基线。

验收：当前解决方案可构建；新增方言 SQL 或数据库分支会让测试失败。

### 阶段 1：AST 核心

- 实现不可变节点、标识符、参数、类型、命令分类和校验。
- 实现六库编译器的查询和基础 DML。
- 建立六库同语义编译快照。

验收：动态值不进入 SQL 文本；六库生成结果均通过契约测试。

### 阶段 2：现有 ORM 降低到 AST

- 迁移 Expression、WhereClip、FromSection、SqlSection、SqlFunc。
- 迁移实体 CRUD 和分页。
- 删除重复分页及函数字符串实现。

验收：旧公开 API 源码兼容；现有调用全部走 AST。

### 阶段 3：高级写入和 Schema

- 实现 Upsert、Bulk、锁、DDL、元数据、CodeFirst、IMicroiORM。
- 实现 Admin、Diagnostics 和数据库生命周期。

验收：六库完成 CRUD、分页、Upsert、Bulk、建改表、索引、元数据、事务和锁测试。

### 阶段 4：核心业务迁移

- 迁移 FormEngine、FormEngineLang、权限、DataSource 和 MCP。
- 把用户原生 SQL 边界改成明确来源类型。

验收：该组目录架构诊断为零；六库核心 API 契约一致。

### 阶段 5：AI、升级和租户生命周期

- 迁移 Microi.AI、NL2SQL、监控、升级资源。
- 迁移租户建库、删库、克隆、导入和导出。

验收：升级可重复；失败不推进版本；六库租户生命周期闭环通过。

### 阶段 6：删除旧轨道

- 删除旧数据库分支、重复 DDL 服务和默认回退。
- 默认关闭 LegacyUnknown SQL 改写。
- 清空架构问题基线。

验收：Dos.ORM 外数据库分支、方言 SQL 和具体 Provider 引用全部为零。

### 阶段 7：六库和前后端总验收

- 六库真实集成测试无 Skip。
- 依次以六种数据库启动 Microi.net.Api。
- 启动 Microi.Client 并执行真实 UI 登录和截图测试。

验收：完整测试命令为绿色，报告包含六库独立证据。

## 13. 自动化测试体系

### 13.1 测试项目

- Dos.ORM.Tests：AST、编译器、参数、标识符和 SQL 快照。
- Dos.ORM.IntegrationTests：六库真实契约。
- Microi.DatabaseArchitecture.Tests：Roslyn 和资源扫描门禁。
- Microi.Server.IntegrationTests：FormEngine、升级、AI、MCP、租户生命周期和 API。

### 13.2 测试分层

1. L0 架构门禁和资源扫描。
2. L1 六库 AST 编译契约。
3. L2 假 DbConnection/DbCommand 组件测试。
4. L3 六库真实数据库集成测试。
5. L4 六库 Microi.net.Api 冒烟。
6. L5 Microi.Client Playwright 登录、网络和截图测试。
7. L6 升级与租户生命周期故障注入。

Quick 模式可运行 L0 至 L2。Full 模式必须运行 L0 至 L6；缺少任一数据库、镜像、许可证或连接时必须失败，禁止自动 Skip 后声称通过。

### 13.3 六库测试环境

初始认证矩阵如下；精确补丁号、镜像 digest、Edition、字符集和排序规则写入受版本控制的 certification-matrix.json，运行时必须逐项核对：

| 数据库 | 最低兼容线 | 目标认证线 | 初始模式 |
|---|---|---|---|
| MySQL | 5.7 | 8.0 | utf8mb4；5.7 和 8.0 均作为必跑子通道 |
| SQL Server | 2017 | 2022 | Developer 或协议等价 Edition；记录并验证 Collation |
| Oracle | 11g R2 | 19c | AL32UTF8；分别验证旧版和新版分页能力 |
| PostgreSQL | 14 | 17 | UTF8、标准 PostgreSQL 模式 |
| DM8 | DM8 | DM8 | 真实 DM8、Oracle 兼容模式、UTF-8 |
| KingbaseES | V9 | V9 | 真实 KingbaseES V9、PostgreSQL 兼容模式、UTF-8 |

目标认证线属于每次 Full 必跑；仍对外承诺的最低兼容线属于 Release Full 必跑。若后续支持其他 DM8/Kingbase 兼容模式，必须新增独立 DialectProfile 和独立真库通道，不能沿用本表结果。

提供一键测试编排：

- MySQL、SQL Server、Oracle、PostgreSQL 使用合法可用的本地容器镜像。
- DM8 和 KingbaseES 使用用户提供的合法本地镜像或测试实例。
- 构建一次，六个数据库通道串行执行；每个通道使用独立 compose project、network、volume 和测试库。
- 每个通道必须读取并记录真实数据库厂商、版本和镜像 digest，防止替代数据库冒充。
- 镜像名、许可证、连接和密码只通过环境变量或本机私有配置注入。
- 每次测试创建隔离数据库或 Schema，完成后自动清理。
- 每个空库先用中性 Schema 和数据 AST 自动创建最小 iTdos fixture，包括租户配置、测试管理员、角色权限、动态菜单和一个专用 CRUD 表单；密码哈希由测试引导程序根据环境变量生成，不写入仓库。
- API 启动前必须回读并验证 fixture 完整，避免把“数据库兼容问题”和“测试租户没有初始化”混在一起。
- 测试日志不得打印连接串、密码、Token 或完整参数值。

当前本机 Docker 服务未运行，六库本地服务可直接执行数量为 0/6。实施后 Full 测试开始前需要启动 Docker，并确保六库合法镜像或实例可用。

## 14. 本地前后端与截图验收

用户指定的页面入口为：

http://localhost:1988/?OsClient=iTdos#/login?redirect=/

验收流程对每个数据库独立执行：

1. 编译 Microi.Server。
2. 停止旧 Microi.net.Api 进程。
3. 在 Microi.Server/Microi.net.Api 以项目 launch profile 启动。
4. 验证 https://localhost:7266 监听且健康。
5. 在 Microi.Client 启动 npm run dev -- --host 0.0.0.0 --port 1988。
6. 通过临时本地代理或运行时配置明确把前端绑定到 7266 和 iTdos，禁止误连远程 ApiBaseDev。
7. 打开指定 URL。
8. 使用用户提供的本地凭据完成真实 UI 登录；凭据只通过环境变量或进程内变量传入。
9. 捕获 Login 请求并断言 HTTP 成功、Code 为 1、Token 存在，但证据只记录布尔结果。
10. 验证首页、菜单、FormEngine 列表、查询、分页和可清理的增删改查闭环。
11. 捕获 requestfailed、HTTP 4xx/5xx、空响应、非法 JSON、意外 Code=0、数据库异常和页面错误。
12. 使用固定 viewport、locale、timezone、字体、动画关闭和稳定等待条件，保存登录页、首页、核心列表、编辑或详情和退出后的全页截图。
13. 对时间、随机 Id 等动态区域做明确 mask，执行基线图像比较和像素容差断言；失败时保留 diff、trace 和视频。
14. 退出登录并确认 Token 清理和回到登录页。
15. 自动化结果完成后再使用图像查看工具做附加人工 QA；人工查看不参与 Full 命令的自动通过判定。

一次性脚本、日志、报告和截图只写入工作区 .tmp：

- .tmp/screenshots/multidb/数据库名称/
- .tmp/reports/multidb/数据库名称/

账号密码、Token、连接串在报告中统一显示为 redacted。

浏览器与截图验收证明应用链路可用，但不能替代 AST 编译契约和六库真实数据库集成认证。最终报告必须分别列出编译器、真实数据库和应用 E2E 三层结果。

## 15. 错误处理和可观测性

- 禁止吞掉 DDL、元数据、Bulk 和数据库生命周期异常。
- 异常包含平台、版本、命令类别、迁移步骤和内部调用点。
- 默认不记录参数值；调试模式也必须脱敏。
- 记录 LegacyUnknown 原生 SQL 和旧正则改写命中次数，帮助删除兼容路径。
- 记录编译耗时、执行耗时和批量分片数，但不把 SQL 文本和敏感值混在普通日志中。

## 16. 性能原则

- AST 不可变，可安全缓存结构模板。
- 参数值每次执行重新绑定。
- 编译计划缓存键使用 AST fingerprint、DialectProfile 和 Schema token，不包含参数值。
- Bulk 自动按数据库参数上限分片。
- 不为追求统一而禁用数据库原生 Bulk、RETURNING 或 OUTPUT；这些能力由统一语义映射到最优实现。
- 所有性能优化必须通过六库语义契约，不能产生数据库特例泄漏。

## 17. 风险和控制

### 风险 1：AST 重构范围大

控制：旧字符串轨道在基线后冻结，只用于 Compare 和回退，不新增数据库能力；所有新实现只写 AST。模块切到 Ast 后立即删除对应旧轨道，避免两套实现同时演进。

### 风险 2：历史标识符大小写

控制：IdentifierPolicy 加真实旧库回归，不直接全量加引号。

同时覆盖 Oracle 空字符串等同 NULL、不同数据库布尔值、字符串拼接、日期精度和时区、DateDiff 边界、NULL 排序及 Identity/Sequence 取值差异。

### 风险 3：旧原生 SQL 依赖 Provider 正则改写

控制：记录兼容命中点，逐项迁移；只对 LegacyUnknown 临时启用。

### 风险 4：国产数据库环境不可获得

控制：Full 模式严格失败并报告缺少的合法镜像或连接；不使用代理数据库伪造结果。

### 风险 5：DDL 隐式提交

控制：能力模型声明实际事务语义，迁移步骤通过幂等和版本状态保证可恢复。

### 风险 6：大规模改动影响现有用户代码

控制：保留 FromSql、实体 CRUD、FromSection、IMicroiORM 和 MicroiEngine.ORM 等公开入口的源码兼容；行为变化以契约测试锁定。

## 18. 最终验收清单

- Microi.net.sln Debug 和 Release 构建通过。
- Dos.ORM 外数据库类型条件分支为 0。
- Dos.ORM 外框架自有方言执行 SQL 为 0。
- Dos.ORM 外具体数据库 Provider 引用为 0。
- 平台自有动态值参数化率为 100%。
- 六库 AST 编译契约全部通过。
- 六库真实集成测试全部通过且无 Skip。
- 六库 Microi.net.Api 启动和核心 API 冒烟全部通过。
- 六库 Microi.Client 真实 UI 登录和核心闭环全部通过。
- 每个数据库都有独立日志、自动视觉对比结果、测试报告和截图；交付前另有不影响命令自动化的附加人工 QA 记录。
- 升级重复执行无副作用，故障时版本不前进。
- 租户创建、初始化、验证、导出、导入和清理形成闭环。
- 用户原生 SQL边界有来源标记、参数审计和明确错误。
- 敏感凭据未进入源码、提交、截图说明或最终报告。

## 19. 设计决策总结

本方案选择 AST 作为平台自有 SQL 的唯一中间表示，数据库平台与编译器全部位于 Dos.ORM。它比单纯集中 switch 的方案成本更高，但能从结构上保证新增数据库不再要求修改 Microi.Core、Microi.net、Microi.AI 或 Microi.Upgrade。

实现将采用阶段式落地，而不是一次提交替换全部代码；最终验收仍以完整六库真实测试和前后端自动化为准。
