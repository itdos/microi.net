/**
 * V8引擎后端 JavaScript API 智能提示定义
 * 用于Monaco编辑器提供代码自动完成功能
 * 
 * 根据官方文档生成:
 * - /Users/Work/Microi.net/microi.doc/docs/doc/v8-engine/v8-server.md
 * - /Users/Work/Microi.net/microi.doc/docs/doc/v8-engine/api-engine.md
 * - /Users/Work/Microi.net/microi.doc/docs/doc/v8-engine/form-engine.md
 * - /Users/Work/Microi.net/microi.doc/docs/doc/v8-engine/where.md
 * 
 * @version 2.0.0
 * @date 2026-01-21
 */

// V8引擎后端完整API定义
export const V8ServerApiDefinitions = {
    V8: {
        label: 'V8',
        kind: 'Module',
        documentation: 'V8引擎全局对象(后端) - 服务器端V8引擎支持ES6语法',
        insertText: 'V8',
        properties: {
            // ========== 系统信息 ==========
            CurrentUser: {
                label: 'CurrentUser',
                kind: 'Property',
                documentation: '当前登录用户信息\n\n包含用户所属角色、组织机构等信息\n未登录时访问到的值为{}\n\n示例:\nvar userName = V8.CurrentUser.Name;',
                insertText: 'CurrentUser'
            },
            OsClient: {
                label: 'OsClient',
                kind: 'Property',
                documentation: '当前SaaS租户标识',
                insertText: 'OsClient'
            },
            Param: {
                label: 'Param',
                kind: 'Property',
                documentation: '接口引擎参数对象\n\n可接收form、json、url三种参数\n\n示例:\nvar id = V8.Param.Id;',
                insertText: 'Param'
            },
            Result: {
                label: 'Result',
                kind: 'Property',
                documentation: '接口引擎返回结果\n\n旧版返回方式(仍支持，但建议使用return)\n\n示例:\nV8.Result = { Code: 1, Data: [] };',
                insertText: 'Result'
            },
            Form: {
                label: 'Form',
                kind: 'Property',
                documentation: '表单数据(在表单提交事件中可用)\n\n示例:\nvar userName = V8.Form.UserName;',
                insertText: 'Form'
            },
            OldForm: {
                label: 'OldForm',
                kind: 'Property',
                documentation: '修改前的表单数据(在表单提交事件中可用)',
                insertText: 'OldForm'
            },
            FormSubmitAction: {
                label: 'FormSubmitAction',
                kind: 'Property',
                documentation: '表单提交类型\n\n可能的值: Insert、Update、Delete',
                insertText: 'FormSubmitAction'
            },

            // ========== ApiEngine接口引擎 ==========
            ApiEngine: {
                label: 'ApiEngine',
                kind: 'Module',
                documentation: '接口引擎 - 服务器端V8可直接调用(非http)\n\n详见: /doc/v8-engine/api-engine',
                insertText: 'ApiEngine',
                methods: {
                    Run: {
                        label: 'Run',
                        kind: 'Method',
                        documentation: '执行接口引擎\n\n参数:\n  - ApiEngineKey: 接口引擎Key\n  - params: 参数对象\n  - V8.DbTrans: 事务对象(可选，传入可保证同一事务)\n\n返回: { Code: 1/0, Data: any, Msg: "" }\n\n示例:\nvar result = V8.ApiEngine.Run("ApiEngineKey", {\n  Param1: "1"\n});\n\n同一事务:\nvar result = V8.ApiEngine.Run("ApiEngineKey", {\n  Param2: "1"\n}, V8.DbTrans);',
                        insertText: 'Run',
                        snippet: 'Run("${1:ApiEngineKey}", {\n\t${2:Param1}: ${3:value}\n}${4:, V8.DbTrans})'
                    }
                }
            },

            // ========== FormEngine表单引擎 ==========
            FormEngine: {
                label: 'FormEngine',
                kind: 'Module',
                documentation: '表单引擎 - 用于操作表单数据的增删改查\n\n详见: /doc/v8-engine/form-engine.html',
                insertText: 'FormEngine',
                methods: {
                    GetFormData: {
                        label: 'GetFormData',
                        kind: 'Method',
                        documentation: '获取单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - params: 查询参数对象\n  - V8.DbTrans: 事务对象(可选)\n\n返回: { Code: 1/0, Data: {}, Msg: "" }',
                        insertText: 'GetFormData',
                        snippet: 'GetFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n}${3:, V8.DbTrans})'
                    },
                    GetTableData: {
                        label: 'GetTableData',
                        kind: 'Method',
                        documentation: '获取表格数据列表\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - params: 查询参数\n  - V8.DbTrans: 事务对象(可选)\n\n返回: { Code: 1/0, Data: [], DataCount: 0, Msg: "" }\n\n示例:\nvar result = V8.FormEngine.GetTableData("tableName", {\n  _Where: [\n    ["GuanLianID", "=", "1"],\n    ["OR", "GuanLianID", "=", null]\n  ],\n  _PageIndex: 1,\n  _PageSize: 15\n});',
                        insertText: 'GetTableData',
                        snippet: 'GetTableData("${1:FormEngineKey}", {\n\t_Where: [["${2:FieldName}", "${3:=}", ${4:value}]],\n\t_PageIndex: ${5:1},\n\t_PageSize: ${6:15}\n}${7:, V8.DbTrans})'
                    },
                    AddFormData: {
                        label: 'AddFormData',
                        kind: 'Method',
                        documentation: '新增单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - params: 数据对象\n  - V8.DbTrans: 事务对象(可选)\n\n返回: { Code: 1/0, Data: {}, Msg: "" }',
                        insertText: 'AddFormData',
                        snippet: 'AddFormData("${1:FormEngineKey}", {\n\t${2:Name}: "${3:value}"\n}${4:, V8.DbTrans})'
                    },
                    UptFormData: {
                        label: 'UptFormData',
                        kind: 'Method',
                        documentation: '修改单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - params: 数据对象(必须包含Id)\n  - V8.DbTrans: 事务对象(可选)\n\n返回: { Code: 1/0, Msg: "" }\n\n示例:\nvar result = V8.FormEngine.UptFormData("tableName", {\n  Id: "xxx",\n  Age: 20,\n  Sex: "女"\n}, V8.DbTrans);',
                        insertText: 'UptFormData',
                        snippet: 'UptFormData("${1:FormEngineKey}", {\n\tId: "${2:id}",\n\t${3:Name}: "${4:value}"\n}${5:, V8.DbTrans})'
                    },
                    DelFormData: {
                        label: 'DelFormData',
                        kind: 'Method',
                        documentation: '删除单条表单数据(软删除)\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - params: 包含Id的对象\n  - V8.DbTrans: 事务对象(可选)\n\n返回: { Code: 1/0, Msg: "" }',
                        insertText: 'DelFormData',
                        snippet: 'DelFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n}${3:, V8.DbTrans})'
                    }
                }
            },

            // ========== 数据库对象 ==========
            Db: {
                label: 'Db',
                kind: 'Module',
                documentation: '数据库访问对象\n\n支持Dos.ORM、SqlSugar切换\n\n示例:\nvar list = V8.Db.FromSql("select * from table")\n  .ToArray(); // 返回数组\n  .ExecuteNonQuery(); // 返回受影响行数\n  .First(); // 返回单条数据\n  .ToScalar(); // 返回单个字段值',
                insertText: 'Db',
                methods: {
                    FromSql: {
                        label: 'FromSql',
                        kind: 'Method',
                        documentation: '执行SQL语句\n\n示例:\nvar list = V8.Db.FromSql("select * from table").ToArray();',
                        insertText: 'FromSql',
                        snippet: 'FromSql("${1:sql}").${2|ToArray,ExecuteNonQuery,First,ToScalar|}()'
                    }
                }
            },
            DbRead: {
                label: 'DbRead',
                kind: 'Module',
                documentation: '数据库只读对象\n\n用法和V8.Db一样\n当数据库未部署读写分离时，此对象与V8.Db对象值一致',
                insertText: 'DbRead'
            },
            DbTrans: {
                label: 'DbTrans',
                kind: 'Module',
                documentation: '数据库事务对象\n\n可以像V8.Db一样使用\n不用手动执行Rollback，接口引擎外部会识别异常并自动回滚\n\n示例:\nvar result1 = V8.FormEngine.UptFormData("table1", {}, V8.DbTrans);\nvar result2 = V8.FormEngine.UptFormData("table2", {}, V8.DbTrans);\nif(result2.Code == 1) {\n  return { Code: 1 }; // 自动提交事务\n} else {\n  return { Code: 0 }; // 自动回滚事务\n}',
                insertText: 'DbTrans',
                methods: {
                    FromSql: {
                        label: 'FromSql',
                        kind: 'Method',
                        documentation: '在事务中执行SQL语句',
                        insertText: 'FromSql',
                        snippet: 'FromSql("${1:sql}").${2|ToArray,ExecuteNonQuery,First,ToScalar|}()'
                    }
                }
            },
            Dbs: {
                label: 'Dbs',
                kind: 'Module',
                documentation: '扩展数据库对象\n\n访问多数据库(扩展库)\n\n示例:\nvar dataList = V8.Dbs.OracleDB1.FromSql("").ToArray();\n\n扩展数据库事务:\nvar emptyExTrans = V8.Dbs.EmptyEx.BeginTransaction();\nvar count = emptyExTrans.FromSql("delete...").ExecuteNonQuery();\nemptyExTrans.Commit(); // 或 Rollback()\nemptyExTrans.Close();',
                insertText: 'Dbs'
            },

            // ========== 缓存操作 ==========
            Cache: {
                label: 'Cache',
                kind: 'Module',
                documentation: '分布式缓存操作类\n\n过期时间格式: d.HH:mm:ss\n\n建议缓存Key命名: Microi:${V8.OsClient}:{分类}:{Key}',
                insertText: 'Cache',
                methods: {
                    Set: {
                        label: 'Set',
                        kind: 'Method',
                        documentation: '写缓存\n\n参数:\n  - key: 缓存键\n  - value: 缓存值\n  - expiry: 过期时间(d.HH:mm:ss)\n\n返回: bool\n\n示例:\nvar cacheKey = `Microi:${V8.OsClient}:FormData:baoming`;\nvar result = V8.Cache.Set(cacheKey, value, "0.00:00:59");',
                        insertText: 'Set',
                        snippet: 'Set("${1:key}", ${2:value}, "${3:0.00:10:00}")'
                    },
                    Get: {
                        label: 'Get',
                        kind: 'Method',
                        documentation: '获取缓存\n\n返回: string或null\n\n示例:\nvar result = V8.Cache.Get(cacheKey);',
                        insertText: 'Get',
                        snippet: 'Get("${1:key}")'
                    },
                    Remove: {
                        label: 'Remove',
                        kind: 'Method',
                        documentation: '删除缓存\n\n返回: bool',
                        insertText: 'Remove',
                        snippet: 'Remove("${1:key}")'
                    }
                }
            },

            // ========== MongoDb操作 ==========
            MongoDb: {
                label: 'MongoDb',
                kind: 'Module',
                documentation: 'MongoDB操作对象\n\n可自定义数据库名、表名，不存在时会自动创建',
                insertText: 'MongoDb',
                methods: {
                    NewId: {
                        label: 'NewId',
                        kind: 'Method',
                        documentation: '生成MongoDb的ObjectId',
                        insertText: 'NewId',
                        snippet: 'NewId()'
                    },
                    AddFormData: {
                        label: 'AddFormData',
                        kind: 'Method',
                        documentation: '新增MongoDB数据\n\n示例:\nV8.MongoDb.AddFormData({\n  DbName: "sys_log_2024",\n  TableName: "log_2024_12",\n  Id: V8.MongoDb.NewId(),\n  _FormData: { Name: "张三" }\n});',
                        insertText: 'AddFormData',
                        snippet: 'AddFormData({\n\tDbName: "${1:DbName}",\n\tTableName: "${2:TableName}",\n\t_FormData: {\n\t\t${3:Name}: "${4:value}"\n\t}\n})'
                    },
                    GetFormData: {
                        label: 'GetFormData',
                        kind: 'Method',
                        documentation: '查询单条MongoDB数据',
                        insertText: 'GetFormData',
                        snippet: 'GetFormData({\n\tDbName: "${1:DbName}",\n\tTableName: "${2:TableName}",\n\tId: "${3:id}"\n})'
                    },
                    GetTableData: {
                        label: 'GetTableData',
                        kind: 'Method',
                        documentation: '查询MongoDB数据列表\n\n示例:\nV8.MongoDb.GetTableData({\n  DbName: "sys_log_itdos",\n  TableName: "log_202412",\n  _Where: [\n    ["Type", "=", "访问菜单"],\n    ["OR", "Type", "=", "点击V8按钮"]\n  ]\n});',
                        insertText: 'GetTableData',
                        snippet: 'GetTableData({\n\tDbName: "${1:DbName}",\n\tTableName: "${2:TableName}",\n\t_Where: [["${3:Field}", "${4:=}", ${5:value}]]\n})'
                    },
                    UptFormData: {
                        label: 'UptFormData',
                        kind: 'Method',
                        documentation: '修改MongoDB数据',
                        insertText: 'UptFormData',
                        snippet: 'UptFormData({\n\tDbName: "${1:DbName}",\n\tTableName: "${2:TableName}",\n\tId: "${3:id}",\n\t_FormData: {\n\t\t${4:Name}: "${5:value}"\n\t}\n})'
                    },
                    DelFormData: {
                        label: 'DelFormData',
                        kind: 'Method',
                        documentation: '删除MongoDB数据',
                        insertText: 'DelFormData',
                        snippet: 'DelFormData({\n\tDbName: "${1:DbName}",\n\tTableName: "${2:TableName}",\n\tId: "${3:id}"\n})'
                    }
                }
            },

            // ========== HTTP请求 ==========
            Http: {
                label: 'Http',
                kind: 'Module',
                documentation: 'HTTP请求对象(基于RestSharp封装)',
                insertText: 'Http',
                methods: {
                    Post: {
                        label: 'Post',
                        kind: 'Method',
                        documentation: 'POST请求，返回string\n\n参数:\n  - Url: 请求地址(必传)\n  - PostParam: 请求参数\n  - PostParamString: 序列化后的参数字符串\n  - ParamType: 请求类型("json"或"form"，默认form)\n  - Timeout: 超时时间(秒，默认5)\n  - Headers/Header: 请求头\n\n示例:\nvar result = V8.Http.Post({\n  Url: "http://api.example.com",\n  PostParam: { Account: "admin" },\n  ParamType: "json",\n  Headers: { token: "" }\n});',
                        insertText: 'Post',
                        snippet: 'Post({\n\tUrl: "${1:url}",\n\tPostParam: {\n\t\t${2:param}: ${3:value}\n\t}${4:,\n\tParamType: "json"}\n})'
                    },
                    PostResponse: {
                        label: 'PostResponse',
                        kind: 'Method',
                        documentation: 'POST请求，返回Response对象\n\n包含Headers、Content、RawBytes\n\n示例:\nvar result = V8.Http.PostResponse({\n  Url: "...",\n  PostParam: {}\n});\nvar header = result.Headers.find(item => item.Name == "Authorization");',
                        insertText: 'PostResponse',
                        snippet: 'PostResponse({\n\tUrl: "${1:url}",\n\tPostParam: {\n\t\t${2:param}: ${3:value}\n\t}\n})'
                    },
                    Get: {
                        label: 'Get',
                        kind: 'Method',
                        documentation: 'GET请求，返回string',
                        insertText: 'Get',
                        snippet: 'Get({\n\tUrl: "${1:url}",\n\tGetParam: {\n\t\t${2:param}: ${3:value}\n\t}\n})'
                    },
                    GetResponse: {
                        label: 'GetResponse',
                        kind: 'Method',
                        documentation: 'GET请求，返回Response对象',
                        insertText: 'GetResponse',
                        snippet: 'GetResponse({\n\tUrl: "${1:url}"\n})'
                    }
                }
            },

            // ========== 工具方法 ==========
            Method: {
                label: 'Method',
                kind: 'Module',
                documentation: '常用函数集合',
                insertText: 'Method',
                methods: {
                    GetCurrentToken: {
                        label: 'GetCurrentToken',
                        kind: 'Method',
                        documentation: '从redis中获取当前登录用户的token和身份信息\n\n参数:\n  - token: 可选，是否包含Bearer均支持\n  - osClient: 可选\n\n返回: { OsClient, CurrentUser, Token } 或 null',
                        insertText: 'GetCurrentToken',
                        snippet: 'GetCurrentToken(${1:token}${2:, osClient})'
                    },
                    RefreshLoginUser: {
                        label: 'RefreshLoginUser',
                        kind: 'Method',
                        documentation: '刷新用户的登录身份redis缓存信息\n\n必传: userId、osClient',
                        insertText: 'RefreshLoginUser',
                        snippet: 'RefreshLoginUser("${1:userId}", "${2:osClient}")'
                    },
                    GetPrivateFileUrl: {
                        label: 'GetPrivateFileUrl',
                        kind: 'Method',
                        documentation: '获取私有文件的临时访问地址\n\n参数:\n  - FilePathName: 单个文件路径\n  - FilePathNames: 文件路径数组\n\n返回: { Code, Data, Msg }',
                        insertText: 'GetPrivateFileUrl',
                        snippet: 'GetPrivateFileUrl({\n\tFilePathName: "${1:/microi/file/xxx.doc}"\n})'
                    },
                    AddSysLog: {
                        label: 'AddSysLog',
                        kind: 'Method',
                        documentation: '添加系统日志\n\n参数:\n  - Type: 日志类型\n  - Title: 日志标题\n  - Content: 日志内容\n  - OtherInfo: 其它信息\n  - Remark: 日志备注\n  - Level: 日志等级',
                        insertText: 'AddSysLog',
                        snippet: 'AddSysLog({\n\tType: "${1:类型}",\n\tTitle: "${2:标题}",\n\tContent: "${3:内容}"\n})'
                    }
                }
            },

            // ========== Base64操作 ==========
            Base64: {
                label: 'Base64',
                kind: 'Module',
                documentation: 'Base64转换\n\n遇异常会直接返回源字符串',
                insertText: 'Base64',
                methods: {
                    StringToBase64: {
                        label: 'StringToBase64',
                        kind: 'Method',
                        documentation: '字符串转Base64',
                        insertText: 'StringToBase64',
                        snippet: 'StringToBase64("${1:str}")'
                    },
                    Base64ToString: {
                        label: 'Base64ToString',
                        kind: 'Method',
                        documentation: 'Base64转字符串',
                        insertText: 'Base64ToString',
                        snippet: 'Base64ToString("${1:base64str}")'
                    }
                }
            },

            // ========== Action工具 ==========
            Action: {
                label: 'Action',
                kind: 'Module',
                documentation: '服务器端全局V8函数',
                insertText: 'Action',
                methods: {
                    GetDateTimeNow: {
                        label: 'GetDateTimeNow',
                        kind: 'Method',
                        documentation: '获取yyyy-MM-dd HH:mm:ss格式的当前时间字符串\n\n示例:\nvar nowDate = V8.Action.GetDateTimeNow();',
                        insertText: 'GetDateTimeNow',
                        snippet: 'GetDateTimeNow()'
                    }
                }
            }
        }
    },

    // ========== System C#系统类 ==========
    System: {
        label: 'System',
        kind: 'Module',
        documentation: 'C#系统类 - 服务器端V8代码能直接使用.net下的System命名空间',
        insertText: 'System',
        properties: {
            Guid: {
                label: 'Guid',
                kind: 'Module',
                documentation: 'GUID操作',
                insertText: 'Guid',
                methods: {
                    NewGuid: {
                        label: 'NewGuid',
                        kind: 'Method',
                        documentation: '生成服务器端GUID值\n\n示例:\nvar newGuid = System.Guid.NewGuid();',
                        insertText: 'NewGuid',
                        snippet: 'NewGuid()'
                    }
                }
            },
            Convert: {
                label: 'Convert',
                kind: 'Module',
                documentation: '类型转换',
                insertText: 'Convert',
                methods: {
                    ToBase64String: {
                        label: 'ToBase64String',
                        kind: 'Method',
                        documentation: '字节数组转Base64字符串\n\n示例:\nvar bytes = System.Text.Encoding.UTF8.GetBytes(str);\nvar base64 = System.Convert.ToBase64String(bytes);',
                        insertText: 'ToBase64String',
                        snippet: 'ToBase64String(${1:bytes})'
                    }
                }
            },
            Threading: {
                label: 'Threading',
                kind: 'Module',
                documentation: '线程操作',
                insertText: 'Threading',
                properties: {
                    Thread: {
                        label: 'Thread',
                        kind: 'Module',
                        documentation: '线程',
                        insertText: 'Thread',
                        methods: {
                            Sleep: {
                                label: 'Sleep',
                                kind: 'Method',
                                documentation: '线程休眠\n\n参数: 毫秒数\n\n示例:\nSystem.Threading.Thread.Sleep(1000);',
                                insertText: 'Sleep',
                                snippet: 'Sleep(${1:1000})'
                            }
                        }
                    },
                    Tasks: {
                        label: 'Tasks',
                        kind: 'Module',
                        documentation: '任务',
                        insertText: 'Tasks',
                        properties: {
                            Task: {
                                label: 'Task',
                                kind: 'Module',
                                documentation: '异步任务',
                                insertText: 'Task',
                                methods: {
                                    Run: {
                                        label: 'Run',
                                        kind: 'Method',
                                        documentation: '异步执行V8代码\n\n示例:\nSystem.Threading.Tasks.Task.Run(function() {\n  System.Threading.Thread.Sleep(1000);\n  V8.FormEngine.UptFormData("table", {});\n});',
                                        insertText: 'Run',
                                        snippet: 'Run(function() {\n\t${1:// 异步代码}\n})'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

/**
 * 生成Monaco编辑器的CompletionItem
 */
export function createV8ServerCompletionItems(monaco, range) {
    const suggestions = [];
    
    // 添加V8对象
    suggestions.push({
        label: V8ServerApiDefinitions.V8.label,
        kind: monaco.languages.CompletionItemKind.Module,
        documentation: { value: V8ServerApiDefinitions.V8.documentation },
        insertText: V8ServerApiDefinitions.V8.insertText,
        range: range
    });
    
    // 添加System对象
    suggestions.push({
        label: V8ServerApiDefinitions.System.label,
        kind: monaco.languages.CompletionItemKind.Module,
        documentation: { value: V8ServerApiDefinitions.System.documentation },
        insertText: V8ServerApiDefinitions.System.insertText,
        range: range
    });
    
    // 添加setTimeout和clearTimeout
    suggestions.push({
        label: 'setTimeout',
        kind: monaco.languages.CompletionItemKind.Function,
        documentation: { value: '异步执行V8代码(推荐)\n\n示例:\nvar timer = setTimeout(function() {\n  // 异步代码\n}, 1000);' },
        insertText: 'setTimeout',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: range
    });
    
    suggestions.push({
        label: 'clearTimeout',
        kind: monaco.languages.CompletionItemKind.Function,
        documentation: { value: '取消定时器\n\n示例:\nclearTimeout(timer);' },
        insertText: 'clearTimeout',
        range: range
    });
    
    return suggestions;
}

/**
 * 根据上下文获取V8属性的建议
 */
export function getV8ServerPropertySuggestions(monaco, objectPath, range) {
    const suggestions = [];
    const parts = objectPath.split('.');
    
    if (parts.length === 1 && parts[0] === 'V8') {
        // 获取V8的一级属性
        const properties = V8ServerApiDefinitions.V8.properties;
        for (const key in properties) {
            const prop = properties[key];
            const kindMap = {
                'Property': monaco.languages.CompletionItemKind.Property,
                'Method': monaco.languages.CompletionItemKind.Method,
                'Module': monaco.languages.CompletionItemKind.Module
            };
            
            suggestions.push({
                label: prop.label,
                kind: kindMap[prop.kind] || monaco.languages.CompletionItemKind.Property,
                documentation: { value: prop.documentation },
                insertText: prop.snippet || prop.insertText,
                insertTextRules: prop.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                range: range
            });
        }
    } else if (parts.length === 2) {
        // 获取二级属性
        const firstLevel = parts[0];
        const secondLevel = parts[1];
        
        let rootObj = null;
        if (firstLevel === 'V8') {
            rootObj = V8ServerApiDefinitions.V8.properties[secondLevel];
        } else if (firstLevel === 'System') {
            rootObj = V8ServerApiDefinitions.System.properties[secondLevel];
        }
        
        if (rootObj && rootObj.methods) {
            for (const key in rootObj.methods) {
                const method = rootObj.methods[key];
                suggestions.push({
                    label: method.label,
                    kind: monaco.languages.CompletionItemKind.Method,
                    documentation: { value: method.documentation },
                    insertText: method.snippet || method.insertText,
                    insertTextRules: method.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range
                });
            }
        }
        
        if (rootObj && rootObj.properties) {
            for (const key in rootObj.properties) {
                const prop = rootObj.properties[key];
                suggestions.push({
                    label: prop.label,
                    kind: monaco.languages.CompletionItemKind[prop.kind] || monaco.languages.CompletionItemKind.Property,
                    documentation: { value: prop.documentation },
                    insertText: prop.insertText,
                    range: range
                });
            }
        }
    } else if (parts.length >= 3) {
        // 处理更深层级的嵌套，如 System.Threading.Thread
        let currentObj = null;
        if (parts[0] === 'System') {
            currentObj = V8ServerApiDefinitions.System;
            for (let i = 1; i < parts.length - 1; i++) {
                if (currentObj && currentObj.properties && currentObj.properties[parts[i]]) {
                    currentObj = currentObj.properties[parts[i]];
                } else {
                    currentObj = null;
                    break;
                }
            }
        }
        
        if (currentObj) {
            if (currentObj.methods) {
                for (const key in currentObj.methods) {
                    const method = currentObj.methods[key];
                    suggestions.push({
                        label: method.label,
                        kind: monaco.languages.CompletionItemKind.Method,
                        documentation: { value: method.documentation },
                        insertText: method.snippet || method.insertText,
                        insertTextRules: method.snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                        range: range
                    });
                }
            }
            if (currentObj.properties) {
                for (const key in currentObj.properties) {
                    const prop = currentObj.properties[key];
                    suggestions.push({
                        label: prop.label,
                        kind: monaco.languages.CompletionItemKind[prop.kind] || monaco.languages.CompletionItemKind.Property,
                        documentation: { value: prop.documentation },
                        insertText: prop.insertText,
                        range: range
                    });
                }
            }
        }
    }
    
    return suggestions;
}

export default {
    V8ServerApiDefinitions,
    createV8ServerCompletionItems,
    getV8ServerPropertySuggestions
};
