<template>
  <div class="monaco-container" :id="'monaco-container-' + field.Id">
    <div>
      <i
        v-if="isMaximum"
        class="el-icon-close"
        title="点击缩小"
        @click="minEditor"
      ></i>
      <i
        v-else
        class="el-icon-full-screen"
        title="点击放大"
        @click="maxEditor"
      ></i>
    </div>
    <div
      ref="container"
      class="monaco-editor"
      :style="{ height: EditorHeight }"
    ></div>
  </div>
</template>

<script>
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
// 全局导入
// import * as monaco from 'monaco-editor'

// 局部导入需要的功能和依赖
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main";

import { language } from "monaco-editor/esm/vs/basic-languages/javascript/javascript";
// 获取的关键字
const { keywords } = language;
// 初始化 SQL 代码和表格数据
const tables = {};

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
    event: "ModelChange",
  },
  props: {
    ModelProps: {},
    ReadonlyFields: {
      type: Array,
      default: () => [],
    },
    FieldReadonly: {
      type: Boolean,
      default: null,
    },
    height: {
      type: String,
      default: function () {
        return "500px";
      },
    },
    field: {
      type: Object,
      default() {
        return {};
      },
    },
    //表单模式Add、Edit、View
    FormMode: {
      type: String,
      default: "", //View
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
          fontSize: 12,
          tabSize: 2, // 缩进
          automaticLayout: true, // 是否自适应宽高，设置为true的话会有性能问题
          autoIndent: true, //自动布局
          language: "javascript", // 语言，需要引入相应文件
          quickSuggestionsDelay: 500, //代码提示延时
          cursorStyle: "line", //光标样式
          glyphMargin: true, //字形边缘
          wordWrap: true, //'on',//自动换行
          contextmenu: false, //右键菜单
          lineDecorationsWidth: 0, // 行号与实际内容间的距离
          quickSuggestions: false, //智能提示
          renderLineHighlight: false, //选中行外部边框
          minimap: { enabled: false }, //是否显示索引地图
          lineNumbersMinChars: 3, //显示行号的位数，控制行号显示的宽度
          folding: true, //代码折叠
          minimap: {
            enabled: true, //是否代码代码缩略图
          },
          formatOnType: true, // 开启实时格式化
          formatOnPaste: true, // 开启粘贴格式化
          mouseWheelZoom: true, //设置是否开启鼠标滚轮缩放功能
        };
      },
    },
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
    },
    // '$route.query.name': {
    //     handler () {
    //         this.monacoEditor && this.monacoEditor.layout()
    //     }
    // },
  },
  beforeDestroy() {},
  data() {
    return {
      currentModel: this.model,
      ModelValue: "",
      monacoEditor: null,
      isMaximum: false,
      originSize: {
        width: "",
        height: "",
      },
      EditorHeight: "",
    };
  },
  beforeCreate() {},
  created() {},
  mounted() {
    var self = this;
    self.EditorHeight = self.height || "500px";

    self.ModelValue = self.ModelProps;
    var options = self.editorOptions;
    options.value = self.ModelValue;
    options.readOnly = self.GetFieldReadOnly(self.field);
    self.$nextTick(function () {
      if (!self.monacoEditor) {
        // 创建代码提醒
        monaco.languages.registerCompletionItemProvider("javascript", {
          triggerCharacters: ["V8.", ".", " ", ...keywords],
          provideCompletionItems: (model, position) => {
            let suggestions = [];
            const { lineNumber, column } = position;
            const textBeforePointer = model.getValueInRange({
              startLineNumber: lineNumber,
              startColumn: 0,
              endLineNumber: lineNumber,
              endColumn: column,
            });
            const words = textBeforePointer.trim().split(/\s+/);
            const lastWord = words[words.length - 1];

            if (lastWord.endsWith(".")) {
              console.log("code-1");
              const tableName = lastWord.slice(0, lastWord.length - 1);
              if (Object.keys(tables).includes(tableName)) {
                suggestions = [...self.getFieldsSuggest(tableName)];
              }
            } else if (lastWord === ".") {
              console.log("code-2");
              suggestions = [];
            } else {
              console.log("code-3");
              suggestions = [
                ...self.getTableSuggest(),
                ...self.getKeywordsSuggest(),
              ];
            }

            return {
              suggestions,
            };
          },
        });
        self.monacoEditor = monaco.editor.create(self.$refs.container, options);
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
    getKeywordsSuggest() {
      return keywords.map((key) => ({
        label: key,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: key,
      }));
    },

    /**
     * @description: 获取表名的补全列表
     */
    getTableSuggest() {
      return Object.keys(tables).map((key) => ({
        label: key,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: key,
      }));
    },

    /**
     * @description: 根据表名获取字段补全列表
     * @param {*} tableName
     */
    getFieldsSuggest(tableName) {
      const fields = tables[tableName];
      if (!fields) {
        return [];
      }
      return fields.map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: name,
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
        let dom = document.getElementById("monaco-container-" + this.field.Id);
        this.originSize = {
          width: dom.clientWidth,
          height: "100%", //dom.clientHeight
        };
        dom.classList.add("editor-fullscreen");
        this.monacoEditor.layout({
          height: "100%", //document.body.clientHeight,
          width: document.body.clientWidth,
        });
      } catch (error) {
        debugger;
      }
    },
    // 缩小
    minEditor() {
      var self = this;
      self.EditorHeight = self.height || "500px";
      this.isMaximum = false;
      let dom = document.getElementById("monaco-container-" + this.field.Id);
      dom.classList.remove("editor-fullscreen");
      this.monacoEditor.layout({
        height: self.EditorHeight, //this.originSize.height,
        width: this.originSize.width,
      });
    },
  },
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
