<script>
// Vue 3: 需要从 vue 中导入 h 函数
import { h } from "vue";
import { useTagsViewStore } from "@/pinia";

export default {
    created() {
        const { params, query } = this.$route;
        const { path } = params;
        
        // 修复路径拼接，如果 path 已经以 / 开头则不需要再加
        const targetPath = Array.isArray(path) ? '/' + path.join('/') : (path.startsWith('/') ? path : '/' + path);
        
        console.log('[Redirect] 准备跳转到:', targetPath, 'query:', query);
        
        // 🔥 关键修复：使用 nextTick 确保在下一帧执行跳转，避免路由冲突
        this.$nextTick(() => {
            // 延迟一小段时间，确保上一个路由已经完全卸载
            setTimeout(() => {
                this.$router.replace({ path: targetPath, query }).then(() => {
                    console.log('[Redirect] 跳转成功:', targetPath);
                }).catch(err => {
                    if (err.name !== 'NavigationDuplicated') {
                        console.error('[Redirect] 跳转失败:', err);
                    }
                });
            }, 50);
        });
    },
    render() {
        return h("div"); // Vue 3: render 函数需要返回 vnode
    }
};
</script>
