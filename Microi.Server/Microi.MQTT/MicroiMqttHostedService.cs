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
        private readonly MqttEnableState _enableState;
        private readonly IHostApplicationLifetime _lifetime;

        public MicroiMqttHostedService(IMicroiMQTT mqtt, MqttEnableState enableState, IHostApplicationLifetime lifetime)
        {
            _mqtt = mqtt;
            _enableState = enableState;
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
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var client = OsClient.GetClient(osClient);
                    _enableState.Refresh(client);
                    if (!_enableState.IsEnabled(osClient))
                    {
                        if (_mqtt.IsRunning) await _mqtt.StopServerAsync().ConfigureAwait(false);
                    }
                    else if (!_mqtt.IsRunning)
                    {
                        await _mqtt.StartServerAsync(client).ConfigureAwait(false);
                        if (_mqtt.IsRunning)
                            Console.WriteLine("Microi：【成功】【MQTT】插件启动成功！");
                    }
                    if (_mqtt.IsRunning)
                        await _mqtt.DisconnectDisabledTenantsAsync().ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    _enableState.DisableAll();
                    if (_mqtt.IsRunning) await _mqtt.StopServerAsync().ConfigureAwait(false);
                    MqttStartupDiagnostics.Report(osClient, "HostedRefreshFailed",
                        MqttStartupDiagnostics.Describe(ex, 1883));
                }

                try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken).ConfigureAwait(false); }
                catch (TaskCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            }

            _enableState.DisableAll();
            if (_mqtt.IsRunning) await _mqtt.StopServerAsync().ConfigureAwait(false);
        }
    }
}
