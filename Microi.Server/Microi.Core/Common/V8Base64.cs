using System;
using System.Text;

namespace Microi.net
{
    public class V8Base64
    {
        public static string StringToBase64(string str)
        {
            try
            {
                string base64String = Convert.ToBase64String(Encoding.UTF8.GetBytes(str));
                return base64String;
            }
            catch (FormatException)
            {
                return str;
            }
        }
        public static string Base64ToString(string str)
        {
            try
            {
                if (DiyCommon.IsBase64String(str))
                {
                    return Encoding.UTF8.GetString(Convert.FromBase64String(str));
                }
                return str;
            }
            catch (FormatException)
            {
                return str;
            }
        }
    }
}

