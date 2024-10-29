using System;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace Microi.net.Api
{
    public class SlugifyParameterTransformer : IOutboundParameterTransformer
	{
		/// <summary>
		/// 
		/// </summary>
		/// <param name="value"></param>
		/// <returns></returns>
		public string TransformOutbound(object value)
		{
			return value == null ? null : Regex.Replace(value.ToString(), "([a-z])([A-Z])", "$1_$2").ToLower();
		}
	}
}



