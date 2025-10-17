using System;
using System.Collections.Generic;
using System.Dynamic;

namespace Dos.Common
{
    public static class DynamicHelper
    {
        public static bool GetDynamicBoolValue(dynamic dynamicModel, string fieldName, bool defaultValue = false)
        {
            if (dynamicModel == null) return
                defaultValue;

            try
            {
                // 直接模拟您原始代码的逻辑
                bool isEnable = defaultValue;
                
                try
                {
                    isEnable = (int)dynamicModel[fieldName] == 1;
                    return isEnable;
                }
                catch (Exception)
                {
                    try
                    {
                        isEnable = (string)dynamicModel[fieldName] == "1" || (string)dynamicModel[fieldName] == "True";
                        return isEnable;
                    }
                    catch (Exception)
                    {
                        return defaultValue;
                    }
                }
            }
            catch
            {
                return defaultValue;
            }
        }

        public static string GetDynamicStringValue(dynamic dynamicModel, string fieldName, string defaultValue = "")
        {
            if (dynamicModel == null) 
                return defaultValue;

            try
            {
                return (string)dynamicModel[fieldName] ?? defaultValue;
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}