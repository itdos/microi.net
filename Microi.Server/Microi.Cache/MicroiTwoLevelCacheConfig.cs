#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：MicroiTwoLevelCacheConfig.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：
* 创建日期：2026-01-10
* 文件描述：二级缓存配置类 - 集中管理所有配置项
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>
    /// 二级缓存配置类 - 所有配置集中在此处管理
    /// </summary>
    public static class MicroiTwoLevelCacheConfig
    {
        #region 基础配置

        /// <summary>
        /// 是否启用二级缓存
        /// true: 启用本地内存 + Redis 二级缓存
        /// false: 仅使用 Redis 缓存
        /// </summary>
        public static bool Enabled { get; set; } = true;

        /// <summary>
        /// 本地缓存统一过期时间
        /// 建议：30-60分钟
        /// 作用：即使 Pub/Sub 失败，最多N分钟后自动恢复一致性
        /// </summary>
        public static TimeSpan LocalCacheTTL { get; set; } = TimeSpan.FromMinutes(30);

        /// <summary>
        /// 本地缓存最大条目数
        /// 建议：10000-50000（根据服务器内存调整）
        /// 作用：防止内存无限增长
        /// </summary>
        public static int MaxLocalCacheSize { get; set; } = 10000;

        /// <summary>
        /// 后台清理过期缓存的间隔时间
        /// 建议：1-5分钟
        /// </summary>
        public static TimeSpan CleanupInterval { get; set; } = TimeSpan.FromMinutes(1);

        #endregion

        #region 白名单配置（启用二级缓存的Key模式）

        /// <summary>
        /// 启用二级缓存的Key模式（白名单）
        /// 匹配规则：Key中包含（Contains）这些模式的会使用本地缓存
        /// 注意：会被黑名单过滤
        /// 
        /// 实际Key格式示例：Microi:osClient123:FormData:sys_apiengine:custom_api_path
        /// 配置模式示例：:FormData:sys_apiengine:
        /// 匹配方式：key.Contains(pattern) - 模式可以在Key的任意位置
        /// 
        /// 【重要】只缓存真正需要高性能的数据：
        /// 1. 接口引擎配置（:FormData:sys_apiengine:）- 频繁查询
        /// 2. 系统配置（:SysConfig）- 全局共享
        /// 3. 菜单/表配置（:FormData:sys_menu: / :FormData:diy_table:）- 可选
        /// </summary>
        public static HashSet<string> EnabledPatterns { get; set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            // ===== 动态接口引擎路由（DynamicApiEngine 查询的缓存）=====
            // 匹配：Microi:xxx:FormData:sys_apiengine:yyy
            // 主要包含：sys_menu、diy_table、sys_apiengine
            ":FormData:",
            ":SysConfig",                 // 系统配置
            ":LoginTokenSysUser:"       // 用户登录信息
        };

        /// <summary>
        /// 可选：添加启用模式
        /// 示例：AddEnabledPattern(":FormData:my_custom_table:")
        /// </summary>
        public static void AddEnabledPattern(string pattern)
        {
            EnabledPatterns.Add(pattern);
        }

        /// <summary>
        /// 可选：批量添加启用模式
        /// </summary>
        public static void AddEnabledPatterns(params string[] patterns)
        {
            foreach (var pattern in patterns)
            {
                EnabledPatterns.Add(pattern);
            }
        }

        /// <summary>
        /// 可选：移除启用模式
        /// </summary>
        public static void RemoveEnabledPattern(string pattern)
        {
            EnabledPatterns.Remove(pattern);
        }

        #endregion

        #region 黑名单配置（禁用二级缓存的Key模式）

        /// <summary>
        /// 禁用二级缓存的Key模式（黑名单）
        /// 优先级：黑名单 > 白名单
        /// 包含这些模式的Key不使用本地缓存，直接走Redis
        /// 
        /// 适用场景：
        /// 1. 频繁变化的数据（用户信息、在线状态）
        /// 2. 安全敏感数据（Token、Session）
        /// 3. 分布式协调数据（Lock、Counter）
        /// 4. 临时数据（Temp、Cache）
        /// 
        /// 注意：FormData 相关的表单数据默认启用二级缓存，如需禁用特定表单请添加到黑名单
        /// </summary>
        public static List<string> DisabledPatterns { get; set; } = new List<string>
        {
            // ===== 用户相关（频繁变化 - 如需启用请移除对应行） =====
            ":FormData:sys_online:",         // 在线状态（保留黑名单，频繁变化）
            
            // ===== 安全敏感数据 =====
            ":Token:",                       // 所有Token
            ":Session:",                     // 会话信息
            ":Auth:",                        // 认证信息
            
            // ===== 分布式协调 =====
            ":Lock:",                        // 分布式锁
            ":Counter:",                     // 计数器
            ":Sequence:",                    // 序列号
            
            // ===== 临时/统计数据 =====
            ":Temp:",                        // 临时数据
            ":Cache:Stats:",                 // 统计数据
            ":Log:",                         // 日志数据
            ":Queue:",                       // 队列数据
            
            // ===== 实时数据 =====
            ":RealTime:",                    // 实时数据
            ":LiveData:",                    // 直播数据
            ":Monitor:",                     // 监控数据
        };

        /// <summary>
        /// 添加禁用模式
        /// </summary>
        public static void AddDisabledPattern(string pattern)
        {
            if (!DisabledPatterns.Contains(pattern))
            {
                DisabledPatterns.Add(pattern);
            }
        }

        /// <summary>
        /// 批量添加禁用模式
        /// </summary>
        public static void AddDisabledPatterns(params string[] patterns)
        {
            foreach (var pattern in patterns)
            {
                AddDisabledPattern(pattern);
            }
        }

        /// <summary>
        /// 移除禁用模式（如果某个数据不再频繁变化，可以移除黑名单）
        /// </summary>
        public static void RemoveDisabledPattern(string pattern)
        {
            DisabledPatterns.Remove(pattern);
        }

        #endregion

        #region 推荐配置场景

        /// <summary>
        /// 配置场景1：高性能模式（推荐）
        /// 适用：读多写少的系统，追求极致性能
        /// </summary>
        public static void UseHighPerformanceMode()
        {
            Enabled = true;
            LocalCacheTTL = TimeSpan.FromMinutes(60);      // 60分钟
            MaxLocalCacheSize = 20000;                      // 2万条
            CleanupInterval = TimeSpan.FromMinutes(2);
        }

        /// <summary>
        /// 配置场景2：平衡模式（默认）
        /// 适用：大多数场景
        /// </summary>
        public static void UseBalancedMode()
        {
            Enabled = true;
            LocalCacheTTL = TimeSpan.FromMinutes(30);      // 30分钟
            MaxLocalCacheSize = 10000;                      // 1万条
            CleanupInterval = TimeSpan.FromMinutes(1);
        }

        /// <summary>
        /// 配置场景3：保守模式
        /// 适用：数据一致性要求较高的系统
        /// </summary>
        public static void UseConservativeMode()
        {
            Enabled = true;
            LocalCacheTTL = TimeSpan.FromMinutes(10);      // 10分钟
            MaxLocalCacheSize = 5000;                       // 5千条
            CleanupInterval = TimeSpan.FromSeconds(30);
        }

        /// <summary>
        /// 配置场景4：仅Redis模式
        /// 适用：数据实时性要求极高，或者单节点部署
        /// </summary>
        public static void UseRedisOnlyMode()
        {
            Enabled = false;  // 禁用本地缓存
        }

        #endregion

        #region Redis Pub/Sub 配置

        /// <summary>
        /// Redis Pub/Sub 频道名称 - 单Key失效通知
        /// </summary>
        public static string InvalidateChannel { get; set; } = "microi:cache:invalidate";

        /// <summary>
        /// Redis Pub/Sub 频道名称 - 模式失效通知
        /// </summary>
        public static string InvalidatePatternChannel { get; set; } = "microi:cache:invalidate:pattern";

        #endregion

        #region 调试配置

        /// <summary>
        /// 是否启用详细日志
        /// true: 输出每次缓存操作的日志
        /// false: 仅输出关键日志
        /// </summary>
        public static bool VerboseLogging { get; set; } = false;

        /// <summary>
        /// 是否在控制台输出缓存统计
        /// true: 定期输出缓存命中率等统计信息
        /// false: 不输出（通过API查看）
        /// </summary>
        public static bool LogStatistics { get; set; } = false;

        /// <summary>
        /// 统计信息输出间隔（仅在 LogStatistics = true 时生效）
        /// </summary>
        public static TimeSpan StatisticsInterval { get; set; } = TimeSpan.FromMinutes(5);

        #endregion

        #region 性能调优配置

        /// <summary>
        /// 本地缓存清理策略
        /// LRU: 最近最少使用
        /// LFU: 最不经常使用
        /// FIFO: 先进先出
        /// TTL: 基于过期时间（默认）
        /// </summary>
        public enum EvictionPolicy
        {
            TTL,    // 基于过期时间（默认）
            LRU,    // 最近最少使用
            LFU,    // 最不经常使用
            FIFO    // 先进先出
        }

        /// <summary>
        /// 当前使用的清理策略（暂未实现，预留）
        /// </summary>
        public static EvictionPolicy CurrentEvictionPolicy { get; set; } = EvictionPolicy.TTL;

        /// <summary>
        /// 缓存容量达到上限时，一次清理的比例
        /// 默认：10%（即清理 MaxLocalCacheSize * 10% 的缓存）
        /// </summary>
        public static double EvictionPercentage { get; set; } = 0.10;

        #endregion

        #region 实用方法

        /// <summary>
        /// 重置为默认配置
        /// </summary>
        public static void ResetToDefault()
        {
            UseBalancedMode();
            VerboseLogging = false;
            LogStatistics = false;
        }

        /// <summary>
        /// 获取配置摘要（用于日志输出）
        /// </summary>
        public static string GetConfigSummary()
        {
            return $"二级缓存配置：" +
                   $"启用={Enabled}, " +
                   $"TTL={LocalCacheTTL.TotalMinutes}分钟, " +
                   $"容量={MaxLocalCacheSize}, " +
                   $"白名单={EnabledPatterns.Count}个, " +
                   $"黑名单={DisabledPatterns.Count}个";
        }

        #endregion
    }
}
