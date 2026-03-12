<template>
    <!-- Mini模式：只显示一个按钮，点击弹出编辑器 -->
    <div v-if="CodeEditorMini" class="code-editor-mini">
        <el-button type="primary" :icon="Edit" @click="openMiniEditor">
            编辑代码{{ miniCodeLength }}
        </el-button>

        <el-dialog
            v-if="miniEditorVisible"
            v-model="miniEditorVisible"
            title="编辑代码"
            width="80%"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
            draggable
            align-center
        >
            <div class="monaco-container" :class="{ 'ai-panel-open': aiPanelVisible }" :id="'monaco-container-' + (field && field.Id) + '-' + RandomValue" :style="{ height: EditorHeight }">
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
                        <button class="toolbar-btn ai-btn" :class="{ active: aiPanelVisible }" @click.prevent="toggleAiPanel" title="AI编程助手">
                            <el-icon><ChatDotSquare /></el-icon> AI编程
                        </button>
                    </div>
                </div>
                <div class="editor-body">
                    <div class="editor-main">
                        <div
                            :id="'monaco-editor-' + (field && field.Id) + '-' + RandomValue"
                            class="monaco-editor"
                            :style="{ height: EditorHeight }"
                        ></div>
                    </div>

                    <!-- AI 聊天面板 -->
                    <transition name="ai-slide">
                        <AiChatPanel
                            v-if="aiPanelVisible"
                            ref="aiPanelRef"
                            :chatMessages="chatMessages"
                            :aiQuestion="aiQuestion"
                            :aiGenerating="aiGenerating"
                            :selectedAiModel="selectedAiModel"
                            :aiModelList="aiModelList"
                            :aiModelLoading="aiModelLoading"
                            @close="aiPanelVisible = false"
                            @update:aiQuestion="v => aiQuestion = v"
                            @update:selectedAiModel="v => selectedAiModel = v"
                            @send="sendAiQuestion"
                            @cancel="cancelAiGeneration"
                            @apply-code="applyCodeToEditor"
                            @use-example="useExample"
                        />
                    </transition>
                </div>
            </div>
            <template #footer>
                <el-button @click="closeMiniEditor">取消</el-button>
                <el-button type="primary" @click="saveMiniEditor">确定</el-button>
            </template>
        </el-dialog>
    </div>

    <!-- 正常模式：完整编辑器 -->
    <div v-else class="monaco-container" :class="{ 'ai-panel-open': aiPanelVisible }" :id="'monaco-container-' + (field && field.Id) + '-' + RandomValue" :style="{ height: EditorHeight }">
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
                <button class="toolbar-btn ai-btn" :class="{ active: aiPanelVisible }" @click.prevent="toggleAiPanel" title="AI编程助手">
                    <el-icon><ChatDotSquare /></el-icon> AI编程
                </button>
            </div>
            <div class="toolbar-right">
                <el-icon v-if="isMaximum" title="点击缩小" @click="minEditor"><Close /></el-icon>
                <el-icon v-else title="点击放大" @click="maxEditor"><FullScreen /></el-icon>
            </div>
        </div>

        <div class="editor-body">
            <!-- 代码编辑器区域 -->
            <div class="editor-main">
                <div
                    :id="'monaco-editor-' + (field && field.Id) + '-' + RandomValue"
                    class="monaco-editor"
                    :style="{ height: EditorHeight }"
                ></div>
            </div>

            <!-- AI 聊天面板 -->
            <transition name="ai-slide">
                <AiChatPanel
                    v-if="aiPanelVisible"
                    ref="aiPanelRef"
                    :chatMessages="chatMessages"
                    :aiQuestion="aiQuestion"
                    :aiGenerating="aiGenerating"
                    :selectedAiModel="selectedAiModel"
                    :aiModelList="aiModelList"
                    :aiModelLoading="aiModelLoading"
                    @close="aiPanelVisible = false"
                    @update:aiQuestion="v => aiQuestion = v"
                    @update:selectedAiModel="v => selectedAiModel = v"
                    @send="sendAiQuestion"
                    @cancel="cancelAiGeneration"
                    @apply-code="applyCodeToEditor"
                    @use-example="useExample"
                />
            </transition>
        </div>

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
            draggable
            align-center
            width="70%"
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
import { onMounted, ref, reactive, computed, watch, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue';

// 动态导入 Monaco Editor（延迟加载，减少首屏体积）
// 使用全局缓存，避免多个组件实例之间的 worker 引用冲突
let monaco = null;

// 异步初始化 Monaco
const initMonaco = async () => {
    // 优先使用全局缓存的 monaco 实例
    if (window.__monacoEditorInstance) {
        monaco = window.__monacoEditorInstance;
        return monaco;
    }
    if (monaco) return monaco;
    
    const [
        monacoModule,
        jsonWorkerModule,
        cssWorkerModule,
        htmlWorkerModule,
        tsWorkerModule,
        editorWorkerModule
    ] = await Promise.all([
        import('monaco-editor'),
        import('monaco-editor/esm/vs/language/json/json.worker?worker'),
        import('monaco-editor/esm/vs/language/css/css.worker?worker'),
        import('monaco-editor/esm/vs/language/html/html.worker?worker'),
        import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
        import('monaco-editor/esm/vs/editor/editor.worker?worker')
    ]);
    
    monaco = monacoModule;
    
    // 将 worker 构造函数存储在全局，确保 MonacoEnvironment.getWorker 始终能正确引用
    if (!window.__monacoWorkers) {
        window.__monacoWorkers = {
            json: jsonWorkerModule.default,
            css: cssWorkerModule.default,
            html: htmlWorkerModule.default,
            ts: tsWorkerModule.default,
            editor: editorWorkerModule.default
        };
    }
    
    // 全局只设置一次 MonacoEnvironment，使用全局 worker 引用
    if (!window.__monacoEnvSet) {
        window.__monacoEnvSet = true;
        globalThis.MonacoEnvironment = {
            getWorker(arg1, label) {
                const w = window.__monacoWorkers;
                if (label === 'json') return new w.json();
                if (label === 'css' || label === 'scss' || label === 'less') return new w.css();
                if (label === 'html' || label === 'handlebars' || label === 'razor') return new w.html();
                if (['typescript', 'javascript'].includes(label)) return new w.ts();
                return new w.editor();
            },
        };
    }
    
    window.__monacoEditorInstance = monaco;
    return monaco;
};
import { getToken } from '@/utils/auth.js';
import AiChatPanel from './AiChatPanel.vue';
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
    Rank,
    ChatDotSquare,
    Edit
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
        // 修复：允许接收多种类型，在组件内部转换为字符串
        type: [String, Object, Number, Array],
        default: ''
    },
    ModelProps: {},
    FormData: {
        type: Object,
        default: () => ({})
    },
    CodeEditorMini: {
        type: Boolean,
        default: false
    },
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
    // 处理对象类型
    let nextValue = newValue;
    if (typeof newValue === 'object' && newValue !== null) {
        try {
            nextValue = JSON.stringify(newValue, null, 2);
        } catch (e) {
            console.error('[CodeEditor] Failed to stringify object in watch:', e);
            nextValue = '';
        }
    } else {
        // 修复：正确处理空值，null/undefined 转为空字符串，其他转为字符串
        nextValue = (newValue === null || newValue === undefined) ? '' : String(newValue);
    }

    // console.log('[CodeEditor] watch modelValue:', {
    //     newValue,
    //     nextValue,
    //     currentEditorValue: monacoEditor ? monacoEditor.getValue() : 'editor not created',
    //     isSelfUpdating,
    //     hasFocus: monacoEditor && monacoEditor.hasTextFocus ? monacoEditor.hasTextFocus() : false
    // });

    // 先更新内部状态
    ModelValue.value = nextValue;

    // 如果编辑器还没创建，只更新内部状态即可
    if (!monacoEditor) {
        console.log('[CodeEditor] editor not created yet, skip setValue');
        return;
    }

    const currentEditorValue = monacoEditor.getValue();
    
    if (nextValue === currentEditorValue) {
        console.log('[CodeEditor] value not changed, skip setValue');
        // 🔥 值相同时重置标志
        isSelfUpdating = false;
        return;
    }

    // 🔥 关键修复：只有当新值等于编辑器当前值时，才是真正的自身更新
    // 如果新值和编辑器当前值不同，即使 isSelfUpdating 为 true，也应该是外部更新
    const wasSelfUpdating = isSelfUpdating;
    isSelfUpdating = false; // 总是重置标志
    
    // 真正的自身更新判断：标志为true 且 新值等于当前值（这种情况在上面已经return了）
    // 如果走到这里，说明新值和当前值不同，即使 wasSelfUpdating 为 true，也是外部更新
    if (wasSelfUpdating && nextValue === currentEditorValue) {
        console.log('[CodeEditor] self updating, skip setValue');
        return;
    }

    // 修复：当要设置为空值时，无论编辑器是否有焦点都应该清空
    // 只有在设置非空值且编辑器有焦点时才阻止更新
    const shouldPreventUpdate = monacoEditor.hasTextFocus 
        && monacoEditor.hasTextFocus() 
        && nextValue !== '' 
        && currentEditorValue !== '';
    
    if (shouldPreventUpdate) {
        console.log('[CodeEditor] editor has focus and content, skip setValue to prevent interruption');
        return;
    }

    console.log('[CodeEditor] updating editor value');
    applyLargeFileOptions(nextValue);
    monacoEditor.setValue(nextValue);
});

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
    
    // 取消 AI 生成
    if (aiAbortController) {
        aiAbortController.abort();
        aiAbortController = null;
    }
    
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

// 修复：确保 ModelValue 始终是字符串类型
const getInitialValue = () => {
    const value = props.modelValue || props.ModelProps || '';
    // 如果是对象，尝试转换为 JSON 字符串
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            console.error('[CodeEditor] Failed to stringify object:', e);
            return '';
        }
    }
    // 确保返回字符串
    return String(value || '');
};

const ModelValue = ref(getInitialValue());
let isSelfUpdating = false;
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
    largeFileOptimizations: true,
    mouseWheelZoom: true,
    // 强制从左到右显示，解决 RTL 环境下光标位置错误的问题
    rtl: false,
});

const LARGE_TEXT_THRESHOLD = 200 * 1024;

const applyLargeFileOptions = (text) => {
    if (!monacoEditor) return;
    const len = (text || '').length;
    if (len >= LARGE_TEXT_THRESHOLD) {
        monacoEditor.updateOptions({
            minimap: { enabled: false },
            wordWrap: 'off',
            codeLens: false,
            colorDecorators: false,
            quickSuggestions: false,
            wordBasedSuggestions: false,
            formatOnType: false,
            formatOnPaste: false,
            renderValidationDecorations: 'off'
        });
    } else {
        monacoEditor.updateOptions({
            minimap: { enabled: true },
            wordWrap: true,
            codeLens: true,
            colorDecorators: true,
            quickSuggestions: true,
            wordBasedSuggestions: true,
            formatOnType: true,
            formatOnPaste: true,
            renderValidationDecorations: 'editable'
        });
    }
};

onMounted(() => {
    // Mini模式下不自动初始化编辑器，等用户点击按钮后再初始化
    if (!props.CodeEditorMini) {
        Init();
    }
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

const Init = async () => {
    // 动态加载 Monaco
    await initMonaco();
    
    EditorHeight.value = props.height || '500px';
    EditorHeightNum.value = parseInt(EditorHeight.value) || 500;
    // 修复：EditorOption 是 reactive对象，不需要 .value
    // EditorOption.value = ModelValue.value;  // 这行是错误的
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
        // 设置初始值到 EditorOption
        EditorOption.value = ModelValue.value;
        
        monacoEditor = monaco.editor.create(
            document.getElementById('monaco-editor-' + (props.field && props.field.Id) + '-' + RandomValue.value),
            EditorOption
        );
        applyLargeFileOptions(ModelValue.value);
        
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
            isSelfUpdating = true;
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
    // 修复：EditorOption 是 reactive对象，不需要 .value
    // EditorOption.value = ModelValue.value;  // 这行是错误的
    EditorOption.readOnly = GetFieldReadOnly(props.field);
    // 从配置中读取语言设置
    if (props.field?.Config?.CodeEditor?.Language) {
        EditorOption.language = props.field.Config.CodeEditor.Language;
    }
    
    if (monacoEditor && monaco) {
        monacoEditor.updateOptions(EditorOption);
        applyLargeFileOptions(ModelValue.value);
        // 更新语言
        if (props.field?.Config?.CodeEditor?.Language) {
            const model = monacoEditor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, props.field.Config.CodeEditor.Language);
            }
        }
        if (!monacoEditor.hasTextFocus || !monacoEditor.hasTextFocus()) {
            if (ModelValue.value !== monacoEditor.getValue()) {
                monacoEditor.setValue(ModelValue.value);
            }
        }
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

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

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
    if (monacoEditor && monaco) {
        const model = monacoEditor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, configForm.value.Language);
        }
        monacoEditor.layout();
    }
    // 提示保存成功
    const instance = getCurrentInstance();
    DiyCommon.Tips('配置已保存', true);
};

// ==================== AI 编程助手 ====================
const aiPanelVisible = ref(false);
const aiQuestion = ref('');
const aiGenerating = ref(false);
const chatMessages = ref([]);
const aiPanelRef = ref(null);
let aiAbortController = null;

// AI 模型选择
const aiModelList = ref([]);
const selectedAiModel = ref(null);
const aiModelLoading = ref(false);

// 加载 AI 模型列表（从 mic_ai 表获取）
const loadAiModelList = async () => {
    try {
        aiModelLoading.value = true;
        const result = await DiyCommon.FormEngine.GetTableData('mic_ai', {
            _OrderBy: 'CreateTime',
            _OrderByType: 'DESC',
            _PageSize: 100
        });
        if (result && result.Code === 1 && result.Data && result.Data.length > 0) {
            aiModelList.value = result.Data;
            // 默认选中第一条模型
            if (!selectedAiModel.value) {
                selectedAiModel.value = result.Data[0];
            }
        }
    } catch (e) {
        console.error('[AI Chat] 加载模型列表失败:', e);
    } finally {
        aiModelLoading.value = false;
    }
};

const toggleAiPanel = () => {
    aiPanelVisible.value = !aiPanelVisible.value;
    if (aiPanelVisible.value) {
        loadAiModelList();
        loadChatHistory();
        nextTick(() => {
            if (monacoEditor) monacoEditor.layout();
        });
    } else {
        nextTick(() => {
            if (monacoEditor) monacoEditor.layout();
        });
    }
};

// 监听面板状态变化，重新布局编辑器
watch(aiPanelVisible, () => {
    nextTick(() => {
        if (monacoEditor) monacoEditor.layout();
    });
});

const formatTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

const scrollToBottom = () => {
    aiPanelRef.value?.scrollToBottom();
};

const useExample = (text) => {
    aiQuestion.value = text;
    sendAiQuestion();
};



// 从AI完整响应中分离自然语言和代码
const parseAiResponse = (text) => {
    if (!text) return { explanation: '', code: '' };
    
    // 匹配所有 ```xxx ... ``` 代码块
    const codeBlockRegex = /```(?:\w*)?\n?([\s\S]*?)```/g;
    let code = '';
    let match;
    
    // 提取所有代码块内容（如有多个则合并）
    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (code) code += '\n\n';
        code += match[1].trim();
    }
    
    // 提取自然语言部分：移除代码块后的剩余内容
    let explanation = text.replace(/```(?:\w*)?\n?[\s\S]*?```/g, '').trim();
    // 收拢多余空行
    explanation = explanation.replace(/\n{3,}/g, '\n\n').trim();
    
    // 如果没找到代码块，可能AI没用围栏，整段当作代码
    if (!code) {
        code = text.trim();
        explanation = '';
    }
    
    // 去除代码中所有空行，保持紧凑
    code = code.replace(/\n{2,}/g, '\n').trim();
    
    return { explanation, code };
};



// 加载聊天历史记录
const loadChatHistory = async () => {
    try {
        const formDataId = props.FormData?.Id;
        const fieldId = props.field?.Id;
        if (!formDataId || !fieldId) return;
        const result = await DiyCommon.FormEngine.GetTableData('mic_ai_record', {
            _Where: [
                ['FormDataId', '=', formDataId],
                ['FieldId', '=', fieldId]
            ],
            _OrderBy: 'CreateTime',
            _OrderByType: 'ASC',
            _PageSize: 200
        });
        
        if (result && result.Code === 1 && result.Data && result.Data.length > 0) {
            // 仅在消息列表为空时加载历史记录（避免重复加载）
            if (chatMessages.value.length === 0) {
                chatMessages.value = result.Data.map(item => {
                    try {
                        const parsed = JSON.parse(item.Content);
                        return parsed;
                    } catch {
                        return {
                            role: 'user',
                            content: item.Content,
                            time: item.CreateTime ? new Date(item.CreateTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '',
                            status: 'done'
                        };
                    }
                });
                scrollToBottom();
            }
        }
    } catch (e) {
        console.error('[AI Chat] 加载历史记录失败:', e);
    }
};

// 保存聊天记录到 mic_ai_record
const saveChatRecord = async (msgObj) => {
    try {
        const formDataId = props.FormData?.Id;
        const fieldId = props.field?.Id;
        if (!formDataId || !fieldId) return;
        
        await DiyCommon.FormEngine.AddFormData('mic_ai_record', {
            FormDataId: formDataId,
            FieldId: fieldId,
            AiModelId: selectedAiModel.value?.Id || '',
            AiModel: selectedAiModel.value?.AiModel || '',
            Content: JSON.stringify(msgObj)
        });
    } catch (e) {
        console.error('[AI Chat] 保存聊天记录失败:', e);
    }
};

// 发送 AI 问题
const sendAiQuestion = async () => {
    const question = aiQuestion.value.trim();
    if (!question || aiGenerating.value) return;
    
    // 添加用户消息
    const userMsg = {
        role: 'user',
        content: question,
        time: formatTime(),
        status: 'done'
    };
    chatMessages.value.push(userMsg);
    saveChatRecord(userMsg);
    scrollToBottom();
    
    // 清空输入
    aiQuestion.value = '';
    aiGenerating.value = true;
    
    // 添加 AI 消息占位
    const aiMsg = reactive({
        role: 'ai',
        content: '',
        time: formatTime(),
        status: 'generating',
        code: '',
        metadata: null
    });
    chatMessages.value.push(aiMsg);
    scrollToBottom();
    
    try {
        const apiBase = DiyCommon.GetApiBase();
        const osClient = DiyCommon.GetOsClient();
        const token = getToken();
        
        aiAbortController = new AbortController();
        
        const response = await fetch(`${apiBase}/api/Ai/NL2V8Engine`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {})
            },
            body: JSON.stringify({
                Question: question,
                AiModelId: selectedAiModel.value?.Id || '',
                AiModel: selectedAiModel.value?.AiModel || '',
                OsClient: osClient
            }),
            signal: aiAbortController.signal
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullCode = '';
        let currentEventType = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的行
            
            for (const line of lines) {
                if (line.startsWith('event:')) {
                    currentEventType = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                    // SSE规范：data:后的第一个空格应被忽略
                    const rawData = line.substring(5);
                    const data = rawData.startsWith(' ') ? rawData.substring(1) : rawData;
                    
                    switch (currentEventType) {
                        case 'message':
                            // 后端SSE每条message是一个token
                            // 当token是换行符\n时，它会被buffer.split('\n')消费，
                            // 导致data为空字符串，因此空data应还原为\n
                            const chunk = data === '' ? '\n' : data;
                            fullCode += chunk;
                            
                            // 在聊天面板实时显示AI响应（打字机效果）
                            aiMsg.content = fullCode;
                            scrollToBottom();
                            break;
                            
                        case 'result':
                            // 最终元数据
                            try {
                                const result = JSON.parse(data);
                                aiMsg.metadata = {
                                    RelevantDocs: result.RelevantDocs || [],
                                    RelevantTables: result.RelevantTables || [],
                                    Source: result.Source || ''
                                };
                            } catch {}
                            break;
                            
                        case 'error':
                            aiMsg.content = data || '生成失败，请稍后重试';
                            aiMsg.status = 'error';
                            aiGenerating.value = false;
                            scrollToBottom();
                            return;
                            
                        case 'done':
                            aiMsg.status = 'done';
                            aiGenerating.value = false;
                            
                            // 分离自然语言和代码
                            const parsed = parseAiResponse(fullCode);
                            const cleanCode = parsed.code;
                            const explanation = parsed.explanation;
                            
                            // 聊天面板显示自然语言说明（如果有的话）
                            aiMsg.content = explanation || '代码生成完成';
                            aiMsg.code = cleanCode;
                            
                            // 纯代码写入编辑器
                            if (cleanCode && monacoEditor) {
                                isSelfUpdating = true;
                                monacoEditor.setValue(cleanCode);
                                ModelValue.value = cleanCode;
                                emits('update:modelValue', cleanCode);
                                emits('ModelChange', cleanCode);
                                emits('CallbackFormValueChange', props.field, cleanCode);
                            }
                            
                            // 保存 AI 回复记录
                            saveChatRecord({
                                role: 'ai',
                                content: aiMsg.content,
                                time: aiMsg.time,
                                status: 'done',
                                code: cleanCode,
                                metadata: aiMsg.metadata
                            });
                            
                            scrollToBottom();
                            DiyCommon.Tips('代码生成完成', true);
                            return;
                    }
                }
            }
        }
        
        // 如果流正常结束但没收到 done 事件
        if (aiMsg.status === 'generating') {
            const parsed = parseAiResponse(fullCode);
            const cleanCode = parsed.code;
            const explanation = parsed.explanation;
            aiMsg.content = cleanCode ? (explanation || '代码生成完成') : '未收到有效响应';
            aiMsg.status = cleanCode ? 'done' : 'error';
            aiMsg.code = cleanCode;
            aiGenerating.value = false;
            if (cleanCode) {
                if (monacoEditor) {
                    monacoEditor.setValue(cleanCode);
                }
                isSelfUpdating = true;
                ModelValue.value = cleanCode;
                emits('update:modelValue', cleanCode);
                emits('ModelChange', cleanCode);
                emits('CallbackFormValueChange', props.field, cleanCode);
                saveChatRecord({
                    role: 'ai',
                    content: aiMsg.content,
                    time: aiMsg.time,
                    status: 'done',
                    code: cleanCode,
                    metadata: aiMsg.metadata
                });
            }
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            aiMsg.content = '已取消生成';
            aiMsg.status = 'error';
        } else {
            aiMsg.content = `生成失败: ${error.message}`;
            aiMsg.status = 'error';
        }
        aiGenerating.value = false;
        scrollToBottom();
    }
};

// 取消 AI 生成
const cancelAiGeneration = () => {
    if (aiAbortController) {
        aiAbortController.abort();
        aiAbortController = null;
    }
    aiGenerating.value = false;
};

// 应用代码到编辑器
const applyCodeToEditor = (code) => {
    if (monacoEditor && code) {
        monacoEditor.setValue(code);
        isSelfUpdating = true;
        ModelValue.value = code;
        emits('update:modelValue', code);
        emits('ModelChange', code);
        emits('CallbackFormValueChange', props.field, code);
        DiyCommon.Tips('代码已应用到编辑器', true);
    }
};



// ==================== Mini 模式 ====================
const miniEditorVisible = ref(false);
let miniEditorBackup = ''; // 打开弹窗时备份的值，用于取消恢复

const miniCodeLength = computed(() => {
    const val = ModelValue.value;
    if (!val) return '';
    const len = String(val).length;
    return len > 0 ? `（${len}字）` : '';
});

// 销毁当前编辑器实例（Mini模式弹窗关闭时调用）
const disposeEditor = () => {
    if (monacoEditor) {
        monacoEditor.dispose();
        monacoEditor = null;
    }
};

const openMiniEditor = () => {
    miniEditorBackup = ModelValue.value;
    miniEditorVisible.value = true;
    nextTick(() => {
        Init();
    });
};

const closeMiniEditor = () => {
    // 取消：恢复备份值
    if (miniEditorBackup !== ModelValue.value) {
        ModelValue.value = miniEditorBackup;
        emits('update:modelValue', miniEditorBackup);
        emits('ModelChange', miniEditorBackup);
        emits('CallbackFormValueChange', props.field, miniEditorBackup);
    }
    disposeEditor();
    miniEditorVisible.value = false;
};

const saveMiniEditor = () => {
    // 确定：保持当前编辑器的值
    disposeEditor();
    miniEditorVisible.value = false;
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
        height: auto;
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

            // AI 编程按钮特殊样式
            &.ai-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-color: #7c6bc4;
                color: #fff;
                font-weight: 500;

                &:hover {
                    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
                    border-color: #9b8dd6;
                    box-shadow: 0 0 12px rgba(102, 126, 234, 0.4);
                }

                &.active {
                    background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
                    border-color: #a78bfa;
                    box-shadow: 0 0 12px rgba(102, 126, 234, 0.5), inset 0 1px 0 rgba(255,255,255,0.15);
                }
            }
        }
    }

    // 编辑器主体区域（编辑器 + AI面板 水平排列）
    .editor-body {
        flex: 1;
        display: flex;
        min-height: 0;
        overflow: hidden;
    }

    .editor-main {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
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

    // ==================== AI 聊天面板样式 ====================
    .ai-chat-panel {
        width: 380px;
        min-width: 380px;
        display: flex;
        flex-direction: column;
        background: #1a1a2e;
        border-left: 1px solid #30305a;
        overflow: hidden;

        .ai-chat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-bottom: 1px solid #30305a;
            flex-shrink: 0;

            .ai-chat-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: #e2e8f0;

                .ai-icon-spark {
                    color: #a78bfa;
                    filter: drop-shadow(0 0 4px rgba(167, 139, 250, 0.5));
                }
            }

            .ai-chat-close {
                font-size: 16px;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;

                &:hover {
                    color: #e2e8f0;
                    background: rgba(255,255,255,0.1);
                }
            }
        }

        .ai-model-selector {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.03);
            border-bottom: 1px solid #30305a;
            flex-shrink: 0;

            .ai-model-label {
                font-size: 12px;
                color: #94a3b8;
                margin-right: 8px;
                white-space: nowrap;
            }

            .ai-model-select {
                flex: 1;

                .el-input__wrapper {
                    background: #242445 !important;
                    border-color: #30305a !important;
                    box-shadow: none !important;
                    border-radius: 6px !important;
                }

                .el-input__inner {
                    color: #e2e8f0 !important;
                    font-size: 12px !important;
                }

                .el-select__caret {
                    color: #94a3b8 !important;
                }

                &:hover .el-input__wrapper {
                    border-color: #667eea !important;
                }
            }
        }

        .ai-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            scroll-behavior: smooth;

            &::-webkit-scrollbar {
                width: 5px;
            }
            &::-webkit-scrollbar-thumb {
                background: rgba(167, 139, 250, 0.3);
                border-radius: 3px;
            }
            &::-webkit-scrollbar-track {
                background: transparent;
            }
        }

        // 欢迎页面
        .ai-welcome {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 30px 16px;
            text-align: center;

            .ai-welcome-icon {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 16px;
                box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
                animation: ai-pulse 2s ease-in-out infinite;

                svg {
                    color: #fff;
                }
            }

            h3 {
                color: #e2e8f0;
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 8px;
            }

            p {
                color: #94a3b8;
                font-size: 13px;
                margin: 0 0 24px;
                line-height: 1.5;
            }

            .ai-welcome-examples {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .ai-example-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                background: rgba(102, 126, 234, 0.08);
                border: 1px solid rgba(102, 126, 234, 0.15);
                border-radius: 8px;
                color: #c4b5fd;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;

                .el-icon {
                    font-size: 14px;
                    color: #a78bfa;
                    flex-shrink: 0;
                }

                &:hover {
                    background: rgba(102, 126, 234, 0.15);
                    border-color: rgba(102, 126, 234, 0.3);
                    color: #ddd6fe;
                    transform: translateX(4px);
                }
            }
        }

        // 消息气泡
        .ai-msg {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
            animation: ai-msg-in 0.3s ease;

            .ai-msg-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;

                &.user-avatar {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    .el-icon { color: #fff; font-size: 14px; }
                }

                &.ai-avatar {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    svg { color: #fff; }
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
                }
            }

            .ai-msg-content {
                flex: 1;
                min-width: 0;
            }

            .ai-msg-text {
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 13px;
                line-height: 1.6;
                word-break: break-all;
                white-space: pre-wrap;
            }

            .ai-msg-time {
                font-size: 11px;
                color: #64748b;
                margin-top: 4px;
                padding-left: 4px;
            }

            .ai-msg-meta {
                margin-top: 8px;
                padding-left: 4px;

                .ai-meta-label {
                    font-size: 11px;
                    color: #94a3b8;
                    margin-bottom: 4px;
                }

                .ai-meta-tag {
                    margin: 2px 4px 2px 0;
                }
            }

            .ai-msg-actions {
                display: flex;
                gap: 4px;
                margin-top: 8px;
                padding-left: 4px;
            }

            // 用户消息
            &.ai-msg-user {
                .ai-msg-text {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: #fff;
                    border-bottom-left-radius: 4px;
                }
            }

            // AI消息
            &.ai-msg-ai {
                .ai-msg-text {
                    background: #242445;
                    color: #e2e8f0;
                    border: 1px solid #30305a;
                    border-bottom-left-radius: 4px;
                }
            }
        }

        .ai-generating-text {
            .ai-cursor-blink {
                animation: ai-blink 1s step-end infinite;
                color: #a78bfa;
                font-weight: bold;
            }
        }

        .ai-error-text {
            color: #f87171 !important;
            .el-icon {
                vertical-align: middle;
                margin-right: 4px;
            }
        }

        // 输入区
        .ai-chat-input {
            padding: 12px 16px;
            border-top: 1px solid #30305a;
            background: #1a1a2e;
            flex-shrink: 0;

            .ai-input-wrapper {
                .el-textarea__inner {
                    background: #242445 !important;
                    border-color: #30305a !important;
                    color: #e2e8f0 !important;
                    border-radius: 10px !important;
                    padding: 10px 14px !important;
                    font-size: 13px !important;
                    resize: none !important;

                    &::placeholder {
                        color: #64748b !important;
                    }

                    &:focus {
                        border-color: #667eea !important;
                        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15) !important;
                    }
                }
            }

            .ai-input-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 8px;

                .ai-input-hint {
                    font-size: 11px;
                    color: #64748b;
                }

                .ai-input-btns {
                    display: flex;
                    gap: 6px;
                }
            }
        }
    }

    // AI 面板展开/收起动画
    .ai-slide-enter-active {
        animation: ai-slide-in 0.3s ease;
    }
    .ai-slide-leave-active {
        animation: ai-slide-in 0.25s ease reverse;
    }
}

@keyframes ai-pulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3); }
    50% { box-shadow: 0 4px 30px rgba(102, 126, 234, 0.5); }
}

@keyframes ai-blink {
    50% { opacity: 0; }
}

@keyframes ai-msg-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes ai-slide-in {
    from { width: 0; min-width: 0; opacity: 0; }
    to { width: 380px; min-width: 380px; opacity: 1; }
}

// Mini模式按钮样式
.code-editor-mini {
    display: inline-block;

    .el-button {
        font-size: 13px;
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
