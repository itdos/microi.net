<template>
    <div>
        <!-- <div>
      <label>文档服务器地址: </label>
      <input v-model="serverUrl" placeholder="https://net.itdos.net:1021" />
      <button @click="updateServer">更新服务器</button>
    </div> -->
        <!--
    https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/how-it-works/opening-file/
    https://helpcenter.onlyoffice.com/docs/installation/docs-community-install-docker.aspx?_ga=2.51711023.782359554.1594636128-1157782750.1587541027
    -->
        <DynamicOnlyOfficeEditor v-if="Load" :document-server-url="serverUrl" :config="editorConfig" @editor-ready="onEditorReady" />
    </div>
</template>

<script>
import DynamicOnlyOfficeEditor from "./onlyoffice-base.vue";
import { mapGetters, mapState } from "vuex";

export default {
    components: {
        DynamicOnlyOfficeEditor
    },
    computed: {
        ...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
            SysConfig: (state) => state.DiyStore.SysConfig
        }),
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        }
    },
    data() {
        return {
            Load: false,
            serverUrl: "", // 默认地址，可动态修改
            editorConfig: {}
        };
    },
    mounted() {
        var self = this;
        var filePath = self.$route.query.filePath;
        var fileType = "";
        if (filePath) {
            filePath = decodeURIComponent(filePath);
            fileType = self.getFileExtension(filePath);
        }

        self.serverUrl = self.SysConfig.OnlyOfficeApiBase;
        self.editorConfig = {
            document: {
                fileType: fileType,
                key: "document-" + Date.now(),
                title: "查看文档",
                url: filePath,
                permissions: {
                    edit: false,
                    download: true
                }
            },
            // documentType: "word",
            // token : 'nas.OnlyOffice',
            editorConfig: {
                callbackUrl: "https://example.com/url-to-callback.ashx",
                // mode: 'edit',
                lang: "zh-CN",
                user: {
                    id: this.GetCurrentUser.Id,
                    name: this.GetCurrentUser.Name || this.GetCurrentUser.Account
                }
            }
        };
        self.Load = true;
    },
    methods: {
        getFileExtension(url) {
            // 处理URL中的查询参数部分
            const baseUrl = url.split("?")[0];

            // 获取最后一个点后面的部分
            const extension = baseUrl.split(".").pop();

            return extension.toLowerCase();
        },
        updateServer() {
            // 切换服务器地址时会自动重新初始化编辑器
            this.$forceUpdate();
        },
        onEditorReady(editorInstance) {
            console.log("编辑器已准备就绪", editorInstance);
        }
    }
};
</script>
