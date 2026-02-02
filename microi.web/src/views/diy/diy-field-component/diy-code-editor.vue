<template>
    <div class="monaco-container" :id="'monaco-container-' + (field && field.Id) + '-' + RandomValue" :style="{ height: EditorHeight }">
        <div class="monaco-toolbar">
            <div class="toolbar-left">
                <button class="toolbar-btn" @click.prevent="formatCode" title="格式化代码 (Shift+Alt+F)">
                    <el-icon><MagicStick /></el-icon> 格式化
                </button>
                <button class="toolbar-btn" @click.prevent="foldAllCode" title="折叠所有代码">
                    <el-icon><DArrowLeft /></el-icon> 折叠
                </button>
                <button class="toolbar-btn" @click.prevent="findInCode" title="查找">
                    <el-icon><Search /></el-icon> 查找
                </button>
                <button class="toolbar-btn" @click.prevent="showShortcuts" title="快捷键">
                    <el-icon><InfoFilled /></el-icon> 快捷键
                </button>
                <button class="toolbar-btn" @click.prevent="openV8Docs" title="V8引擎文档">
                    <el-icon><Document /></el-icon> V8文档
                </button>
                <button class="toolbar-btn" @click.prevent="increaseFontSize" title="放大">
                    <el-icon><ZoomIn /></el-icon>
                </button>
                <button class="toolbar-btn" @click.prevent="decreaseFontSize" title="缩小">
                    <el-icon><ZoomOut /></el-icon>
                </button>
            </div>
            <div class="toolbar-right">
                <el-icon v-if="isMaximum" title="点击缩小" @click="minEditor"><Close /></el-icon>
                <el-icon v-else title="点击放大" @click="maxEditor"><FullScreen /></el-icon>
            </div>
        </div>
        <div
            :id="'monaco-editor-' + (field && field.Id) + '-' + RandomValue"
            class="monaco-editor"
            :style="{ height: EditorHeight }"
        ></div>

        <!-- 右下角拉伸手柄 -->
        <div 
            v-if="!isMaximum"
            class="resize-handle"
            @mousedown="startResize"
            title="拖动调整大小"
        >
            <el-icon><Rank /></el-icon>
        </div>

        <!-- 快捷键说明弹窗 -->
        <el-dialog title="编辑器快捷键" v-model="shortcutsDialogVisible" width="600px" append-to-body>
            <div class="shortcuts-content">
                <h4>编辑操作</h4>
                <ul class="shortcuts-list">
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>Z</kbd> <span>撤销</span></li>
                    <li><kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>F</kbd> <span>格式化文档</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>F</kbd> <span>查找</span></li>
                    <li><kbd>Cmd/Ctrl</kbd> + <kbd>H</kbd> <span>替换</span></li>
                </ul>
            </div>
        </el-dialog>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            title="代码编辑器配置"
            width="400px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <el-form label-width="100px" label-position="top" size="small">
                <el-form-item label="默认高度">
                    <el-input v-model="configForm.Height" placeholder="500">
                        <template #append>px</template>
                    </el-input>
                </el-form-item>
            </el-form>
            <el-form label-width="100px" label-position="top" size="small">
                <el-form-item label="默认语言">
                    <el-select v-model="configForm.Language" placeholder="javascript">
                        <el-option label="JavaScript" value="javascript"></el-option>
                        <el-option label="JSON" value="json"></el-option>
                        <el-option label="SQL" value="sql"></el-option>
                        <el-option label="HTML" value="html"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="V8代码类型">
                    <el-radio-group v-model="configForm.V8CodeType">
                        <el-radio label="client">客户端</el-radio>
                        <el-radio label="server">服务端</el-radio>
                    </el-radio-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import * as monaco from 'monaco-editor';
import { onMounted, ref, reactive, watch, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';
import { 
    MagicStick, 
    DArrowLeft, 
    Search, 
    InfoFilled, 
    Document, 
    ZoomIn, 
    ZoomOut, 
    Close, 
    FullScreen,
    Rank
} from '@element-plus/icons-vue';
import { getV8PropertySuggestions, createV8CompletionItems } from '../diy-components/v8-api-definitions';
import { getV8ServerPropertySuggestions, createV8ServerCompletionItems } from '../diy-components/v8-api-server-definitions';

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

const emits = defineEmits(['update:modelValue', 'ModelChange', 'CallbackFormValueChange']);
const props = defineProps({
    modelValue: {
        type: String,
    },
    ModelProps: {},
    ReadonlyFields: {
        type: Array,
        default: () => []
    },
    FieldReadonly: {
        type: Boolean,
    },
    height: {
        type: String,
    },
    field: {
        type: Object,
    },
    FormMode: {
        type: String,
    },
    v8CodeType: {
        type: String,
        default: "client"
    }
});

// 监听表单模式变化
const stopFormModeWatch = watch(() => props.FormMode, () => {
    UpdateInit();
});

// 监听字段变化
const stopFieldWatch = watch(() => props.field, () => {
    UpdateInit();
});

// 监听modelValue变化，同步到编辑器
const stopModelValueWatch = watch(() => props.modelValue, (newValue) => {
    if (monacoEditor && newValue !== monacoEditor.getValue()) {
        ModelValue.value = newValue || '';
        monacoEditor.setValue(ModelValue.value);
        // 🔥 设置光标到文本末尾
        nextTick(() => {
            if (monacoEditor) {
                const model = monacoEditor.getModel();
                if (model) {
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineLength(lineCount);
                    monacoEditor.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
                }
            }
        });
    }
});

// 配置 Monaco Editor 环境
self.MonacoEnvironment = {
    getWorker(arg1, label) {
        return new tsWorker();
        if (label === 'json') {
            return new jsonWorker();
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
            return new cssWorker();
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new htmlWorker();
        }
        if (['typescript', 'javascript'].includes(label)) {
            return new tsWorker();
        }
        return new EditorWorker();
    },
};

// 关键：使用 let 而不是 ref
let monacoEditor = null;

// 修复 ID 冲突
const RandomValue = ref(Math.random());

// V8代码提示相关
let completionProviderRegistered = false;
let globalCompletionProvider = null;
const keywords = [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
    'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import',
    'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw',
    'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await',
    'of', 'static', 'get', 'set', 'true', 'false', 'null', 'undefined'
];
const tables = {}; // 可根据需要填充表格数据

onBeforeUnmount(() => {
    // 停止所有watch监听
    if (stopFormModeWatch) stopFormModeWatch();
    if (stopFieldWatch) stopFieldWatch();
    if (stopModelValueWatch) stopModelValueWatch();
    
    // 清理编辑器实例
    if (monacoEditor) {
        monacoEditor.dispose();
        monacoEditor = null;
    }
    
    // 注意: globalCompletionProvider是全局共享的，不在这里清理
    // 只有当所有编辑器实例都销毁时才清理，这里不做处理
});

const EditorHeight = ref(props.height || '500px');
const EditorHeightNum = ref(parseInt(props.height) || 500); // 数值形式的高度，用于拉伸计算
const ModelValue = ref(props.modelValue || props.ModelProps || '');
const shortcutsDialogVisible = ref(false);
const currentFontSize = ref(12);
const isFolded = ref(false);

const EditorOption = reactive({
    theme: 'vs-dark',
    language: 'javascript',
    renderLineHighlight: 'gutter',
    folding: true,
    roundedSelection: false,
    foldingHighlight: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'always',
    disableLayerHinting: true,
    emptySelectionClipboard: true,
    selectionClipboard: true,
    automaticLayout: true,
    codeLens: true,
    scrollBeyondLastLine: false,
    colorDecorators: true,
    accessibilitySupport: 'on',
    lineNumbers: 'on',
    lineNumbersMinChars: 5,
    enableSplitViewResizing: false,
    wordBasedSuggestions: true,
    autoIndex: true,
    lineHeight: 20,
    fontSize: 12,
    tabSize: 2,
    autoIndent: true,
    quickSuggestions: true,
    quickSuggestionsDelay: 500,
    cursorStyle: 'line',
    glyphMargin: true,
    wordWrap: true,
    contextmenu: true,
    lineDecorationsWidth: 0,
    minimap: {
        enabled: true,
    },
    formatOnType: true,
    formatOnPaste: true,
    mouseWheelZoom: true,
    // 强制从左到右显示，解决 RTL 环境下光标位置错误的问题
    rtl: false,
});

onMounted(() => {
    Init();
});

const formatCode = () => {
    if (monacoEditor) {
        monacoEditor.getAction('editor.action.formatDocument').run();
    }
};

const foldAllCode = () => {
    if (monacoEditor) {
        if (isFolded.value) {
            monacoEditor.getAction("editor.unfoldAll").run();
            isFolded.value = false;
        } else {
            monacoEditor.getAction("editor.foldAll").run();
            isFolded.value = true;
        }
    }
};

const findInCode = () => {
    if (monacoEditor) {
        monacoEditor.getAction("actions.find").run();
    }
};

const showShortcuts = () => {
    shortcutsDialogVisible.value = true;
};

const increaseFontSize = () => {
    if (monacoEditor && currentFontSize.value < 40) {
        currentFontSize.value += 1;
        monacoEditor.updateOptions({
            fontSize: currentFontSize.value,
            lineHeight: Math.round(currentFontSize.value * 1.5)
        });
    }
};

const decreaseFontSize = () => {
    if (monacoEditor && currentFontSize.value > 8) {
        currentFontSize.value -= 1;
        monacoEditor.updateOptions({
            fontSize: currentFontSize.value,
            lineHeight: Math.round(currentFontSize.value * 1.5)
        });
    }
};

const openV8Docs = () => {
    const docUrl = props.v8CodeType === "server" 
        ? "https://microi.net/doc/v8-engine/v8-server.html" 
        : "https://microi.net/doc/v8-engine/v8-client.html";
    window.open(docUrl, "_blank");
};

const Init = () => {
    EditorHeight.value = props.height || '500px';
    EditorHeightNum.value = parseInt(EditorHeight.value) || 500;
    EditorOption.value = ModelValue.value;
    EditorOption.readOnly = GetFieldReadOnly(props.field);
    // 从配置中读取语言设置
    if (props.field?.Config?.CodeEditor?.Language) {
        EditorOption.language = props.field.Config.CodeEditor.Language;
    }

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2016,
        allowNonTsExtensions: true,
    });

    // 注册V8代码提示（全局只注册一次，所有编辑器实例共享）
    // 使用组件外部的全局变量确保真正的单例
    if (!window.__monacoV8CompletionRegistered) {
        window.__monacoV8CompletionRegistered = true;
        globalCompletionProvider = monaco.languages.registerCompletionItemProvider('javascript', {
            triggerCharacters: ['.', ' ', ...keywords],
            provideCompletionItems: (model, position) => {
                let suggestions = [];
                const { lineNumber, column } = position;
                const textBeforePointer = model.getValueInRange({
                    startLineNumber: lineNumber,
                    startColumn: 0,
                    endLineNumber: lineNumber,
                    endColumn: column
                });

                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const words = textBeforePointer.trim().split(/\s+/);
                const lastWord = words[words.length - 1];

                // 根据v8CodeType选择对应的提示函数
                const createItems = props.v8CodeType === 'server' 
                    ? createV8ServerCompletionItems 
                    : createV8CompletionItems;
                const getPropertySuggestions = props.v8CodeType === 'server'
                    ? getV8ServerPropertySuggestions
                    : getV8PropertySuggestions;

                // V8 API提示检测
                if (textBeforePointer.match(/\bV8\.\w+\.$/)) {
                    const match = textBeforePointer.match(/\b(V8\.\w+)\.$/);
                    if (match) {
                        const objectPath = match[1];
                        suggestions = [...suggestions, ...getPropertySuggestions(monaco, objectPath, range)];
                    }
                } else if (textBeforePointer.match(/\bV8\.$/)) {
                    suggestions = [...suggestions, ...getPropertySuggestions(monaco, 'V8', range)];
                } else if (lastWord === 'V8' || textBeforePointer.match(/\bV8$/)) {
                    suggestions = [...suggestions, ...createItems(monaco, range)];
                } else if (lastWord.endsWith('.')) {
                    // 表格字段提示逻辑可在此扩展
                } else if (lastWord === '.') {
                    suggestions = [];
                } else {
                    // JavaScript关键字
                    suggestions = [
                        ...suggestions,
                        ...keywords.map((key) => ({
                            label: key,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: key,
                            range: range
                        }))
                    ];
                }

                return { suggestions };
            }
        });
    }

    if (!monacoEditor) {
        monacoEditor = monaco.editor.create(
            document.getElementById('monaco-editor-' + (props.field && props.field.Id) + '-' + RandomValue.value),
            EditorOption
        );
        
        // 🔥 关键修复：强制设置光标位置到文本末尾，解决RTL环境下光标位置错误
        nextTick(() => {
            if (monacoEditor) {
                const model = monacoEditor.getModel();
                if (model) {
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineLength(lineCount);
                    // 设置光标到最后一行的末尾
                    monacoEditor.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
                    // 确保编辑器聚焦
                    // monacoEditor.focus();
                }
            }
        });
        
        // 添加中文右键菜单
        monacoEditor.addAction({
            id: 'format-document-zh',
            label: '格式化文档',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
            contextMenuGroupId: '1_modification',
            contextMenuOrder: 1.5,
            run: function (ed) {
                ed.getAction('editor.action.formatDocument').run();
            }
        });

        monacoEditor.addAction({
            id: 'find-zh',
            label: '查找',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1,
            run: function (ed) {
                ed.getAction('actions.find').run();
            }
        });

        monacoEditor.addAction({
            id: 'replace-zh',
            label: '替换',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 2,
            run: function (ed) {
                ed.getAction('editor.action.startFindReplaceAction').run();
            }
        });

        monacoEditor.addAction({
            id: 'select-all-zh',
            label: '全选',
            contextMenuGroupId: '9_cutcopypaste',
            contextMenuOrder: 4,
            run: function (ed) {
                ed.getAction('editor.action.selectAll').run();
            }
        });

        monacoEditor.addAction({
            id: 'comment-line-zh',
            label: '切换行注释',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
            contextMenuGroupId: '1_modification',
            contextMenuOrder: 2,
            run: function (ed) {
                ed.getAction('editor.action.commentLine').run();
            }
        });
        
        monacoEditor.onDidChangeModelContent(event => {
            var changeContent = monacoEditor.getValue();
            ModelValue.value = changeContent;
            emits('update:modelValue', changeContent);
            emits('ModelChange', changeContent);
            emits('CallbackFormValueChange', props.field, changeContent);
        });
    } else {
        UpdateInit();
    }
};

const UpdateInit = () => {
    EditorHeight.value = props.height || 
        (props.field?.Config?.CodeEditor?.Height 
            ? props.field.Config.CodeEditor.Height + 'px'
            : '500px');
    EditorHeightNum.value = parseInt(EditorHeight.value) || 500;
    EditorOption.value = ModelValue.value;
    EditorOption.readOnly = GetFieldReadOnly(props.field);
    // 从配置中读取语言设置
    if (props.field?.Config?.CodeEditor?.Language) {
        EditorOption.language = props.field.Config.CodeEditor.Language;
    }
    
    if (monacoEditor) {
        monacoEditor.updateOptions(EditorOption);
        // 更新语言
        if (props.field?.Config?.CodeEditor?.Language) {
            const model = monacoEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, props.field.Config.CodeEditor.Language);
            }
        }
        monacoEditor.setValue(ModelValue.value);
        // 🔥 设置光标到文本末尾
        nextTick(() => {
            if (monacoEditor) {
                const model = monacoEditor.getModel();
                if (model) {
                    const lineCount = model.getLineCount();
                    const lastLineLength = model.getLineLength(lineCount);
                    monacoEditor.setPosition({ lineNumber: lineCount, column: lastLineLength + 1 });
                }
            }
        });
    }
};

const GetFieldReadOnly = field => {
    if (props.FieldReadonly == true) {
        return true;
    }
    if (props.FormMode == 'View') {
        return true;
    }
    if (field && props.ReadonlyFields.indexOf(field.Name) > -1) {
        return true;
    }
    return field?.Readonly ? true : false;
};

const isMaximum = ref(false);
const originSize = reactive({
    width: '',
    height: '',
});

const maxEditor = () => {
    try {
        EditorHeight.value = '100%';
        isMaximum.value = true;
        let dom = document.getElementById('monaco-container-' + (props.field && props.field.Id) + '-' + RandomValue.value);
        originSize.width = dom.clientWidth;
        originSize.height = '100%';
        dom.classList.add('editor-fullscreen');
        monacoEditor.layout({
            height: '100%',
            width: document.body.clientWidth,
        });
    } catch (error) {
        console.error(error);
    }
};

const minEditor = () => {
    EditorHeight.value = props.height || '500px';
    EditorHeightNum.value = parseInt(EditorHeight.value) || 500;
    isMaximum.value = false;
    let dom = document.getElementById('monaco-container-' + (props.field && props.field.Id) + '-' + RandomValue.value);
    dom.classList.remove('editor-fullscreen');
    monacoEditor.layout({
        height: EditorHeight.value,
        width: originSize.width,
    });
};

/**
 * 右下角拉伸手柄
 */
const startResize = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = EditorHeightNum.value;
    
    const onMouseMove = (moveEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = Math.max(200, startHeight + deltaY); // 最小高度 200px
        EditorHeightNum.value = newHeight;
        EditorHeight.value = newHeight + 'px';
        
        // 更新编辑器布局
        if (monacoEditor) {
            monacoEditor.layout();
        }
    };
    
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// ==================== 配置弹窗相关 ====================
const configDialogVisible = ref(false);
const configForm = ref({
    Height: '500',
    Language: 'javascript',
    V8CodeType: 'client'
});

const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.CodeEditor) {
        props.field.Config.CodeEditor = {};
    }
    configForm.value = {
        Height: props.field.Config.CodeEditor.Height || '500',
        Language: props.field.Config.CodeEditor.Language || 'javascript',
        V8CodeType: props.field.Config.CodeEditor.V8CodeType || props.v8CodeType || 'client'
    };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.CodeEditor) {
        props.field.Config.CodeEditor = {};
    }
    props.field.Config.CodeEditor.Height = configForm.value.Height;
    props.field.Config.CodeEditor.Language = configForm.value.Language;
    props.field.Config.CodeEditor.V8CodeType = configForm.value.V8CodeType;
    configDialogVisible.value = false;
    // 更新编辑器高度
    EditorHeight.value = configForm.value.Height + 'px';
    EditorHeightNum.value = parseInt(configForm.value.Height) || 500;
    // 更新编辑器语言
    if (monacoEditor) {
        const model = monacoEditor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, configForm.value.Language);
        }
        monacoEditor.layout();
    }
    // 提示保存成功
    const instance = getCurrentInstance();
    const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>

<style lang="scss">
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
    /* 强制 LTR 方向，解决代码显示反向问题 */
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: embed !important;

    .monaco-toolbar {
        display: flex;
        height: 40px;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
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
            padding: 6px 12px;
            height: 32px;
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

            .el-icon {
                font-size: 14px;
            }
        }
    }

    .monaco-editor {
        flex: 1;
        min-height: 0;
        /* 强制 LTR 方向 */
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: embed !important;
    }

    .resize-handle {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(60, 60, 60, 0.8);
        border-radius: 4px;
        z-index: 10;
        
        .el-icon {
            color: #cccccc;
            font-size: 14px;
            transform: rotate(-45deg);
        }
        
        &:hover {
            background: rgba(80, 80, 80, 0.9);
            
            .el-icon {
                color: #ffffff;
            }
        }
    }

    .toolbar-right .el-icon {
        font-size: 20px;
        cursor: pointer;
        color: #cccccc;
        
        &:hover {
            color: #ffffff;
        }
    }
}

.shortcuts-content {
    h4 {
        margin: 15px 0 10px;
        color: #409eff;
        font-size: 14px;

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
                font-family: "Courier New", monospace;
                background: #f5f5f5;
                border: 1px solid #ccc;
                border-radius: 3px;
                margin-right: 4px;
            }

            span {
                margin-left: auto;
                color: #666;
                font-size: 14px;
            }
        }
    }
}
</style>
