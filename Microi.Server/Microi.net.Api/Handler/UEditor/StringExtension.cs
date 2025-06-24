using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net.Api
{
    public static class StringExtension
    {
        public static bool IsNullOrWhiteSpaceUEditor(this string value)
        {
            if (value == null) return true;

            for (int i = 0; i < value.Length; i++)
            {
                if (!Char.IsWhiteSpace(value[i])) return false;
            }

            return true;
        }
    }
}
