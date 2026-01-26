<template>
    <el-dialog title="流程数据信息" v-model="dialogVisible" width="70%">
        <!-- <el-alert
                title="使用说明"
                type="warning"
                description="以下流程信息可以被存储起来，方便下一次流程加载"
                show-icon
                close-text="知道了"
        >
        </el-alert> -->
        <br />
        <!--codemirror 已禁用 - vue-codemirror 不支持 Vue 3-->
        <pre class="code">{{ FlowDesignModel }}</pre>
    </el-dialog>
</template>

<script>
// vue-codemirror 暂不支持 Vue 3
// import "codemirror/lib/codemirror.css";
// import { codemirror } from "vue-codemirror";
// require("codemirror/mode/javascript/javascript.js");

export default {
    props: {
        data: Object
    },
    data() {
        return {
            dialogVisible: false,
            FlowDesignModel: {},
            options: {
                mode: { name: "javascript", json: true },
                lineNumbers: true
            }
        };
    },
    components: {
        // codemirror  // 已禁用
    },
    methods: {
        init() {
            this.dialogVisible = true;
            this.FlowDesignModel = JSON.stringify(this.data, null, 4).toString();
        }
    }
};
</script>
