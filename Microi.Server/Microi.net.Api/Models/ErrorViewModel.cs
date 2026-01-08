using System;
namespace Microi.net.Api
{
	/// <summary>
	/// 
	/// </summary> <summary>
	/// 
	/// </summary>
	public class ErrorViewModel
	{
		/// <summary>
		/// 
		/// </summary> <summary>
		/// 
		/// </summary>
		/// <value></value>
		public string? RequestId { get; set; }
		/// <summary>
		/// 
		/// </summary>
		/// <returns></returns>

		public bool ShowRequestId => !string.IsNullOrEmpty(RequestId);
	}
}

	