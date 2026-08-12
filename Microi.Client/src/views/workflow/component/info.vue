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
        <pre class="code">{{ FlowDesignModel }}</pre>
    </el-dialog>
</template>

<script>
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
    methods: {
        init() {
            this.dialogVisible = true;
            this.FlowDesignModel = JSON.stringify(this.data, null, 4).toString();
        }
    }
};
</script>
