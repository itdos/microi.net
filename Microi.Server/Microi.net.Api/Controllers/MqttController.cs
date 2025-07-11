using Microsoft.AspNetCore.Mvc;
using MQTTnet;

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class MqttController : Controller
    {
        private readonly IMicroiMQTT _mqttService;

        public MqttController(IMicroiMQTT mqttService)
        {
            _mqttService = mqttService;
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                IsRunning = _mqttService.IsRunning,
                // ConnectedClients = _mqttService.ConnectedClients
            });
        }

        // [HttpPost("restart")]
        // public async Task<IActionResult> RestartServer()
        // {
        //     await _mqttService.StopServerAsync();
        //     await Task.Delay(1000);
        //     await _mqttService.StartServerAsync();
        //     return Ok("MQTT server restarted");
        // }
        [HttpPost("send-command")]
        public async Task<IActionResult> SendCommand([FromBody] string command)
        {
            var message = new MqttApplicationMessageBuilder()
                .WithTopic("M100/command")
                .WithPayload(command)
                .Build();
            
            await _mqttService.PublishAsync(message);
            return Ok("Command sent");
        }
    }
}
