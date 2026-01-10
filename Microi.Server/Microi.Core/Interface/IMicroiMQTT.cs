using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MQTTnet;

namespace Microi.net
{
    public interface IMicroiMQTT
    {
        Task StartServerAsync(OsClientSecret osclientModel = null);
        Task StopServerAsync();
        Task PublishAsync(MqttApplicationMessage message);
        bool IsRunning { get; }
        // Dictionary<string, string> ConnectedClients { get; }
    }

}
