using System;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Options;
using Dos.Common;
using Microi.net;

namespace Microi.net.Api;

public static class RedisConnBuilder
{
    public static string BuildDefaultRedisConn()
    {
        var redisHost = Environment.GetEnvironmentVariable("OsClientRedisHost", EnvironmentVariableTarget.Process)
                        ?? ConfigHelper.GetAppSettings("OsClientRedisHost") ?? "";
        var redisPort = Environment.GetEnvironmentVariable("OsClientRedisPort", EnvironmentVariableTarget.Process)
                        ?? ConfigHelper.GetAppSettings("OsClientRedisPort") ?? "";
        var redisPwd = Environment.GetEnvironmentVariable("OsClientRedisPwd", EnvironmentVariableTarget.Process)
                        ?? ConfigHelper.GetAppSettings("OsClientRedisPwd") ?? "";
        var redisDataBase = Environment.GetEnvironmentVariable("OsClientRedisDataBase", EnvironmentVariableTarget.Process)
                        ?? ConfigHelper.GetAppSettings("OsClientRedisDataBase") ?? OsClientDefault.OsClientRedisDataBase;
        
        if (string.IsNullOrWhiteSpace(redisHost) 
            || string.IsNullOrWhiteSpace(redisPort)
            || string.IsNullOrWhiteSpace(redisPwd))
        {
            throw new Exception("Microi：【Error异常】未检测到 [OsClientRedisHost] 的相关配置！");
        }
        
        return redisHost + ":" + redisPort
                        + ",defaultDatabase=" + redisDataBase
                        + ",password=" + redisPwd
                        + ",abortConnect=false,ssl=false,connectTimeout=5000"
                        ;
    }
    public static string Build(OsClientSecret clientModel)
    {
        string redisConnectionString = "";
        // 哨兵连接类型
        string sentinelType = "2";
        
        // 【防御】确保 RedisDataBase 有有效值，默认为 OsClientDefault.OsClientRedisDataBase
        string redisDataBase = clientModel.OsClientModel["RedisDataBase"].Val<string>();
        if (string.IsNullOrWhiteSpace(redisDataBase))
        {
            redisDataBase = OsClientDefault.OsClientRedisDataBase;
        }
        
        // 【防御】确保 RedisHost 和 RedisPort 有有效值
        string redisHost = clientModel.OsClientModel["RedisHost"].Val<string>();
        string redisPort = clientModel.OsClientModel["RedisPort"].Val<string>();
        if (
            string.IsNullOrWhiteSpace(redisHost)
            || string.IsNullOrWhiteSpace(redisPort)
            || string.IsNullOrWhiteSpace(clientModel.OsClientModel["RedisPwd"].Val<string>())
        )
        {
            throw new Exception("Microi：【Error异常】未检测到 [OsClientRedisHost] 的相关配置！");
        }
        
        if (!clientModel.OsClientModel["CacheConnectionType"].Val<string>().DosIsNullOrWhiteSpace() 
            && clientModel.OsClientModel["CacheConnectionType"].Val<string>() == sentinelType)
        {
            var ipArr = clientModel.OsClientModel["SentinelHost"].Val<string>().DosSplit(',');
            string hostStr = "";
            foreach (var ip in ipArr)
            {
                hostStr += $"{ip},";
            }
            redisConnectionString = $"{hostStr}serviceName={clientModel.OsClientModel["SentinelServiceName"].Val<string>()},password={clientModel.OsClientModel["SentinelPwd"].Val<string>()}," +
                            $"connectTimeout=5000,connectRetry=3,KeepAlive=180,DefaultDatabase={redisDataBase},allowAdmin=true";
        }
        else
        {
            redisConnectionString = redisHost
                                    + ":" + redisPort
                                    + ",defaultDatabase=" + redisDataBase
                                    + ",password=" + clientModel.OsClientModel["RedisPwd"].Val<string>()
                                    + ",abortConnect=false,ssl=false,connectTimeout=5000"
                                    ;
        }
        return redisConnectionString;
    }
}