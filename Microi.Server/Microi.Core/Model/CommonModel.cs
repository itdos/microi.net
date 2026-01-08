//using Microsoft.AspNetCore.Http;
//using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class V8EngineHttpResponse
    {
        //public Dictionary<string, string> Headers { get; set; }
        //public IList<Parameter> Headers { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<V8EngineHttpResponseHeaders> Headers { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Content { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public byte[] RawBytes { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string ErrorMessage { get; set; }
    }
    public class V8EngineHttpResponseHeaders
    {
        public string Name{ get; set; }
        public object Value{ get; set; }
        public string Type{ get; set; }
        public string DataFormat{ get; set; }
        public string ContentType{ get; set; }
    }
    public class GetFieldsDataResult
    {
        public string FieldId { get; set; }
        public string FormEngineFieldKey { get; set; }
        public string TableId { get; set; }
        public string FormEngineKey { get; set; }
        public object Result { get; set; }
    }
    public class UniqueFieldModel
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Name { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Label { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Value { get; set; }
    }
    public class CommonModel
    {
        public static List<DiyField> DefaultExportFields = new List<DiyField>() {
            new DiyField(){Name = "UserName", Label = "创建人" },
            new DiyField(){Name = "CreateTime", Label = "创建时间" },
            new DiyField(){Name = "UpdateTime", Label = "修改时间" }
        };

        public static Dos.ORM.Field[] _diyTableFields = new DiyTable().GetFields();
    }
    public partial class SysConfig
    {
        public string ServerVersion { get; set; }
        public string ClientVersion { get; set; }
    }
    public class ApiEngineFileModel
    {
        public string FileName { get; set; }
        public string ContentType { get; set; }
        public string FileByte { get; set; }
    }
    public enum InvokeType
    {
        Client, //0
        Server  //1
    }
    public partial class IdName
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }
    public partial class SearchFieldIdsModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Label { get; set; }
        public string AsName { get; set; }
        public string TableId { get; set; }
        public string TableName { get; set; }
        public string TableDescription { get; set; }
        public string DisplayType { get; set; }
        public bool DisplaySelect { get; set; }
    }

    public partial class SysRoleLimits
    {
        public string Id { get; set; }
        public string Permission { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    //public struct KeyValue<TKey, TValue>
    //{
    //    /// <summary>
    //    /// 
    //    /// </summary>
    //    /// <param name="key"></param>
    //    /// <param name="value"></param>
    //    public KeyValue(TKey key, TValue value) {
    //        this.Key = key;
    //        this.Value = value;
    //    }
    //    public TKey Key
    //    { get; set; }

    //    public TValue Value
    //    { get; set; }
    //}
    public partial class DiyUploadParam : BaseParam
    {
        /// <summary>
        /// 返回类型：默认Url，可选Byte、Stream
        /// </summary>
        public string ReturnFileType { get; set; }
        public string FieldId { get; set; }
        public string FormDataId { get; set; }
        public string FormEngineKey { get; set; }
        public string HDFS { get; set; }
        public string FilePathName { get; set; }
        public List<string> FilePathNames { get; set; }
        // public string OsClient { get; set; }
        public string FileId { get; set; }
        public string Path { get; set; }
        /// <summary>
        /// 压缩后最大体积。单位：kb
        /// </summary>
        public int? CompressMaxSize { get; set; }
        /// <summary>
        /// 压缩后最大宽度，单位：px
        /// </summary>
        public int? CompressMaxWidth { get; set; }
        public bool? Limit { get; set; }
        public bool? Multiple { get; set; }
        /// <summary>
        /// 是否是预览图，如果是预览图则压缩
        /// </summary>
        public bool? Preview { get; set; }
        /// <summary>
        /// 注意：HttpContext不能做为参数 ，否则会报错：Could not create an instance of type 'Microsoft.AspNetCore.Http.HttpContext'. Model bound complex types must not be abstract or value types and must have a parameterless constructor. Alternatively, set the 'HttpContext' property to a non-null value in the 'Microi.net.Model.UploadParam' constructor.
        /// </summary>
        //public HttpContext HttpContext { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, Stream> Files { get; set; }
        public Dictionary<string, byte[]> FilesByte { get; set; }
        public Dictionary<string, string> FilesByteBase64 { get; set; }
    }
    public partial class KeyValue
    {
        public KeyValue()
        {
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="key"></param>
        /// <param name="value"></param>
        public KeyValue(string key, string value)
        {
            this.Key = key;
            this.Value = value;
        }
        public string Key { get; set; }

        public string Value { get; set; }
    }
    //public class KeyValue
    //{
    //    /// <summary>
    //    /// 内部键值对象
    //    /// </summary>
    //    private KeyValuePair<object, object> obj = new KeyValuePair<object, object>();

    //    /// <summary>
    //    /// 返回数据
    //    /// </summary>
    //    public Object Data { get; set; }

    //    /// <summary>
    //    /// 键
    //    /// </summary>
    //    public Object Key
    //    {
    //        get { return obj.Key; }
    //        set { obj = new KeyValuePair<object, object>(value, obj.Value); }
    //    }

    //    /// <summary>
    //    /// 值
    //    /// </summary>
    //    public Object Value
    //    {
    //        get { return obj.Value; }
    //        set { obj = new KeyValuePair<object, object>(obj.Key, value); }
    //    }

    //    /// <summary>
    //    /// 设置键值
    //    /// </summary>
    //    /// <param name="key"></param>
    //    /// <param name="value"></param>
    //    public void SetKeyValue(Object key, Object value) { obj = new KeyValuePair<object, object>(key, value); }
    //    public void SetKeyValue(Object key, Object value, Object data)
    //    {
    //        obj = new KeyValuePair<object, object>(key, value);
    //        this.Data = data;
    //    }

    //    /// <summary>
    //    /// 初始化键值对象
    //    /// </summary>
    //    /// <param name="key"></param>
    //    /// <param name="value"></param>
    //    public KeyValue(object key, object value) { SetKeyValue(key, value); }
    //    public KeyValue(object key, object value, object data) { SetKeyValue(key, value, data); }

    //}
    public class KeyValue<T1, T2>
    {
        /// <summary>
        /// 内部键值对象
        /// </summary>
        private KeyValuePair<T1, T2> obj = new KeyValuePair<T1, T2>();

        /// <summary>
        /// 返回数据
        /// </summary>
        public object Data { get; set; }

        /// <summary>
        /// 键
        /// </summary>
        public T1 Key
        {
            get { return obj.Key; }
            set { obj = new KeyValuePair<T1, T2>(value, obj.Value); }
        }

        /// <summary>
        /// 值
        /// </summary>
        public T2 Value
        {
            get { return obj.Value; }
            set { obj = new KeyValuePair<T1, T2>(obj.Key, value); }
        }

        /// <summary>
        /// 设置键值
        /// </summary>
        /// <param name="key"></param>
        /// <param name="value"></param>
        public void SetKeyValue(T1 key, T2 value) { obj = new KeyValuePair<T1, T2>(key, value); }
        public void SetKeyValue(T1 key, T2 value, Object data)
        {
            obj = new KeyValuePair<T1, T2>(key, value);
            this.Data = data;
        }

        /// <summary>
        /// 初始化键值对象
        /// </summary>
        /// <param name="key"></param>
        /// <param name="value"></param>
        public KeyValue(T1 key, T2 value) { SetKeyValue(key, value); }
        public KeyValue(T1 key, T2 value, object data) { SetKeyValue(key, value, data); }

    }

    public partial class SysMenuDefaultOrderBy
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public int Sort { get; set; }
    }
    public partial class DiyFieldConfig
    {
        public bool KeysAddVisible { get; set; }
        public string KeysAddVModel { get; set; }
        public string Sql { get; set; }
        public string SelectLabel { get; set; }
        public int? AutoNumberLength { get; set; }
        public string AutoNumberFixed { get; set; }
        public List<string> AutoNumberFields { get; set; }
        public string TableChildTableId { get; set; }
        public string TableChildSysMenuId { get; set; }
        public string TableChildFkFieldName { get; set; }
        public string TableChildCallbackField { get; set; }

        public AutoNumber AutoNumber { get; set; }
        public DiyFieldConfigUnique Unique { get; set; }
        public DiyFieldConfigCascader Cascader { get; set; }
        public DiyFieldConfigSelectTree SelectTree { get; set; }
        public DiyFieldConfigTableChild TableChild { get; set; }
    }
    public partial class DiyFieldConfigTableChild
    {
        public string PrimaryTableFieldName { get; set; }
    }
    public partial class DiyFieldConfigCascader
    {
        public bool Lazy { get; set; }
        public bool Filterable { get; set; }
        public bool Multiple { get; set; }
        public string Value { get; set; }
        public string Label { get; set; }
        public string Children { get; set; }
        public string ParentField { get; set; }
        public string ParentFields { get; set; }
        public string Disabled { get; set; }
        public string Leaf { get; set; }
    }
    public partial class DiyFieldConfigSelectTree
    {
        public bool Lazy { get; set; }
        public bool Filterable { get; set; }
        public bool Multiple { get; set; }
        public string Value { get; set; }
        public string Label { get; set; }
        public string Children { get; set; }
        public string ParentField { get; set; }
        public string ParentFields { get; set; }
        public string Disabled { get; set; }
        public string Leaf { get; set; }
    }

    public partial class AutoNumber
    {
        public string DataRule { get; set; }
        public string CreateRule { get; set; }
    }
    public partial class DiyFieldConfigUnique
    {
        public string Type { get; set; }
    }
    public partial class IdType
    {
        public string Id { get; set; }
        public string Type { get; set; }
    }
    /// <summary>
    /// 同一个用户，可能在多个PC、多个手机端进行登陆，每个不同的客户端均生成不同的token值，但使用相同的 T CurrentUser。
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public partial class CurrentToken<T>
    {
        /// <summary>
        /// 用户实体信息
        /// </summary>
        public T CurrentUser { get; set; }
        /// <summary>
        /// 登陆IP地址。同一个用户，可能在多个PC、多个手机端进行登陆，每个不同的客户端均生成不同的token值，因此此字段理论上作废。
        /// </summary>
        // public string IP { get; set; }
        /// <summary>
        /// 设备Id。同一个用户，可能在多个PC、多个手机端进行登陆，每个不同的客户端均生成不同的token值，因此此字段理论上作废。
        /// </summary>
        // public string Did { get; set; }
        //public string Did { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime UpdateTime { get; set; }
        /// <summary>
        /// 同一个用户，可能在多个PC、多个手机端进行登陆，每个不同的客户端均生成不同的token值，因此此字段理论上作废。
        /// </summary>
        public string Token { get; set; }
        /// <summary>
        /// 指用户在所有客户端登陆时存储的token，如PC、Empty
        /// </summary>
        public List<TokensModel> Tokens { get; set; }
        public string OsClient { get; set; }
    }
    public class TokensModel
    {
        /// <summary>
        /// Token里面包含了UserId、OsClient、CreateTime（string）、ClientType、Did
        /// </summary>
        public string Token { get; set; }
        /// <summary>
        /// PC、Empty
        /// </summary>
        public string ClientType { get; set; }
        /// <summary>
        /// 设备Id（可能的值：Empty、Guid值）
        /// </summary>
        public string Did { get; set; }
        public string IP { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime UpdateTime { get; set; }
    }
}
