using System.Globalization;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{

/// <summary>保留未知未读数；存储超时不能向客户端广播一个伪造的零。</summary>
public static class ChatUnreadProjection
{
    public static bool TryGetCount(JToken? value, out long count)
    {
        count = 0;
        if (value?.Type != JTokenType.Integer) return false;
        return long.TryParse(value.ToString(Formatting.None), NumberStyles.None,
            CultureInfo.InvariantCulture, out count) && count >= 0;
    }
}
}
