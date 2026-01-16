/**
 * Microi V8引擎 API 类型定义
 * 
 * 此文件为 V8 引擎注入的全局对象提供 TypeScript/JavaScript 智能提示
 * 
 * @author Anderson <973702@qq.com>
 * @version 1.0.0
 */

/**
 * 查询条件项
 */
interface DiyWhere {
    /** 字段名 */
    Name: string;
    /** 字段值 */
    Value: any;
    /** 比较类型: =, <>, >, <, >=, <=, Like, In, NotIn, IsNull, IsNotNull */
    Type: '=' | '<>' | '>' | '<' | '>=' | '<=' | 'Like' | 'In' | 'NotIn' | 'IsNull' | 'IsNotNull';
    /** 逻辑连接: AND 或 OR */
    AndOr?: 'AND' | 'OR';
    /** 分组开始 */
    GroupStart?: boolean;
    /** 分组结束 */
    GroupEnd?: boolean;
}

/**
 * 通用返回结果
 */
interface DosResult<T = any> {
    /** 状态码: 1=成功, 0=失败 */
    Code: number;
    /** 返回数据 */
    Data: T;
    /** 消息 */
    Msg: string;
    /** 总数（分页时使用） */
    Total?: number;
    /** 附加数据 */
    DataAppend?: any;
}

/**
 * 表单引擎查询参数
 */
interface FormEngineGetParams {
    /** 表单引擎Key或表名 */
    FormEngineKey: string;
    /** 主键ID */
    Id?: string;
    /** 查询条件 */
    _Where?: DiyWhere[];
    /** 选择的字段列表 */
    _SelectFields?: string[];
    /** 排序字段 */
    _OrderBy?: string;
    /** 排序方式: ASC 或 DESC */
    _OrderByType?: 'ASC' | 'DESC';
    /** 页码（从1开始） */
    PageIndex?: number;
    /** 每页数量 */
    PageSize?: number;
    /** OsClient（可选，默认使用当前上下文） */
    OsClient?: string;
}

/**
 * 表单引擎新增参数
 */
interface FormEngineAddParams {
    /** 表单引擎Key或表名 */
    FormEngineKey: string;
    /** 表单数据 */
    [key: string]: any;
}

/**
 * 表单引擎更新参数
 */
interface FormEngineUptParams {
    /** 表单引擎Key或表名 */
    FormEngineKey: string;
    /** 主键ID */
    Id: string;
    /** 更新的字段数据 */
    [key: string]: any;
}

/**
 * V8 全局对象 - 表单引擎
 */
interface V8FormEngine {
    /**
     * 获取单条表单数据
     * @param params 查询参数
     * @returns 查询结果
     * @example
     * var result = V8.FormEngine.GetFormData({
     *   FormEngineKey: 'sys_user',
     *   Id: 'xxx-xxx-xxx'
     * });
     */
    GetFormData(params: FormEngineGetParams): DosResult<any>;

    /**
     * 获取表格数据列表
     * @param params 查询参数
     * @returns 查询结果（包含分页信息）
     * @example
     * var result = V8.FormEngine.GetTableData({
     *   FormEngineKey: 'sys_user',
     *   PageIndex: 1,
     *   PageSize: 20,
     *   _Where: [{ Name: 'IsDeleted', Value: '0', Type: '=' }]
     * });
     */
    GetTableData(params: FormEngineGetParams): DosResult<any[]>;

    /**
     * 获取树形数据
     * @param params 查询参数
     * @returns 树形结构数据
     */
    GetTableDataTree(params: FormEngineGetParams): DosResult<any[]>;

    /**
     * 新增表单数据
     * @param params 新增参数
     * @returns 操作结果
     * @example
     * var result = V8.FormEngine.AddFormData({
     *   FormEngineKey: 'sys_user',
     *   Name: '张三',
     *   Age: 25
     * });
     */
    AddFormData(params: FormEngineAddParams): DosResult<any>;

    /**
     * 更新表单数据
     * @param formEngineKey 表单引擎Key
     * @param params 更新参数（必须包含Id）
     * @returns 操作结果
     * @example
     * V8.FormEngine.UptFormData('sys_user', {
     *   Id: 'xxx-xxx-xxx',
     *   Name: '李四'
     * });
     */
    UptFormData(formEngineKey: string, params: FormEngineUptParams): DosResult<any>;

    /**
     * 删除表单数据（软删除）
     * @param formEngineKey 表单引擎Key
     * @param id 主键ID
     * @returns 操作结果
     */
    DelFormData(formEngineKey: string, id: string): DosResult<any>;

    /**
     * 新增表（创建数据表）
     * @param params 表配置
     */
    AddTable(params: any): DosResult<any>;

    /**
     * 新增字段
     * @param params 字段配置
     */
    AddField(params: any): DosResult<any>;
}

/**
 * V8 全局对象 - 缓存操作
 */
interface V8Cache {
    /**
     * 获取缓存
     * @param key 缓存键
     * @returns 缓存值（字符串）
     * @example
     * var value = V8.Cache.Get('myKey');
     * if (value) {
     *   var obj = JSON.parse(value);
     * }
     */
    Get(key: string): string | null;

    /**
     * 设置缓存
     * @param key 缓存键
     * @param value 缓存值
     * @param expireSeconds 过期时间（秒），可选
     * @example
     * V8.Cache.Set('myKey', JSON.stringify({ a: 1 }));
     * V8.Cache.Set('myKey2', 'value', 3600); // 1小时后过期
     */
    Set(key: string, value: any, expireSeconds?: number): void;

    /**
     * 删除缓存
     * @param key 缓存键
     */
    Remove(key: string): void;

    /**
     * 删除缓存（别名）
     */
    Del(key: string): void;

    /**
     * 检查缓存是否存在
     * @param key 缓存键
     */
    Exists(key: string): boolean;
}

/**
 * V8 全局对象 - HTTP 请求
 */
interface V8Http {
    /**
     * 发送 GET 请求
     * @param url 请求地址
     * @param headers 请求头（可选）
     * @returns 响应结果
     * @example
     * var result = V8.Http.Get('https://api.example.com/data');
     */
    Get(url: string, headers?: Record<string, string>): any;

    /**
     * 发送 POST 请求
     * @param url 请求地址
     * @param data 请求数据
     * @param headers 请求头（可选）
     * @returns 响应结果
     * @example
     * var result = V8.Http.Post('https://api.example.com/data', {
     *   name: 'test'
     * }, { 'Content-Type': 'application/json' });
     */
    Post(url: string, data: any, headers?: Record<string, string>): any;

    /**
     * 发送 PUT 请求
     */
    Put(url: string, data: any, headers?: Record<string, string>): any;

    /**
     * 发送 DELETE 请求
     */
    Delete(url: string, headers?: Record<string, string>): any;
}

/**
 * V8 全局对象 - 数据库操作
 */
interface V8Db {
    /**
     * 执行 SQL 查询
     * @param sql SQL 语句
     * @param params 参数（可选）
     * @returns 查询结果数组
     * @example
     * var users = V8.Db.Query('SELECT * FROM sys_user WHERE Name = @Name', { Name: '张三' });
     */
    Query(sql: string, params?: Record<string, any>): any[];

    /**
     * 执行 SQL 语句（增删改）
     * @param sql SQL 语句
     * @param params 参数（可选）
     * @returns 影响的行数
     */
    Execute(sql: string, params?: Record<string, any>): number;

    /**
     * 执行 SQL 查询，返回第一行第一列
     * @param sql SQL 语句
     * @param params 参数（可选）
     */
    Scalar(sql: string, params?: Record<string, any>): any;
}

/**
 * V8 全局对象 - 接口引擎
 */
interface V8ApiEngine {
    /**
     * 调用其他接口引擎
     * @param apiEngineKey 接口引擎Key
     * @param params 参数
     * @returns 接口返回结果
     * @example
     * var result = V8.ApiEngine.Run('get-user-list', { PageIndex: 1 });
     */
    Run(apiEngineKey: string, params?: any): any;
}

/**
 * V8 全局对象 - 常用方法
 */
interface V8Method {
    /**
     * 获取当前 Token 信息
     * @param token Token 字符串（可选）
     * @param osClient OsClient（可选）
     */
    GetCurrentToken(token?: string, osClient?: string): any;

    /**
     * 刷新登录用户信息
     * @param userId 用户ID
     * @param osClient OsClient
     */
    RefreshLoginUser(userId: string, osClient?: string): DosResult<any>;

    /**
     * 生成 GUID
     */
    NewGuid(): string;

    /**
     * 生成雪花ID
     */
    SnowflakeId(): string;
}

/**
 * V8 全局对象 - 常用操作
 */
interface V8Action {
    /**
     * 获取服务器当前时间
     * @returns 当前时间字符串
     */
    GetDateTimeNow(): string;

    /**
     * 获取服务器当前时间戳
     */
    GetTimestamp(): number;

    /**
     * 休眠指定毫秒数
     * @param ms 毫秒数
     */
    Sleep(ms: number): void;
}

/**
 * V8 全局对象 - 加密解密
 */
interface V8EncryptHelper {
    /**
     * MD5 加密
     * @param text 原文
     * @returns MD5 哈希值
     */
    MD5Encrypt(text: string): string;

    /**
     * SHA256 加密
     */
    SHA256Encrypt(text: string): string;

    /**
     * AES 加密
     */
    AESEncrypt(text: string, key: string): string;

    /**
     * AES 解密
     */
    AESDecrypt(cipherText: string, key: string): string;
}

/**
 * V8 全局对象 - Base64 编解码
 */
interface V8Base64 {
    /**
     * Base64 编码
     */
    Encode(text: string): string;

    /**
     * Base64 解码
     */
    Decode(base64: string): string;
}

/**
 * V8 全局对象 - MongoDB 操作
 */
interface V8MongoDB {
    /**
     * 查询文档
     * @param collection 集合名
     * @param filter 查询条件
     */
    Find(collection: string, filter: any): any[];

    /**
     * 插入文档
     */
    Insert(collection: string, document: any): any;

    /**
     * 更新文档
     */
    Update(collection: string, filter: any, update: any): any;

    /**
     * 删除文档
     */
    Delete(collection: string, filter: any): any;
}

/**
 * V8 全局对象 - 消息队列
 */
interface V8MQ {
    /**
     * 发送消息到队列
     * @param queueName 队列名
     * @param message 消息内容
     */
    Send(queueName: string, message: any): void;
}

/**
 * V8 全局对象 - 工作流引擎
 */
interface V8WFEngine {
    /**
     * 启动工作流
     */
    Start(params: any): DosResult<any>;

    /**
     * 提交工作流节点
     */
    Submit(params: any): DosResult<any>;

    /**
     * 获取待办列表
     */
    GetTodoList(params: any): DosResult<any[]>;
}

/**
 * V8 全局对象 - 短信服务
 */
interface V8Sms {
    /**
     * 发送短信
     * @param phone 手机号
     * @param templateCode 模板编码
     * @param params 模板参数
     */
    Send(phone: string, templateCode: string, params: any): DosResult<any>;
}

/**
 * V8 全局对象 - 翻译引擎
 */
interface V8TranslateEngine {
    /**
     * 翻译文本
     * @param text 原文
     * @param from 源语言
     * @param to 目标语言
     */
    Translate(text: string, from?: string, to?: string): string;
}

/**
 * V8 全局对象 - 文件存储
 */
interface V8HDFS {
    /**
     * 上传文件
     */
    Upload(params: any): DosResult<any>;

    /**
     * 下载文件
     */
    Download(fileId: string): any;

    /**
     * 删除文件
     */
    Delete(fileId: string): DosResult<any>;
}

/**
 * V8 全局对象 - Office 文档
 */
interface V8Office {
    /**
     * 导出 Excel
     */
    ExportExcel(params: any): any;

    /**
     * 导入 Excel
     */
    ImportExcel(params: any): DosResult<any[]>;

    /**
     * 导出 Word
     */
    ExportWord(params: any): any;

    /**
     * 导出 PDF
     */
    ExportPdf(params: any): any;
}

/**
 * Microi V8引擎全局对象
 * 
 * @description 在接口引擎 JavaScript 代码中可直接使用的全局对象
 * @example
 * // 获取用户列表
 * var result = V8.FormEngine.GetTableData({
 *   FormEngineKey: 'sys_user',
 *   PageIndex: 1,
 *   PageSize: 20
 * });
 * 
 * // 设置返回结果
 * V8.Result = {
 *   Code: 1,
 *   Data: result.Data,
 *   Msg: '获取成功'
 * };
 */
declare const V8: {
    /** 当前 OsClient */
    OsClient: string;

    /** 当前用户ID */
    UserId: string;

    /** 当前用户名 */
    UserName: string;

    /** 当前用户信息 */
    CurrentUser: {
        Id: string;
        Name: string;
        RoleIds: string;
        DeptId: string;
        DeptName: string;
        [key: string]: any;
    };

    /** 系统配置 */
    SysConfig: Record<string, any>;

    /** 请求参数 */
    Param: Record<string, any>;

    /** 请求头 */
    Header: Record<string, string>;

    /** 表单数据（表单引擎提交时） */
    Form: Record<string, any>;

    /** 修改前的表单数据 */
    OldForm: Record<string, any>;

    /** 表格数据（批量操作时） */
    TableData: any[];

    /** 当前行索引（表格遍历时） */
    RowIndex: number;

    /** 返回结果（设置此值作为接口返回） */
    Result: any;

    /** 表单引擎 */
    FormEngine: V8FormEngine;

    /** 缓存操作 */
    Cache: V8Cache;

    /** HTTP 请求 */
    Http: V8Http;

    /** 数据库操作 */
    Db: V8Db;

    /** 只读数据库 */
    DbRead: V8Db;

    /** 数据库事务 */
    DbTrans: {
        /** 提交事务 */
        Commit(): void;
        /** 回滚事务 */
        Rollback(): void;
    };

    /** 接口引擎 */
    ApiEngine: V8ApiEngine;

    /** 常用方法 */
    Method: V8Method;

    /** 常用操作 */
    Action: V8Action;

    /** 加密工具 */
    EncryptHelper: V8EncryptHelper;

    /** Base64 编解码 */
    Base64: V8Base64;

    /** MongoDB */
    MongoDb: V8MongoDB;

    /** 消息队列 */
    MQ: V8MQ;

    /** 工作流引擎 */
    WFEngine: V8WFEngine;

    /** 短信服务 */
    Sms: V8Sms;

    /** 翻译引擎 */
    TranslateEngine: V8TranslateEngine;

    /** 文件存储 */
    HDFS: V8HDFS;

    /** Office 文档 */
    Office: V8Office;

    /** IP 工具 */
    IPHelper: {
        /** 获取客户端IP */
        GetClientIP(): string;
    };
};

/**
 * 控制台对象（用于日志输出）
 */
declare const console: {
    log(message: any): void;
    error(message: any): void;
    warn(message: any): void;
    info(message: any): void;
};

/**
 * 定时器
 */
declare function setTimeout(callback: () => void, delay: number): number;
declare function clearTimeout(timerId: number): void;
