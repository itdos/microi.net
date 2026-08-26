using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.Hosting;

namespace Microi.net
{
    /// <summary>
    /// MQTT Broker 的宿主生命周期归 MQTT 插件所有。等待 ApplicationStarted 后
    /// 再读取最新租户配置，避免 Program.cs 承载插件业务与 fire-and-forget 逻辑。
    /// </summary>
    internal sealed class MicroiMqttHostedService : BackgroundService
    {
        private readonly IMicroiMQTT _mqtt;
        private readonly IHostApplicationLifetime _lifetime;

        public MicroiMqttHostedService(IMicroiMQTT mqtt, IHostApplicationLifetime lifetime)
        {
            _mqtt = mqtt;
            _lifetime = lifetime;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            using var registration = _lifetime.ApplicationStarted.Register(() => started.TrySetResult(true));
            using var cancellation = stoppingToken.Register(() => started.TrySetCanceled());
            try
            {
                await started.Task.ConfigureAwait(false);
            }
            catch (TaskCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }

            var osClient = OsClient.GetConfigOsClient();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = OsClientDefault.OsClient;
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.OsClientModel?["MqttEnable"].Val<int>() != 1) return;

                await _mqtt.StartServerAsync(client).ConfigureAwait(false);
                if (_mqtt.IsRunning)
                    Console.WriteLine("Microi：【成功】【MQTT】插件启动成功！");
                else
                    Console.WriteLine("Microi：【Error异常】【MQTT】插件未能启动，请查看系统日志中的 MQTT 诊断信息。");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】MQTT延迟启动失败：{ex.Message}");
            }
        }
    }
}
