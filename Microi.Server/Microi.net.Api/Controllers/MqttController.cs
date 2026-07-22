using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

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
        public async Task<IActionResult> GetStatus()
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            var osClient = currentToken?.OsClient;
            if (string.IsNullOrWhiteSpace(osClient)) return Unauthorized();

            return Ok(new
            {
                IsRunning = _mqttService.IsRunning,
                OsClient = osClient,
                StatusScope = "CurrentNode",
                ConnectedClients = _mqttService.GetConnectedClients(osClient)
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
            var currentToken = await DiyToken.GetCurrentToken(false);
            var osClient = currentToken?.OsClient;
            if (string.IsNullOrWhiteSpace(osClient)) return Unauthorized();

            await _mqttService.PublishAsync(osClient, "M100/command", command);
            return Ok("Command sent");
        }
    }
}
