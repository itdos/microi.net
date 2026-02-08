using System;
using Newtonsoft.Json.Linq;

namespace Microi.net.Tests
{
    /// <summary>
    /// SystemInfo 单元测试（仅用于验证编译和基本功能）
    /// </summary>
    public class SystemInfoTests
    {
        /// <summary>
        /// 测试获取操作系统信息
        /// </summary>
        public static void TestGetOSInfo()
        {
            try
            {
                var systemInfo = new SystemInfo();
                var result = systemInfo.GetOSInfo();
                
                Console.WriteLine("=== 测试：获取操作系统信息 ===");
                Console.WriteLine(result.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 测试获取 CPU 和内存信息
        /// </summary>
        public static void TestGetCpuMemoryInfo()
        {
            try
            {
                var systemInfo = new SystemInfo();
                var result = systemInfo.GetCpuMemoryInfo();
                
                Console.WriteLine("=== 测试：获取 CPU 和内存信息 ===");
                Console.WriteLine(result.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 测试获取磁盘信息
        /// </summary>
        public static void TestGetDiskInfo()
        {
            try
            {
                var systemInfo = new SystemInfo();
                var result = systemInfo.GetDiskInfo();
                
                Console.WriteLine("=== 测试：获取磁盘信息 ===");
                Console.WriteLine(result.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 测试获取网络流量
        /// </summary>
        public static void TestGetNetworkTraffic()
        {
            try
            {
                var systemInfo = new SystemInfo();
                
                Console.WriteLine("=== 测试：获取网络流量（第一次调用） ===");
                var result1 = systemInfo.GetNetworkTraffic();
                Console.WriteLine(result1.ToString(Newtonsoft.Json.Formatting.Indented));
                
                Console.WriteLine("\n等待 2 秒...\n");
                System.Threading.Thread.Sleep(2000);
                
                Console.WriteLine("=== 测试：获取网络流量（第二次调用，应包含速率） ===");
                var result2 = systemInfo.GetNetworkTraffic();
                Console.WriteLine(result2.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result2["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result2["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 测试获取磁盘 IO
        /// </summary>
        public static void TestGetDiskIO()
        {
            try
            {
                var systemInfo = new SystemInfo();
                
                Console.WriteLine("=== 测试：获取磁盘 IO（第一次调用） ===");
                var result1 = systemInfo.GetDiskIO();
                Console.WriteLine(result1.ToString(Newtonsoft.Json.Formatting.Indented));
                
                Console.WriteLine("\n等待 2 秒...\n");
                System.Threading.Thread.Sleep(2000);
                
                Console.WriteLine("=== 测试：获取磁盘 IO（第二次调用，应包含速率） ===");
                var result2 = systemInfo.GetDiskIO();
                Console.WriteLine(result2.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result2["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result2["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 测试获取所有信息
        /// </summary>
        public static void TestGetAllSystemInfo()
        {
            try
            {
                var systemInfo = new SystemInfo();
                var result = systemInfo.GetAllSystemInfo();
                
                Console.WriteLine("=== 测试：获取所有系统信息 ===");
                Console.WriteLine(result.ToString(Newtonsoft.Json.Formatting.Indented));
                
                if (result["Success"]?.Value<bool>() == true)
                {
                    Console.WriteLine("✓ 测试通过");
                }
                else
                {
                    Console.WriteLine("✗ 测试失败: " + result["Error"]);
                }
                Console.WriteLine();
            }
            catch (Exception ex)
            {
                Console.WriteLine("✗ 测试异常: " + ex.Message);
                Console.WriteLine(ex.StackTrace);
            }
        }

        /// <summary>
        /// 运行所有测试
        /// </summary>
        public static void RunAllTests()
        {
            Console.WriteLine("========================================");
            Console.WriteLine("SystemInfo 功能测试");
            Console.WriteLine("========================================\n");

            TestGetOSInfo();
            TestGetCpuMemoryInfo();
            TestGetDiskInfo();
            TestGetNetworkTraffic();
            TestGetDiskIO();
            TestGetAllSystemInfo();

            Console.WriteLine("========================================");
            Console.WriteLine("所有测试完成");
            Console.WriteLine("========================================");
        }
    }
}

/* 
 * 在 Program.cs 或其他入口点调用测试：
 * 
 * Microi.net.Tests.SystemInfoTests.RunAllTests();
 * 
 * 或单独测试某个功能：
 * 
 * Microi.net.Tests.SystemInfoTests.TestGetOSInfo();
 */
