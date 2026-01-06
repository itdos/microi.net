using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 表单引擎接口
    /// </summary>
    public interface IFormEngine
    {
        DosResult UptTableData(dynamic dynamicParam, DbTrans _trans = null);
        DosResult DelTableData(dynamic dynamicParam, DbTrans _trans = null);
        DosResult AddTableData(dynamic dynamicParam, DbTrans _trans = null);
         Task<DosResultList<dynamic>> GetTableTreeAsync(dynamic dynamicParam, DbTrans _trans = null);
        Task<DosResult<dynamic>> RunSqlGetModel(DiyTableRowParam param);
        Task<DosResultList<dynamic>> RunSqlGetList(DiyTableRowParam param);
        Task<DosResultList<GetFieldsDataResult>> GetFieldsData(DiyTableRowParam param);
        Task<DosResultList<dynamic>> GetDiyFieldSqlData(DiyTableRowParam param);
        Task<DosResultList<DiyTable>> GetDiyTable(DiyTableParam param);
        Task<DosResult<DiyTable>> GetDiyTableModel(DiyTableParam param, DbTrans _trans = null);
        Task<DosResult> UptDiyTable(DiyTableParam param);
        Task<DosResult> DelDiyTable(DiyTableParam param);
        Task<DosResult<DiyTable>> AddDiyTable(DiyTableParam param, DbTrans _trans = null);
        Task<DosResultList<string>> GetNotDiyTable(DiyTableParam param);
        Task<DosResultList<DiyDocument>> GetDiyDocumentTree(DiyDocumentParam param);
        #region 配置相关方法
        
        /// <summary>
        /// 获取系统配置（带缓存）
        /// </summary>
        Task<DosResult<dynamic>> GetSysConfig(string osClient, string _Lang = "cn");
        
        /// <summary>
        /// 获取自定义表配置（带缓存）
        /// </summary>
        Task<DosResult<dynamic>> GetDiyTable(string idOrName, string osClient, string _Lang = "cn");
        
        /// <summary>
        /// 获取系统菜单配置（带缓存）
        /// </summary>
        Task<DosResult<dynamic>> GetSysMenu(string idOrKey, string osClient, string _Lang = "cn");
        
        #endregion

        #region 获取单条数据
        
        /// <summary>
        /// 获取一条数据
        /// </summary>
        Task<DosResult<dynamic>> GetFormDataAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取一条数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult<dynamic>> GetFormDataAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取一条数据（泛型版本）
        /// </summary>
        Task<DosResult<T>> GetFormDataAsync<T>(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取一条数据（指定表单引擎Key，泛型版本）
        /// </summary>
        Task<DosResult<T>> GetFormDataAsync<T>(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取一条数据（同步版本）
        /// </summary>
        DosResult<dynamic> GetFormData(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取一条数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult<dynamic> GetFormData(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 修改数据
        
        /// <summary>
        /// 修改一条数据
        /// </summary>
        Task<DosResult> UptFormDataAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 修改一条数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult> UptFormDataAsync(string formEngineKey, dynamic formData, DbTrans _trans = null);
        
        /// <summary>
        /// 修改一条数据（同步版本）
        /// </summary>
        DosResult UptFormData(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 修改一条数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult UptFormData(string formEngineKey, dynamic formData, DbTrans _trans = null);
        
        /// <summary>
        /// 批量修改数据
        /// </summary>
        Task<DosResult> UptFormDataBatchAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 批量修改数据（同步版本）
        /// </summary>
        DosResult UptFormDataBatch(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件修改数据
        /// </summary>
        Task<DosResult> UptFormDataByWhereAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件修改数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult> UptFormDataByWhereAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件修改数据（同步版本）
        /// </summary>
        DosResult UptFormDataByWhere(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件修改数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult UptFormDataByWhere(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 新增数据
        
        /// <summary>
        /// 新增一条数据
        /// </summary>
        Task<DosResult> AddFormDataAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 新增一条数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult> AddFormDataAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 新增一条数据（同步版本）
        /// </summary>
        DosResult AddFormData(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 新增一条数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult AddFormData(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 批量新增数据
        /// </summary>
        Task<DosResult> AddFormDataBatchAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 批量新增数据（同步版本）
        /// </summary>
        DosResult AddFormDataBatch(dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 字段管理
        
        /// <summary>
        /// 新增一个字段
        /// </summary>
        Task<DosResult<dynamic>> AddFieldAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 新增一个字段（同步版本）
        /// </summary>
        DosResult<dynamic> AddField(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 修改一个字段
        /// </summary>
        Task<DosResult> UptFieldAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 修改一个字段（同步版本）
        /// </summary>
        DosResult UptField(dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 表管理
        Task<DosResult> AddDiyField(DiyFieldParam param, DbTrans _trans = null);
        Task<DosResultList<dynamic>> GetExceptionFieldList(DiyFieldParam param);
        Task<DosResult> AddDbField(DiyFieldParam param);
        Task<DosResult> DelDiyField(DiyFieldParam param);
        Task<DosResult> UptDiyField(DiyFieldParam param, DbTrans _trans = null);
        Task<DosResult> UptDiyFieldList(DiyFieldParam param);
        Task<DosResult<DiyField>> GetDiyFieldModel(DiyFieldParam param);
        Task<DosResultList<DiyField>> GetDiyField(DiyFieldParam param);
        Task<DosResult> RecoverDiyField(DiyFieldParam param);
        Task<DosResultList<DiyField>> GetDiyFieldByDiyTables(DiyFieldParam param);
        
        /// <summary>
        /// 新增表
        /// </summary>
        Task<DosResult<dynamic>> AddTableAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 新增表（同步版本）
        /// </summary>
        DosResult<dynamic> AddTable(dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 删除数据
        
        /// <summary>
        /// 删除一条数据
        /// </summary>
        Task<DosResult> DelFormDataAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 删除一条数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult> DelFormDataAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 删除一条数据（同步版本）
        /// </summary>
        DosResult DelFormData(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 删除一条数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult DelFormData(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 批量删除数据
        /// </summary>
        Task<DosResult> DelFormDataBatchAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 批量删除数据（同步版本）
        /// </summary>
        DosResult DelFormDataBatch(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件删除数据
        /// </summary>
        Task<DosResult> DelFormDataByWhereAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件删除数据（指定表单引擎Key）
        /// </summary>
        Task<DosResult> DelFormDataByWhereAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件删除数据（同步版本）
        /// </summary>
        DosResult DelFormDataByWhere(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 根据条件删除数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResult DelFormDataByWhere(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 获取数据列表
        
        /// <summary>
        /// 获取数据列表
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据列表（指定表单引擎Key）
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据列表（泛型版本）
        /// </summary>
        Task<DosResultList<T>> GetTableDataAsync<T>(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据列表（指定表单引擎Key，泛型版本）
        /// </summary>
        Task<DosResultList<T>> GetTableDataAsync<T>(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据列表（同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableData(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据列表（指定表单引擎Key，同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableData(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据条数
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataCountAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据条数（指定表单引擎Key）
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataCountAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据条数（同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableDataCount(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取数据条数（指定表单引擎Key，同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableDataCount(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 树形数据
        
        /// <summary>
        /// 获取树形数据（异步版本）
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataTreeAsync(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取树形数据（指定表单引擎Key，异步版本）
        /// </summary>
        Task<DosResultList<dynamic>> GetTableDataTreeAsync(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取树形数据（同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableDataTree(dynamic dynamicParam, DbTrans _trans = null);
        
        /// <summary>
        /// 获取树形数据（指定表单引擎Key，同步版本）
        /// </summary>
        DosResultList<dynamic> GetTableDataTree(string formEngineKey, dynamic dynamicParam, DbTrans _trans = null);
        
        #endregion

        #region 字段数据
        
        /// <summary>
        /// 获取字段数据
        /// </summary>
        Task<DosResultList<dynamic>> GetFieldDataAsync(dynamic dynamicParam);
        
        /// <summary>
        /// 获取字段数据（同步版本）
        /// </summary>
        DosResultList<dynamic> GetFieldData(dynamic dynamicParam);
        
        #endregion

        #region 表操作
        
        /// <summary>
        /// 将非diy表加载为diy表
        /// </summary>
        Task<DosResult> LoadNotDiyTableAsync(dynamic dynamicParam);
        
        /// <summary>
        /// 将非diy表加载为diy表（同步版本）
        /// </summary>
        DosResult LoadNotDiyTable(dynamic dynamicParam);
        
        #endregion
    }
}