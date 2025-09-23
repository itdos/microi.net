<template>
  <div>
    <!-- 编辑器容器 -->
    <div id="onlyoffice-editor"></div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">ONLYOFFICE编辑器加载中...</div>
    <div v-if="error" class="error">编辑器加载失败: {{ error }}</div>
  </div>
</template>

<script>
export default {
  name: 'DynamicOnlyOfficeEditor',
  props: {
    // 动态文档服务器地址（必传）
    documentServerUrl: {
      type: String,
      required: true
    },
    // 编辑器配置
    config: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      error: null,
      docEditor: null,
      isScriptLoaded: false // 标记脚本是否已加载
    };
  },
  watch: {
    // 监听文档服务器地址变化
    documentServerUrl(newUrl) {
      if (newUrl) {
        this.initOnlyOffice();
      }
    }
  },
  mounted() {
    this.initOnlyOffice();
  },
  beforeDestroy() {
    // 清理
    if (this.docEditor) {
      this.docEditor.destroyEditor();
    }
  },
  methods: {
    async initOnlyOffice() {
      // 确保有服务器地址
      if (!this.documentServerUrl) {
        this.error = '文档服务器地址未提供';
        return;
      }

      // 构造完整的API脚本URL
      const scriptUrl = `${this.documentServerUrl}/web-apps/apps/api/documents/api.js`;
      
      try {
        this.loading = true;
        this.error = null;

        // 动态加载脚本
        await this.loadScript(scriptUrl);
        
        // 脚本加载完成后初始化编辑器
        if (window.DocsAPI) {
          this.initializeEditor();
        } else {
          throw new Error('DocsAPI未正确加载');
        }
        
      } catch (err) {
        this.error = `加载失败: ${err.message}`;
        console.error('ONLYOFFICE初始化错误:', err);
      } finally {
        this.loading = false;
      }
    },

    /**
     * 动态加载脚本的方法
     * 基于搜索结果中的动态加载原理:cite[1]:cite[3]:cite[10]
     */
    loadScript(src) {
      return new Promise((resolve, reject) => {
        // 检查是否已存在相同src的脚本:cite[1]:cite[3]
        const existingScripts = document.querySelectorAll(`script[src="${src}"]`);
        if (existingScripts.length > 0) {
          // 脚本已存在，检查全局变量
          if (window.DocsAPI) {
            resolve();
            return;
          }
        }

        // 创建新的script元素:cite[10]
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = src;
        script.async = true;

        // 加载成功回调
        script.onload = () => {
          this.isScriptLoaded = true;
          resolve();
        };

        // 加载失败回调:cite[10]
        script.onerror = (error) => {
          reject(new Error(`脚本加载失败: ${src}`));
        };

        // 添加到DOM
        document.head.appendChild(script);
      });
    },

    /**
     * 初始化ONLYOFFICE编辑器
     */
    initializeEditor() {
      try {
        // 合并配置
        const editorConfig = {
          width: '100%',
          height: (window.innerHeight - 100) + 'px',
          type: 'desktop',
          ...this.config
        };

        // 初始化编辑器
        this.docEditor = new window.DocsAPI.DocEditor('onlyoffice-editor', editorConfig);
        
        // 触发成功回调
        this.$emit('editor-ready', this.docEditor);
        
      } catch (err) {
        throw new Error(`编辑器初始化失败: ${err.message}`);
      }
    },

    /**
     * 重新加载编辑器（供父组件调用）
     */
    reloadEditor() {
      this.initOnlyOffice();
    }
  }
};
</script>

<style scoped>
.loading, .error {
  padding: 20px;
  text-align: center;
  font-size: 16px;
}

.error {
  color: #f56c6c;
  background-color: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
}
</style>