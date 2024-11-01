﻿//------------------------------------------------------------------------------
// <auto-generated>
//     此代码由工具生成。
//     运行时版本:4.0.30319.42000
//     Website: http://ITdos.com/Dos/ORM/Index.html
//     对此文件的更改可能会导致不正确的行为，并且如果
//     重新生成代码，这些更改将会丢失。
// </auto-generated>
//------------------------------------------------------------------------------

using System;
using Dos.ORM;

namespace Microi.net
{
	/// <summary>
	/// 实体类DiyDocument。(属性说明自动提取数据库字段的描述信息)
	/// </summary>
	[Table("diy_document")]
	[Serializable]
	public partial class DiyDocument : Entity
	{
		#region Model
		private string _Id;
		private DateTime _CreateTime;
		private DateTime? _UpdateTime;
		private string _UserId;
		private string _UserName;
		private int _IsDeleted;
		private string _Title;
		private string _Content;
		private int? _Display;
		private string _ParentId;
		private string _ParentIds;
		private int? _Sort;

		/// <summary>
		/// Id
		/// </summary>
		[Field("Id")]
		public string Id
		{
			get { return _Id; }
			set
			{
				this.OnPropertyValueChange("Id");
				this._Id = value;
			}
		}
		/// <summary>
		/// 创建时间
		/// </summary>
		[Field("CreateTime")]
		public DateTime CreateTime
		{
			get { return _CreateTime; }
			set
			{
				this.OnPropertyValueChange("CreateTime");
				this._CreateTime = value;
			}
		}
		/// <summary>
		/// 更新修改
		/// </summary>
		[Field("UpdateTime")]
		public DateTime? UpdateTime
		{
			get { return _UpdateTime; }
			set
			{
				this.OnPropertyValueChange("UpdateTime");
				this._UpdateTime = value;
			}
		}
		/// <summary>
		/// 操作人Id
		/// </summary>
		[Field("UserId")]
		public string UserId
		{
			get { return _UserId; }
			set
			{
				this.OnPropertyValueChange("UserId");
				this._UserId = value;
			}
		}
		/// <summary>
		/// 操作人
		/// </summary>
		[Field("UserName")]
		public string UserName
		{
			get { return _UserName; }
			set
			{
				this.OnPropertyValueChange("UserName");
				this._UserName = value;
			}
		}
		/// <summary>
		/// 是否删除
		/// </summary>
		[Field("IsDeleted")]
		public int IsDeleted
		{
			get { return _IsDeleted; }
			set
			{
				this.OnPropertyValueChange("IsDeleted");
				this._IsDeleted = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("Title")]
		public string Title
		{
			get { return _Title; }
			set
			{
				this.OnPropertyValueChange("Title");
				this._Title = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("Content")]
		public string Content
		{
			get { return _Content; }
			set
			{
				this.OnPropertyValueChange("Content");
				this._Content = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("Display")]
		public int? Display
		{
			get { return _Display; }
			set
			{
				this.OnPropertyValueChange("Display");
				this._Display = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("ParentId")]
		public string ParentId
		{
			get { return _ParentId; }
			set
			{
				this.OnPropertyValueChange("ParentId");
				this._ParentId = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("ParentIds")]
		public string ParentIds
		{
			get { return _ParentIds; }
			set
			{
				this.OnPropertyValueChange("ParentIds");
				this._ParentIds = value;
			}
		}
		/// <summary>
		/// null
		/// </summary>
		[Field("Sort")]
		public int? Sort
		{
			get { return _Sort; }
			set
			{
				this.OnPropertyValueChange("Sort");
				this._Sort = value;
			}
		}
		#endregion

		#region Method
		/// <summary>
		/// 获取实体中的主键列
		/// </summary>
		public override Field[] GetPrimaryKeyFields()
		{
			return new Field[] {
				_.Id,
			};
		}
		/// <summary>
		/// 获取列信息
		/// </summary>
		public override Field[] GetFields()
		{
			return new Field[] {
				_.Id,
				_.CreateTime,
				_.UpdateTime,
				_.UserId,
				_.UserName,
				_.IsDeleted,
				_.Title,
				_.Content,
				_.Display,
				_.ParentId,
				_.ParentIds,
				_.Sort,
			};
		}
		/// <summary>
		/// 获取值信息
		/// </summary>
		public override object[] GetValues()
		{
			return new object[] {
				this._Id,
				this._CreateTime,
				this._UpdateTime,
				this._UserId,
				this._UserName,
				this._IsDeleted,
				this._Title,
				this._Content,
				this._Display,
				this._ParentId,
				this._ParentIds,
				this._Sort,
			};
		}
		/// <summary>
		/// 是否是v1.10.5.6及以上版本实体。
		/// </summary>
		/// <returns></returns>
		public override bool V1_10_5_6_Plus()
		{
			return true;
		}
		#endregion

		#region _Field
		/// <summary>
		/// 字段信息
		/// </summary>
		public class _
		{
			/// <summary>
			/// * 
			/// </summary>
			public readonly static Field All = new Field("*", "diy_document");
			/// <summary>
			/// Id
			/// </summary>
			public readonly static Field Id = new Field("Id", "diy_document", "Id");
			/// <summary>
			/// 创建时间
			/// </summary>
			public readonly static Field CreateTime = new Field("CreateTime", "diy_document", "创建时间");
			/// <summary>
			/// 更新修改
			/// </summary>
			public readonly static Field UpdateTime = new Field("UpdateTime", "diy_document", "更新修改");
			/// <summary>
			/// 操作人Id
			/// </summary>
			public readonly static Field UserId = new Field("UserId", "diy_document", "操作人Id");
			/// <summary>
			/// 操作人
			/// </summary>
			public readonly static Field UserName = new Field("UserName", "diy_document", "操作人");
			/// <summary>
			/// 是否删除
			/// </summary>
			public readonly static Field IsDeleted = new Field("IsDeleted", "diy_document", "是否删除");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field Title = new Field("Title", "diy_document", "null");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field Content = new Field("Content", "diy_document", "null");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field Display = new Field("Display", "diy_document", "null");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field ParentId = new Field("ParentId", "diy_document", "null");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field ParentIds = new Field("ParentIds", "diy_document", "null");
			/// <summary>
			/// null
			/// </summary>
			public readonly static Field Sort = new Field("Sort", "diy_document", "null");
		}
		#endregion
	}
}