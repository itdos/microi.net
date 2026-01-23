/**
 * V8引擎 JavaScript API 智能提示定义
 * 用于Monaco编辑器提供代码自动完成功能
 *
 * 根据官方文档生成: /Users/Work/Microi.net/microi.doc/docs/doc/v8-engine/v8-client.md
 * @version 2.0.0
 * @date 2026-01-21
 */

// V8引擎完整API定义
export const V8ApiDefinitions = {
    V8: {
        label: "V8",
        kind: "Module",
        documentation: "V8引擎全局对象 - 前端V8引擎支持完整ES6语法",
        insertText: "V8",
        properties: {
            // ========== 表单相关属性 ==========
            Form: {
                label: "Form",
                kind: "Property",
                documentation: "访问当前表单字段值\n\n示例:\nvar id = V8.Form.Id;\nvar name = V8.Form.UserName;\n\n如果是下拉框组件:\nvar selectId = V8.Form.SelectUser.Id;",
                insertText: "Form"
            },
            OldForm: {
                label: "OldForm",
                kind: "Property",
                documentation: "访问表单修改前的字段值\n\n示例:\nvar oldName = V8.OldForm.UserName;",
                insertText: "OldForm"
            },
            Field: {
                label: "Field",
                kind: "Property",
                documentation: "访问当前表单字段属性\n\n包含属性: Name、Label、Config、Data(绑定数据源)、Readonly、Visible、Placeholder等\n\n示例:\nvar isReadonly = V8.Field.UserName.Readonly;",
                insertText: "Field"
            },
            FormMode: {
                label: "FormMode",
                kind: "Property",
                documentation: '获取当前Form打开的模式\n\n可能的值: Add(新增)、Edit(编辑)、View(预览)\n\n示例:\nif(V8.FormMode == "Add") {\n  V8.FormSet("ShenqingR", V8.CurrentUser.Name);\n}',
                insertText: "FormMode"
            },
            FormSubmitAction: {
                label: "FormSubmitAction",
                kind: "Property",
                documentation: "表单提交类型\n\n可能的值: Insert、Update、Delete\n\n注意: 在表单进入事件无法访问，只能在表单提交前、提交后访问",
                insertText: "FormSubmitAction"
            },
            CurrentUser: {
                label: "CurrentUser",
                kind: "Property",
                documentation: "访问当前登录用户信息\n\n示例:\nvar id = V8.CurrentUser.Id;\nvar name = V8.CurrentUser.Name;\nvar deptName = V8.CurrentUser.DeptName;",
                insertText: "CurrentUser"
            },
            CurrentToken: {
                label: "CurrentToken",
                kind: "Property",
                documentation: "当前登录身份Token",
                insertText: "CurrentToken"
            },
            SysConfig: {
                label: "SysConfig",
                kind: "Property",
                documentation: "访问系统设置信息\n\n可以访问sys_config表的任意字段\n\n示例:\nvar sysTitle = V8.SysConfig.SysTitle;\nvar apiBase = V8.SysConfig.ApiBase;",
                insertText: "SysConfig"
            },
            SelectedData: {
                label: "SelectedData",
                kind: "Property",
                documentation: "获取已选择的行数组，每行包含了所有数据\n\n示例:\nvar selectData = V8.SelectedData;\nvar ids = selectData.map(item => item.Id);",
                insertText: "SelectedData"
            },
            ParentV8: {
                label: "ParentV8",
                kind: "Module",
                documentation: '子表中访问父表的V8对象\n\n可使用父表V8对象的所有功能\n\n示例:\nvar parentForm = V8.ParentV8.Form;\nV8.ParentV8.FormSet("字段名", "值");',
                insertText: "ParentV8"
            },

            // ========== 表单操作方法 ==========
            FormSet: {
                label: "FormSet",
                kind: "Method",
                documentation:
                    '给当前表单字段赋值，会触发被赋值字段的值变更事件\n\n参数:\n  - fieldName: 字段名\n  - value: 字段值\n\n注意: V8.Form.UserName = "张三" 不会触发值变更事件\n强烈不建议在字段的值变更事件中使用FormSet再次对此字段赋值\n\n示例:\nV8.FormSet("UserName", "张三");\nV8.FormSet("SelectUser", { Id: 1, Name: "张三" });',
                insertText: "FormSet",
                snippet: 'FormSet("${1:fieldName}", ${2:value})'
            },
            FieldSet: {
                label: "FieldSet",
                kind: "Method",
                documentation:
                    '给当前表单字段属性赋值\n\n参数:\n  - fieldName: 字段名\n  - propertyName: 属性名\n  - value: 属性值\n\n示例:\nV8.FieldSet("UserName", "Readonly", true);\nV8.FieldSet("SelectField", "Data", [{Id:1}, {Id:2}]);',
                insertText: "FieldSet",
                snippet: 'FieldSet("${1:fieldName}", "${2:propertyName}", ${3:value})'
            },
            FormSubmit: {
                label: "FormSubmit",
                kind: "Method",
                documentation:
                    '提交表单\n\n注意: 此函数会触发"前端表单提交前V8事件"\n不能在"前端表单提交前V8事件"调用此函数，否则会死循环\n\n参数:\n  - CloseForm: 是否关闭Form表单\n  - SavedType: 保存后的操作(Insert/Update/View)\n  - Callback: 回调函数\n\n示例:\nV8.FormSubmit({\n  CloseForm: true,\n  SavedType: "Insert",\n  Callback: function(result) { ... }\n});',
                insertText: "FormSubmit",
                snippet: 'FormSubmit({\n\tCloseForm: ${1:true},\n\tSavedType: "${2:Insert}",\n\tCallback: function(result) {\n\t\t${3:// 处理结果}\n\t}\n})'
            },
            FormClose: {
                label: "FormClose",
                kind: "Method",
                documentation: "强制关闭表单\n\n示例:\nV8.FormClose();",
                insertText: "FormClose",
                snippet: "FormClose()"
            },
            OpenForm: {
                label: "OpenForm",
                kind: "Method",
                documentation: '打开表单\n\n参数:\n  - formModel: 表单数据对象\n  - type: "View"/"Edit"/"Add"\n\n示例(在行更多V8按钮事件中):\nV8.OpenForm(V8.Form, "Edit");',
                insertText: "OpenForm",
                snippet: 'OpenForm(${1:V8.Form}, "${2|View,Edit,Add|}")'
            },
            OpenAnyForm: {
                label: "OpenAnyForm",
                kind: "Method",
                documentation:
                    '打开一个任意表单\n\n参数:\n  - TableName: 表名(必传)\n  - FormMode: 打开模式(必传) Add/Edit/View\n  - Id: 数据Id(Edit/View时必传)\n  - DialogType: 打开方式(可选) Dialog/Drawer\n  - Width: 弹出宽度(可选)\n  - DataAppend: 自定义附加数据(可选)\n  - EventReplace: 替换事件(可选)\n\n示例:\nV8.OpenAnyForm({\n  TableName: "Diy_User",\n  FormMode: "Edit",\n  Id: V8.Form.Id\n});',
                insertText: "OpenAnyForm",
                snippet: 'OpenAnyForm({\n\tTableName: "${1:TableName}",\n\tFormMode: "${2|Add,Edit,View|}",\n\tId: ${3:V8.Form.Id}\n})'
            },
            OpenAnyTable: {
                label: "OpenAnyTable",
                kind: "Method",
                documentation:
                    '打开一个任意列表\n\n参数:\n  - SysMenuId/ModuleEngineKey: 菜单Id或模块引擎Key(必传其一)\n  - MultipleSelect: 是否多选\n  - PropsWhere: 查询条件\n  - SubmitEvent: 提交事件回调\n\n示例:\nV8.OpenAnyTable({\n  SysMenuId: "xxx-xxx",\n  MultipleSelect: true,\n  SubmitEvent: async function(selectData, callback) {\n    callback(result);\n  }\n});',
                insertText: "OpenAnyTable",
                snippet:
                    'OpenAnyTable({\n\tSysMenuId: "${1:menuId}",\n\tMultipleSelect: ${2:true},\n\tSubmitEvent: async function(selectData, callback) {\n\t\t${3:// 处理提交}\n\t\tcallback(result);\n\t}\n})'
            },

            // ========== 表格操作方法 ==========
            RefreshTable: {
                label: "RefreshTable",
                kind: "Method",
                documentation: "刷新表格数据列表\n\n参数:\n  - _PageIndex: 页码，传入-1表示跳转到最后一页\n\n示例:\nV8.RefreshTable({ _PageIndex: 1 });",
                insertText: "RefreshTable",
                snippet: "RefreshTable({ _PageIndex: ${1:1} })"
            },
            SearchSet: {
                label: "SearchSet",
                kind: "Method",
                documentation: '表格Tabs设置搜索条件(替换原有条件)\n\n示例:\nV8.SearchSet([\n  ["Age", ">=", 18]\n]);',
                insertText: "SearchSet",
                snippet: 'SearchSet([\n\t["${1:FieldName}", "${2:=}", ${3:value}]\n])'
            },
            SearchAppend: {
                label: "SearchAppend",
                kind: "Method",
                documentation: '表格Tabs追加搜索条件(保留原有条件)\n\n示例:\nV8.SearchAppend([\n  ["Age", ">=", 18]\n]);',
                insertText: "SearchAppend",
                snippet: 'SearchAppend([\n\t["${1:FieldName}", "${2:=}", ${3:value}]\n])'
            },

            // ========== FormEngine表单引擎 ==========
            FormEngine: {
                label: "FormEngine",
                kind: "Module",
                documentation: "表单引擎 - 用于操作表单数据的增删改查\n\n详见平台文档: /doc/v8-engine/form-engine.html",
                insertText: "FormEngine",
                methods: {
                    GetFormData: {
                        label: "GetFormData",
                        kind: "Method",
                        documentation:
                            '获取单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - Id: 主键ID(可选)\n  - _Where: 查询条件(可选)\n  - _SelectFields: 指定查询字段(可选)\n\n返回: { Code: 1/0, Data: {}, Msg: "" }\n\n示例:\nvar result = await V8.FormEngine.GetFormData("sys_user", {\n  Id: "xxx-xxx"\n});',
                        insertText: "GetFormData",
                        snippet: 'GetFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n})'
                    },
                    GetTableData: {
                        label: "GetTableData",
                        kind: "Method",
                        documentation:
                            '获取表格数据列表\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - _Where: 查询条件数组\n  - _PageSize: 每页条数\n  - _PageIndex: 页码(从1开始)\n  - _OrderBy: 排序字段\n  - _OrderByType: 排序方式(ASC/DESC)\n\n返回: { Code: 1/0, Data: [], DataCount: 0, Msg: "" }\n\n示例:\nvar result = await V8.FormEngine.GetTableData("sys_user", {\n  _Where: [["Age", ">", "18"]],\n  _PageSize: 20,\n  _PageIndex: 1\n});',
                        insertText: "GetTableData",
                        snippet: 'GetTableData("${1:FormEngineKey}", {\n\t_Where: [["${2:FieldName}", "${3:=}", ${4:value}]],\n\t_PageSize: ${5:20},\n\t_PageIndex: ${6:1}\n})'
                    },
                    AddFormData: {
                        label: "AddFormData",
                        kind: "Method",
                        documentation:
                            '新增单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - Id: 主键ID(可选)\n  - 其他字段: 要保存的数据\n\n返回: { Code: 1/0, Data: {}, Msg: "" }\n\n示例:\nvar result = await V8.FormEngine.AddFormData("sys_user", {\n  Name: "张三",\n  Age: 25\n});',
                        insertText: "AddFormData",
                        snippet: 'AddFormData("${1:FormEngineKey}", {\n\t${2:Name}: "${3:value}"\n})'
                    },
                    UptFormData: {
                        label: "UptFormData",
                        kind: "Method",
                        documentation:
                            '修改单条表单数据\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - Id: 主键ID(必传)\n  - 其他字段: 要修改的数据\n\n返回: { Code: 1/0, Msg: "" }\n\n示例:\nvar result = await V8.FormEngine.UptFormData("sys_user", {\n  Id: "xxx-xxx",\n  Name: "李四"\n});',
                        insertText: "UptFormData",
                        snippet: 'UptFormData("${1:FormEngineKey}", {\n\tId: "${2:id}",\n\t${3:Name}: "${4:value}"\n})'
                    },
                    DelFormData: {
                        label: "DelFormData",
                        kind: "Method",
                        documentation:
                            '删除单条表单数据(软删除)\n\n参数:\n  - FormEngineKey: 表单引擎Key或表名\n  - Id或Ids: 主键ID或ID数组\n\n返回: { Code: 1/0, Msg: "" }\n\n示例:\nvar result = await V8.FormEngine.DelFormData("sys_user", {\n  Id: "xxx-xxx"\n});',
                        insertText: "DelFormData",
                        snippet: 'DelFormData("${1:FormEngineKey}", {\n\tId: "${2:id}"\n})'
                    }
                }
            },

            // ========== ApiEngine接口引擎 ==========
            ApiEngine: {
                label: "ApiEngine",
                kind: "Module",
                documentation: "接口引擎 - 用于调用后端API接口",
                insertText: "ApiEngine",
                methods: {
                    Run: {
                        label: "Run",
                        kind: "Method",
                        documentation:
                            '执行接口引擎\n\n参数:\n  - ApiEngineKey: 接口引擎Key\n  - 其他参数: 传递给接口的参数\n\n返回: { Code: 1/0, Data: any, Msg: "" }\n\n示例:\nvar result = await V8.ApiEngine.Run("sysuser_reg", {\n  Account: "test",\n  Name: "测试"\n});',
                        insertText: "Run",
                        snippet: 'Run("${1:ApiEngineKey}", {\n\t${2:ParamName}: ${3:value}\n})'
                    }
                }
            },

            // ========== HTTP请求方法 ==========
            Post: {
                label: "Post",
                kind: "Method",
                documentation: 'POST请求 - 自带token，默认Form Data格式\n\n示例:\nV8.Post("/api/xxx", { Id: 1 }, function(result) {\n  if(result.Code == 1) { ... }\n});',
                insertText: "Post",
                snippet: 'Post("${1:/api/xxx}", {\n\t${2:param}: ${3:value}\n}, function(result) {\n\tif(result.Code == 1) {\n\t\t${4:// 成功处理}\n\t}\n})'
            },
            Get: {
                label: "Get",
                kind: "Method",
                documentation: 'GET请求\n\n示例:\nV8.Get("/api/xxx", {}, function(result) {});',
                insertText: "Get",
                snippet: 'Get("${1:/api/xxx}", {}, function(result) {\n\t${2:// 处理结果}\n})'
            },

            // ========== UI交互方法 ==========
            Tips: {
                label: "Tips",
                kind: "Method",
                documentation:
                    '右下角弹出消息提示\n\n参数:\n  - msgContent: 消息内容\n  - success: true(成功,1秒后消失) / false(错误,5秒后消失)\n  - time: 提示框多少秒后消失(可选)\n\n示例:\nV8.Tips("操作成功", true);\nV8.Tips("错误信息", false, 10);',
                insertText: "Tips",
                snippet: 'Tips("${1:message}", ${2:true})'
            },
            ConfirmTips: {
                label: "ConfirmTips",
                kind: "Method",
                documentation:
                    '确认提示框\n\n参数:\n  - message: 确认消息\n  - okCallback: 确认回调\n  - cancelCallback: 取消回调(可选)\n  - option: 选项配置(可选)\n\n示例:\nV8.ConfirmTips("确认删除?", function() {\n  // 确认后的操作\n});',
                insertText: "ConfirmTips",
                snippet: 'ConfirmTips("${1:message}", function() {\n\t${2:// 确认后的操作}\n})'
            },

            // ========== 工具方法 ==========
            IsNull: {
                label: "IsNull",
                kind: "Method",
                documentation: '判断值是否为空\n\n当值为null、undefined、""(空字符串)、"null"、"undefined"时，均返回true\n\n示例:\nif(V8.IsNull(value)) { ... }',
                insertText: "IsNull",
                snippet: "IsNull(${1:value})"
            },
            NewGuid: {
                label: "NewGuid",
                kind: "Method",
                documentation: "生成前端GUID\n\n示例:\nvar newGuid = V8.NewGuid();",
                insertText: "NewGuid",
                snippet: "NewGuid()"
            },
            ChineseToPinyin: {
                label: "ChineseToPinyin",
                kind: "Method",
                documentation:
                    '中文转拼音\n\n参数:\n  - chinese: 中文字符串\n  - fullPyLen: 前几个字转换为全拼音\n  - type: 1(驼峰,默认) / 2(全大写) / 3(全小写)\n\n示例:\nvar pinyin = V8.ChineseToPinyin("你好吾码", 2, 1);',
                insertText: "ChineseToPinyin",
                snippet: 'ChineseToPinyin("${1:中文}", ${2:2}, ${3:1})'
            },

            // ========== Base64加解密 ==========
            Base64: {
                label: "Base64",
                kind: "Module",
                documentation: "Base64编码解码工具",
                insertText: "Base64",
                methods: {
                    encode: {
                        label: "encode",
                        kind: "Method",
                        documentation: "Base64编码",
                        insertText: "encode",
                        snippet: 'encode("${1:str}")'
                    },
                    decode: {
                        label: "decode",
                        kind: "Method",
                        documentation: "Base64解码",
                        insertText: "decode",
                        snippet: 'decode("${1:base64str}")'
                    }
                }
            },

            // ========== 路由和窗口 ==========
            Router: {
                label: "Router",
                kind: "Module",
                documentation: "路由对象",
                insertText: "Router",
                methods: {
                    Push: {
                        label: "Push",
                        kind: "Method",
                        documentation: '页面跳转\n\n示例:\nV8.Router.Push("/notice");',
                        insertText: "Push",
                        snippet: 'Push("${1:/path}")'
                    }
                }
            },
            Window: {
                label: "Window",
                kind: "Module",
                documentation: "窗口对象",
                insertText: "Window",
                methods: {
                    Open: {
                        label: "Open",
                        kind: "Method",
                        documentation: '打开新窗口\n\n示例:\nV8.Window.Open("https://microi.net");',
                        insertText: "Open",
                        snippet: 'Open("${1:url}")'
                    }
                }
            },

            // ========== 工作流 ==========
            WF: {
                label: "WF",
                kind: "Module",
                documentation: "工作流对象(WorkFlow)",
                insertText: "WF",
                methods: {
                    StartWork: {
                        label: "StartWork",
                        kind: "Method",
                        documentation:
                            '发起流程\n\n参数:\n  - FlowDesignId: 流程图Id(必传)\n  - TableRowId: 关联数据Id(必传)\n  - FormData: 表单数据(可选)\n\n示例:\nV8.WF.StartWork({\n  FlowDesignId: "xxx",\n  TableRowId: V8.Form.Id\n}, function(result) {\n  V8.Tips("发起成功!");\n});',
                        insertText: "StartWork",
                        snippet: 'StartWork({\n\tFlowDesignId: "${1:flowId}",\n\tTableRowId: ${2:V8.Form.Id}\n}, function(result) {\n\t${3:// 处理结果}\n})'
                    }
                }
            }
        }
    }
};

/**
 * 生成Monaco编辑器的CompletionItem
 */
export function createV8CompletionItems(monaco, range) {
    const suggestions = [];

    suggestions.push({
        label: V8ApiDefinitions.V8.label,
        kind: monaco.languages.CompletionItemKind.Module,
        documentation: { value: V8ApiDefinitions.V8.documentation },
        insertText: V8ApiDefinitions.V8.insertText,
        range: range
    });

    return suggestions;
}

/**
 * 根据上下文获取V8属性的建议
 */
export function getV8PropertySuggestions(monaco, objectPath, range) {
    const suggestions = [];
    const parts = objectPath.split(".");

    if (parts.length === 1 && parts[0] === "V8") {
        // 获取V8的一级属性
        const properties = V8ApiDefinitions.V8.properties;
        for (const key in properties) {
            const prop = properties[key];
            const kindMap = {
                Property: monaco.languages.CompletionItemKind.Property,
                Method: monaco.languages.CompletionItemKind.Method,
                Module: monaco.languages.CompletionItemKind.Module
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
    } else if (parts.length === 2 && parts[0] === "V8") {
        // 获取二级属性的方法
        const secondLevel = parts[1];
        const property = V8ApiDefinitions.V8.properties[secondLevel];

        if (property && property.methods) {
            for (const key in property.methods) {
                const method = property.methods[key];
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
    }

    return suggestions;
}

export default {
    V8ApiDefinitions,
    createV8CompletionItems,
    getV8PropertySuggestions
};
