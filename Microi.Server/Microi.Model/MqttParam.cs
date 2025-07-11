using System;

namespace Microi.net
{ 
    public class MqttParam
    {
        public string ClientId { get; set; }
        public object Payload { get; set; }
        public string Topic { get; set; }
    }
}

