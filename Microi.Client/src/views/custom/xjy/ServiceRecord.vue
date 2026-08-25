<template>
    <el-card class="box-card" v-if="DataAppend.formData">
        <!-- <div class="keyword-search">
      {{ DataAppend }}
    </div> -->
        <div class="table-container" v-for="(item, index) in GetformData" :key="index">
            <table style="width: 100%" border="1" cellspacing="0">
                <thead>
                    <tr>
                        <th>服务时间</th>
                        <th>服务项目</th>
                        <th>服务内容</th>
                        <th>服务人员</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>{{ item.FinishTime }}</td>
                        <td>{{ item.Leixing }}</td>
                        <td>{{ item.Neirong }}</td>
                        <td>{{ item.ShouhouRY }}</td>
                    </tr>
                    <tr>
                        <td colspan="4">
                            <div v-for="(item1, index1) in item.ShouhouSPArr" :key="index1" class="shouhou-img-container">
                                <div v-for="(item2, index2) in item1.JieguoTP" :key="index2" style="margin: 15px">
                                    <!-- <img :src="item2.Path" alt=""> -->
                                    <el-image style="width: 150px; height: 150px" :src="item2.Path" :preview-src-list="item1.JieguoTPArr"> </el-image>
                                    <div>{{ item1.AnzhuangWZ }}</div>
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </el-card>
</template>

<script>
export default {
    props: {
        DataAppend: {
            type: Object,
            default: () => ({})
        }
    },
    computed: {
        GetformData() {
            var self = this;
            var formData = self.DataAppend.formData ? JSON.parse(self.DataAppend.formData) : [];
            formData.map((item) => {
                item.ShouhouSPArr.map((item1) => {
                    item1.JieguoTP = JSON.parse(item1.JieguoTP);
                    item1.JieguoTPArr = [];
                    const privateFileContext = self.ResolvePrivateFileContext(item1);
                    item1.JieguoTP.map(async (item2) => {
                        item2.Path = await self.GetServerPath(item2.Path, privateFileContext);
                        item1.JieguoTPArr.push(item2.Path);
                    });
                });
            });
            this.formData = formData;
            return this.formData;
        }
    },
    data() {
        return {
            formData: []
        };
    },
    mounted() {},
    methods: {
        // 处理图片路径 匿名访问的
        async GetServerPath(url, privateFileContext) {
            var self = this;
            var serverPath = await self.GetPrivateFileUrl(url, privateFileContext);
            return serverPath;
        },
        ResolvePrivateFileContext(record) {
            const row = record && typeof record === "object" ? record : {};
            const v8 = this.DataAppend?.V8 || {};
            const v8TableName = String(v8.TableName || "");
            const isTaskDeviceContext = v8TableName.toLowerCase() === "diy_shouhousp";
            const recordContext = row._PrivateFileContext?.JieguoTP
                || row.PrivateFileContext?.JieguoTP
                || row._PrivateFileContext
                || row.PrivateFileContext
                || {};
            return {
                FormEngineKey: String(recordContext.FormEngineKey || (isTaskDeviceContext ? v8TableName : "diy_shouhousp")),
                FormDataId: String(recordContext.FormDataId || row.Id || ""),
                FieldId: String(recordContext.FieldId || (isTaskDeviceContext ? v8.Field?.JieguoTP?.Id : "") || ""),
                SysMenuId: String(recordContext.SysMenuId || (isTaskDeviceContext ? v8.SysMenuId : "") || "")
            };
        },
        GetPrivateFileUrl(url, privateFileContext) {
            return new Promise((resolve) => {
                var self = this;
                const context = privateFileContext || {};
                if (!url || !context.FormEngineKey || !context.FormDataId || !context.FieldId || !context.SysMenuId) {
                    console.warn("服务记录图片缺少受信任的表、记录、字段或菜单上下文，已拒绝签发私有地址。", {
                        FormEngineKey: context.FormEngineKey || "",
                        FormDataId: context.FormDataId || "",
                        FieldId: context.FieldId || "",
                        SysMenuId: context.SysMenuId || ""
                    });
                    resolve("");
                    return;
                }
                self.DiyCommon.Post(
                    "/apiengine/platform-private-file-url",
                    {
                        FilePathName: url,
                        ResourceKind: "FormField",
                        FormEngineKey: context.FormEngineKey,
                        FormDataId: context.FormDataId,
                        FieldId: context.FieldId,
                        SysMenuId: context.SysMenuId
                    },
                    (result) => {
                        if (self.DiyCommon.Result(result)) {
                            resolve(result.Data);
                        } else {
                            resolve("");
                        }
                    }
                );
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.table-container {
    margin-bottom: 30px;
}
thead tr th {
    padding: 6px;
    text-align: center;
}
tbody tr td {
    padding: 6px;
    text-align: center;
    height: 34px;
}
.shouhou-img-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
}
</style>
