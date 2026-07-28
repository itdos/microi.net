<template>
    <el-dialog
        v-model="visible"
        align-center
        draggable
        width="min(920px, calc(100vw - 48px))"
        :close-on-click-modal="false"
        :title="`访问密钥 - ${user?.Name || user?.Account || ''}`"
        @open="loadKeys"
    >
        <el-alert
            title="访问密钥只能收窄帐号现有权限，不能扩大权限。建议看板使用独立的只读帐号。"
            type="warning"
            :closable="false"
            show-icon
            class="mb-3"
        />

        <el-form :model="form" label-width="130px">
            <el-row :gutter="18">
                <el-col :span="12">
                    <el-form-item label="密钥名称" required>
                        <el-input v-model="form.Name" maxlength="200" placeholder="例如：会议室电视看板" />
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                    <el-form-item label="有效期" required>
                        <el-radio-group v-model="form.ExpiryMode">
                            <el-radio-button value="90d">90 天</el-radio-button>
                            <el-radio-button value="custom">自定义</el-radio-button>
                            <el-radio-button value="permanent">永久</el-radio-button>
                        </el-radio-group>
                    </el-form-item>
                </el-col>
                <el-col v-if="form.ExpiryMode === 'custom'" :span="12">
                    <el-form-item label="到期时间" required>
                        <el-date-picker
                            v-model="form.ExpiresAt"
                            type="datetime"
                            value-format="YYYY-MM-DD HH:mm:ss"
                            style="width: 100%"
                        />
                    </el-form-item>
                </el-col>
                <el-col :span="24">
                    <el-form-item label="允许页面路由" required>
                        <el-input
                            v-model="form.AllowedRoutesText"
                            type="textarea"
                            :rows="2"
                            placeholder="/mic/data-dashboard/preview/看板Id；多个路由请换行"
                        />
                    </el-form-item>
                </el-col>
                <el-col :span="24">
                    <el-form-item label="允许读取的表" required>
                        <el-input
                            v-model="form.AllowedTableNamesText"
                            placeholder="多个表用逗号分隔；看板至少填写 mic_data_dashboard"
                        />
                    </el-form-item>
                </el-col>
                <el-col :span="24">
                    <el-form-item label="权限范围">
                        <el-checkbox v-model="form.AllowFormRead" disabled>页面与表单只读</el-checkbox>
                        <el-checkbox v-model="form.AllowApiEngine">运行指定接口引擎</el-checkbox>
                        <el-checkbox v-model="form.AllowDataSource">运行指定数据源引擎</el-checkbox>
                        <el-checkbox v-model="form.AllowFileRead">读取文件</el-checkbox>
                        <el-checkbox v-model="form.AllowFormWrite">允许表单写入（高风险）</el-checkbox>
                    </el-form-item>
                </el-col>
                <el-col v-if="form.AllowApiEngine" :span="24">
                    <el-form-item label="接口引擎Key">
                        <el-input v-model="form.AllowedApiEngineKeysText" placeholder="多个 Key 用逗号分隔" />
                    </el-form-item>
                </el-col>
                <el-col v-if="form.AllowDataSource" :span="24">
                    <el-form-item label="数据源引擎Key">
                        <el-input v-model="form.AllowedDataSourceKeysText" placeholder="多个 Key 用逗号分隔" />
                    </el-form-item>
                </el-col>
                <el-col :span="24">
                    <el-form-item label="备注">
                        <el-input v-model="form.Remark" type="textarea" :rows="2" />
                    </el-form-item>
                </el-col>
            </el-row>
        </el-form>

        <div class="toolbar">
            <el-button type="primary" :loading="creating" @click="createKey">创建访问密钥</el-button>
            <span>入口：系统管理 → 用户管理 → 用户行【访问密钥】；可选 90 天、自定义或永久。</span>
        </div>

        <el-table :data="keys" v-loading="loading" border stripe>
            <el-table-column prop="Name" label="名称" min-width="150" />
            <el-table-column prop="KeyPrefix" label="密钥前缀" min-width="160" />
            <el-table-column label="到期时间" width="175">
                <template #default="{ row }">{{ row.ExpiresAt || "永久" }}</template>
            </el-table-column>
            <el-table-column label="状态" width="95">
                <template #default="{ row }">
                    <el-tag :type="row.State === 1 && !isExpired(row) ? 'success' : 'info'">
                        {{ row.State === 2 ? "已吊销" : isExpired(row) ? "已过期" : "启用" }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="UseCount" label="使用次数" width="95" />
            <el-table-column prop="LastUsedAt" label="最后使用" width="175" />
            <el-table-column label="操作" fixed="right" width="90">
                <template #default="{ row }">
                    <el-button
                        v-if="row.State !== 2"
                        type="danger"
                        link
                        @click="revokeKey(row)"
                    >
                        吊销
                    </el-button>
                </template>
            </el-table-column>
        </el-table>

        <el-dialog
            v-model="showCreated"
            align-center
            draggable
            width="min(720px, calc(100vw - 48px))"
            title="访问密钥已创建"
            append-to-body
            :close-on-click-modal="false"
        >
            <el-alert
                title="完整密钥只显示这一次。请复制链接后关闭窗口，平台无法再次查看明文。"
                type="success"
                :closable="false"
                show-icon
            />
            <el-form label-width="90px" class="created-result">
                <el-form-item label="完整密钥">
                    <el-input v-model="created.AccessKey" readonly type="textarea" :rows="2" />
                </el-form-item>
                <el-form-item label="自动登录URL">
                    <el-input v-model="created.LoginUrl" readonly type="textarea" :rows="4" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="copyText(created.AccessKey)">复制密钥</el-button>
                <el-button type="primary" @click="copyText(created.LoginUrl)">复制自动登录URL</el-button>
            </template>
        </el-dialog>
    </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { DiyCommon } from "@/utils/microi.net.import";

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    user: { type: Object, default: () => ({}) }
});
const emit = defineEmits(["update:modelValue"]);
const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value)
});
const loading = ref(false);
const creating = ref(false);
const keys = ref([]);
const showCreated = ref(false);
const created = reactive({ AccessKey: "", LoginUrl: "" });

function formatDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function newForm() {
    return {
        Name: "",
        ExpiryMode: "90d",
        ExpiresAt: formatDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
        AllowedRoutesText: "",
        AllowedTableNamesText: "mic_data_dashboard",
        AllowedApiEngineKeysText: "",
        AllowedDataSourceKeysText: "",
        AllowFormRead: true,
        AllowFormWrite: false,
        AllowApiEngine: false,
        AllowDataSource: false,
        AllowFileRead: false,
        Remark: ""
    };
}

const form = reactive(newForm());
function resetForm() {
    Object.assign(form, newForm());
}

function splitValues(value) {
    return String(value || "")
        .split(/[,;\r\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function isExpired(row) {
    return row?.ExpiresAt && new Date(String(row.ExpiresAt).replace(" ", "T")).getTime() <= Date.now();
}

async function loadKeys() {
    if (!props.user?.Id) return;
    loading.value = true;
    try {
        const result = await DiyCommon.PostAsync(
            "/api/SysUserAccessKey/List",
            { TargetUserId: props.user.Id },
            null,
            null,
            "json"
        );
        keys.value = result?.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
        if (result?.Code !== 1) ElMessage.error(result?.Msg || "读取访问密钥失败");
    } finally {
        loading.value = false;
    }
}

async function createKey() {
    const routes = splitValues(form.AllowedRoutesText);
    const tables = splitValues(form.AllowedTableNamesText);
    if (!form.Name.trim() || routes.length === 0 || tables.length === 0) {
        ElMessage.warning("请填写密钥名称、允许页面路由和允许读取的表。");
        return;
    }
    if (form.ExpiryMode === "custom" && !form.ExpiresAt) {
        ElMessage.warning("请选择自定义到期时间。");
        return;
    }
    const scopes = ["page:open", "form:read"];
    if (form.AllowFormWrite) scopes.push("form:write");
    if (form.AllowApiEngine) scopes.push("api-engine:run");
    if (form.AllowDataSource) scopes.push("data-source:run");
    if (form.AllowFileRead) scopes.push("file:read");

    creating.value = true;
    try {
        const result = await DiyCommon.PostAsync(
            "/api/SysUserAccessKey/Create",
            {
                TargetUserId: props.user.Id,
                Name: form.Name.trim(),
                Permanent: form.ExpiryMode === "permanent",
                ExpiresAt: form.ExpiryMode === "permanent"
                    ? ""
                    : form.ExpiryMode === "90d"
                        ? formatDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
                        : form.ExpiresAt,
                Scopes: scopes,
                AllowedRoutes: routes,
                AllowedTableNames: tables,
                AllowedApiEngineKeys: splitValues(form.AllowedApiEngineKeysText),
                AllowedDataSourceKeys: splitValues(form.AllowedDataSourceKeysText),
                Remark: form.Remark
            },
            null,
            null,
            "json"
        );
        if (result?.Code !== 1 || !result.Data) {
            ElMessage.error(result?.Msg || "创建访问密钥失败");
            return;
        }
        const basePath = window.location.pathname.endsWith("/")
            ? window.location.pathname
            : window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        created.AccessKey = result.Data.AccessKey;
        created.LoginUrl = window.location.origin
            + basePath
            + String(result.Data.LoginPath || "").replace(/^\/?#/, "#");
        showCreated.value = true;
        resetForm();
        await loadKeys();
    } finally {
        creating.value = false;
    }
}

async function revokeKey(row) {
    await ElMessageBox.confirm(`确认立即吊销访问密钥“${row.Name}”吗？`, "吊销访问密钥", {
        type: "warning"
    });
    const result = await DiyCommon.PostAsync(
        "/api/SysUserAccessKey/Revoke",
        { Id: row.Id },
        null,
        null,
        "json"
    );
    if (result?.Code === 1) {
        ElMessage.success("访问密钥已吊销");
        await loadKeys();
    } else {
        ElMessage.error(result?.Msg || "吊销失败");
    }
}

async function copyText(value) {
    try {
        await navigator.clipboard.writeText(String(value || ""));
        ElMessage.success("已复制");
    } catch (_) {
        ElMessage.warning("浏览器未允许自动复制，请手动选择文本复制。");
    }
}
</script>

<style scoped>
.mb-3 {
    margin-bottom: 18px;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 4px 0 18px;
    color: var(--el-text-color-secondary);
}

.created-result {
    margin-top: 20px;
}
</style>
