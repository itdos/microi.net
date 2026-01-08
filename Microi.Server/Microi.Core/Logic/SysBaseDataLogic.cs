using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
	public partial class SysBaseDataLogic
	{
		public static Dictionary<string, string> CantDeleteId = new Dictionary<string, string> { 
		{
			"GetPa",
			"83442E16-917D-43B1-9C79-7F173C74EDC0"
		} };

		/// <summary>
		/// 通用获取model，根据Key
		/// </summary>
		/// <param name="key"></param>
		/// <returns></returns>
		public static async Task<DosResult<SysBaseData>> GetSysBaseDataModel(string key, string osClient)
		{
			return await new SysBaseDataLogic().GetSysBaseDataModel(new SysBaseDataParam
			{
				Key = key,
				OsClient = osClient
			});
		}

		/// <summary>
		/// 帮助中心列表
		/// </summary>
		public async Task<DosResultList<SysBaseData>> GetPa(SysBaseDataParam param)
		{
			param.ParentId = CantDeleteId["GetPa"];
			return await GetSysBaseData(param);
		}

		/// <summary>
		/// 传入Id
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResult<SysBaseData>> GetSysBaseDataModel(SysBaseDataParam param)
		{
			if (param.Id.DosIsNullOrWhiteSpace() && string.IsNullOrWhiteSpace(param.Key))
			{
				return new DosResult<SysBaseData>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
			SysBaseData model = null;// (!param.Id.DosIsNullOrWhiteSpace() ? (await SysBaseDataCache.GetSysBaseDataModel(param.Id, param.OsClient)) : (await SysBaseDataCache.GetSysBaseDataModel(param.Key, param.OsClient)));
			if (model == null)
			{
				model = (!param.Id.DosIsNullOrWhiteSpace() ? (from d in dbSession.From<SysBaseData>()
					where d.Id == param.Id
					select d).First() : (from d in dbSession.From<SysBaseData>()
					where d.Key == param.Key
					select d).First());
				if (model == null)
				{
					return new DosResult<SysBaseData>(0, null, string.Concat(str2: ((param.Id.DosIsNullOrWhiteSpace()) ? "" : param.ToString()) + param.Key, str0: DiyMessage.GetLang(param.OsClient,  "NoExistData", param._Lang), str1: "【", str3: "】"));
				}
				//SysBaseDataCache.SetSysBaseDataModel(model, param.OsClient);
			}
			return new DosResult<SysBaseData>(1, model);
		}

		/// <summary>
		/// 获取基础数据。
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResultList<SysBaseData>> GetSysBaseDataStep(SysBaseDataParam param)
		{
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
			Where<SysBaseData> where = new Where<SysBaseData>();
			if (!param.Customer.DosIsNullOrWhiteSpace())
			{
				where.And((SysBaseData d) => d.Customer == param.Customer);
			}
			if (param.IsDeleted.HasValue)
			{
				where.And((SysBaseData d) => d.IsDeleted == param.IsDeleted);
			}
			List<SysBaseData> allList = (from d in dbSession.From<SysBaseData>().Where(@where)
				orderby d.Sort
				select d).ToList();
			new List<SysBaseData>();
			
			List<SysBaseData> firstList = (!param.ParentId.DosIsNullOrWhiteSpace() ? allList.Where(delegate(SysBaseData d)
			{
				var parentId = d.ParentId;
				var parentId2 = param.ParentId;
				return parentId == parentId2;
			}).ToList() : (param.ParentKey.DosIsNullOrWhiteSpace() ? allList.Where((SysBaseData d) => d.ParentId == Guid.Empty.ToString() || d.ParentId == DiyCommon.UlidEmpty).ToList() : allList.Where((SysBaseData d) => d.ParentKey == param.ParentKey).ToList()));
			GetAllBaseDataChild(allList, firstList);
			return new DosResultList<SysBaseData>(1, firstList);
		}

		/// <summary>
		/// 递归获取层级
		/// </summary>
		private void GetAllBaseDataChild(List<SysBaseData> allList, List<SysBaseData> list)
		{
			foreach (SysBaseData sysBaseData in list)
			{
				if (allList.Any((SysBaseData d) => d.ParentId == sysBaseData.Id))
				{
					sysBaseData._Child = (from d in allList
						where d.ParentId == sysBaseData.Id
						orderby d.Sort
						select d).ToList();
					GetAllBaseDataChild(allList, sysBaseData._Child);
				}
			}
		}

		/// <summary>
		/// 获取基础数据。必传：ParentId
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResultList<SysBaseData>> GetSysBaseData(SysBaseDataParam param)
		{
			if (param.ParentId.DosIsNullOrWhiteSpace() && param.ParentKey.DosIsNullOrWhiteSpace())
			{
				return new DosResultList<SysBaseData>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).DbRead;
			Where<SysBaseData> where = new Where<SysBaseData>();
			new List<SysBaseData>();
			List<SysBaseData> list = null;
			if (!param.ParentId.DosIsNullOrWhiteSpace())
			{
				//list = await SysBaseDataCache.GetSysBaseDataList(param.ParentId, param.OsClient);
				where.And((SysBaseData d) => d.ParentId == param.ParentId);
			}
			else
			{
				//list = await SysBaseDataCache.GetSysBaseDataList(param.ParentKey, param.OsClient);
				where.And((SysBaseData d) => d.ParentKey == param.ParentKey);
			}
			if (param.IsDeleted.HasValue)
			{
				where.And((SysBaseData d) => d.IsDeleted == param.IsDeleted);
			}
			if (list == null)
			{
				list = (from d in dbSession.From<SysBaseData>().Where(@where)
					orderby d.Sort
					select d).ToList();
				DosResult<SysBaseData> parentModel = await GetSysBaseDataModel(new SysBaseDataParam
				{
					Id = param.ParentId,
					Key = param.ParentKey,
					OsClient = param.OsClient
				});
				if (parentModel.Code == 1)
				{
					if (!parentModel.Data.Key.DosIsNullOrWhiteSpace())
					{
						//SysBaseDataCache.SetSysBaseDataList(list, parentModel.Data.Key, param.OsClient);
					}
					//SysBaseDataCache.SetSysBaseDataList(list, parentModel.Data.Id, param.OsClient);
				}
			}
			return new DosResultList<SysBaseData>(1, list);
		}

		/// <summary>
		/// 修改基础数据。必传：Id。可传：Value、Remark、Sort
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResult> UptSysBaseData(SysBaseDataParam param)
		{
			if (param.Id.DosIsNullOrWhiteSpace())
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			if (param.Id == param.ParentId)
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
			DbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
			SysBaseData model = (await GetSysBaseDataModel(param)).Data;
			if (model.Key != param.Key && !param.Key.Contains("未命名") && !param.Key.Contains("Unnamed") && (from d in dbRead.From<SysBaseData>()
				where d.Key == param.Key
				select d).Count() > 0)
			{
				return new DosResult(0, null, "已存在的Key！");
			}
			model = MapperHelper.MapNotNull(param, model);
			_ = model.ParentId;
			if (model.ParentId != Guid.Empty.ToString() && model.ParentId != DiyCommon.UlidEmpty)
			{
				DosResult<SysBaseData> parentModel = await GetSysBaseDataModel(new SysBaseDataParam
				{
					Id = model.ParentId,
					OsClient = param.OsClient
				});
				if (parentModel.Code == 1)
				{
					model.ParentKey = parentModel.Data.Key;
				}
			}
			dbSession.Update(model, (SysBaseData d) => d.Id == param.Id);
			_ = model.ParentId;
			if (true)
			{
				//SysBaseDataCache.DelSysBaseDataList(model.ParentId, param.OsClient);
				//SysBaseDataCache.DelSysBaseDataList(model.ParentKey, param.OsClient);
			}
			//SysBaseDataCache.DelSysBaseDataModel(model, param.OsClient);
			if (!param.ParentId.DosIsNullOrWhiteSpace() && param.Sort.HasValue)
			{
				List<SysBaseData> allChild = (from d in dbRead.From<SysBaseData>()
					where d.ParentId == param.ParentId && d.Id != model.Id
					orderby d.Sort
					select d).ToList();
				int tIndex = 0;
				foreach (SysBaseData item in allChild)
				{
					if (tIndex != param.Sort)
					{
						item.Sort = tIndex;
					}
					else
					{
						tIndex = (item.Sort = tIndex + 1);
					}
					tIndex++;
				}
				dbSession.Update(allChild);
			}
			return new DosResult(1, model);
		}

		/// <summary>
		/// 新增基础数据。必传Key、Value。可传：Sort、ParentId、Remark
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResult> AddSysBaseData(SysBaseDataParam param)
		{
			if (string.IsNullOrWhiteSpace(param.Key))
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
			DbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
			if (!param.Key.Contains("未命名") && !param.Key.Contains("Unnamed") && (from d in dbRead.From<SysBaseData>()
				where d.Key == param.Key
				select d).Count() > 0)
			{
				return new DosResult(0, null, "已存在的Key！");
			}
			SysBaseData model = MapperHelper.Map<object, SysBaseData>(param);
			model.Id = Ulid.NewUlid().ToString();
			model.ParentId = param.ParentId.DosIsNullOrWhiteSpace() ? DiyCommon.UlidEmpty : param.ParentId;
			model.Sort = param.Sort.GetValueOrDefault();
			model.CreateTime = DateTime.Now;
			model.IsDeleted = 0;
			_ = model.ParentId;
			if (model.ParentId != Guid.Empty.ToString() && model.ParentId != DiyCommon.UlidEmpty)
			{
				DosResult<SysBaseData> parentModel = await GetSysBaseDataModel(new SysBaseDataParam
				{
					Id = model.ParentId,
					OsClient = param.OsClient
				});
				if (parentModel.Code == 1)
				{
					model.ParentKey = parentModel.Data.Key;
				}
			}
			int count = dbSession.Insert(model);
			_ = model.ParentId;
			if (true)
			{
				//SysBaseDataCache.DelSysBaseDataList(model.ParentId, param.OsClient);
				//SysBaseDataCache.DelSysBaseDataList(model.ParentKey, param.OsClient);
			}
			//SysBaseDataCache.SetSysBaseDataModel(model, param.OsClient);
			return new DosResult((count > 0) ? 1 : 0, model, (count > 0) ? "" : DiyMessage.GetLang(param.OsClient,  "Line0", param._Lang));
		}

		/// <summary>
		/// 删除基础数据，必传ID或Key
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		public async Task<DosResult> DelSysBaseData(SysBaseDataParam param)
		{
			if (param.Id.DosIsNullOrWhiteSpace() && string.IsNullOrWhiteSpace(param.IDs))
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
			}
			if (CantDeleteId.ContainsValue(param.Id))
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "CantDelete", param._Lang));
			}
			DbSession dbSession = OsClientExtend.GetClient(param.OsClient).Db;
			DbSession dbRead = OsClientExtend.GetClient(param.OsClient).DbRead;
			if (!string.IsNullOrWhiteSpace(param.IDs))
			{
				List<string> ids = param.IDs.Split(',').ToList();
				List<SysBaseData> list = (from d in dbRead.From<SysBaseData>()
					where d.Id.In(ids)
					select d).ToList();
				foreach (SysBaseData baseData in list)
				{
					baseData.IsDeleted = 1;
					//SysBaseDataCache.DelSysBaseDataModel(baseData, param.OsClient);
				}
				if (list.Any())
				{
					//SysBaseDataCache.DelSysBaseDataList(list.First().ParentId, param.OsClient);
					//SysBaseDataCache.DelSysBaseDataList(list.First().ParentKey, param.OsClient);
				}
				int count2 = dbSession.Update(list);
				return new DosResult(1, count2);
			}
			SysBaseData model = (await GetSysBaseDataModel(param)).Data;
			if ((from d in dbRead.From<SysBaseData>()
				where d.ParentId == model.Id
				select d).First() != null)
			{
				return new DosResult(0, null, DiyMessage.GetLang(param.OsClient,  "ExistChildData", param._Lang));
			}
			if (model.ParentId == Guid.Empty.ToString() || model.ParentId == DiyCommon.UlidEmpty)
			{
				return new DosResult(0, null, "顶级节点暂不允许删除！");
			}
			model.IsDeleted = 1;
			int count = dbSession.Update(model);
			_ = model.ParentId;
			if (true)
			{
				//SysBaseDataCache.DelSysBaseDataList(model.ParentId, param.OsClient);
				//SysBaseDataCache.DelSysBaseDataList(model.ParentKey, param.OsClient);
			}
			//SysBaseDataCache.DelSysBaseDataModel(model, param.OsClient);
			return new DosResult(1, count);
		}

		public async Task<List<SysBaseData>> GetSysUserLevel(SysBaseDataParam param)
		{
			List<SysBaseData> result = (await GetSysBaseData(new SysBaseDataParam
			{
				ParentId = CantDeleteId["UserLevelParentId"]
			})).Data;
			return result.Where((SysBaseData d) => Convert.ToDecimal(d.Value) >= (decimal)param._CurrentSysUser.Level).ToList();
		}

		public async Task<SysBaseData> GetSysBaseDataModelByValue(string value, string osClient, string Lang = "")
		{
			if (value.DosIsNullOrWhiteSpace())
			{
				return new SysBaseData();
			}
			if (Lang.DosIsNullOrWhiteSpace())
			{
				Lang = DiyMessage.Lang;
			}
			SysBaseData model = null;// await SysBaseDataCache.GetSysBaseDataModelByValue(value, osClient);
			DbSession dbSession = OsClientExtend.GetClient(osClient).DbRead;
			if (model == null)
			{
				model = (from d in dbSession.From<SysBaseData>()
					where d.Value == value
					select d).First();
				if (model == null)
				{
					throw new Exception(DiyMessage.GetLang(osClient, "NoExistData", Lang) + "【" + value + "】");
				}
				//SysBaseDataCache.SetSysBaseDataModelByValue(value, model, osClient);
			}
			return model;
		}
	}
}
