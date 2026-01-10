using System;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.Extensions.Options;
using Dos.Common;

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
                        ?? ConfigHelper.GetAppSettings("OsClientRedisDataBase") ?? "5";
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
        if (!clientModel.CacheConnectionType.DosIsNullOrWhiteSpace() && clientModel.CacheConnectionType == sentinelType)
        {
            var ipArr = clientModel.SentinelHost.Split(',');
            string hostStr = "";
            foreach (var ip in ipArr)
            {
                hostStr += $"{ip},";
            }
            redisConnectionString = $"{hostStr}serviceName={clientModel.SentinelServiceName},password={clientModel.SentinelPwd}," +
                            $"connectTimeout=5000,connectRetry=3,KeepAlive=180,DefaultDatabase={clientModel.RedisDataBase},allowAdmin=true";
        }
        else
        {
            redisConnectionString = clientModel.RedisHost
                                    + ":" + clientModel.RedisPort
                                    + ",defaultDatabase=" + clientModel.RedisDataBase
                                    + ",password=" + clientModel.RedisPwd
                                    + ",abortConnect=false,ssl=false,connectTimeout=5000"
                                    ;
        }
        return redisConnectionString;
    }
}