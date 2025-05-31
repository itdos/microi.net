using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Config 的摘要说明
    /// </summary>
    public class ConfigHandler
    {
        public JObject Process()
        {
            return UeditorConfig.Items;
        }
    }
}