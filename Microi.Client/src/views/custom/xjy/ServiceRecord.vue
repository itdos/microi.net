<template>
    <el-card v-if="HasPayload" v-mci-loading="loading" class="box-card">
        <el-empty v-if="!loading && GetformData.length === 0" description="暂无符合条件的服务记录" :image-size="72" />
        <div v-for="(item, index) in GetformData" :key="item.Id || index" class="table-container">
            <table class="service-table" border="1" cellspacing="0">
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
                        <td>{{ item.FinishTime || "-" }}</td>
                        <td>{{ item.Leixing || "-" }}</td>
                        <td>{{ item.Neirong || "-" }}</td>
                        <td>{{ item.ShouhouRY || "-" }}</td>
                    </tr>
                    <tr v-if="HasDeviceImages(item)">
                        <td colspan="4">
                            <div v-for="(device, deviceIndex) in item.ShouhouSPArr" :key="device.Id || deviceIndex" class="shouhou-img-container">
                                <div v-for="(photo, photoIndex) in device.JieguoTP" :key="photo.Id || photo.Path || photoIndex" class="service-image">
                                    <el-image v-if="photo.Path" class="service-image__preview" :src="photo.Path" :preview-src-list="device.JieguoTPArr" preview-teleported>
                                        <template #error>
                                            <div class="service-image__error">图片加载失败</div>
                                        </template>
                                    </el-image>
                                    <div v-else-if="photo.Loading" class="service-image__loading">图片加载中</div>
                                    <div v-if="photo.Path" class="service-image__location">{{ device.AnzhuangWZ || "未填写安装位置" }}</div>
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
    data() {
        return {
            formData: [],
            loading: false,
            loadVersion: 0
        };
    },
    computed: {
        HasPayload() {
            const value = this.DataAppend?.formData;
            return value !== undefined && value !== null && value !== "";
        },
        GetformData() {
            return this.formData;
        }
    },
    watch: {
        "DataAppend.formData": {
            immediate: true,
            handler() {
                this.LoadFormData();
            }
        }
    },
    methods: {
        NormalizeArray(value) {
            if (value === undefined || value === null || value === "") return [];
            if (Array.isArray(value)) return value;
            if (typeof value === "string") {
                try {
                    return this.NormalizeArray(JSON.parse(value));
                } catch (error) {
                    console.warn("服务记录数据不是有效 JSON，已按空数据处理。", error);
                    return [];
                }
            }
            if (typeof value === "object") return [value];
            return [];
        },
        async LoadFormData() {
            const currentVersion = ++this.loadVersion;
            const source = this.NormalizeArray(this.DataAppend?.formData);
            this.loading = true;

            const rows = source.map((row) => {
                const service = row && typeof row === "object" ? { ...row } : {};
                service.ShouhouSPArr = this.NormalizeArray(service.ShouhouSPArr).map((device) => {
                    const normalizedDevice = device && typeof device === "object" ? { ...device } : {};
                    normalizedDevice.JieguoTP = this.NormalizeArray(normalizedDevice.JieguoTP).map((photo) => {
                        const normalizedPhoto = typeof photo === "string" ? { Path: photo } : { ...(photo || {}) };
                        normalizedPhoto.SourcePath = normalizedPhoto.Path || "";
                        normalizedPhoto.Path = "";
                        normalizedPhoto.Loading = Boolean(normalizedPhoto.SourcePath);
                        return normalizedPhoto;
                    });
                    normalizedDevice.JieguoTPArr = [];
                    return normalizedDevice;
                });
                return service;
            });

            if (currentVersion !== this.loadVersion) return;
            // 文字记录是快照的主体，不能被任意一张私有图片的网络请求阻塞。
            this.formData = rows;
            this.loading = false;
            this.ResolveRowsImages(this.formData, currentVersion).catch((error) => {
                console.warn("服务记录图片批量加载失败。", error);
            });
        },
        async ResolveRowsImages(rows, currentVersion) {
            await Promise.all(
                rows.map((service) =>
                    Promise.all(
                        service.ShouhouSPArr.map(async (device) => {
                            const privateFileContext = this.ResolvePrivateFileContext(device);
                            const photos = device.JieguoTP.slice();
                            await Promise.all(
                                photos.map(async (photo) => {
                                    const path = await this.GetServerPath(photo.SourcePath, privateFileContext);
                                    if (currentVersion !== this.loadVersion) return;
                                    photo.Path = path;
                                    photo.Loading = false;
                                    device.JieguoTPArr = device.JieguoTP.map((item) => item.Path).filter(Boolean);
                                })
                            );
                            if (currentVersion !== this.loadVersion) return;
                            device.JieguoTP = device.JieguoTP.filter((photo) => Boolean(photo.Path));
                        })
                    )
                )
            );
        },
        HasDeviceImages(service) {
            return this.NormalizeArray(service?.ShouhouSPArr).some((device) => this.NormalizeArray(device?.JieguoTP).length > 0);
        },
        async GetServerPath(url, privateFileContext) {
            if (!url) return "";
            try {
                return await this.GetPrivateFileUrl(url, privateFileContext);
            } catch (error) {
                console.warn("服务记录图片地址获取失败。", error);
                return "";
            }
        },
        ResolvePrivateFileContext(record) {
            const row = record && typeof record === "object" ? record : {};
            const v8 = this.DataAppend?.V8 || {};
            const v8TableName = String(v8.TableName || "");
            const isTaskDeviceContext = v8TableName.toLowerCase() === "diy_shouhousp";
            const recordContext = row._PrivateFileContext?.JieguoTP || row.PrivateFileContext?.JieguoTP || row._PrivateFileContext || row.PrivateFileContext || {};
            return {
                FormEngineKey: String(recordContext.FormEngineKey || (isTaskDeviceContext ? v8TableName : "diy_shouhousp")),
                FormDataId: String(recordContext.FormDataId || row.Id || ""),
                FieldId: String(recordContext.FieldId || (isTaskDeviceContext ? v8.Field?.JieguoTP?.Id : "") || ""),
                SysMenuId: String(recordContext.SysMenuId || (isTaskDeviceContext ? v8.SysMenuId : "") || "")
            };
        },
        GetPrivateFileUrl(url, privateFileContext) {
            return new Promise((resolve) => {
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
                let settled = false;
                const finish = (path) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    resolve(path || "");
                };
                // DiyCommon.Post 是回调接口；网络异常或回调丢失时必须主动收口，避免图片任务永久悬挂。
                const timeoutId = setTimeout(() => finish(""), 10000);
                try {
                    this.DiyCommon.Post(
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
                            finish(this.DiyCommon.Result(result) ? result.Data : "");
                        },
                        () => finish("")
                    );
                } catch (error) {
                    console.warn("服务记录私有图片请求发起失败。", error);
                    finish("");
                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.table-container {
    margin-bottom: 30px;
}

.table-container:last-child {
    margin-bottom: 0;
}

.service-table {
    width: 100%;
    border-collapse: collapse;
}

thead tr th,
tbody tr td {
    padding: 6px;
    text-align: center;
}

tbody tr td {
    height: 34px;
}

.shouhou-img-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: flex-start;
}

.service-image {
    margin: 15px;
}

.service-image__preview,
.service-image__error,
.service-image__loading {
    width: 150px;
    height: 150px;
}

.service-image__error,
.service-image__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
}

.service-image__location {
    max-width: 150px;
    margin-top: 6px;
    word-break: break-all;
}
</style>
