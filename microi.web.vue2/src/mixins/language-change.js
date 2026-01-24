/**
 * 语言变化 Mixin
 * 用于监听语言变化并重新加载数据
 * 
 * 使用方法：
 * import languageChangeMixin from '@/mixins/language-change'
 * export default {
 *   mixins: [languageChangeMixin],
 *   methods: {
 *     // 必须实现 loadData 方法，用于重新加载数据
 *     loadData() {
 *       // 重新请求接口数据
 *       this.fetchData();
 *     }
 *   }
 * }
 */
export default {
    mounted() {
        // 监听 Vue 事件总线的语言变化事件
        if (this.$root.$eventBus) {
            this.$root.$eventBus.$on('language-changed', this.handleLanguageChange);
        }
        
        // 监听 window 自定义事件
        this.handleWindowLanguageChange = (event) => {
            this.handleLanguageChange(event.detail);
        };
        window.addEventListener('microi-language-changed', this.handleWindowLanguageChange);
        
        // 监听页面数据重新加载事件
        this.handleReloadPageData = () => {
            if (this.loadData && typeof this.loadData === 'function') {
                console.log('页面组件收到重新加载数据事件');
                this.loadData();
            }
        };
        if (this.$root.$eventBus) {
            this.$root.$eventBus.$on('reload-page-data', this.handleReloadPageData);
        }
        window.addEventListener('microi-reload-page-data', this.handleReloadPageData);
    },
    beforeDestroy() {
        // 移除事件监听器
        if (this.$root.$eventBus) {
            if (this.handleLanguageChange) {
                this.$root.$eventBus.$off('language-changed', this.handleLanguageChange);
            }
            if (this.handleReloadPageData) {
                this.$root.$eventBus.$off('reload-page-data', this.handleReloadPageData);
            }
        }
        if (this.handleWindowLanguageChange) {
            window.removeEventListener('microi-language-changed', this.handleWindowLanguageChange);
        }
        if (this.handleReloadPageData) {
            window.removeEventListener('microi-reload-page-data', this.handleReloadPageData);
        }
    },
    methods: {
        handleLanguageChange(data) {
            console.log('组件收到语言变化事件:', data);
            // 如果组件实现了 loadData 方法，则调用它重新加载数据
            if (this.loadData && typeof this.loadData === 'function') {
                console.log('重新加载组件数据...');
                this.loadData();
            } else {
                console.warn('组件未实现 loadData 方法，无法自动重新加载数据');
            }
        }
    }
};
