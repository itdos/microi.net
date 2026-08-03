<template>
    <div class="user-access-key-panel">
        <el-alert
            title="访问密钥只能使用该帐号本来就有的权限，不会把普通帐号变成管理员。建议看板使用独立只读帐号。"
            type="warning"
            :closable="false"
            show-icon
            class="mb-3"
        />

        <el-form :model="form" label-width="112px" class="access-key-form">
            <el-row :gutter="18">
                <el-col :xs="24" :md="12">
                    <el-form-item label="密钥名称" required>
                        <el-input v-model="form.Name" maxlength="200" placeholder="例如：会议室电视看板" />
                    </el-form-item>
                </el-col>
                <el-col :xs="24" :md="12">
                    <el-form-item label="有效期" required>
                        <el-radio-group v-model="form.ExpiryMode">
                            <el-radio-button value="90d">90 天</el-radio-button>
                            <el-radio-button value="custom">自定义</el-radio-button>
                            <el-radio-button value="permanent">永久</el-radio-button>
                        </el-radio-group>
                    </el-form-item>
                </el-col>
                <el-col v-if="form.ExpiryMode === 'custom'" :xs="24" :md="12">
                    <el-form-item label="到期时间" required>
                        <el-date-picker
                            v-model="form.ExpiresAt"
                            type="datetime"
                            value-format="YYYY-MM-DD HH:mm:ss"
                            style="width: 100%"
                        />
                    </el-form-item>
                </el-col>
            </el-row>

            <section class="scope-section">
                <div class="scope-heading">
                    <div>
                        <strong>允许访问哪些页面</strong>
                        <span>按页面名称勾选，不需要填写路由</span>
                    </div>
                    <el-radio-group v-model="form.PageMode" @change="handlePageModeChange">
                        <el-radio-button value="selected">指定页面（推荐）</el-radio-button>
                        <el-radio-button value="all">全部已授权页面</el-radio-button>
                    </el-radio-group>
                </div>

                <template v-if="form.PageMode === 'selected'">
                    <div class="page-tools">
                        <el-input
                            v-model="routeKeyword"
                            clearable
                            placeholder="搜索页面名称"
                            class="page-search"
                        />
                        <el-input
                            v-model="pageUrlInput"
                            clearable
                            placeholder="也可以粘贴完整页面网址"
                            @keyup.enter="addPageUrl"
                        >
                            <template #append>
                                <el-button @click="addPageUrl">添加页面</el-button>
                            </template>
                        </el-input>
                    </div>
                    <div class="check-panel" v-loading="optionLoading">
                        <el-checkbox-group v-model="form.SelectedRoutes" @change="handleRoutesChange">
                            <el-checkbox
                                v-for="option in filteredRouteOptions"
                                :key="option.value"
                                :value="option.value"
                                class="scope-checkbox"
                            >
                                <span class="checkbox-label">{{ option.label }}</span>
                            </el-checkbox>
                        </el-checkbox-group>
                        <el-empty
                            v-if="!optionLoading && filteredRouteOptions.length === 0"
                            description="没有匹配页面，可在上方粘贴完整页面网址"
                            :image-size="52"
                        />
                    </div>
                    <div v-if="customRouteOptions.length" class="custom-routes">
                        <span>已从网址添加：</span>
                        <el-tag
                            v-for="option in customRouteOptions"
                            :key="option.value"
                            closable
                            @close="removeCustomRoute(option.value)"
                        >
                            {{ option.label }}
                        </el-tag>
                    </div>
                </template>
                <el-alert
                    v-else
                    title="允许访问该帐号当前及以后被授权的页面；帐号没有权限的页面仍然打不开。"
                    type="info"
                    :closable="false"
                    show-icon
                />

                <el-form-item label="登录后打开" required class="landing-item">
                    <el-select
                        v-model="form.LandingRoute"
                        filterable
                        allow-create
                        default-first-option
                        placeholder="选择页面；也可粘贴完整页面网址"
                        style="width: 100%"
                        @change="normalizeLandingRoute"
                    >
                        <el-option label="平台首页" value="/" />
                        <el-option
                            v-for="option in landingRouteOptions"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value"
                        />
                    </el-select>
                </el-form-item>
            </section>

            <section class="scope-section">
                <div class="scope-heading">
                    <div>
                        <strong>允许读取哪些数据</strong>
                        <span>仍受该帐号现有表单、部门和行级权限限制</span>
                    </div>
                    <el-radio-group v-model="form.DataMode">
                        <el-radio-button value="all">全部已授权数据（推荐）</el-radio-button>
                        <el-radio-button value="selected">指定表单</el-radio-button>
                    </el-radio-group>
                </div>
                <el-alert
                    v-if="form.DataMode === 'all'"
                    title="无需填写数据库表名；只允许读取该帐号本来有权读取的数据。"
                    type="success"
                    :closable="false"
                    show-icon
                />
                <div v-else class="check-panel table-panel" v-loading="optionLoading">
                    <el-checkbox-group v-model="form.SelectedTables">
                        <el-checkbox
                            v-for="option in tableOptions"
                            :key="option.value"
                            :value="option.value"
                            class="scope-checkbox"
                        >
                            <span class="checkbox-label">{{ option.label }}</span>
                            <small v-if="option.description">{{ option.description }}</small>
                        </el-checkbox>
                    </el-checkbox-group>
                    <el-empty
                        v-if="!optionLoading && tableOptions.length === 0"
                        description="当前菜单没有可选择的关联表单，请使用“全部已授权数据”"
                        :image-size="52"
                    />
                </div>
            </section>

            <el-collapse class="advanced-collapse">
                <el-collapse-item title="高级权限（一般看板无需设置）" name="advanced">
                    <el-form-item label="附加能力">
                        <el-checkbox v-model="form.AllowFormRead" disabled>页面与表单只读</el-checkbox>
                        <el-checkbox v-model="form.AllowApiEngine">运行指定接口引擎</el-checkbox>
                        <el-checkbox v-model="form.AllowDataSource">运行指定数据源引擎</el-checkbox>
                        <el-checkbox v-model="form.AllowFileRead">读取文件</el-checkbox>
                        <el-checkbox v-model="form.AllowFormWrite">允许表单写入（高风险）</el-checkbox>
                    </el-form-item>
                    <el-form-item v-if="form.AllowApiEngine" label="接口引擎 Key">
                        <el-input v-model="form.AllowedApiEngineKeysText" placeholder="多个 Key 用逗号分隔" />
                    </el-form-item>
                    <el-form-item v-if="form.AllowDataSource" label="数据源引擎 Key">
                        <el-input v-model="form.AllowedDataSourceKeysText" placeholder="多个 Key 用逗号分隔" />
                    </el-form-item>
                </el-collapse-item>
            </el-collapse>

            <el-form-item label="备注">
                <el-input v-model="form.Remark" type="textarea" :rows="2" placeholder="可填写设备位置、使用人等信息" />
            </el-form-item>
        </el-form>

        <div class="toolbar">
            <el-button type="primary" :loading="creating" @click="createKey">创建访问密钥</el-button>
            <span>入口：【系统账号】→ 用户行【访问密钥】。密钥创建后只显示一次。</span>
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
                        v-if="row.State === 1 && !isExpired(row)"
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
            width="min(720px, calc(100vw - 32px))"
            title="访问密钥已创建"
            append-to-body
            :close-on-click-modal="false"
            @closed="clearCreated"
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
                <el-form-item label="自动登录 URL">
                    <el-input v-model="created.LoginUrl" readonly type="textarea" :rows="4" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="copyText(created.AccessKey)">复制密钥</el-button>
                <el-button type="primary" @click="copyText(created.LoginUrl)">复制自动登录 URL</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePermissionStore } from "@/pinia";
import { DiyCommon } from "@/utils/microi.net.import";
import {
    ACCESS_KEY_WILDCARD,
    buildAccessLoginUrl,
    normalizeAccessRoute
} from "./user-access-key-utils";

const props = defineProps({
    user: { type: Object, default: () => ({}) },
    DataAppend: { type: Object, default: () => ({}) }
});
const permissionStore = usePermissionStore();
const targetUser = computed(() => {
    if (props.user?.Id) return props.user;
    return props.DataAppend?.User || props.DataAppend?.user || {};
});
const loading = ref(false);
const optionLoading = ref(false);
const creating = ref(false);
const keys = ref([]);
const tableOptions = ref([]);
const routeKeyword = ref("");
const pageUrlInput = ref("");
const customRouteOptions = ref([]);
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
        PageMode: "selected",
        SelectedRoutes: [],
        LandingRoute: "",
        DataMode: "all",
        SelectedTables: [],
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
    routeKeyword.value = "";
    pageUrlInput.value = "";
    customRouteOptions.value = [];
}

function splitValues(value) {
    return String(value || "")
        .split(/[,;\r\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function joinRoutePath(parentPath, routePath) {
    const raw = String(routePath || "").trim();
    if (!raw) return normalizeAccessRoute(parentPath);
    if (raw.startsWith("/")) return normalizeAccessRoute(raw);
    return normalizeAccessRoute(`${String(parentPath || "").replace(/\/$/, "")}/${raw}`);
}

const routeOptions = computed(() => {
    const options = [];
    const seen = new Set();
    const walk = (routes, parentPath = "") => {
        (Array.isArray(routes) ? routes : []).forEach((route) => {
            if (!route) return;
            const path = joinRoutePath(parentPath, route.path);
            const name = String(route.name || "");
            const isSelectable = name.startsWith("menu_")
                && !name.startsWith("menu_grid_")
                && !route.hidden
                && route.Display !== 0
                && route.Display !== "0"
                && path
                && path !== "/"
                && !path.includes("*");
            if (isSelectable && !seen.has(path)) {
                seen.add(path);
                options.push({
                    value: path,
                    label: String(route.meta?.title || route.title || path),
                    diyTableId: String(route.meta?.DiyTableId || "")
                });
            }
            walk(route.children, path);
        });
    };
    walk(permissionStore.addRoutes);
    return options.sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});

const filteredRouteOptions = computed(() => {
    const keyword = routeKeyword.value.trim().toLowerCase();
    if (!keyword) return routeOptions.value;
    return routeOptions.value.filter((item) =>
        item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword));
});

const landingRouteOptions = computed(() => {
    const source = form.PageMode === "all"
        ? routeOptions.value
        : routeOptions.value.filter((item) => form.SelectedRoutes.includes(item.value));
    const combined = [...source, ...customRouteOptions.value];
    return combined.filter((item, index) =>
        item.value !== "/" && combined.findIndex((other) => other.value === item.value) === index);
});

function isExpired(row) {
    return row?.ExpiresAt && new Date(String(row.ExpiresAt).replace(" ", "T")).getTime() <= Date.now();
}

async function loadKeys() {
    if (!targetUser.value?.Id) return;
    loading.value = true;
    try {
        const result = await DiyCommon.PostAsync(
            "/api/SysUserAccessKey/List",
            { TargetUserId: targetUser.value.Id },
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

async function loadTableOptions() {
    optionLoading.value = true;
    try {
        const ids = [...new Set(routeOptions.value.map((item) => item.diyTableId).filter(Boolean))];
        if (ids.length === 0) {
            tableOptions.value = [];
            return;
        }
        const result = await DiyCommon.FormEngine.GetTableData("diy_table", {
            Ids: ids,
            _SelectFields: ["Id", "Name", "Description"],
            _PageIndex: 1,
            _PageSize: Math.max(ids.length, 100)
        });
        const rows = result?.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
        tableOptions.value = rows.map((row) => {
            const pageNames = routeOptions.value
                .filter((item) => item.diyTableId === String(row.Id || ""))
                .map((item) => item.label);
            return {
                value: String(row.Name || ""),
                label: pageNames[0] || row.Description || row.Name,
                description: pageNames.length > 1 ? `关联 ${pageNames.length} 个页面` : ""
            };
        }).filter((item) => item.value);
    } catch (_) {
        tableOptions.value = [];
    } finally {
        optionLoading.value = false;
    }
}

async function handleOpen() {
    resetForm();
    await Promise.all([loadKeys(), loadTableOptions()]);
}

watch(
    () => targetUser.value?.Id,
    (userId) => {
        if (userId) handleOpen();
    },
    { immediate: true }
);

function handlePageModeChange(mode) {
    if (mode === "all" && !form.LandingRoute) form.LandingRoute = "/";
    if (mode === "selected" && form.LandingRoute === "/" && form.SelectedRoutes.length) {
        form.LandingRoute = form.SelectedRoutes[0];
    }
}

function handleRoutesChange() {
    if (!form.SelectedRoutes.length) {
        form.LandingRoute = "";
        return;
    }
    if (!form.SelectedRoutes.includes(normalizeAccessRoute(form.LandingRoute))) {
        form.LandingRoute = form.SelectedRoutes[0];
    }
}

function addPageUrl() {
    const path = normalizeAccessRoute(pageUrlInput.value);
    if (!path || path === ACCESS_KEY_WILDCARD || ["/login", "/access-login"].includes(path)) {
        ElMessage.warning("没有识别出可用页面，请粘贴浏览器中的完整页面网址。");
        return;
    }
    if (!form.SelectedRoutes.includes(path)) form.SelectedRoutes.push(path);
    if (!routeOptions.value.some((item) => item.value === path)
        && !customRouteOptions.value.some((item) => item.value === path)) {
        customRouteOptions.value.push({ value: path, label: path });
    }
    if (!form.LandingRoute) form.LandingRoute = path;
    pageUrlInput.value = "";
}

function removeCustomRoute(path) {
    customRouteOptions.value = customRouteOptions.value.filter((item) => item.value !== path);
    form.SelectedRoutes = form.SelectedRoutes.filter((item) => item !== path);
    handleRoutesChange();
}

function normalizeLandingRoute(value) {
    const path = normalizeAccessRoute(value);
    form.LandingRoute = path === ACCESS_KEY_WILDCARD ? "/" : path;
}

function resolveTenant() {
    return String(
        DiyCommon.GetOsClient()
        || new URLSearchParams(window.location.search).get("OsClient")
        || ""
    ).trim();
}

async function createKey() {
    let routes = form.PageMode === "all"
        ? [ACCESS_KEY_WILDCARD]
        : [...new Set(form.SelectedRoutes.map(normalizeAccessRoute).filter(Boolean))];
    const tables = form.DataMode === "all"
        ? [ACCESS_KEY_WILDCARD]
        : [...new Set(form.SelectedTables.map((item) => String(item || "").trim()).filter(Boolean))];
    let landingRoute = normalizeAccessRoute(form.LandingRoute)
        || (form.PageMode === "all" ? "/" : routes[0]);

    if (!form.Name.trim() || routes.length === 0 || tables.length === 0 || !landingRoute) {
        ElMessage.warning("请填写密钥名称，并选择允许页面、数据范围和登录后打开的页面。");
        return;
    }
    if (form.PageMode === "selected" && !routes.includes(landingRoute)) {
        ElMessage.warning("“登录后打开”必须是已勾选的允许页面。");
        return;
    }
    if (form.ExpiryMode === "custom" && !form.ExpiresAt) {
        ElMessage.warning("请选择自定义到期时间。");
        return;
    }
    if (form.PageMode === "selected") {
        routes = [landingRoute, ...routes.filter((item) => item !== landingRoute)];
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
                TargetUserId: targetUser.value.Id,
                Name: form.Name.trim(),
                Permanent: form.ExpiryMode === "permanent",
                ExpiresAt: form.ExpiryMode === "permanent"
                    ? ""
                    : form.ExpiryMode === "90d"
                        ? formatDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
                        : form.ExpiresAt,
                Scopes: scopes,
                AllowedRoutes: routes,
                RedirectPath: landingRoute,
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
        created.AccessKey = result.Data.AccessKey;
        created.LoginUrl = buildAccessLoginUrl({
            origin: window.location.origin,
            pathname: window.location.pathname,
            osClient: resolveTenant(),
            loginPath: result.Data.LoginPath
        });
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

function clearCreated() {
    created.AccessKey = "";
    created.LoginUrl = "";
}
</script>

<style scoped>
.mb-3 {
    margin-bottom: 18px;
}

.access-key-form {
    max-height: min(58vh, 620px);
    overflow-y: auto;
    padding-right: 6px;
}

.scope-section {
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 10px;
    background: var(--el-fill-color-extra-light);
}

.scope-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
}

.scope-heading strong,
.scope-heading span {
    display: block;
}

.scope-heading strong {
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
}

.scope-heading span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.page-tools {
    display: grid;
    grid-template-columns: minmax(180px, 0.65fr) minmax(320px, 1.35fr);
    gap: 10px;
    margin-bottom: 10px;
}

.check-panel {
    max-height: 176px;
    overflow-y: auto;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background: var(--el-bg-color);
}

.check-panel :deep(.el-checkbox-group) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2px 12px;
}

.scope-checkbox {
    width: 100%;
    min-width: 0;
    margin-right: 0;
}

.scope-checkbox :deep(.el-checkbox__label) {
    min-width: 0;
    overflow: hidden;
}

.checkbox-label,
.scope-checkbox small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.scope-checkbox small {
    color: var(--el-text-color-secondary);
    font-size: 11px;
}

.custom-routes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.landing-item {
    margin-top: 14px;
    margin-bottom: 0;
}

.advanced-collapse {
    margin: 0 0 16px;
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

@media (max-width: 768px) {
    .scope-heading,
    .toolbar {
        align-items: stretch;
        flex-direction: column;
    }

    .page-tools,
    .check-panel :deep(.el-checkbox-group) {
        grid-template-columns: 1fr;
    }

    .scope-heading :deep(.el-radio-group) {
        display: flex;
    }

    .scope-heading :deep(.el-radio-button) {
        flex: 1;
    }
}
</style>
