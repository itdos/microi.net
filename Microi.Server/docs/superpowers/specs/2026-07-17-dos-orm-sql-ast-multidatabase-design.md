# Dos.ORM 完整 SQL AST 与六数据库兼容架构设计

日期：2026-07-17
状态：已批准，按终审修订后的六计划路线实施
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
   Lower / Optimize（可产生 internal 方言私有 IR）
                |
                v
  allocation-only resolver + 稳定参数分配
                |
                v
     六库 SqlCompiler 纯渲染
                |
                v
 DatabaseExecutionPlan(步骤 + 参数定义 + 分类)
                |
                v
 DriverAdapter + DbSession + Transaction
~~~

Dos.ORM 是唯一了解数据库类型、驱动、语法、参数、标识符、能力和版本差异的程序集。

### 3.1 数据库平台注册中心

注册中心采用阶段式激活，不能在真实编译器存在前用占位实现抢占平台。
第一阶段只冻结不可变 `DatabaseCapabilities` 和测试用
`DialectProfile`；MySQL、PostgreSQL、KingbaseES、SQL Server、Oracle、DM8
编译器随后以 internal 真实类型被直接测试。只有六个真实编译器全部存在、
Oracle 11g 的首个私有 IR 参数分配合同通过后，才在 compiler Task 6B
激活公开描述符和注册中心：

~~~csharp
public sealed class DatabasePlatformDescriptor
{
    public DatabaseType Type { get; }
    public IReadOnlyList<string> Aliases { get; }
    public DialectProfile Profile { get; }
    public ISqlCompiler Compiler { get; }
    public DatabaseCapabilities Capabilities { get; }
}

public static class DatabasePlatformRegistry
{
    public static DatabasePlatformDescriptor Get(DialectProfile profile);
    public static bool TryGet(
        DialectProfile profile,
        out DatabasePlatformDescriptor descriptor);
    public static DatabasePlatformDescriptor Resolve(
        string alias,
        DialectProfile profile);
}
~~~

描述符构造函数是 internal，拒绝 null compiler/capabilities、空/重复 alias
和 type/profile 不一致；保留调用者传入的精确 profile 引用，并防御性复制
alias。注册中心没有 public Register、默认平台、无参查找或只接收
DatabaseType 的重载。每次查找都返回新 descriptor，不缓存 descriptor 或
输入 profile；静态定义、共享真实 compiler、capabilities 和 alias 表均不可变，
compiler 不保存每次调用状态。

六个官方 alias 的封闭表为：MySql=`mysql`、SqlServer=`sqlserver`、
Oracle=`oracle`、PostgreSql=`postgresql`、DaMeng=`dm8`、
KingBase=`kingbasees-v9`，只允许 OrdinalIgnoreCase 精确匹配，不做 substring
猜测。MsAccess、Sqlite3、SqlServer9 是明确的 legacy provider 路径，不进入
六库注册或认证，也不得被报告成任一官方平台。

Task 6B 的公开 descriptor 只冻结 compiler/capabilities/profile/alias 合同。
DriverAdapter、TypeMapper、SchemaIntrospector、Bulk、Admin、Diagnostics、
NativeScripts 和 ConnectionPolicy 是后续 legacy/execution 阶段加入注册中心
私有 immutable platform definition 的程序集内部服务；它们不通过扩大
`DatabasePlatformDescriptor` 公共面暴露。legacy Task 1 只绑定已激活的
compiler/capabilities descriptor；managed execution Task 2 再阶段化加入
driver 等内部服务选择，并由完整公共面基线证明没有意外公开增量。

最终注册中心及其内部服务目录负责：

- DatabaseType 和字符串别名解析。
- compiler/capability 选择，以及后续 internal driver/service factory 选择。
- 数据库版本能力探测。
- 连接串规范化。
- 普通连接、管理库连接和建删库连接的选择。
- 未注册数据库的快速失败。

DbProvider 只保留连接、命令、事务和驱动适配职责，不再自行改写 SQL。

ProviderFactory 创建时尚未打开连接，因此只把 **exact legacy alias** 映射为
DatabaseType 和配置兼容模式；它不检测 live profile、不缓存 profile、不调用
Registry.Get，也不暴露可能陈旧的 public `Platform`。连接打开后，internal
bootstrap 从同一平台注册的六个 production `IDbDriverAdapter` 之一读取完整四段
server version 与原始 mode，验证/规范化 mode（DM raw 2 -> canonical Oracle），
构造 exact `DialectProfile`，随后才调用 `DatabasePlatformRegistry.Get(profile)`。
一次 managed-execution ticket 的 private constructor 绑定同一个 internal platform
definition、driver 和 resource resolver；materializer 只能使用 `ticket.Driver`，
并通过 `CreateParameter(DbCommand command, PhysicalBoundParameter parameter)`
创建参数，
禁止按 DatabaseType 二次选择或从 stale descriptor 取 driver。

## 4. SQL AST 类型系统

公共/中性 AST 和方言私有 IR 是两个封闭词汇表。Task 2-6 的 93 个中性
`SqlNode` 全部不可变，不保存数据库类型，不直接保存带方言的 SQL 片段；
Bind、Normalize、Validate 只接受这 93 个节点并对其他 subtype fail closed。

Validate 之后，Lower/Optimize 可以为确有需要的语义产生对应方言命名空间
下的 internal sealed `SqlNode`，例如 Oracle 11g nested-ROWNUM paging IR。
私有 IR 不是公共 AST 输入，不加入 93-node normalizer/validator catalog，
也不提供 public visitor/registry/plugin API。私有 IR 中的运行时参数仍只能是
可达的 `ParameterExpression(ParameterDefinition)` 叶；不得保存值、SQL、
ParameterBag、BoundParameter 或 provider 对象。

### 4.1 语句节点

- SelectStatement
- InsertStatement
- UpdateStatement
- DeleteStatement
- UpsertStatement
- BulkInsertOperation
- SchemaOperation 及其 Create/Alter/Rename/Drop/Comment/Sequence 子类
- MetadataQueryOperation 及其 List/Get 子类
- DatabaseDiagnosticOperation
- DatabaseAdminOperation 及 Create/Drop/Export/Import 子类

这些名称与已冻结的 93-node catalog 一致；不存在
`MetadataQueryStatement`、`DiagnosticQueryStatement` 或可用分号绕过计划验证的
`SqlBatch`。多命令只存在于 `DatabaseExecutionPlan.Steps`。执行计划显式携带
AtomicityRequirement。只有全部步骤支持事务且使用同一连接时才保持同一事务；
DDL 隐式提交或 Admin 跨管理连接时，编译器必须拒绝 Required 原子批次，或生成
明确标注 BestEffort/None 的分段计划，不能暗示这些步骤可以整体回滚。

### 4.2 查询结构节点

- TableSource、DerivedTableSource、JoinSource
- CommonTableExpression
- Projection、OrderBy、GroupBy、Having
- Pagination，包括 Offset/Limit 和 Keyset 两种中性语义
- RowLock
- Union、UnionAll、Intersect、Except

分页语义包含页码、页大小、偏移量和确定性排序要求。现有
`OffsetPageSpec.Offset`/`Limit` 是经过构造器校验的结构整数，不是运行时参数；
writer 只能通过专用 non-negative structural-integer token 输出它们。分页计划
固定为 count Scalar 与 data RowSet 两个独立 command step，禁止分号 batch，
禁止把 Offset/Limit 伪装成 `ParameterDefinition`。编译器分别生成
LIMIT/OFFSET、OFFSET/FETCH 或 Oracle 分页结构，业务层不能直接表达这些关键字。
一个带 `OffsetPageSpec` 的 `SelectStatement` 只调用一次 `Compile`；编译器内部从
该源派生去排序/去分页的 count 分支和保留分页的 data 分支，并在一个计划中按
`[Scalar, RowSet]` 返回两条独立 command。调用方不得另建/另编译 Count AST，
不得调用预览 SQL 属性参与执行，也不得在编译器外补分页语义。
Oracle 11g private IR 精确保留 `InnerQuery:SqlNode`、`Offset:int`、`Limit:int`，
allocation child 只有 InnerQuery；双层 ROWNUM 的 inner upper bound 使用 checked
`Offset + Limit`，outer alias 使用 `> Offset`，溢出在返回任何计划前安全失败。

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
    DatabaseExecutionPlan CompileMigration(MigrationPlan plan, SqlCompilationOptions options);
}

public sealed class DatabaseExecutionPlan
{
    public IReadOnlyList<DatabasePlanStep> Steps { get; }
    public SqlResultShape ResultShape { get; }
    public SqlSafetyOrigin Origin { get; }
    public AtomicityRequirement Atomicity { get; }
    public DialectProfile DialectProfile { get; }
    public SchemaToken SchemaToken { get; }
    public PlanCachePolicy CachePolicy { get; }
    public CompiledPlanFingerprint Fingerprint { get; }
    public PlanSafetyBinding Safety { get; }
    public bool RequiresEffectiveImpactApproval { get; }
}
~~~

`SqlCompilerBase`、`SqlTextWriter`、`SqlLoweringContext`、
`AllocatedSqlNode` 和 `RenderedSql` 全部是 internal；公开扩展面只有现有
`ISqlCompiler`。没有 placeholder compiler。真实 compiler 可以作为 immutable
共享实例，但 writer、lowering、allocation、render 和 plan state 必须每次
调用新建，50-task 同实例编译结果必须确定一致。Allocated/Rendered wrappers
是 value-free immutable snapshot，不得包含 ParameterBag、BoundParameter、
runtime value、connection、command、transaction、provider 或 approval。
Dos.ORM 只向 `Dos.ORM.Tests` 声明一个精确 `InternalsVisibleTo`，使测试直接
构造这些 internal 类型；门禁拒绝其他 friend assembly 和任何为测试而公开的
compiler/capability constructor。

DatabasePlanStep 包含：

- SqlCommandStep：SQL 模板和无值 ParameterDefinition。
- BulkStep：原生 Bulk 或 AST Insert 分批计划。
- AdminStep：建删库、切换管理连接或导入导出。
- NativeScriptStep：仅用于用户提供并声明目标数据库的导入脚本，不允许承载平台升级或初始化逻辑。

执行时由 ParameterBag 生成 BoundParameter。缓存只保存无值模板，不能保存 BoundParameter。

编译分为以下八个明确阶段：

1. Bind：`ISqlCompiler` 只接收已构造的中性 `SqlStatement`；legacy
   Field/WhereClip/FromSection 由编译器外的 source adapter 先转换为 AST。Bind
   使用 deterministic internal closed-set binder 在 93-node AST 内解析列引用的
   alias owner 和结构类型元数据，仍输出 neutral AST；未解析/歧义引用安全失败，
   不能做 identity/no-op，也不连接数据库或读取运行时值。
2. Normalize：归一化 NULL 比较、空 IN、逻辑树、别名、函数和分页。
3. Validate：校验类型、字段归属、写安全、标识符和可移植能力。
4. Lower：把高级语义降低为目标数据库 IR，例如 Oracle 版本分页、OUTPUT 或冲突处理；可以返回 internal sealed 方言私有节点。
5. Optimize：只做能够证明语义等价的常量折叠和批次规划。
6. AllocateParameters：按稳定遍历顺序分配参数、类型和批次。中性节点使用
   93-node closed catalog；私有节点只通过程序集内部 allocation-only exact-type
   descriptor resolver 提供有序 `SqlNode` children。中性描述优先，未知私有
   节点在 Render 前失败，私有/中性节点共享同一 depth 128、occurrence 4096、
   collection-slot 16384 预算和参数冲突/首次定义内核。Normalize/Validate
   永远不接收该 resolver。
7. Render：只消费 value-free `AllocatedSqlNode` 的 root/slot snapshot，纯渲染
   SQL 并映射方言占位符，不重新发现或分配参数。
8. Plan：由 base 在 source-aware plan factory 中生成一个或多个 step、事务要求、
   ResultShape 和缓存信息。

普通 Compile 和 Migration 的每一个 source step 都必须由 base 依序经过八阶段；
方言只能实现 Lower/Optimize/Render/能力/有效影响 hooks，不能替换入口、迁移循环、
跳过阶段或重排。迁移 context 携带 exact `MigrationStepId`，每个生成命令的
`SourceMigrationStepId` 必须相同；ForMigration 只聚合已验证 fragment。internal
enum-only Observe hook 使测试可观测顺序，production 默认为空，六个真实 compiler
不得 override 或注入 observer。

Validate 返回非空 diagnostics 时立即在 Lower 前抛出 public sealed
`SqlAstValidationException`；它防御性复制完整、只读、value-safe
`IReadOnlyList<SqlAstDiagnostic>`。缺少能力抛出 public sealed
`UnsupportedDatabaseCapabilityException`。两者公共诊断只含 DatabaseType、四段
ServerVersion、CompatibilityMode、feature、结构 node path（validation 另含安全
diagnostics snapshot）；固定 Message、Data 和 ToString 不得包含 SQL、参数值、
连接串、secret、source node 或原始调用对象。

`RenderedSql` 是 internal immutable `Commands|Bulk|Admin` 判别联合；三个精确
factory 互斥且都不携带 effective impact。有效影响只由 base
`DeriveEffectiveImpact` 单源传入 source-aware plan factory。`SqlTextWriter` 没有
AppendRaw/Append(string)，只有 keyword/operator/identifier/parameter/括号/逗号/
点/structural-int/typed-schema-literal tokens；每个命令使用 fresh writer，terminal
snapshot 只冻结 value-free text+parameter definitions，再显式构造带 result role、
connection/transaction behavior 和 source step ID 的 command。

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

测试仓库维护非运行时推导的 exhaustive disposition catalog：十个 exact profile
对全部 93 neutral nodes、全部 operator、SemanticFunctionId、LogicalDbType、
DML/锁/分页/Bulk、DDL/metadata/admin 逐项恰好标记 Native、Lowered 或
Rejected(feature,path)。反射发现任何新增 enum/type 未补十行 disposition 即失败。
所有可编译 disposition 对十个 profile 生成受版本控制 exact golden snapshot，
比较完整命令顺序/文本/参数定义/result/transaction/impact/fingerprint inputs，不以
Contains 冒充验收，不允许运行器自动更新 baseline。

### 5.3 能力模型

`DatabaseCapabilities` 是 public sealed、internal constructor、全 get-only 的
不可变标量合同。精确属性面覆盖：

- `bool SupportsLimitOffsetPagination`、`SupportsOffsetFetchPagination`、`SupportsRownumPagination`。
- `bool SupportsReturningClause`、`SupportsReturningIntoClause`、`SupportsOutputClause`。
- `bool SupportsIdentityColumns`、`SupportsSequences`。
- `bool SupportsOnDuplicateKeyUpsert`、`SupportsOnConflictUpsert`、`SupportsMergeUpsert`、`SupportsLockedUpdateThenInsertUpsert`。
- `bool SupportsJson`、`SupportsWindowFunctions`、`SupportsCommonTableExpressions`。
- `bool SupportsForUpdateLock`、`SupportsUpdateLockHint`、`SupportsSkipLocked`、`SupportsNoWait`。
- `bool SupportsMultipleStatements`、`SupportsMultipleResultSets`。
- `int MaxParametersPerCommand`、`MaxCommandTextLength`、`MaxBulkRowsPerBatch`，均必须大于 0。
- 复用现有 `PlanTransactionBehavior DdlTransactionBehavior`。
- `bool SupportsSchemas`、`SupportsCatalogs`、`SupportsCreateDatabase`、`SupportsDropDatabase`。
- `bool SupportsNativeBulk`。

以上恰好 30 个 get-only scalar，不增加 capability enum。构造函数要求至少一个
pagination 为 true，拒绝三个非正 limits，拒绝
`PlanTransactionBehavior.Opaque` 以及所有未定义/负 enum 值，并要求 SupportsSkipLocked 或
SupportsNoWait 为 true 时 `SupportsForUpdateLock || SupportsUpdateLockHint`
也为 true；不接受集合、setter、mutable builder、default instance 或
DatabaseType 推断。

官方版本/mode 到能力对象的映射由各方言 task 自己的 internal factory 提供：
MySQL 5.7.8.0+/8.0.11.0+ 对应 band、SQL Server engine 14/16、Oracle
11.2.0.4/19、PostgreSQL 14/17、DM8 major 8 + canonical ordinal `Oracle`、
KingbaseES 9.4.12.0+ + ordinal `PostgreSQL`。其他 type/version/mode/case 明确失败。Build/Revision 仍保留在
profile/fingerprint 中，不能被 registry 缓存或兼容模式归一化吞掉。连接后的
能力探测必须映射到同一 factory 合同，业务代码不得判断版本字符串。

30 项能力值按 constructor/property 顺序冻结如下。缩写依次为：LO
LimitOffset、OF OffsetFetch、RN Rownum、R RETURNING、RI RETURNING INTO、
O OUTPUT、ID Identity、SQ Sequence、DK ON DUPLICATE KEY、OC ON CONFLICT、
MG MERGE、LU LockedUpdateThenInsert、J JSON、W Window、C CTE、FU FOR UPDATE、
UH UpdateLockHint、SL SKIP LOCKED、NW NOWAIT、MS MultipleStatements、MR
MultipleResultSets。

| Exact capability band | LO | OF | RN | R | RI | O | ID | SQ | DK | OC | MG | LU | J | W | C | FU | UH | SL | NW | MS | MR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MySQL `5.7.8.0+` in 5.7 | T | F | F | F | F | F | T | F | T | F | F | F | T | F | F | T | F | F | F | F | F |
| MySQL `8.0.11.0+` in 8.0 | T | F | F | F | F | F | T | F | T | F | F | F | T | T | T | T | F | T | T | F | F |
| SQL Server engine 14/16 | F | T | F | F | F | T | T | T | F | F | F | T | T | T | T | F | T | F | T | F | F |
| Oracle `11.2.0.4` | F | F | T | F | T | F | F | T | F | F | T | F | F | T | T | T | F | T | T | F | F |
| Oracle 19 | F | T | T | F | T | F | T | T | F | F | T | F | T | T | T | T | F | T | T | F | F |
| PostgreSQL 14 | T | T | F | T | F | F | T | T | F | T | F | F | T | T | T | T | F | T | T | F | F |
| PostgreSQL 17 | T | T | F | T | F | F | T | T | F | T | T | F | T | T | T | T | F | T | T | F | F |
| DM8 canonical Oracle mode after raw mode 2 | T | T | T | F | T | F | T | T | F | F | T | F | F | T | T | T | F | T | T | F | F |
| KingbaseES `9.4.12.0+`, PostgreSQL mode | T | T | F | T | F | F | T | T | F | T | T | F | T | T | T | T | F | T | T | F | F |

| Capability band | MaxParameters | MaxCommandText | MaxBulkRows | DDL behavior | Schemas | Catalogs | Create DB | Drop DB | Native bulk |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| MySQL 5.7/8.0 | 65535 | 1048576 | 1000 | ImplicitCommit | T | F | T | T | F |
| SQL Server 14/16 | 2100 | 1048576 | 1000 | Enlistable | T | T | T | T | F |
| Oracle 11.2/19 | 1000 | 65535 | 1000 | ImplicitCommit | T | F | F | F | F |
| PostgreSQL 14/17 | 65535 | 1048576 | 1000 | Enlistable | T | F | T | T | F |
| DM8 Oracle mode | 2048 | 65535 | 1000 | ImplicitCommit | T | F | F | F | F |
| KingbaseES 9.4.12 PostgreSQL mode | 32767 | 1048576 | 1000 | Enlistable | T | F | T | T | F |

`SupportsMultipleStatements`、`SupportsMultipleResultSets`、
`SupportsNativeBulk` 初始全部为 false；只有精确 driver/server/profile/protocol
真实集成通过后才能对该 profile 启用。MaxCommandText 是 Dos.ORM 保守编译上限，
不是数据库硬上限；Oracle 1000 同样是保守 bind 上限。有效 Bulk 行数为
`min(1000, MaxParametersPerCommand / parametersPerRow)`，MySQL 另受 live
`max_allowed_packet` 限制。DM live detector 必须先验证原始
`COMPATIBLE_MODE=2`，再映射为 public canonical
`DialectProfile.CompatibilityMode == "Oracle"`；profile 中绝不保留原始 `"2"`。
Kingbase 首个认证 band 固定 `9.4.12.0+` exact PostgreSQL mode，其他 V9 profile
不能猜测通过。十个 TestProfiles 都使用四段 `ServerVersion`，每次访问返回 fresh
对象；factory 对 null、wrong type、band boundary、wrong/mode case 建立 fail-closed
matrix，band 内 Build/Revision 可接受但仍保持 exact profile/fingerprint identity。

一手依据包括 [MySQL 5.7 JSON](https://dev.mysql.com/doc/refman/5.7/en/json.html)、
[MySQL 8 Window](https://dev.mysql.com/doc/refman/8.0/en/window-functions.html)、
[SQL Server capacity](https://learn.microsoft.com/en-us/sql/sql-server/maximum-capacity-specifications-for-sql-server)、
[SQL Server lock hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table)、
[Oracle 19 SELECT](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html)、
[PostgreSQL 17 MERGE](https://www.postgresql.org/docs/17/sql-merge.html)、
[PostgreSQL limits](https://www.postgresql.org/docs/17/limits.html)、
[DM8 JSON mode](https://eco.dameng.com/document/dm/zh-cn/pm/json.html)、
[DM8 DML](https://eco.dameng.com/document/dm/zh-cn/pm/insertion-deletion-modification.html)、
[KingbaseES V9 SQL](https://help.kingbase.com.cn/v9/development/sql-plsql/sql/SQL_Statements_10.html)
和 [KingbaseES 9.4.12 parameter FAQ](https://help.kingbase.com.cn/v9.4.12/faq/faq-new/interface/jdbc.html)。

## 6. 执行器

DbSession 增加 AST 执行入口，统一执行流程：

1. 从当前连接检测精确 DialectProfile，以注册中心获取新 descriptor 和对应 internal platform service definition。
2. 由同一 DriverAdapter 回读并验证精确 DatabaseStorageContract；Oracle/DM8 的 storage-contract fingerprint 纳入 SchemaToken。
3. 由 descriptor 的真实 compiler 编译 AST。
4. 由同一 internal definition 的 DriverAdapter 创建命令和物理参数。
5. 绑定当前事务。
6. 执行并按结果 value contract 转换为逻辑值。
7. 在异常中附加命令类别和数据库信息，但不记录敏感参数值。

`DatabaseDiagnosticOperation` 是普通 `SqlStatement`，必须通过 source-only
`DbSession.FromAst` 编译/执行；它不是 `DatabaseAdminOperation`，不得走
ExecuteAdmin。只有 Create/Drop/Export/Import 等真实 admin source 使用
PreviewAdmin/ExecuteAdmin。

分页默认执行 Count AST 和 Data AST 两个独立命令，可共享同一事务或一致性快照。禁止假设所有驱动都支持以分号拼接两个查询。

Upsert 必须使用目标库原子能力；没有原子语义时只能使用显式锁与事务策略，或报告不支持。不得用先查后写的无锁降级伪装成原子 Upsert。

SQL Server 的 Upsert 不默认依赖 MERGE。它只接受调用者显式请求
`AtomicityRequirement.Required`，使用 UPDLOCK + SERIALIZABLE
update-then-conditional-insert 并通过并发竞争集成测试；None/BestEffort 必须拒绝，
不得由编译器静默升级或弱化。

Bulk 优先使用数据库原生 Bulk API；降级为 AST 批量 Insert 时必须遵守最大参数数、分批、当前事务和失败回滚。

## 7. 原生 SQL 边界

原生 SQL 是受控逃生舱，不属于 AST 自动翻译范围。

Dos.ORM 内部提供明确来源类型；平台调用者不构造 profile 或该类型：

~~~csharp
NativeSqlText.UserProvided(sql, exactLiveProfile, commandKind)
NativeSqlText.LegacyAiGenerated(sql, exactLiveProfile, commandKind)
NativeSqlText.LegacyUnknown(sql, exactLiveProfile)
~~~

规则如下：

- V8.Db.FromSql 和 DataSource 用户输入标记为 UserProvided。
- 新的公共边界只有 `FromNativeSql(string, NativeSqlCommandKind,
  IEnumerable<ParameterDefinition>, ParameterBag)`；section 创建阶段不打开
  连接，第一个 terminal 检测 live profile 后由 Dos.ORM 内部绑定
  `NativeSqlText.UserProvided`。不得增加 profile accessor、caller-built
  NativeSqlText 重载或 DatabaseType-only factory。
- 新 NL2SQL 不输出 SQL 字符串。模型输出有版本的 PortableQueryDocument 结构化 JSON，经 Schema 白名单、只读语义和类型校验后转换成 Select AST，再由目标数据库编译器生成 SQL。
- LegacyAiGenerated 只为迁移旧 NL2SQL 保留，属于调用者管理的当前数据库方言 SQL，不计入跨库兼容承诺；最终验收前平台默认路径必须清零。
- 现有 FromSql(string) 保持源码兼容，但标记为 LegacyUnknown；平台源码直接调用它会触发架构诊断。
- 原生 SQL 不做正则方言翻译。
- 原生 SQL 是 provider-specific physical escape hatch，不具备 AST 的字段、
  pattern、JSON path 或结果列信息，因此不参与 Oracle/DM8 logical text
  envelope 编解码，也不能计入空串跨库认证。
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
- ProviderFactory/DbSession.CreateDbProvider 只做 exact legacy alias/config
  入口兼容；live connection bootstrap 取得四段 profile 后才委托 registry。
- 下游只使用 public source-only DbSession facade（FromAst、ExecuteMigration、
  PreviewAdmin/ExecuteAdmin 等已冻结入口），参数只接收 neutral source、
  ParameterBag、atomicity/approval/resource handle；不得接收 compiled plan、SQL、
  provider、driver、internal `IDatabaseAdmin`/`IDatabaseDiagnostics`/
  `IConnectionPolicy`。数据库差异与执行票据继续留在 Dos.ORM internal。

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

官方 seed 已证明需要的 `SchemaCollation`（Unicode/case/accent/binary 四维 +
sourceName）、`ColumnUpdateBehavior.CurrentDateTime` 与
`IndexColumnDefinition.PrefixLength` 必须在 six-dialect Task 7、legacy public
baseline 捕获之前加入。保留旧 ColumnDefinition/IndexColumnDefinition 构造器，
默认 null/None/null 不写任何 fingerprint extension byte，旧 fingerprint 完全不变；
非默认语义写 versioned tag。SchemaCollation 是 value object 而非 SqlNode，neutral
catalog 仍为 93。normalizer/validator/traversal/fingerprint/public-surface tests 与十
profile disposition/goldens同时更新；seed plan 后续只能消费，不能再修改 public AST。

Collation 可移植合同仅承诺 Unicode repertoire、case/accent sensitivity、binary/
linguistic comparison 四维及 unique constraint 结果，不宣称各厂商排序权重逐字节
相同。已知 source name 映射到 exact per-profile collation/ICU/NLS 策略，实库用
中文、emoji、大小写、重音、ordering/equality/unique-index probe 验证；manifest
记录受控转换，未知或无法满足四维时 fail closed。

### 9.2 升级资源

现有 MySQL 专用 DDL 和数据脚本按以下规则迁移：

- 表结构转为 SchemaOperation。
- 初始化数据转为 JSON 或强类型数据行，通过 AST Insert/Upsert 执行。
- 迁移步骤必须有稳定 Id、幂等判断和失败状态。
- 任一步失败都不得推进 ServerVersion。
- 同一旧库快照连续升级两次，第二次必须无副作用。

平台升级和初始化不保留厂商原生脚本例外。若某数据库功能无法由现有节点
表达，必须在 Dos.ORM 增加中性语义节点或方言私有 Lowering 实现，并为六个
DialectProfile 提供明确实现或明确不支持错误；不得通过原生脚本绕过 AST。
方言私有 Lowering 必须走上述 allocation-only exact-type descriptor resolver：
ParameterExpression-only、中性优先、共享预算、unknown-before-Render；不得让
Render 自行发现参数。

标准空业务库另有正式 seed-converter 阶段。它每次从
`https://static.itdos.com/install/microi_empty_mysql57.sql.zip` 安全下载当前 MySQL
5.7 源，防 ZIP Slip/炸弹/多 SQL entry/截断/编码异常，使用 streaming MySQL 5.7
lexer/parser 构造 value-free neutral schema + typed rows + manifest。默认客户命令
生成五个当前非 MySQL 目标库确定性 artifact（SQL Server、Oracle、PostgreSQL、
DM8、KingbaseES），且每个 artifact 绑定 `seed-targets.json` 中明确的 exact
four-part profile，不使用 capability floor；其它客户版本由 `--targets-file` 或
`--profile` 明确给出。Full 不复用可能不匹配真实镜像的默认 artifact，而从本次
不可变 `resolved-matrix.json` 为各 live exact profile 重新生成（另含 MySQL 8）；
ReleaseFull 同样按 exact profile 生成全部认证版本 artifact。
2026-07-18 审计 SHA 的 133 tables / 2403 columns / 16083 rows 仅是固定 fixture/
缓存的历史回归合同；latest URL 绝不硬编码这些计数。每次当前包的 expected
table/column/row/digest 来自本次 manifest，并先由单独 MySQL 5.7 reference
import 回读验证；只有 source SHA 等于审计 SHA 才额外断言旧计数。所有生成目标
随后逐库串行恢复并按同一动态 manifest 比较全表、全行与 schema digest。
逐行 canonical wire 是 schema ordinal 下 type/null/length/value 的流式编码。有 PK
时按 canonical typed PK wire 排序；无 PK 时不得拒绝合法新表，而由 Dos.ORM 做
bounded external sort：row SHA-256 后接完整 row wire 作为 collision-safe tie-break，
保留重复行 multiplicity，private spill/merge 后可靠清理。MySQL reference 与各目标
独立读取并采用同一逻辑定义，不依赖 DB natural order、LOB ORDER BY 或全量内存；
no-PK duplicate/LOB/order permutation/collision-injection 都是强制测试。

每个目标 ZIP 同时包含 (a) canonical portable typed payload 和 (b) 面向客户离线
还原的 vendor SQL。两者都绑定同一 manifest/digest；vendor SQL 经过静态扫描与
真实 restore 验证，但 DbSession **永不执行该 SQL**。目标库 ZIP 明确使用现有
`DatabaseImportOperation(database, resource, DatabaseTransferFormat.ProviderNative,
DatabaseTransferScope.SchemaAndData, ...)`；这里的 ProviderNative 只表示
**Dos.ORM 自己生成**、绑定 exact target DialectProfile、source/manifest/content
digest 的目标 artifact。Dos.ORM internal importer 只读取其中已验证的 portable
typed payload，并重建 Schema/DML AST 计划，绝不读取 vendor SQL 进入执行，亦不
转换成 `NativeSqlText` 或 PlatformGenerated SQL 逃生口。canonical neutral
manifest/payload 可另以 `PortableJson` 发布，但不得把
target-specific ZIP 误标为 PortableJson；本轮不新增 transfer-format enum。
seed Task 4 明确拥有 `DatabaseResourcePipeline`、`SqlExecutionCoordinator` 与
`PortableSeedImportCoordinator` 的接线和故障注入测试；因此 Task 5 首次调用
ExecuteAdmin 前 managed payload 路径已经真实可执行，不等待后续平台迁移补齐。
artifact hash graph 唯一且无环：`manifest.json` 只记录 portable payload 与各 vendor
SQL entry 的 digest，明确排除自身、`checksums.sha256` 与 final ZIP；随后
`checksums.sha256` 覆盖除自身外的全部 entry（包括 manifest）；最后关闭 ZIP 后计算
outer `ResourceContentDigest` 并放入 `DatabaseResourceHandle`。OpenRead 必须返回这份
完整 ZIP，importer 先验 outer digest/安全 archive/manifest/entry hashes/cross-digest，
再且只执行 portable payload。

宿主只通过已冻结的最小 public `IDatabaseResourceProvider` 提供字节流；
resource handle 的 content digest 必须与流一致。DbSession ticket 绑定同一 resolver，
PreviewAdmin/ExecuteAdmin source-only facade 接收上述现有 DatabaseImportOperation，
不新增 `SeedInstallRequest`、compiled plan/SQL/provider 参数。Microi.net 和
Microi.Core 只提供字节，不解析方言或执行 SQL。

~~~csharp
public interface IDatabaseResourceProvider
{
    Stream OpenRead(DatabaseResourceHandle resource);
    Stream OpenWrite(DatabaseResourceHandle resource);
}
~~~

正式 Microi host implementation 只有 seed Task 5 在 Microi.Core 创建的 internal
sealed `MicroiDatabaseResourceProvider`；`AddMicroiORM` 在同一程序集内只把它注册
一次为 public `IDatabaseResourceProvider` singleton。release、tenant 和 platform
migration 的构造函数/宿主只依赖该 public interface，不能命名 internal 实现。
Microi.net 私仓不得再创建 alternate provider/wrapper/subclass。

该接口是 import/export/seed managed-execution 唯一新增 resource public delta：无
async 重载、无 path/URL/string/byte[]/SQL/profile/provider 参数。OpenRead 返回的
流由 Dos.ORM 逐字节核验 expected content digest。OpenWrite 必须返回尚未公开的
temporary writable stream。Dos.ORM 先在 private spool 生成并核验完整 expected
digest，digest mismatch 时 `OpenWriteCalls == 0`；验证后才 OpenWrite/复制/flush/
dispose。provider 返回流实现 exact `Writing -> Prepared|Aborted` 状态机：Write
累计 provider-owned 长度/SHA；唯一 terminal Flush/FlushAsync 先验证 expected
length/digest，再 seal 为 Prepared；任何写入、取消、短写、oversize 或 flush 失败
转为 Aborted。Dos.ORM 只在 copy 阶段观察取消；Flush 成功后立刻进入不可取消的
Dispose commit window，不执行用户回调或其它工作。Prepared Dispose 原子发布且
发布后不得抛；Writing/Aborted Dispose 只丢弃；publish 失败必须在对象可见前抛出。
null/错误方向/重复打开、fresh stream
identity、exclusive disposal ownership及所有 close/rollback 矩阵由 contract test
冻结；接口没有第三个 commit/abort/delete/path 方法。这样现有
DatabaseExportOperation 有明确 sink，DatabaseImportOperation 有明确 source，且
二者都不把路径、SQL 或方言暴露给下游。

Seed 计划的独立 `SeedPublicApiDeltaAllowlist` 只再允许 public sealed
`DatabaseSeedConverter`（parameterless ctor；
`InspectSource(Stream,Stream)`、`Convert(Stream,DialectProfile,Stream)` 与
`Verify(Stream,DialectProfile)` 均返回 `ResourceContentDigest`）和 value-safe public
sealed `DatabaseSeedSourceException`（internal ctor；Code/ByteOffset/
StructuralPath/SourceDigest）。Exception 在 seed Tasks 1-4 保持 internal，Task 5
与该 allowlist 同一 commit 才改 public，禁止出现未被精确 public-surface gate 覆盖的
中间状态。`InspectSource` 只向调用者提供的 evidence stream 写入
versioned canonical value-safe JSON（包/SQL摘要与大小、解析器版本、结构计数、逐表
schema/row digest 和安全诊断），不暴露 row value、SQL/token text、URL、路径或凭据；
CLI 与 certification 只能消费该 evidence，不能引用 internal manifest/model。所有
Inspect/Convert 先在 bounded private spool 完成全量解析、验证、编译、封包和摘要，
成功后才写 caller destination；任何 pre-copy 失败保证 `WriteCalls == 0`，仅最终复制
失败可留下不可用输出且永不发布。所有 caller stream 均不由 facade 关闭。所有 seed
model/parser/compiler/artifact 类型 internal；最终 public surface 必须精确等于 legacy
baseline、managed delta 与 seed delta 的并集。

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
- MICROI_DB005：Dos.ORM 外生产源码引用 legacy public
  `Dos.ORM.CommandCreator` 类型、构造函数或任意 `Create*Command` 成员。

扫描必须覆盖 Microi.Server 的真实物理文件，包括
`Microi.Server/Microi.net` 与 `Microi.Server/Microi.AI` 两个独立私有 Git
仓库源；只按完整目录段排除 `bin`、`obj`、`.git`、`.vs`、`.tmp`、
`.tmp-build`、`artifacts`、`TestResults`、`coverage`、`node_modules`、`dist`
和 `publish`。位于这些目录外的 `.g.cs`、`.generated.cs` 和其它物理 C#
文件照常扫描；SQL/resource/JSON/XML、`.mjs`、`.cshtml` 与其它生产文本也
进入 origin/vendor-token 门禁。扫描 canonicalize 后必须仍位于
Microi.Server 根目录，且不得跟随 reparse point/junction/symlink。它们不是
根仓“被忽略目录”，扫描范围与 Git 所有权不能混为一谈。

开源根仓、Microi.net 私仓、Microi.AI 私仓必须分别执行 status/diff/add/commit
（仅实施者获授权时）和各自 build/test；根仓不得 `git add -f` 私仓路径，也不得
用根仓 clean/staged 状态证明私仓交付。物理架构扫描仍一次覆盖三个工作树。

Dos.ORM 自身的编译器架构门禁同时断言：compiler base/writer/lowering/
allocated/rendered wrappers 全部 internal；Task 6B 之前不存在成功 registry；
Task 6B 之后 registry 只有精确 profile API、无 public Register/default/type-only
入口；Normalize/Validate 不依赖 private-IR resolver；每个方言 private IR exact
coverage、共享预算、unknown-before-Render 和 parameter/render 对应全部通过。

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
- 先冻结 exact capabilities/TestProfiles，再实现 internal 八阶段 neutral-only base。
- 依次直接构造和测试六库真实 internal 编译器；不创建 placeholder registry。
- Oracle 11g 捕获首个真实 private-IR allocation RED 后才增加 allocation-only resolver；Oracle/DM8 完成后才由 Task 6B 激活六库 registry。
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
| MySQL | 5.7.8.0 | 8.0.11.0+ certified band | utf8mb4；5.7 和 8.0 均作为必跑子通道 |
| SQL Server | engine 14.0.0.0 | engine 16.0.0.0 | exact Developer/approved Edition；记录并验证 Collation |
| Oracle | 11.2.0.4 | 19.0.0.0 certified band | exact Edition、AL32UTF8；分别验证旧版和新版分页能力 |
| PostgreSQL | 14.0.0.0 | 17.0.0.0 | UTF8、标准 PostgreSQL 模式 |
| DM8 | exact certified 8.x four-part | exact certified 8.x four-part | 真实 DM8、raw mode 2 -> canonical Oracle、UTF-8 |
| KingbaseES | 9.4.12.0 | 9.4.12.0+ certified band | 真实 KingbaseES、exact PostgreSQL mode、UTF-8 |

目标认证线属于每次 Full 必跑；仍对外承诺的最低兼容线属于 Release Full 必跑。若后续支持其他 DM8/Kingbase 兼容模式，必须新增独立 DialectProfile 和独立真库通道，不能沿用本表结果。

提供一键测试编排：

- MySQL、SQL Server、Oracle、PostgreSQL 使用合法可用的本地容器镜像。
- DM8 和 KingbaseES 使用用户提供的合法本地镜像或测试实例。
- 构建一次，六个数据库通道串行执行；每个通道使用独立 compose project、network、volume 和测试库。
- 每个通道必须读取并记录真实数据库厂商、版本和镜像 digest，防止替代数据库冒充。
- 镜像名、许可证、连接和密码只通过环境变量或本机私有配置注入。
- 每次测试创建隔离数据库或 Schema，完成后自动清理。
- Full/ReleaseFull 先对本次 official package 执行独立 MySQL 5.7 reference
  import，动态 manifest 回读一致后，才在当前唯一数据库 lane 恢复对应的完整
  target artifact（全结构+全数据）；禁止用 minimum fixture 冒充标准空库。测试
  专用管理员凭据/CRUD overlay 通过 neutral AST 在恢复后追加并在 finally 清理，
  不修改 artifact 或 manifest。
- API 启动前必须按动态 manifest 回读全表/全行/schema digest，再验证测试 overlay，
  避免把“数据库兼容问题”和“测试租户没有初始化”混在一起。
- 测试日志不得打印连接串、密码、Token 或完整参数值。

当前本机 Docker 服务未运行，六库本地服务可直接执行数量为 0/6。实施后 Full 测试开始前需要启动 Docker，并确保六库合法镜像或实例可用。

## 14. 本地前后端与截图验收

用户指定的页面入口为：

http://localhost:1988/?OsClient=iTdos#/login?redirect=/

验收流程对每个数据库独立执行，并以 certification 计划的冻结合同为唯一
细节来源：

1. 编译 Microi.Server，停止旧进程，启动
   `Microi.Server/Microi.net.Api`，只接受固定后端 origin
   `https://127.0.0.1:7266`。证书必须由预检明确验证/信任该 loopback 主机；
   不允许退回 `https://localhost:7266` 或忽略 TLS 错误。
2. 在 Microi.Client 以
   `npm run dev -- --host localhost --port 1988 --strictPort` 启动，只接受
   固定前端 origin `http://localhost:1988` 和用户入口 URL；禁止
   `0.0.0.0`、远程 ApiBaseDev、hostname 重写或隐式端口漂移。
3. 启动前强制读取无默认值的 `MICROI_CERT_ACCOUNT`、
   `MICROI_CERT_PASSWORD` 与 exact `MICROI_OSCLIENT=iTdos`；缺失/错误直接
   exit 26。凭据、Token、连接串不得进入源码、URL、日志、附件或证据。
4. 使用 exact Playwright 1.59.1 bundled Chromium，固定 1440x900、
   zh-CN、Asia/Shanghai、deviceScaleFactor 1、reduced motion 和 SHA 验证字体。
5. 真实执行 login、workbench、list、add、edit、detail、delete、logout，
   每个语义状态等待对应 `Code == 1` 网络响应并保存恰好一张同名 PNG；登录
   响应必须成功且存在非空 Token，但证据只保留脱敏布尔结论。
6. 网络门禁只允许上述两个 exact origins 和审查过的本地资源；任何
   requestfailed、未批准重定向/4xx/5xx、空/非法 JSON、意外 Code、pageerror、
   console error、Vue recursive update 或敏感值泄露均失败。
7. credential-bearing 测试强制关闭 trace、video 和 HAR。失败证据只允许
   masked screenshot、像素 diff 与结构化脱敏日志；不得以调试便利为由录制
   账号、密码或 Token。
8. 普通测试必须先读取 tracked
   `Microi.Client/tests/e2e/multidb/snapshots/manifest.json` 和恰好八张 approved
   baseline；缺任一项 exit 27，绝不自动创建/更新。首次建立与以后更新只经
   certification 计划冻结的一次性授权/审批命令。
9. 所有本次运行 evidence 只写
   `./.tmp/microi-multidb/<run-id>`；tracked baseline 只在上述 Client 路径。
   自动断言完成后才可人工查看图像，人工查看不参与 Full 通过判定。

账号密码、Token、连接串在任何允许的结构化报告中统一显示为 redacted。

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
- 编译计划缓存键使用 AST fingerprint、DialectProfile、Schema token 和
  storage/value-contract fingerprint，不包含参数值。
- Bulk 自动按数据库参数上限分片。
- 不为追求统一而禁用数据库原生 Bulk、RETURNING 或 OUTPUT；这些能力由统一语义映射到最优实现。
- 所有性能优化必须通过六库语义契约，不能产生数据库特例泄漏。

## 17. 风险和控制

### 风险 1：AST 重构范围大

控制：旧字符串轨道在基线后冻结，只用于 Compare 和回退，不新增数据库能力；所有新实现只写 AST。模块切到 Ast 后立即删除对应旧轨道，避免两套实现同时演进。

### 风险 2：历史标识符大小写

控制：IdentifierPolicy 加真实旧库回归，不直接全量加引号。

Oracle/DM8 Oracle mode 使用 Dos.ORM 内部 `NonEmptyEnvelopeV1`：NULL 保持
DB NULL，每个非 NULL 文本统一增加一个 U+E000 前缀，读取严格移除一个
前缀；`DOSORM_STORAGE_CONTRACT` 冻结逐列合同和独立 physical-support
digest。参数、结果、DDL/default、索引/FK、LIKE、排序、字符串函数、Bulk、
Upsert、Returning 和 seed 两条恢复路径都由 Dos.ORM 同一合同处理；缺失/
损坏合同在业务命令前失败，未标记物理值在首次托管读取时零逻辑值暴露、
零后续命令并失败。逻辑 schema/typed-row digest
仍与 MySQL reference 一致，内部 support table 单独验收。空库导入采用
`PendingImport -> schema-only DDL -> fresh SchemaToken/column catalog -> Active
-> first data DML`，失败的 pending 状态阻断普通业务且只允许同一已验证资源
在重新授权后恢复。非空历史库缺合同不得原地猜测 backfill；必须用独立权威
逻辑制品和已批准的 `ReplaceTargetDatabase` 重建。这里的 Replace 是 Dos.ORM
内部按精确 profile 选择的“逻辑目标重置”，不是无条件建删库：仅当两个数据库
级 capability 均为 true 时才 drop/create database；Oracle/DM8 用已授权管理连接
完整枚举并按依赖删除目标 schema owner 的业务/支持对象，关闭旧连接，重新连接
并再次检测相同 profile/mode，证明业务对象和 support contract 均为空后才写
`PendingImport`。权限、对象目录、重连或空库证明任一失败都在 pending/data DML
前终止。已经折叠的旧空串不能伪称恢复；Oracle/DM8 的真实集成测试必须分别证明
reset -> reconnect -> empty proof -> PendingImport -> Active read -> first DML
的严格顺序，且不得调用其 false 的 Create/DropDatabase capability。

真实恢复的 VendorSql→ManagedPayload 交接还必须由 Dos.ORM 内部
`DatabaseTargetIdentityProbe` 证明仍是同一非空目标。六驱动分别读取权威
server/cluster instance 与当前 catalog/database/schema-principal 身份材料，按
固定字段、长度前缀、精确 live profile 和域 `dosorm-target-instance-v1` 计算
恰好 64 个小写十六进制字符的 SHA-256；原始身份、连接和名称不出 Dos.ORM。连接串、profile、
schema/row digest 不能代替目标身份。`inspect-live` 只输出该不可逆指纹，证据
schema 在 managed reset 前要求它与 vendor 完成态完全一致且目标非空；合法
drop/create 后的 post-managed 指纹允许变化。

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
- latest official seed 先经 MySQL 5.7 reference import 验证动态 manifest；Full 的
  六个 current product target ZIP（生成 MySQL 8 + 五个默认非 MySQL）及 ReleaseFull
  全部 exact-profile target ZIP 的 vendor SQL 与 managed portable payload 均逐库
  恢复全结构/全数据并匹配该 manifest。133/2403/16083 只在 audited SHA fixture
  下断言。
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
