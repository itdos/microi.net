using System;
using System.Collections.Generic;
using System.Dynamic;
using Newtonsoft.Json.Linq;

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
                try
                {
                    return (int)dynamicModel[fieldName] == 1;
                }
                catch (Exception ex)
                {
                    try
                    {
                        return (string)dynamicModel[fieldName] == "1" || (string)dynamicModel[fieldName] == "True";
                    }
                    catch (Exception ex2)
                    {
                    }
                    try
                    {
                        var value = JObject.FromObject(dynamicModel)[fieldName]?.ToString();
                        return value == "1" || value == "True";
                    }
                    catch (System.Exception ex3)
                    {

                    }
                    return defaultValue;
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
            catch (System.Exception ex)
            {
                try
                {
                    return JObject.FromObject(dynamicModel)[fieldName]?.ToString() ?? defaultValue;
                }
                catch (System.Exception ex2)
                {

                }
                return defaultValue;
            }
        }
    }
}