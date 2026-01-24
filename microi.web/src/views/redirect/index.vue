<script>
// Vue 3: 需要从 vue 中导入 h 函数
import { h } from "vue";

export default {
    created() {
        const { params, query } = this.$route;
        const { path } = params;
        // 修复路径拼接，如果 path 已经以 / 开头则不需要再加
        const targetPath = path.startsWith('/') ? path : '/' + path;
        this.$router.replace({ path: targetPath, query });
    },
    render() {
        return h("div"); // Vue 3: render 函数需要返回 vnode
    }
};
</script>
