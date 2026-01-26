<template>
    <div class="monaco-container" :id="'monaco-container-' + ((field && field.Id) || time)"
         :style="{ height: EditorHeight }">
        <div class="monaco-toolbar">
            <div class="toolbar-left">
                <button class="toolbar-btn" @click.prevent="formatCode" title="格式化代码 (Shift+Alt+F)">
                    <i class="el-icon-magic-stick"></i> 格式化
                </button>
                <button class="toolbar-btn" @click.prevent="foldAllCode" title="折叠所有代码 (Cmd/Ctrl+K Cmd/Ctrl+0)">
                    <i class="el-icon-d-arrow-left"></i> 折叠
                </button>
                <button class="toolbar-btn" @click.prevent="findInCode" title="查找 (Cmd/Ctrl+F)">
                    <i class="el-icon-search"></i> 查找/替换
                </button>
                <!-- <button class="toolbar-btn" @click.prevent="replaceInCode" title="替换 (Cmd/Ctrl+H)">
                    <i class="el-icon-edit"></i> 替换
                </button> -->
                <button class="toolbar-btn" @click.prevent="showShortcuts" title="查看快捷键">
                    <i class="el-icon-info"></i> 快捷键
                </button>
                <button class="toolbar-btn" @click.prevent="openV8Docs" title="V8引擎文档">
                    <i class="el-icon-document"></i> V8引擎文档
                </button>
                <button class="toolbar-btn" @click.prevent="openAIProgramming" title="AI编程">
                    <i class="el-icon-document"></i> AI编程
                </button>
                <button class="toolbar-btn" @click.prevent="increaseFontSize" title="放大字体 (Cmd/Ctrl++)">
                    <i class="el-icon-zoom-in"></i> 放大
                </button>
                <button class="toolbar-btn" @click.prevent="decreaseFontSize" title="缩小字体 (Cmd/Ctrl+-)">
                    <i class="el-icon-zoom-out"></i> 缩小
                </button>
            </div>
            <div class="toolbar-right">
                <i v-if="isMaximum" class="el-icon-close" title="点击缩小" @click="minEditor"></i>
                <i v-else class="el-icon-full-screen" title="点击放大" @click="maxEditor"></i>
            </div>
        </div>
        <div ref="container" class="monaco-editor" :style="{ height: EditorHeight }"></div>
        
        <!-- 快捷键说明弹窗 -->
        <el-dialog
            title="编辑器快捷键"
            :visible.sync="shortcutsDialogVisible"
            width="600px"
            append-to-body>
            <div class="shortcuts-content">
                <h4>编辑操作</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> + <kbd>1</kbd> <span>折叠代码到第1层</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> + <kbd>3</kbd> <span>折叠代码到第3层</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> + <kbd>0</kbd> <span>全部代码折叠</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Z</kbd> <span>撤销</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> <span>重做</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>C</kbd> <span>复制</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>X</kbd> <span>剪切</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>V</kbd> <span>粘贴</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>A</kbd> <span>全选</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> <span>删除行</span></li>
                </ul>
                
                <h4>查找替换</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>F</kbd> <span>查找</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd> <span>替换</span></li>
                    <li><kbd>F3</kbd> / <kbd>Cmd/Ctrl</kbd> + <kbd>G</kbd> <span>查找下一个</span></li>
                    <li><kbd>Shift</kbd> + <kbd>F3</kbd> <span>查找上一个</span></li>
                </ul>
                
                <h4>代码编辑</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>F</kbd> <span>格式化文档</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>/</kbd> <span>切换行注释</span></li>
                    <li><kbd>Ctrl</kbd> + <kbd>Space</kbd> <span>触发建议</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> <span>选择所有匹配项</span></li>
                </ul>
                
                <h4>多光标编辑</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Alt</kbd> + <kbd>点击</kbd> <span>添加光标</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>↓/↑</kbd> <span>向下/上添加光标</span></li>
                </ul>
                
                <h4>视图控制</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>滚轮</kbd> <span>缩放字体</span></li>
                </ul>
            </div>
        </el-dialog>
    </div>
</template>

<script>
// 使用完整版 Monaco Editor，支持代码格式化和完整的语言服务
import * as monaco from 'monaco-editor';

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
            EditorHeight: "",
            shortcutsDialogVisible: false, // 快捷键弹窗显示状态
            currentFontSize: 14, // 当前字体大小
            isFolded: false // 代码是否已折叠
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
        // 初始化字体大小
        self.currentFontSize = options.fontSize || 14;
        self.$nextTick(function () {
            if (!self.monacoEditor) {
                // 配置TypeScript/JavaScript的智能提示（如果可用）
                if (monaco.languages.typescript && monaco.languages.typescript.javascriptDefaults) {
                    try {
                        // 添加 V8 引擎全局类型定义
                        const v8GlobalTypes = `
                            declare var V8: any;
                            declare var JSON: any;
                            declare var console: any;
                            declare var Array: any;
                            declare var Object: any;
                            declare var String: any;
                            declare var Number: any;
                            declare var Boolean: any;
                            declare var Date: any;
                            declare var Math: any;
                            declare var Promise: any;
                        `;
                        monaco.languages.typescript.javascriptDefaults.addExtraLib(v8GlobalTypes, 'ts:filename/v8-globals.d.ts');
                        
                        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                            target: monaco.languages.typescript.ScriptTarget.ES2020,
                            allowNonTsExtensions: true,
                            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                            module: monaco.languages.typescript.ModuleKind.CommonJS,
                            noEmit: true,
                            typeRoots: ["node_modules/@types"],
                            // 添加 ES 库支持，提供 JavaScript 内置 API 提示
                            lib: ["ES2020", "DOM"],
                            // 允许在非函数作用域使用 return（适合脚本片段）
                            allowUnreachableCode: true,
                            allowUnusedLabels: true,
                            noImplicitReturns: false,
                            noImplicitAny: false,
                            noUnusedLocals: false,
                            noUnusedParameters: false
                        });

                        // 设置诊断选项 - 关闭语义验证，只保留语法检查
                        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                            noSemanticValidation: true,  // 关闭语义验证（不检查类型、变量定义等）
                            noSyntaxValidation: false,   // 保留语法验证（检查语法错误）
                            diagnosticCodesToIgnore: [1108, 2304, 2552, 2662]  // 忽略特定错误代码：1108=return语句, 2304=找不到名称
                        });
                        
                        // 启用 JavaScript 语言特性
                        monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
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
                    // 不自定义快捷键，使用编辑器默认的 Ctrl/Cmd+A
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
        // 格式化代码
        formatCode() {
            if (this.monacoEditor) {
                const model = this.monacoEditor.getModel();
                if (!model) return;
                
                try {
                    // 尝试使用内置格式化
                    this.monacoEditor.getAction('editor.action.formatDocument').run();
                } catch (error) {
                    // edcore版本没有内置格式化，使用简单的手动格式化
                    console.warn('内置格式化不可用，使用简单格式化');
                    const code = model.getValue();
                    const formatted = this.simpleFormatJS(code);
                    model.setValue(formatted);
                }
            }
        },
        // 简单的JavaScript代码格式化
        simpleFormatJS(code) {
            let formatted = '';
            let indent = 0;
            const indentStr = '  '; // 2个空格缩进
            
            // 移除多余空白
            code = code.trim();
            
            for (let i = 0; i < code.length; i++) {
                const char = code[i];
                const nextChar = code[i + 1];
                const prevChar = code[i - 1];
                
                if (char === '{') {
                    formatted += char;
                    indent++;
                    if (nextChar !== '\n' && nextChar !== '}') {
                        formatted += '\n' + indentStr.repeat(indent);
                    }
                } else if (char === '}') {
                    if (prevChar !== '{' && prevChar !== '\n') {
                        formatted += '\n';
                    }
                    indent--;
                    formatted += indentStr.repeat(indent) + char;
                    if (nextChar && nextChar !== ',' && nextChar !== ';' && nextChar !== '\n') {
                        formatted += '\n' + indentStr.repeat(indent);
                    }
                } else if (char === ',') {
                    formatted += char;
                    // 在对象属性后添加换行
                    if (nextChar !== '\n' && nextChar !== ' ') {
                        formatted += '\n' + indentStr.repeat(indent);
                    } else if (nextChar === ' ') {
                        // 跳过后面的空格
                        while (code[i + 1] === ' ') i++;
                        formatted += '\n' + indentStr.repeat(indent);
                    }
                } else if (char === ':') {
                    formatted += char + ' ';
                    // 跳过冒号后的空格
                    while (code[i + 1] === ' ') i++;
                } else if (char === '\n') {
                    // 跳过多余的换行
                    if (formatted[formatted.length - 1] !== '\n') {
                        formatted += char;
                    }
                } else if (char === ' ') {
                    // 只保留必要的空格
                    if (formatted[formatted.length - 1] !== ' ' && formatted[formatted.length - 1] !== '\n') {
                        formatted += char;
                    }
                } else {
                    formatted += char;
                }
            }
            return formatted.trim();
        },
        // 折叠/展开所有代码
        foldAllCode() {
            if (this.monacoEditor) {
                if (this.isFolded) {
                    // 当前已折叠，执行展开
                    this.monacoEditor.getAction('editor.unfoldAll').run();
                    this.isFolded = false;
                } else {
                    // 当前已展开，执行折叠
                    this.monacoEditor.getAction('editor.foldAll').run();
                    this.isFolded = true;
                }
            }
        },
        // 查找
        findInCode() {
            if (this.monacoEditor) {
                this.monacoEditor.getAction('actions.find').run();
            }
        },
        // 替换
        replaceInCode() {
            if (this.monacoEditor) {
                this.monacoEditor.getAction('editor.action.startFindReplaceAction').run();
            }
        },
        // 显示快捷键说明
        showShortcuts() {
            this.shortcutsDialogVisible = true;
        },
        // 放大字体
        increaseFontSize() {
            if (this.monacoEditor && this.currentFontSize < 40) {
                this.currentFontSize += 1;
                // 同时调整fontSize和lineHeight，保持1.5倍的行高比例
                this.monacoEditor.updateOptions({
                    fontSize: this.currentFontSize,
                    lineHeight: Math.round(this.currentFontSize * 1.5)
                });
            }
        },
        // 缩小字体
        decreaseFontSize() {
            if (this.monacoEditor && this.currentFontSize > 8) {
                this.currentFontSize -= 1;
                // 同时调整fontSize和lineHeight，保持1.5倍的行高比例
                this.monacoEditor.updateOptions({
                    fontSize: this.currentFontSize,
                    lineHeight: Math.round(this.currentFontSize * 1.5)
                });
            }
        },
        // 打开V8引擎文档
        openV8Docs() {
            // 根据v8CodeType打开不同的文档
            const docUrl = this.v8CodeType === 'server' 
                ? 'https://microi.net/doc/v8-engine/v8-server.html' 
                : 'https://microi.net/doc/v8-engine/v8-client.html';
            window.open(docUrl, '_blank');
        },
        openAIProgramming() {
            const aiUrl = 'https://microi.net/doc/v8-engine/ai-apiengine.html';
            window.open(aiUrl, '_blank');
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
    display: flex;
    flex-direction: column;
    
    // 工具栏样式
    .monaco-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 10px;
        background: #1e1e1e;
        border-bottom: 1px solid #3c3c3c;
        flex-shrink: 0;
        
        .toolbar-left {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .toolbar-right {
            display: flex;
            align-items: center;
        }
        
        .toolbar-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 0px 12px;
            background: #2d2d30;
            border: 1px solid #3e3e42;
            color: #cccccc;
            font-size: 13px;
            cursor: pointer;
            border-radius: 3px;
            transition: all 0.2s;
            
            &:hover {
                background: #3e3e42;
                color: #ffffff;
                border-color: #007acc;
            }
            
            i {
                font-size: 14px;
            }
        }
    }
    
    .monaco-editor {
        flex: 1;
        overflow: hidden;
    }
    
    [class^="el-icon"] {
        font-size: 20px;
        cursor: pointer;
        color: #cccccc;
        transition: color 0.2s;
        
        &:hover {
            color: #ffffff;
        }
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

// 快捷键弹窗样式
.shortcuts-content {
    h4 {
        margin: 15px 0 10px;
        color: #409eff;
        font-size: 14px;
        font-weight: 600;
        
        &:first-child {
            margin-top: 0;
        }
    }
    
    .shortcuts-list {
        list-style: none;
        padding: 0;
        margin: 0 0 10px;
        
        li {
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #f0f0f0;
            
            &:last-child {
                border-bottom: none;
            }
            
            kbd {
                color: #000;
                display: inline-block;
                padding: 2px 6px;
                font-size: 12px;
                font-family: 'Courier New', monospace;
                background: #f5f5f5;
                border: 1px solid #ccc;
                border-radius: 3px;
                box-shadow: 0 1px 0 rgba(0,0,0,0.1);
                margin-right: 4px;
            }
            
            span {
                margin-left: auto;
                color: #666;
                font-size: 13px;
            }
        }
    }
}
</style>
