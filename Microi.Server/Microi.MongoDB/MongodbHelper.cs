using Dos.Common;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public  static partial class TMongodbHelper<T> where T : class, new()
    {
        #region +Add 添加一条数据
        /// <summary>
        /// 添加一条数据
        /// </summary>
        /// <param name="t">添加的实体</param>
        /// <param name="host">mongodb连接信息</param>
        /// <returns></returns>
        public static DosResult Insert(MongodbHost host, T t)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                client.InsertOne(t);
                return new DosResult(1);
            }
            catch(Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        #endregion

        #region +AddAsync 异步添加一条数据
        /// <summary>
        /// 异步添加一条数据
        /// </summary>
        /// <param name="t">添加的实体</param>
        /// <param name="host">mongodb连接信息</param>
        /// <returns></returns>
        public static async Task<DosResult> InsertAsync(MongodbHost host, T t)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                await client.InsertOneAsync(t);
                return new DosResult(1);
            }
            catch(Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        #endregion

        #region +InsertMany 批量插入
        /// <summary>
        /// 批量插入
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="t">实体集合</param>
        /// <returns></returns>
        public static int InsertMany(MongodbHost host, List<T> t)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                client.InsertMany(t);
                return 1;
            }
            catch (Exception ex)
            {
                        
                
                return 0;
            }
        }
        #endregion

        #region +InsertManyAsync 异步批量插入
        /// <summary>
        /// 异步批量插入
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="t">实体集合</param>
        /// <returns></returns>
        public static async Task<int> InsertManyAsync(MongodbHost host, List<T> t)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                await client.InsertManyAsync(t);
                return 1;
            }
            catch
            {
                return 0;
            }
        }
        #endregion

        #region +Update 修改一条数据
        /// <summary>
        /// 修改一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="t">添加的实体</param>
        /// <param name="id">主键,_id</param>
        /// <returns></returns>
        public static DosResult Update(MongodbHost host, T t, string id)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //修改条件
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                //要修改的字段
                var list = new List<UpdateDefinition<T>>();
                if(t is IDictionary<string, object> expandoDict){
                    foreach (var kvp in expandoDict)
                    {
                        if (kvp.Key.ToLower() == "_id") continue; // 不能修改主键
                        list.Add(Builders<T>.Update.Set(kvp.Key, kvp.Value));
                    }
                }else{
                    foreach (var item in t.GetType().GetProperties())
                    {
                        if (item.Name.ToLower() == "_id") continue;//不能修改主键
                        list.Add(Builders<T>.Update.Set(item.Name, item.GetValue(t)));
                    }
                }
                
                var updatefilter = Builders<T>.Update.Combine(list);
                var updateResult = client.UpdateOne(filter, updatefilter);
                return new DosResult(updateResult.ModifiedCount > 0 ? 1 : 0);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        #endregion

        #region +UpdateAsync 异步修改一条数据
        /// <summary>
        /// 异步修改一条数据
        /// </summary>
        /// <returns></returns>
        public static async Task<DosResult> UpdateAsync(MongodbHost host, T t, string id)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //修改条件
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                //要修改的字段
                var list = new List<UpdateDefinition<T>>();
                foreach (var item in t.GetType().GetProperties())
                {
                    if (item.Name.ToLower() == "id" || item.Name.ToLower() == "_id") continue;
                    list.Add(Builders<T>.Update.Set(item.Name, item.GetValue(t)));
                }
                var updatefilter = Builders<T>.Update.Combine(list);
                var updateResult = await client.UpdateOneAsync(filter, updatefilter);
                return new DosResult(updateResult.ModifiedCount > 0 ? 1 : 0);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }
        #endregion

        #region +UpdateManay 批量修改数据
        /// <summary>
        /// 批量修改数据
        /// </summary>
        /// <param name="dic">要修改的字段</param>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">修改条件</param>
        /// <returns></returns>
        public static UpdateResult UpdateManay(MongodbHost host, Dictionary<string, string> dic, FilterDefinition<T> filter)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                T t = new T();
                //要修改的字段
                var list = new List<UpdateDefinition<T>>();
                foreach (var item in t.GetType().GetProperties())
                {
                    if (!dic.ContainsKey(item.Name)) continue;
                    var value = dic[item.Name];
                    list.Add(Builders<T>.Update.Set(item.Name, value));
                }
                var updatefilter = Builders<T>.Update.Combine(list);
                return client.UpdateMany(filter, updatefilter);
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        #endregion

        #region +UpdateManayAsync 异步批量修改数据
        /// <summary>
        /// 异步批量修改数据
        /// </summary>
        /// <param name="dic">要修改的字段</param>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">修改条件</param>
        /// <returns></returns>
        public static async Task<UpdateResult> UpdateManayAsync(MongodbHost host, Dictionary<string, object> dic, FilterDefinition<T> filter)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                T t = new T();
                //要修改的字段
                var list = new List<UpdateDefinition<T>>();
                foreach (var item in t.GetType().GetProperties())
                {
                    if (!dic.ContainsKey(item.Name)) continue;
                    var value = dic[item.Name];
                    list.Add(Builders<T>.Update.Set(item.Name, value));
                }
                var updatefilter = Builders<T>.Update.Combine(list);
                return await client.UpdateManyAsync(filter, updatefilter);
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        #endregion

        #region Delete 删除一条数据
        /// <summary>
        /// 删除一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="id">objectId</param>
        /// <returns></returns>
        public static DosResult Delete(MongodbHost host, string id)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                var delResult = client.DeleteOne(filter);
                return new DosResult(delResult.DeletedCount > 0 ? 1 : 0);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }

        }
        #endregion

        #region DeleteAsync 异步删除一条数据
        /// <summary>
        /// 异步删除一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="id">objectId</param>
        /// <returns></returns>
        public static async Task<DosResult> DeleteAsync(MongodbHost host, string id)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //修改条件
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                var delResult = await client.DeleteOneAsync(filter);
                return new DosResult(delResult.DeletedCount > 0 ? 1 : 0);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }

        }
        #endregion

        #region DeleteMany 删除多条数据
        /// <summary>
        /// 删除一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">删除的条件</param>
        /// <returns></returns>
        public static DeleteResult DeleteMany(MongodbHost host, FilterDefinition<T> filter)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                return client.DeleteMany(filter);
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }

        }
        #endregion

        #region DeleteManyAsync 异步删除多条数据
        /// <summary>
        /// 异步删除多条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">删除的条件</param>
        /// <returns></returns>
        public static async Task<DeleteResult> DeleteManyAsync(MongodbHost host, FilterDefinition<T> filter)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                return await client.DeleteManyAsync(filter);
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }

        }
        #endregion

        #region Count 根据条件获取总数
        /// <summary>
        /// 根据条件获取总数
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">条件</param>
        /// <returns></returns>
        public static long Count(MongodbHost host, FilterDefinition<T> filter)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //注意坑：在1千多万数据量下，CountDocumentsAsync性能极低（EstimatedDocumentCountAsync不支持搜索条件），CountAsync性能极高，应该是mongodb官方的Bug。
                //Use CountDocumentsAsync or EstimatedDocumentCountAsync instead
                return client.Count(filter);
                //return client.CountDocuments(filter);
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        #endregion

        #region CountAsync 异步根据条件获取总数
        /// <summary>
        /// 异步根据条件获取总数
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">条件</param>
        /// <returns></returns>
        public static async Task<long> CountAsync(MongodbHost host, FilterDefinition<T> filter, string[] field = null)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                if (field == null || field.Length == 0)
                {
                    //注意坑：在1千多万数据量下，CountDocumentsAsync性能极低（EstimatedDocumentCountAsync不支持搜索条件），CountAsync性能极高，应该是mongodb官方的Bug。
                    //Use CountDocumentsAsync or EstimatedDocumentCountAsync instead
                    return await client.CountAsync(filter);
                    //return await client.CountDocumentsAsync(filter);
                }
                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();
                //注意坑：在1千多万数据量下，CountDocumentsAsync性能极低（EstimatedDocumentCountAsync不支持搜索条件），CountAsync性能极高，应该是mongodb官方的Bug。
                //Use CountDocumentsAsync or EstimatedDocumentCountAsync instead
                return await client.Find(filter).Project<T>(projection).CountAsync();
                //return await client.Find(filter).Project<T>(projection).CountDocumentsAsync();
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        /// <summary>
        /// 异步0条件获取总数
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <returns></returns>
        public static async Task<long> CountEstimatedAsync(MongodbHost host)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                return await client.EstimatedDocumentCountAsync();
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        /// <summary>
        /// 0条件获取总数
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <returns></returns>
        public static long CountEstimated(MongodbHost host)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                return client.EstimatedDocumentCount();
            }
            catch (Exception ex)
            {
                        
                
                throw ex;
            }
        }
        #endregion

        #region FindOne 根据id查询一条数据
        /// <summary>
        /// 根据id查询一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="id">objectid</param>
        /// <param name="field">要查询的字段，不写时查询全部</param>
        /// <returns></returns>
        public static DosResult<T> Find(MongodbHost host, string id, string[] field = null)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    var result1 = client.Find(filter).FirstOrDefault<T>();
                    return new DosResult<T>(1, result1);
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();
                var result = client.Find(filter).Project<T>(projection).FirstOrDefault<T>();
                return new DosResult<T>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResult<T>(0, null, ex.Message);
            }
        }
        #endregion

        #region FindOneAsync 异步根据id查询一条数据
        /// <summary>
        /// 异步根据id查询一条数据
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="id">objectid</param>
        /// <returns></returns>
        public static async Task<DosResult<T>> FindAsync(MongodbHost host, string id, string[]? field = null)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                FilterDefinition<T> filter = Builders<T>.Filter.Eq("_id", new ObjectId(id));
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    var result1 = await client.Find(filter).FirstOrDefaultAsync();
                    return new DosResult<T>(1, result1);
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();
                var result = await client.Find(filter).Project<T>(projection).FirstOrDefaultAsync();
                return new DosResult<T>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResult<T>(0, null, ex.Message);
            }
        }
        #endregion

        #region FindList 查询集合
        /// <summary>
        /// 查询集合
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">查询条件(必须的)</param>
        /// <param name="field">要查询的字段,不写时查询全部</param>
        /// <param name="sort">要排序的字段</param>
        /// <returns></returns>
        public static List<T> FindList(MongodbHost host, FilterDefinition<T> filter = null, string[] field = null, SortDefinition<T> sort = null)
        {
            try
            {
                if(filter == null){
                    filter = Builders<T>.Filter.Empty;
                }
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    if (sort == null) {
                        var result1 = client.Find(filter).ToList();
                        // return new DosResultList<T>(1, result1);
                        return result1;
                    }
                    //进行排序
                    var result2 = client.Find(filter).Sort(sort).ToList();
                    // return new DosResultList<T>(1, result2);
                    return result2;
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();
                if (sort == null) {
                    var result3 = client.Find(filter).Project<T>(projection).ToList();
                    // return new DosResultList<T>(1, result3);
                    return result3;
                }
                //排序查询
                var result = client.Find(filter).Sort(sort).Project<T>(projection).ToList();
                // return new DosResultList<T>(1, result);
                return result;
            }
            catch (Exception ex)
            {
                throw ex;
                // return new DosResultList<T>(0, null, ex.Message);
            }
        }
        #endregion

        #region FindListAsync 异步查询集合
        /// <summary>
        /// 异步查询集合
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">查询条件</param>
        /// <param name="field">要查询的字段,不写时查询全部</param>
        /// <param name="sort">要排序的字段</param>
        /// <returns></returns>
        public static async Task<DosResultList<T>> FindListAsync(MongodbHost host, FilterDefinition<T> filter, string[] field = null, SortDefinition<T> sort = null)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    if (sort == null)
                    {
                        var result1 = await client.Find(filter).ToListAsync();
                        return new DosResultList<T>(1, result1);
                    }
                    var result2 = await client.Find(filter).Sort(sort).ToListAsync();
                    return new DosResultList<T>(1, result2);
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();
                if (sort == null)
                {
                    var result3 = await client.Find(filter).Project<T>(projection).ToListAsync();
                    return new DosResultList<T>(1, result3);
                }
                //排序查询
                var result = await client.Find(filter).Sort(sort).Project<T>(projection).ToListAsync();
                return new DosResultList<T>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResultList<T>(0, null, ex.Message);
            }
        }
        #endregion

        #region FindListByPage 分页查询集合
        /// <param name="count">总条数</param>
        /// <summary>
        /// 分页查询集合
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">查询条件</param>
        /// <param name="pageIndex">当前页</param>
        /// <param name="pageSize">页容量</param>
        /// <param name="field">要查询的字段,不写时查询全部</param>
        /// <param name="sort">要排序的字段</param>
        /// <returns></returns>
        public static List<T> FindListByPage(MongodbHost host, FilterDefinition<T> filter, int pageIndex, int pageSize,string[] field = null, SortDefinition<T> sort = null)// out long count, 
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                // count = client.Count(filter);
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    if (sort == null) return client.Find(filter).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToList();
                    //进行排序
                    return client.Find(filter).Sort(sort).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToList();
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();

                //不排序
                if (sort == null) return client.Find(filter).Project<T>(projection).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToList();

                //排序查询
                return client.Find(filter).Sort(sort).Project<T>(projection).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToList();

            }
            catch (Exception ex)
            {
                throw ex;
            }
        }
        #endregion

        #region FindListByPageAsync 异步分页查询集合
        /// <summary>
        /// 异步分页查询集合
        /// </summary>
        /// <param name="host">mongodb连接信息</param>
        /// <param name="filter">查询条件</param>
        /// <param name="pageIndex">当前页</param>
        /// <param name="pageSize">页容量</param>
        /// <param name="field">要查询的字段,不写时查询全部</param>
        /// <param name="sort">要排序的字段</param>
        /// <returns></returns>
        public static async Task<List<T>> FindListByPageAsync(MongodbHost host, FilterDefinition<T> filter, int pageIndex, int pageSize, string[] field = null, SortDefinition<T> sort = null)
        {
            try
            {
                var client = MongodbClient<T>.MongodbInfoClient(host);
                //不指定查询字段
                if (field == null || field.Length == 0)
                {
                    if (sort == null) return await client.Find(filter).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToListAsync();
                    //进行排序
                    return await client.Find(filter).Sort(sort).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToListAsync();
                }

                //制定查询字段
                var fieldList = new List<ProjectionDefinition<T>>();
                for (int i = 0; i < field.Length; i++)
                {
                    fieldList.Add(Builders<T>.Projection.Include(field[i].ToString()));
                }
                var projection = Builders<T>.Projection.Combine(fieldList);
                fieldList?.Clear();

                //不排序
                if (sort == null) return await client.Find(filter).Project<T>(projection).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToListAsync();

                //排序查询
                return await client.Find(filter).Sort(sort).Project<T>(projection).Skip((pageIndex - 1) * pageSize).Limit(pageSize).ToListAsync();

            }
            catch (Exception ex)
            {
                
                throw ex;
            }
        }
        #endregion
    }
}