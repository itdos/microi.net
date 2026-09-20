using Xunit;

// 正式 Full 门禁会与浏览器、双 API 及多数据库夹具同机运行。串行测试集合保留
// 全部用例，同时避免 Windows 提交额度紧张时 Roslyn/MessagePack 并行初始化伪失败。
[assembly: CollectionBehavior(DisableTestParallelization = true, MaxParallelThreads = 1)]
