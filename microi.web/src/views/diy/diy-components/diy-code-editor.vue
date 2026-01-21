<template>
    <div class="monaco-container" :id="'monaco-container-' + ((field && field.Id) || time)">
        <div>
            <i v-if="isMaximum" class="el-icon-close" title="点击缩小" @click="minEditor"></i>
            <i v-else class="el-icon-full-screen" title="点击放大" @click="maxEditor"></i>
        </div>
        <div ref="container" class="monaco-editor" :style="{ height: EditorHeight }"></div>
    </div>
</template>

<script>
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
// 全局导入
// import * as monaco from 'monaco-editor'

// 局部导入需要的功能和依赖
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main";

import { language } from "monaco-editor/esm/vs/basic-languages/javascript/javascript";
// 导入V8 API定义
import { getV8PropertySuggestions, createV8CompletionItems } from './v8-api-definitions';
import { getV8ServerPropertySuggestions, createV8ServerCompletionItems } from './v8-api-server-definitions';

// 获取的关键字
const { keywords } = language;
// 初始化 SQL 代码和表格数据
const tables = {};

// 全局标志位，确保代码提示只注册一次
let completionProviderRegistered = false;
let globalCompletionProvider = null;

// Monaco Editor 中文语言配置
const monacoLanguageZhCN = {
    // 右键菜单
    'editor.action.clipboardCutAction.label': '剪切',
    'editor.action.clipboardCopyAction.label': '复制',
    'editor.action.clipboardPasteAction.label': '粘贴',
    'actions.find.label': '查找',
    'actions.replace.label': '替换',
    'editor.action.selectAll.label': '全选',
    'editor.action.formatDocument.label': '格式化文档',
    'editor.action.commentLine.label': '切换行注释',
    'editor.action.blockComment.label': '切换块注释',
    'editor.action.transformToUppercase.label': '转换为大写',
    'editor.action.transformToLowercase.label': '转换为小写',
    'editor.action.goToDeclaration.label': '转到定义',
    'editor.action.goToReferences.label': '转到引用',
    'editor.action.rename.label': '重命名符号',
    'editor.action.changeAll.label': '更改所有匹配项',
    'editor.action.quickCommand.label': '命令面板',
    'editor.action.quickOutline.label': '转到符号',
    
    // 查找/替换
    'editor.find.findInputPlaceHolder': '查找',
    'editor.find.replaceInputPlaceHolder': '替换',
    'editor.find.matchCase.label': '区分大小写',
    'editor.find.matchWholeWord.label': '全字匹配',
    'editor.find.regex.label': '使用正则表达式',
    'editor.find.closeButton.title': '关闭',
    'editor.find.previousMatchButton.title': '上一个',
    'editor.find.nextMatchButton.title': '下一个',
    'editor.find.replaceButton.title': '替换',
    'editor.find.replaceAllButton.title': '全部替换',
    'editor.find.toggleReplaceButton.title': '切换替换',
    
    // 提示信息
    'editor.contrib.folding.foldAction.label': '折叠',
    'editor.contrib.folding.unfoldAction.label': '展开',
    'editor.contrib.folding.foldAllAction.label': '全部折叠',
    'editor.contrib.folding.unfoldAllAction.label': '全部展开',
    'suggestWidget.loading': '加载中...',
    'suggestWidget.noSuggestions': '无建议',
    
    // 编辑器状态栏
    'editorLightBulb.lightBulbTooltip': '显示修复',
};

//如果要使用from 'monaco-editor'，  下面这些文件，一定要将_languageId到_lazyLoadPromiseReject这5个变量放到LazyLanguageLoader上面提前声明，否则报写法错误。
// import * as monaco from 'monaco-editor';
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/basic-languages/_.contribution.js
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/typescript/tsMode.js
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/json/monaco.contribution.js
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/css/monaco.contribution.js
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/css/cssMode.js
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/json/jsonMode.js

//下面这个文件，一定要将_languageId到_lazyLoadPromiseReject这5个变量放到LazyLanguageLoader上面提前声明，否则报写法错误。
///Users/Work/道斯科技/Microi.net.vue/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/language/typescript/monaco.contribution.js
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
// import 'monaco-editor/esm/vs/editor/contrib/find/findController.js';

// 编辑器适配屏幕缩放
// 手动调用 editorIns.layout() 方法 文档
// 实例化编辑器的时候 automaticLayout 声明为 true文档 （可能有性能问题）
export default {
    name: "diy_code_editor",
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        ModelProps: {},
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        FieldReadonly: {
            type: Boolean,
            default: null
        },
        height: {
            type: String,
            default: function () {
                return "500px";
            }
        },
        field: {
            type: Object,
            default() {
                return {};
            }
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: "" //View
        },
        // V8代码类型: 'client'(前端) 或 'server'(后端)
        v8CodeType: {
            type: String,
            default: 'client',
            validator: function(value) {
                return ['client', 'server'].indexOf(value) !== -1;
            }
        },
        // 主要配置
        editorOptions: {
            type: Object,
            default: function () {
                return {
                    wordBasedSuggestions: true, // 基于单词的自动完成
                    autoIndex: true, // 控制是否开启自动索引。当开启时，编辑器会自动创建索引以加速搜索和语义高亮。
                    // value: '', // 默认值
                    lineNumbers: true, // 是否显示行数
                    theme: "vs-dark", // 编辑器主题
                    lineHeight: 20, // 行高
                    fontSize: 14, // 字体大小
                    tabSize: 2, // 缩进
                    automaticLayout: true, // 是否自适应宽高，设置为true的话会有性能问题
                    autoIndent: true, // 自动布局
                    language: "javascript", // 语言，需要引入相应文件
                    quickSuggestionsDelay: 100, // 代码提示延时（降低延迟）
                    cursorStyle: "line", // 光标样式
                    glyphMargin: true, // 字形边缘
                    wordWrap: "on", // 自动换行
                    contextmenu: true, // 启用右键菜单（重要！）
                    lineDecorationsWidth: 3, // 行号与实际内容间的距离
                    quickSuggestions: true, // 启用智能提示（重要！）
                    renderLineHighlight: "all", // 高亮当前行
                    lineNumbersMinChars: 3, // 显示行号的位数，控制行号显示的宽度
                    folding: true, // 代码折叠
                    minimap: {
                        enabled: true // 显示代码缩略图
                    },
                    formatOnType: true, // 开启实时格式化
                    formatOnPaste: true, // 开启粘贴格式化
                    mouseWheelZoom: true, // 设置是否开启鼠标滚轮缩放功能
                    // 启用更多功能
                    find: {
                        seedSearchStringFromSelection: true, // 从选中文本自动填充搜索框
                        autoFindInSelection: "never"
                    },
                    suggestOnTriggerCharacters: true, // 触发字符时显示建议
                    acceptSuggestionOnEnter: "on", // 按Enter接受建议
                    snippetSuggestions: "top", // 代码片段建议显示在顶部
                    selectOnLineNumbers: true, // 点击行号选中整行
                    roundedSelection: false,
                    readOnly: false, // 是否只读
                    cursorSmoothCaretAnimation: true, // 平滑光标动画
                    scrollBeyondLastLine: false, // 滚动时不超过最后一行
                    smoothScrolling: true, // 平滑滚动
                    links: true, // 启用链接检测
                    colorDecorators: true, // 启用颜色装饰器
                    matchBrackets: "always", // 始终匹配括号
                    bracketPairColorization: {
                        enabled: true // 启用括号配对着色
                    }
                };
            }
        }
    },
    watch: {
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                //当修改代码的时候，这个事件会也会同时触发
                self.ModelValue = self.ModelProps;
                // this.monacoEditor.setValue(self.ModelProps)
            }
        },
        FormMode: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.UpdateInit();
            }
        },
        field: function (newVal, oldVal) {
            var self = this;
            self.UpdateInit();
        }
        // '$route.query.name': {
        //     handler () {
        //         this.monacoEditor && this.monacoEditor.layout()
        //     }
        // },
    },
    beforeDestroy() {
        // 只销毁编辑器实例，不销毁全局共享的提示提供器
        if (this.monacoEditor) {
            this.monacoEditor.dispose();
        }
    },
    data() {
        return {
            time: new Date().getTime(),
            currentModel: this.model,
            ModelValue: "",
            monacoEditor: null,
            isMaximum: false,
            originSize: {
                width: "",
                height: ""
            },
            EditorHeight: ""
        };
    },
    beforeCreate() {},
    created() {},
    mounted() {
        var self = this;
        if (self.field && self.field.Config && self.field.Config.CodeEditor && self.field.Config.CodeEditor.Height) {
            self.EditorHeight = self.field.Config.CodeEditor.Height + "px";
        } else {
            self.EditorHeight = self.height || "500px";
        }
        self.ModelValue = self.ModelProps;
        var options = self.editorOptions;
        options.value = self.ModelValue;
        options.readOnly = self.GetFieldReadOnly(self.field);
        self.$nextTick(function () {
            if (!self.monacoEditor) {
                // 配置TypeScript/JavaScript的智能提示（如果可用）
                if (monaco.languages.typescript && monaco.languages.typescript.javascriptDefaults) {
                    try {
                        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                            target: monaco.languages.typescript.ScriptTarget.ES2016,
                            allowNonTsExtensions: true,
                            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                            module: monaco.languages.typescript.ModuleKind.CommonJS,
                            noEmit: true,
                            typeRoots: ["node_modules/@types"]
                        });

                        // 设置诊断选项
                        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: false,
                            noSyntaxValidation: false
                        });
                    } catch (error) {
                        console.warn('Monaco TypeScript configuration not available:', error);
                    }
                }

                // 创建代码提醒（全局只注册一次，所有编辑器实例共享）
                if (!completionProviderRegistered) {
                    completionProviderRegistered = true;
                    globalCompletionProvider = monaco.languages.registerCompletionItemProvider("javascript", {
                        triggerCharacters: [".", " ", ...keywords],
                        provideCompletionItems: (model, position) => {
                            let suggestions = [];
                            const { lineNumber, column } = position;
                            const textBeforePointer = model.getValueInRange({
                                startLineNumber: lineNumber,
                                startColumn: 0,
                                endLineNumber: lineNumber,
                                endColumn: column
                            });
                            
                            // 创建range对象
                            const word = model.getWordUntilPosition(position);
                            const range = {
                                startLineNumber: position.lineNumber,
                                endLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endColumn: word.endColumn
                            };

                            const words = textBeforePointer.trim().split(/\s+/);
                            const lastWord = words[words.length - 1];

                            // V8引擎API智能提示 - 默认使用客户端提示
                            // 注意: 因为提供器是全局共享的，这里默认使用client模式
                            // 如果需要server模式，建议在编辑器外部通过注释或特殊标记来区分
                            const createItems = createV8CompletionItems;
                            const getPropertySuggestions = getV8PropertySuggestions;
                            
                            // V8 API提示检测（按优先级从高到低）
                            // 1. 检测V8.FormEngine.等多级嵌套（输入V8.FormEngine后按点）
                            if (textBeforePointer.match(/\bV8\.\w+\.$/)) {
                                const match = textBeforePointer.match(/\b(V8\.\w+)\.$/);
                                if (match) {
                                    const objectPath = match[1];
                                    suggestions = [...suggestions, ...getPropertySuggestions(monaco, objectPath, range)];
                                }
                            }
                            // 2. 检测V8.的情况（输入V8后按点）
                            else if (textBeforePointer.match(/\bV8\.$/)) {
                                suggestions = [...suggestions, ...getPropertySuggestions(monaco, 'V8', range)];
                            }
                            // 3. 检测正在输入V8（未输入点号，用于关键字匹配）
                            else if (lastWord === 'V8' || textBeforePointer.match(/\bV8$/)) {
                                suggestions = [...suggestions, ...createItems(monaco, range)];
                            }
                            // 原有的表格字段提示逻辑
                            else if (lastWord.endsWith(".")) {
                                const tableName = lastWord.slice(0, lastWord.length - 1);
                                if (Object.keys(tables).includes(tableName)) {
                                    // 无法访问具体实例的方法，这里返回空数组
                                    // 如需表格字段提示，建议移到编辑器特定的提示逻辑中
                                }
                            } else if (lastWord === ".") {
                                suggestions = [];
                            } else {
                                // 添加JavaScript关键字
                                suggestions = [...suggestions, ...keywords.map((key) => ({
                                    label: key,
                                    kind: monaco.languages.CompletionItemKind.Keyword,
                                    insertText: key,
                                    range: range
                                }))];
                            }

                            return {
                                suggestions
                            };
                        }
                    });
                }
                
                self.monacoEditor = monaco.editor.create(self.$refs.container, options);
                
                // 自定义右键菜单中文化
                self.monacoEditor.addAction({
                    id: 'format-document-zh',
                    label: '格式化文档',
                    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
                    contextMenuGroupId: '1_modification',
                    contextMenuOrder: 1.5,
                    run: function(ed) {
                        ed.getAction('editor.action.formatDocument').run();
                    }
                });

                self.monacoEditor.addAction({
                    id: 'find-zh',
                    label: '查找',
                    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
                    contextMenuGroupId: 'navigation',
                    contextMenuOrder: 1,
                    run: function(ed) {
                        ed.getAction('actions.find').run();
                    }
                });

                self.monacoEditor.addAction({
                    id: 'replace-zh',
                    label: '替换',
                    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
                    contextMenuGroupId: 'navigation',
                    contextMenuOrder: 2,
                    run: function(ed) {
                        ed.getAction('editor.action.startFindReplaceAction').run();
                    }
                });

                self.monacoEditor.addAction({
                    id: 'select-all-zh',
                    label: '全选',
                    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA],
                    contextMenuGroupId: '9_cutcopypaste',
                    contextMenuOrder: 4,
                    run: function(ed) {
                        ed.getAction('editor.action.selectAll').run();
                    }
                });

                self.monacoEditor.addAction({
                    id: 'comment-line-zh',
                    label: '切换行注释',
                    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
                    contextMenuGroupId: '1_modification',
                    contextMenuOrder: 2,
                    run: function(ed) {
                        ed.getAction('editor.action.commentLine').run();
                    }
                });

                self.monacoEditor.onDidChangeModelContent((event) => {
                    var changeContent = this.monacoEditor.getValue();
                    self.$emit("ModelChange", changeContent);
                    //当修改代码的时候，这个事件会也会同时触发
                    self.$emit("CallbackFormValueChange", self.field, changeContent);
                });
            } else {
                self.UpdateInit();
            }
        });
    },
    methods: {
        Init() {
            var self = this;
        },
        /**
         * @description: 获取关键字的补全列表
         *
         */
        getKeywordsSuggest(range) {
            return keywords.map((key) => ({
                label: key,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: key,
                range: range
            }));
        },

        /**
         * @description: 获取表名的补全列表
         */
        getTableSuggest(range) {
            return Object.keys(tables).map((key) => ({
                label: key,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: key,
                range: range
            }));
        },

        /**
         * @description: 根据表名获取字段补全列表
         * @param {*} tableName
         */
        getFieldsSuggest(tableName, range) {
            const fields = tables[tableName];
            if (!fields) {
                return [];
            }
            return fields.map((name) => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: name,
                range: range
            }));
        },
        UpdateInit() {
            var self = this;
            self.ModelValue = self.ModelProps;
            var options = self.editorOptions;
            options.value = self.ModelValue;
            options.readOnly = self.GetFieldReadOnly(self.field);
            self.EditorHeight = self.height || "500px";
            self.$nextTick(function () {
                if (self.monacoEditor) {
                    self.monacoEditor.updateOptions(options);
                    self.monacoEditor.setValue(self.ModelProps);
                }
            });
        },
        GetFieldReadOnly(field) {
            var self = this;
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            // if(field.Component == 'Button'
            //     && field.Config.Button.PreviewCanClick === true
            //     && !field.Readonly
            //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
            //     return false;
            // }
            if (self.FieldReadonly == true) {
                return true;
            }
            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            return field.Readonly ? true : false;
        },
        // 放大
        maxEditor() {
            var self = this;
            try {
                self.EditorHeight = "100%";
                this.isMaximum = true;
                let dom = document.getElementById("monaco-container-" + ((self.field && self.field.Id) || self.time));
                this.originSize = {
                    width: dom.clientWidth,
                    height: "100%" //dom.clientHeight
                };
                dom.classList.add("editor-fullscreen");
                this.monacoEditor.layout({
                    height: "100%", //document.body.clientHeight,
                    width: document.body.clientWidth
                });
            } catch (error) {}
        },
        // 缩小
        minEditor() {
            var self = this;
            self.EditorHeight = self.height || "500px";
            this.isMaximum = false;
            let dom = document.getElementById("monaco-container-" + ((self.field && self.field.Id) || self.time));
            dom.classList.remove("editor-fullscreen");
            this.monacoEditor.layout({
                height: self.EditorHeight, //this.originSize.height,
                width: this.originSize.width
            });
        }
    }
};
</script>

<style lang="scss">
// css操作
.editor-fullscreen {
    position: fixed !important;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100% !important;
    z-index: 3000;
}
.monaco-container {
    width: 100%;
    height: 100%;
    position: relative;
    [class^="el-icon"] {
        font-size: 35px;
        cursor: pointer;
        position: absolute;
        right: 10px;
        top: 0;
        z-index: 1000;
        color: #fff;
    }
    .my-editor {
        width: 100%;
        height: 100%;
        overflow: auto;
    }
    .monaco-editor .scroll-decoration {
        box-shadow: none;
    }
}
</style>
