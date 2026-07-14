<template>
    <div class="mci-redis-manager">
        <header class="mci-redis-header">
            <div class="mci-redis-brand">
                <div class="mci-redis-logo"><el-icon><Coin /></el-icon></div>
                <div>
                    <div class="mci-redis-title">Redis 管理器</div>
                    <div class="mci-redis-subtitle">连接、检索、分析和维护 Redis 数据</div>
                </div>
            </div>
            <div class="mci-redis-header-actions">
                <el-tag v-if="isLoggedIn" type="success" effect="plain" round>
                    <el-icon><CircleCheck /></el-icon> 已登录 · 平台连接可用
                </el-tag>
                <el-tag v-else type="warning" effect="plain" round>
                    <el-icon><WarningFilled /></el-icon> 匿名应急模式
                </el-tag>
                <el-button v-if="!isLoggedIn" @click="goLogin">登录后台</el-button>
                <el-button :icon="Link" @click="openConnectionDialog()">
                    {{ isLoggedIn ? '添加连接' : '临时连接' }}
                </el-button>
                <el-button :icon="DataAnalysis" :disabled="!activeConnection" @click="openStatistics">统计</el-button>
                <el-button type="primary" :icon="Refresh" :disabled="!activeConnection" @click="refreshKeys">刷新</el-button>
            </div>
        </header>

        <div v-if="!isLoggedIn" class="mci-anonymous-tip">
            <el-icon><WarningFilled /></el-icon>
            <span>未登录时不会加载当前租户或已保存的服务器。临时连接只保存在本页内存中，刷新页面后立即清除。</span>
        </div>

        <main class="mci-redis-workspace">
            <aside class="mci-redis-sidebar">
                <section class="mci-sidebar-section mci-connection-section">
                    <div class="mci-section-heading">
                        <span>连接与数据库</span>
                        <el-button text circle :icon="Plus" @click="openConnectionDialog()" />
                    </div>
                    <div v-if="connectionLoading" class="mci-tree-skeleton">
                        <el-skeleton :rows="5" animated />
                    </div>
                    <el-empty v-else-if="connectionTree.length === 0" :image-size="64" description="还没有 Redis 连接">
                        <el-button type="primary" size="small" @click="openConnectionDialog()">立即连接</el-button>
                    </el-empty>
                    <el-tree
                        v-else
                        ref="connectionTreeRef"
                        class="mci-connection-tree"
                        node-key="key"
                        :data="connectionTree"
                        :props="{ label: 'label', children: 'children' }"
                        :highlight-current="true"
                        :default-expanded-keys="expandedConnectionKeys"
                        @node-click="handleConnectionNodeClick"
                    >
                        <template #default="{ data }">
                            <div class="mci-tree-node" :class="{ 'is-notice': data.kind === 'notice' }">
                                <span class="mci-tree-node-main">
                                    <el-icon v-if="data.kind === 'database'"><Coin /></el-icon>
                                    <el-icon v-else><Connection /></el-icon>
                                    <span class="mci-tree-node-label">{{ data.label }}</span>
                                </span>
                                <span v-if="data.kind === 'connection' && data.connection.Mode === 'saved'" class="mci-tree-node-actions">
                                    <el-button text circle size="small" :icon="EditPen" @click.stop="editSavedConnection(data.connection)" />
                                    <el-button text circle size="small" type="danger" :icon="Delete" @click.stop="deleteSavedConnection(data.connection)" />
                                </span>
                            </div>
                        </template>
                    </el-tree>
                </section>

                <section class="mci-sidebar-section mci-namespace-section">
                    <div class="mci-section-heading">
                        <span>键空间</span>
                        <span class="mci-muted">{{ keyList.length }}</span>
                    </div>
                    <el-empty v-if="namespaceTree.length === 0" :image-size="48" description="暂无键空间" />
                    <el-tree
                        v-else
                        class="mci-namespace-tree"
                        node-key="key"
                        :data="namespaceTree"
                        :props="{ label: 'label', children: 'children' }"
                        @node-click="handleNamespaceClick"
                    >
                        <template #default="{ data }">
                            <div class="mci-namespace-node">
                                <el-icon><FolderOpened /></el-icon>
                                <span>{{ data.label }}</span>
                                <span class="mci-namespace-count">{{ data.count }}</span>
                            </div>
                        </template>
                    </el-tree>
                </section>
            </aside>

            <section class="mci-key-panel">
                <div class="mci-panel-toolbar">
                    <div class="mci-active-connection">
                        <strong>{{ activeConnection ? activeConnection.Name : '未连接' }}</strong>
                        <span v-if="activeConnection">{{ activeConnection.Host }}:{{ activeConnection.Port }} · DB {{ activeDatabase }}</span>
                    </div>
                    <div class="mci-key-actions">
                        <el-select v-model="activeDatabase" :disabled="!activeConnection" class="mci-db-select" @change="changeDatabase">
                            <el-option v-for="db in databaseOptions" :key="db" :label="'DB ' + db" :value="db" />
                        </el-select>
                        <el-input
                            v-model="keyPattern"
                            class="mci-key-search"
                            :prefix-icon="Search"
                            clearable
                            placeholder="搜索 Key，支持 * ? [abc]"
                            @keyup.enter="searchKeys"
                            @clear="searchKeys"
                        />
                        <el-button type="primary" :disabled="!activeConnection" @click="searchKeys">查询</el-button>
                        <el-button :icon="Plus" :disabled="!activeConnection" @click="openCreateKey">新建 Key</el-button>
                    </div>
                </div>

                <div v-if="selectedKeys.length" class="mci-batch-bar">
                    <span>已选择 {{ selectedKeys.length }} 个 Key</span>
                    <el-button type="danger" plain size="small" :icon="Delete" @click="deleteSelectedKeys">批量删除</el-button>
                </div>

                <div class="mci-key-table-wrap" v-loading="keyLoading">
                    <el-empty v-if="!activeConnection && !keyLoading" :image-size="90" description="请先从左侧选择 Redis 连接" />
                    <el-empty v-else-if="activeConnection && keyList.length === 0 && !keyLoading" :image-size="90" description="当前条件没有匹配的 Key">
                        <el-button type="primary" plain @click="openCreateKey">新建 Key</el-button>
                    </el-empty>
                    <el-table
                        v-else
                        ref="keyTableRef"
                        :data="filteredKeyList"
                        height="100%"
                        row-key="Key"
                        highlight-current-row
                        @selection-change="rows => selectedKeys = rows"
                        @row-click="loadKeyDetail"
                    >
                        <el-table-column type="selection" width="46" />
                        <el-table-column prop="Key" label="Key" min-width="260" show-overflow-tooltip>
                            <template #default="{ row }">
                                <div class="mci-key-name"><el-icon><Key /></el-icon><span>{{ row.Key }}</span></div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="Type" label="类型" width="108">
                            <template #default="{ row }"><el-tag :type="typeTag(row.Type)" effect="plain">{{ typeLabel(row.Type) }}</el-tag></template>
                        </el-table-column>
                        <el-table-column prop="TtlSeconds" label="TTL" width="110">
                            <template #default="{ row }">{{ formatTtl(row.TtlSeconds) }}</template>
                        </el-table-column>
                        <el-table-column prop="MemoryBytes" label="内存" width="104">
                            <template #default="{ row }">{{ formatBytes(row.MemoryBytes) }}</template>
                        </el-table-column>
                        <el-table-column label="操作" width="90" fixed="right">
                            <template #default="{ row }">
                                <el-button text type="danger" :icon="Delete" @click.stop="deleteOneKey(row)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
                <div v-if="keyHasMore" class="mci-load-more">
                    <el-button :loading="keyLoading" @click="loadMoreKeys">继续加载</el-button>
                </div>
            </section>

            <aside class="mci-detail-panel">
                <div class="mci-detail-header">
                    <div>
                        <div class="mci-detail-title">键值详情</div>
                        <div class="mci-detail-key" :title="selectedDetail?.Key">{{ selectedDetail?.Key || '选择一个 Key 查看内容' }}</div>
                    </div>
                    <div v-if="selectedDetail" class="mci-detail-actions">
                        <el-button size="small" :icon="EditPen" @click="openRename">重命名</el-button>
                        <el-button size="small" :icon="Timer" @click="openTtl">TTL</el-button>
                        <el-button size="small" type="danger" :icon="Delete" @click="deleteCurrentKey">删除</el-button>
                    </div>
                </div>

                <el-empty v-if="!selectedDetail && !detailLoading" :image-size="76" description="从 Key 列表选择一条数据" />
                <div v-else class="mci-detail-content" v-loading="detailLoading">
                    <div v-if="selectedDetail" class="mci-detail-metrics">
                        <div><span>类型</span><strong>{{ typeLabel(selectedDetail.Type) }}</strong></div>
                        <div><span>元素/长度</span><strong>{{ selectedDetail.Length ?? '-' }}</strong></div>
                        <div><span>TTL</span><strong>{{ formatTtl(selectedDetail.TtlSeconds) }}</strong></div>
                        <div><span>内存</span><strong>{{ formatBytes(selectedDetail.MemoryBytes) }}</strong></div>
                    </div>
                    <el-alert
                        v-if="selectedDetail?.Truncated"
                        title="当前只显示首批数据；大集合请通过搜索或 MCP 分页处理。"
                        type="warning"
                        :closable="false"
                        show-icon
                    />
                    <div v-if="selectedDetail" class="mci-editor-shell">
                        <DiyCodeEditor
                            v-model="editorValue"
                            :field="codeEditorField"
                            :FieldReadonly="selectedDetail.Type === 'stream'"
                            height="100%"
                        />
                    </div>
                    <div v-if="selectedDetail" class="mci-detail-footer">
                        <span class="mci-muted">
                            {{ selectedDetail.Type === 'stream'
                                ? 'Stream 暂为只读。'
                                : '保存会覆盖当前 Key 内容并保留原 TTL。' }}
                        </span>
                        <el-button
                            type="primary"
                            :loading="detailSaving"
                            :disabled="selectedDetail.Type === 'stream'"
                            @click="saveCurrentValue"
                        >保存内容</el-button>
                    </div>
                </div>
            </aside>
        </main>

        <el-dialog
            v-model="connectionDialogVisible"
            :title="connectionForm.Id ? '编辑 Redis 连接' : (connectionKind === 'saved' ? '添加已保存连接' : '临时连接 Redis')"
            width="720px"
            draggable
            align-center
            :close-on-click-modal="false"
        >
            <el-tabs v-if="isLoggedIn && !connectionForm.Id" v-model="connectionKind" class="mci-connection-tabs">
                <el-tab-pane label="保存到当前租户" name="saved" />
                <el-tab-pane label="仅本次临时连接" name="temporary" />
            </el-tabs>
            <el-alert
                v-if="connectionKind === 'temporary'"
                title="连接信息只保存在当前浏览器内存，不会写入数据库；请优先使用 HTTPS 访问此页面。"
                type="warning"
                :closable="false"
                show-icon
            />
            <el-form :model="connectionForm" label-width="112px" class="mci-connection-form">
                <div class="mci-form-grid">
                    <el-form-item label="连接名称" required><el-input v-model="connectionForm.Name" placeholder="例如：本机 Redis" /></el-form-item>
                    <el-form-item label="主机地址" required><el-input v-model="connectionForm.Host" placeholder="127.0.0.1 / redis / 域名" /></el-form-item>
                    <el-form-item label="端口" required><el-input-number v-model="connectionForm.Port" :min="1" :max="65535" controls-position="right" /></el-form-item>
                    <el-form-item label="默认数据库"><el-input-number v-model="connectionForm.Database" :min="0" :max="1023" controls-position="right" /></el-form-item>
                    <el-form-item label="ACL 用户名"><el-input v-model="connectionForm.Username" autocomplete="off" placeholder="Redis 6+，可留空" /></el-form-item>
                    <el-form-item label="密码"><el-input v-model="connectionForm.Password" type="password" show-password autocomplete="new-password" :placeholder="connectionForm.Id ? '留空表示保持原密码' : '可留空'" /></el-form-item>
                    <el-form-item label="连接超时"><el-input-number v-model="connectionForm.ConnectTimeout" :min="1000" :max="15000" :step="500" controls-position="right" /><span class="mci-form-unit">ms</span></el-form-item>
                    <el-form-item label="启用 TLS"><el-switch v-model="connectionForm.Ssl" /></el-form-item>
                    <el-form-item label="键分隔符"><el-input v-model="connectionForm.KeySeparator" maxlength="10" placeholder=":" /></el-form-item>
                    <el-form-item v-if="connectionKind === 'saved'" label="排序"><el-input-number v-model="connectionForm.Sort" :min="0" :max="9999" controls-position="right" /></el-form-item>
                </div>
                <el-form-item v-if="connectionKind === 'saved'" label="备注"><el-input v-model="connectionForm.Remark" type="textarea" :rows="2" /></el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="connectionDialogVisible = false">取消</el-button>
                <el-button :loading="connectionTesting" @click="testDialogConnection">测试连接</el-button>
                <el-button type="primary" :loading="connectionSaving" @click="saveAndConnect">
                    {{ connectionKind === 'saved' ? '保存并连接' : '连接' }}
                </el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="createDialogVisible" title="新建 Redis Key" width="760px" draggable align-center :close-on-click-modal="false">
            <el-form label-width="90px">
                <div class="mci-create-grid">
                    <el-form-item label="Key" required><el-input v-model="createForm.Key" placeholder="例如：Microi:demo:config" /></el-form-item>
                    <el-form-item label="数据类型" required>
                        <el-select v-model="createForm.DataType" @change="applyCreateTemplate">
                            <el-option label="String" value="string" />
                            <el-option label="Hash" value="hash" />
                            <el-option label="List" value="list" />
                            <el-option label="Set" value="set" />
                            <el-option label="Sorted Set" value="sortedset" />
                        </el-select>
                    </el-form-item>
                    <el-form-item label="TTL(秒)"><el-input-number v-model="createForm.TtlSeconds" :min="-1" :max="315360000" /><span class="mci-form-unit">-1 永久</span></el-form-item>
                </div>
                <div class="mci-create-editor">
                    <DiyCodeEditor v-model="createForm.Value" :field="createCodeEditorField" height="330px" />
                </div>
            </el-form>
            <template #footer>
                <el-button @click="createDialogVisible = false">取消</el-button>
                <el-button type="primary" :loading="createSaving" @click="createKey">创建</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="renameDialogVisible" title="重命名 Redis Key" width="560px" draggable align-center>
            <el-form label-width="90px">
                <el-form-item label="原 Key"><el-input :model-value="selectedDetail?.Key" disabled /></el-form-item>
                <el-form-item label="新 Key" required><el-input v-model="renameValue" @keyup.enter="renameCurrentKey" /></el-form-item>
            </el-form>
            <template #footer><el-button @click="renameDialogVisible = false">取消</el-button><el-button type="primary" @click="renameCurrentKey">确定</el-button></template>
        </el-dialog>

        <el-dialog v-model="ttlDialogVisible" title="设置 TTL" width="500px" draggable align-center>
            <el-alert title="-1 表示永久不过期，0 表示立即删除，大于 0 表示过期秒数。" type="info" :closable="false" />
            <el-input-number v-model="ttlValue" class="mci-ttl-input" :min="-1" :max="315360000" />
            <template #footer><el-button @click="ttlDialogVisible = false">取消</el-button><el-button type="primary" @click="saveTtl">确定</el-button></template>
        </el-dialog>

        <el-drawer v-model="statisticsVisible" title="Redis 运行统计" size="520px">
            <div class="mci-statistics" v-loading="statisticsLoading">
                <div v-if="statistics" class="mci-stat-grid">
                    <div class="mci-stat-card"><span>Key 总数</span><strong>{{ statistics.KeyCount?.toLocaleString() }}</strong></div>
                    <div class="mci-stat-card"><span>Ping</span><strong>{{ statistics.PingMilliseconds }} ms</strong></div>
                    <div class="mci-stat-card"><span>已用内存</span><strong>{{ statistics.Info?.used_memory_human || '-' }}</strong></div>
                    <div class="mci-stat-card"><span>连接客户端</span><strong>{{ statistics.Info?.connected_clients || '-' }}</strong></div>
                </div>
                <section v-if="statistics" class="mci-stat-section">
                    <h3>数据类型分布 <small>抽样 {{ statistics.SampleSize }} 个 Key</small></h3>
                    <div v-for="(count, type) in statistics.TypeDistribution" :key="type" class="mci-type-row">
                        <el-tag :type="typeTag(type)" effect="plain">{{ typeLabel(type) }}</el-tag>
                        <el-progress :percentage="statistics.SampleSize ? Math.round(count * 100 / statistics.SampleSize) : 0" :stroke-width="9" />
                        <strong>{{ count }}</strong>
                    </div>
                </section>
                <section v-if="statistics" class="mci-stat-section">
                    <h3>服务器信息</h3>
                    <el-descriptions :column="1" border size="small">
                        <el-descriptions-item v-for="(value, key) in statistics.Info" :key="key" :label="key">{{ value }}</el-descriptions-item>
                    </el-descriptions>
                </section>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
    CircleCheck, Coin, Connection, DataAnalysis, Delete, EditPen, FolderOpened,
    Key, Link, Plus, Refresh, Search, Timer, WarningFilled
} from '@element-plus/icons-vue';
import { DiyCommon } from '@/utils/microi.net.import';
import { getToken } from '@/utils/auth.js';
import { useDiyStore } from '@/pinia';

const DiyCodeEditor = defineAsyncComponent(() => import('@/views/form-engine/diy-field-component/diy-code-editor.vue'));
const router = useRouter();
const diyStore = useDiyStore();

const connectionTreeRef = ref(null);
const keyTableRef = ref(null);
const keyLoading = ref(false);
const detailLoading = ref(false);
const detailSaving = ref(false);
const connectionLoading = ref(false);
const connectionTesting = ref(false);
const connectionSaving = ref(false);
const createSaving = ref(false);
const statisticsLoading = ref(false);
const isLoggedIn = ref(false);
const connections = ref([]);
const temporaryConnections = reactive({});
const activeConnection = ref(null);
const activeDatabase = ref(0);
const databaseOptions = Array.from({ length: 64 }, (_, index) => index);
const keyPattern = ref('*');
const keyList = ref([]);
const keyCursor = ref('');
const keyHasMore = ref(false);
const selectedKeys = ref([]);
const selectedDetail = ref(null);
const editorValue = ref('');
const codeEditorField = ref(makeCodeField('mci-redis-value', 'json', 520));
const createCodeEditorField = ref(makeCodeField('mci-redis-create', 'json', 330));

const connectionDialogVisible = ref(false);
const connectionKind = ref('temporary');
const connectionForm = reactive(emptyConnectionForm());
const createDialogVisible = ref(false);
const createForm = reactive({ Key: '', DataType: 'string', Value: '{\n  "enabled": true\n}', TtlSeconds: -1 });
const renameDialogVisible = ref(false);
const renameValue = ref('');
const ttlDialogVisible = ref(false);
const ttlValue = ref(-1);
const statisticsVisible = ref(false);
const statistics = ref(null);

const expandedConnectionKeys = computed(() => activeConnection.value ? [`connection:${activeConnection.value.Id}`] : []);
const connectionTree = computed(() => connections.value.map(connection => {
    if (connection.Mode === 'notice') return { key: `notice:${connection.Id}`, label: connection.Name, kind: 'notice', connection };
    const defaultDb = Number(connection.Database || 0);
    const dbs = Array.from(new Set([defaultDb, ...Array.from({ length: 16 }, (_, index) => index)])).sort((a, b) => a - b);
    return {
        key: `connection:${connection.Id}`,
        label: connection.Name,
        kind: 'connection',
        connection,
        children: dbs.map(db => ({
            key: `connection:${connection.Id}:db:${db}`,
            label: `DB ${db}`,
            kind: 'database',
            database: db,
            connection
        }))
    };
}));

const filteredKeyList = computed(() => keyList.value);
const namespaceTree = computed(() => buildNamespaceTree(keyList.value));

function makeCodeField(id, language, height) {
    return {
        Id: id,
        Name: 'RedisValue',
        Label: 'Redis Value',
        Config: { CodeEditor: { Language: language, Height: String(height), V8CodeType: 'client' } }
    };
}

function emptyConnectionForm() {
    return {
        Id: '', Name: '', Host: '127.0.0.1', Port: 6379, Username: '', Password: '',
        Database: 0, Ssl: false, ConnectTimeout: 5000, KeySeparator: ':', Status: 1, Sort: 100, Remark: ''
    };
}

function resetConnectionForm(data) {
    Object.assign(connectionForm, emptyConnectionForm(), data || {});
    connectionForm.Password = '';
}

function currentUserLooksValid() {
    let user = null;
    try { user = diyStore.GetCurrentUser; } catch (_) { user = null; }
    return !!(getToken() && user && user.Id);
}

async function apiPost(url, data) {
    const result = await DiyCommon.PostAsync(url, data, null, null, 'json');
    if (!result || result.Code !== 1) throw new Error(result?.Msg || result?.Message || '请求失败');
    return result.Data;
}

function contextPayload(extra = {}) {
    if (!activeConnection.value) throw new Error('请先选择 Redis 连接');
    const payload = {
        Mode: activeConnection.value.Mode,
        ConnectionId: activeConnection.value.Mode === 'saved' ? activeConnection.value.Id : '',
        Database: activeDatabase.value
    };
    if (activeConnection.value.Mode === 'temporary') payload.Connection = temporaryConnections[activeConnection.value.Id];
    return Object.assign(payload, extra);
}

async function loadConnections() {
    if (!isLoggedIn.value) return;
    connectionLoading.value = true;
    try {
        const data = await apiPost('/api/cache/redis/connections', {});
        connections.value = Array.isArray(data) ? data : [];
        const first = connections.value.find(item => item.Mode === 'tenant') || connections.value.find(item => item.Mode === 'saved');
        if (first) await selectConnection(first, Number(first.Database || 0));
    } catch (error) {
        isLoggedIn.value = false;
        connections.value = connections.value.filter(item => item.Mode === 'temporary');
        ElMessage.warning(error.message + '，已切换为匿名应急模式。');
        nextTick(() => openConnectionDialog());
    } finally {
        connectionLoading.value = false;
    }
}

async function selectConnection(connection, database) {
    if (!connection || connection.Mode === 'notice') return;
    activeConnection.value = connection;
    activeDatabase.value = Number(database ?? connection.Database ?? 0);
    selectedDetail.value = null;
    editorValue.value = '';
    await refreshKeys();
    nextTick(() => connectionTreeRef.value?.setCurrentKey(`connection:${connection.Id}:db:${activeDatabase.value}`));
}

function handleConnectionNodeClick(data) {
    if (data.kind === 'database') selectConnection(data.connection, data.database);
    else if (data.kind === 'connection') selectConnection(data.connection, Number(data.connection.Database || 0));
}

function changeDatabase() {
    selectedDetail.value = null;
    refreshKeys();
}

async function refreshKeys() {
    keyCursor.value = '';
    keyList.value = [];
    await loadKeys(false);
}

function searchKeys() {
    if (!keyPattern.value) keyPattern.value = '*';
    refreshKeys();
}

async function loadMoreKeys() {
    await loadKeys(true);
}

async function loadKeys(append) {
    if (!activeConnection.value || keyLoading.value) return;
    keyLoading.value = true;
    try {
        const data = await apiPost('/api/cache/redis/keys', contextPayload({
            Pattern: keyPattern.value || '*',
            Cursor: append ? keyCursor.value : '',
            PageSize: 100
        }));
        const list = Array.isArray(data?.List) ? data.List : [];
        keyList.value = append
            ? [...keyList.value, ...list.filter(item => !keyList.value.some(old => old.Key === item.Key))]
            : list;
        keyCursor.value = data?.NextCursor || '';
        keyHasMore.value = !!data?.HasMore;
        selectedKeys.value = [];
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        keyLoading.value = false;
    }
}

async function loadKeyDetail(row) {
    if (!row || detailLoading.value) return;
    detailLoading.value = true;
    try {
        const data = await apiPost('/api/cache/redis/key', contextPayload({ Key: row.Key, PageIndex: 1, PageSize: 500 }));
        selectedDetail.value = data;
        editorValue.value = data?.RawValue ?? '';
        const language = data?.Type === 'string' && !looksLikeJson(editorValue.value) ? 'plaintext' : 'json';
        codeEditorField.value = makeCodeField(`mci-redis-value-${Date.now()}`, language, 520);
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        detailLoading.value = false;
    }
}

function looksLikeJson(value) {
    const text = String(value || '').trim();
    return (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
}

async function saveCurrentValue() {
    if (!selectedDetail.value) return;
    detailSaving.value = true;
    try {
        await apiPost('/api/cache/redis/key/replace', contextPayload({
            Key: selectedDetail.value.Key,
            DataType: selectedDetail.value.Type,
            Value: editorValue.value
        }));
        ElMessage.success('Redis 内容已保存');
        await loadKeyDetail({ Key: selectedDetail.value.Key });
        await refreshKeys();
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        detailSaving.value = false;
    }
}

async function confirmDelete(keys) {
    if (!keys.length) return;
    await ElMessageBox.confirm(`确认删除 ${keys.length} 个 Redis Key？该操作不可恢复。`, '删除确认', {
        type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消', draggable: true
    });
    const data = await apiPost('/api/cache/redis/keys/delete', contextPayload({ Keys: keys }));
    ElMessage.success(`已删除 ${data?.Deleted ?? keys.length} 个 Key`);
    selectedDetail.value = null;
    editorValue.value = '';
    await refreshKeys();
}

async function deleteOneKey(row) {
    try { await confirmDelete([row.Key]); } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || String(error)); }
}
async function deleteSelectedKeys() {
    try { await confirmDelete(selectedKeys.value.map(item => item.Key)); } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || String(error)); }
}
async function deleteCurrentKey() {
    if (!selectedDetail.value) return;
    try { await confirmDelete([selectedDetail.value.Key]); } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || String(error)); }
}

function openConnectionDialog(connection) {
    connectionKind.value = connection?.Mode === 'saved' ? 'saved' : (isLoggedIn.value ? 'saved' : 'temporary');
    resetConnectionForm(connection);
    connectionDialogVisible.value = true;
}

function editSavedConnection(connection) {
    connectionKind.value = 'saved';
    resetConnectionForm(connection);
    connectionDialogVisible.value = true;
}

function dialogContextPayload() {
    return {
        Mode: 'temporary',
        Database: connectionForm.Database,
        Connection: {
            Name: connectionForm.Name || '临时 Redis', Host: connectionForm.Host, Port: connectionForm.Port,
            Username: connectionForm.Username, Password: connectionForm.Password, Database: connectionForm.Database,
            Ssl: connectionForm.Ssl, ConnectTimeout: connectionForm.ConnectTimeout, KeySeparator: connectionForm.KeySeparator || ':'
        }
    };
}

function validateConnectionForm() {
    if (!String(connectionForm.Name || '').trim()) throw new Error('请输入连接名称');
    if (!String(connectionForm.Host || '').trim()) throw new Error('请输入主机地址');
}

async function testDialogConnection() {
    connectionTesting.value = true;
    try {
        validateConnectionForm();
        const payload = connectionForm.Id && connectionKind.value === 'saved'
            ? { Mode: 'saved', ConnectionId: connectionForm.Id, Database: connectionForm.Database }
            : dialogContextPayload();
        const data = await apiPost('/api/cache/redis/test', payload);
        ElMessage.success(`连接成功，Ping ${data?.PingMilliseconds ?? '-'} ms`);
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        connectionTesting.value = false;
    }
}

async function saveAndConnect() {
    connectionSaving.value = true;
    try {
        validateConnectionForm();
        if (connectionKind.value === 'saved') {
            const saved = await apiPost('/api/cache/redis/connections/save', { ...connectionForm });
            await apiPost('/api/cache/redis/test', { Mode: 'saved', ConnectionId: saved.Id, Database: saved.Database });
            await loadConnectionsOnly();
            const item = connections.value.find(connection => connection.Id === saved.Id) || saved;
            connectionDialogVisible.value = false;
            await selectConnection(item, Number(item.Database || 0));
            ElMessage.success('连接已保存');
        } else {
            const payload = dialogContextPayload();
            await apiPost('/api/cache/redis/test', payload);
            const id = `temporary-${Date.now()}`;
            temporaryConnections[id] = { ...payload.Connection };
            const summary = {
                Id: id, Name: payload.Connection.Name, Mode: 'temporary', Host: payload.Connection.Host,
                Port: payload.Connection.Port, Database: payload.Connection.Database, Ssl: payload.Connection.Ssl,
                KeySeparator: payload.Connection.KeySeparator, Sort: 10
            };
            connections.value.push(summary);
            connectionDialogVisible.value = false;
            await selectConnection(summary, summary.Database);
            ElMessage.success('临时 Redis 已连接');
        }
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        connectionSaving.value = false;
    }
}

async function loadConnectionsOnly() {
    const temp = connections.value.filter(item => item.Mode === 'temporary');
    const data = await apiPost('/api/cache/redis/connections', {});
    connections.value = [...(Array.isArray(data) ? data : []), ...temp];
}

async function deleteSavedConnection(connection) {
    try {
        await ElMessageBox.confirm(`确认删除连接“${connection.Name}”？不会删除 Redis 中的数据。`, '删除连接', { type: 'warning', draggable: true });
        await apiPost('/api/cache/redis/connections/delete', { Id: connection.Id });
        if (activeConnection.value?.Id === connection.Id) {
            activeConnection.value = null;
            keyList.value = [];
            selectedDetail.value = null;
        }
        await loadConnectionsOnly();
        ElMessage.success('连接已删除');
    } catch (error) {
        if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || String(error));
    }
}

function openCreateKey() {
    Object.assign(createForm, { Key: '', DataType: 'string', Value: '{\n  "enabled": true\n}', TtlSeconds: -1 });
    createCodeEditorField.value = makeCodeField(`mci-redis-create-${Date.now()}`, 'json', 330);
    createDialogVisible.value = true;
}

function applyCreateTemplate(type) {
    const templates = {
        string: '{\n  "enabled": true\n}', hash: '{\n  "field": "value"\n}',
        list: '[\n  "item-1",\n  "item-2"\n]', set: '[\n  "member-1",\n  "member-2"\n]',
        sortedset: '[\n  { "member": "member-1", "score": 1 }\n]'
    };
    createForm.Value = templates[type] || '';
}

async function createKey() {
    createSaving.value = true;
    try {
        if (!String(createForm.Key || '').trim()) throw new Error('请输入 Redis Key');
        await apiPost('/api/cache/redis/key/replace', contextPayload({ ...createForm }));
        createDialogVisible.value = false;
        ElMessage.success('Redis Key 已创建');
        await refreshKeys();
        const row = keyList.value.find(item => item.Key === createForm.Key);
        if (row) await loadKeyDetail(row);
    } catch (error) {
        ElMessage.error(error.message);
    } finally {
        createSaving.value = false;
    }
}

function openRename() {
    renameValue.value = selectedDetail.value?.Key || '';
    renameDialogVisible.value = true;
}

async function renameCurrentKey() {
    try {
        const oldKey = selectedDetail.value?.Key;
        await apiPost('/api/cache/redis/key/rename', contextPayload({ Key: oldKey, NewKey: renameValue.value }));
        renameDialogVisible.value = false;
        ElMessage.success('Key 已重命名');
        await refreshKeys();
        const row = keyList.value.find(item => item.Key === renameValue.value);
        if (row) await loadKeyDetail(row);
    } catch (error) { ElMessage.error(error.message); }
}

function openTtl() {
    ttlValue.value = selectedDetail.value?.TtlSeconds ?? -1;
    ttlDialogVisible.value = true;
}

async function saveTtl() {
    try {
        const key = selectedDetail.value?.Key;
        await apiPost('/api/cache/redis/key/ttl', contextPayload({ Key: key, TtlSeconds: ttlValue.value }));
        ttlDialogVisible.value = false;
        ElMessage.success('TTL 已更新');
        if (ttlValue.value === 0) {
            selectedDetail.value = null;
            await refreshKeys();
        } else {
            await loadKeyDetail({ Key: key });
        }
    } catch (error) { ElMessage.error(error.message); }
}

async function openStatistics() {
    statisticsVisible.value = true;
    statisticsLoading.value = true;
    try { statistics.value = await apiPost('/api/cache/redis/statistics', contextPayload()); }
    catch (error) { ElMessage.error(error.message); }
    finally { statisticsLoading.value = false; }
}

function handleNamespaceClick(data) {
    if (!data?.prefix) return;
    keyPattern.value = data.prefix + '*';
    searchKeys();
}

function buildNamespaceTree(items) {
    const roots = [];
    const map = new Map();
    for (const item of items) {
        const parts = String(item.Key || '').split(':');
        if (parts.length < 2) continue;
        let parentChildren = roots;
        let prefix = '';
        for (let index = 0; index < parts.length - 1; index++) {
            prefix += parts[index] + ':';
            let node = map.get(prefix);
            if (!node) {
                node = { key: prefix, label: parts[index] || '(空)', prefix, count: 0, children: [] };
                map.set(prefix, node);
                parentChildren.push(node);
            }
            node.count++;
            parentChildren = node.children;
        }
    }
    return roots;
}

function typeTag(type) {
    return ({ string: 'success', hash: 'warning', list: 'primary', set: 'info', sortedset: 'danger', zset: 'danger', stream: '' })[String(type || '').toLowerCase()] || 'info';
}
function typeLabel(type) {
    const value = String(type || '').toLowerCase();
    return ({ string: 'String', hash: 'Hash', list: 'List', set: 'Set', sortedset: 'Sorted Set', zset: 'Sorted Set', stream: 'Stream', none: 'None' })[value] || type || '-';
}
function formatTtl(value) {
    if (value === null || value === undefined || Number(value) < 0) return '永久';
    const seconds = Number(value);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}
function formatBytes(value) {
    if (value === null || value === undefined) return '-';
    const bytes = Number(value);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function goLogin() { router.push({ path: '/login', query: { redirect: '/mci-redis-manager' } }); }

function onAuthExpired() {
    isLoggedIn.value = false;
    connections.value = connections.value.filter(item => item.Mode === 'temporary');
    if (activeConnection.value && activeConnection.value.Mode !== 'temporary') {
        activeConnection.value = null;
        keyList.value = [];
        selectedDetail.value = null;
    }
}

onMounted(async () => {
    window.addEventListener('microi-redis-auth-expired', onAuthExpired);
    isLoggedIn.value = currentUserLooksValid();
    if (isLoggedIn.value) await loadConnections();
    else nextTick(() => openConnectionDialog());
});
onBeforeUnmount(() => window.removeEventListener('microi-redis-auth-expired', onAuthExpired));
</script>

<style scoped lang="scss">
.mci-redis-manager {
    --mci-redis-bg: var(--mci-bg-page, #f4f7fb);
    --mci-redis-card: var(--mci-bg-card, #ffffff);
    --mci-redis-border: var(--mci-border-color, #e5eaf2);
    --mci-redis-text: var(--mci-text-primary, #172033);
    --mci-redis-muted: var(--mci-text-secondary, #6b778c);
    --mci-redis-primary: var(--mci-color-primary, #2f6bff);
    min-width: 1180px;
    height: 100vh;
    overflow: hidden;
    color: var(--mci-redis-text);
    background: var(--mci-redis-bg);
}
.mci-redis-header { height: 72px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background: var(--mci-redis-card); border-bottom: 1px solid var(--mci-redis-border); }
.mci-redis-brand, .mci-redis-header-actions, .mci-tree-node-main, .mci-key-name, .mci-namespace-node { display: flex; align-items: center; }
.mci-redis-logo { width: 42px; height: 42px; margin-right: 12px; display: grid; place-items: center; color: #fff; font-size: 23px; border-radius: 12px; background: linear-gradient(135deg, #e74b42, #c92e40); box-shadow: 0 8px 22px rgba(207, 48, 57, .24); }
.mci-redis-title { font-size: 19px; line-height: 26px; font-weight: 700; }
.mci-redis-subtitle { color: var(--mci-redis-muted); font-size: 12px; }
.mci-redis-header-actions { gap: 10px; }
.mci-redis-header-actions .el-tag .el-icon { margin-right: 4px; }
.mci-anonymous-tip { height: 38px; padding: 0 20px; display: flex; align-items: center; gap: 8px; color: #8a5b00; font-size: 13px; background: #fff8e7; border-bottom: 1px solid #f4dfae; }
.mci-redis-workspace { height: calc(100vh - 73px); display: grid; grid-template-columns: 280px minmax(500px, 1fr) minmax(420px, 38vw); gap: 10px; padding: 10px; box-sizing: border-box; }
.mci-anonymous-tip + .mci-redis-workspace { height: calc(100vh - 111px); }
.mci-redis-sidebar, .mci-key-panel, .mci-detail-panel { min-height: 0; overflow: hidden; background: var(--mci-redis-card); border: 1px solid var(--mci-redis-border); border-radius: 10px; box-shadow: 0 3px 12px rgba(30, 50, 80, .04); }
.mci-redis-sidebar { display: grid; grid-template-rows: minmax(260px, 56%) minmax(180px, 44%); }
.mci-sidebar-section { min-height: 0; display: flex; flex-direction: column; }
.mci-connection-section { border-bottom: 1px solid var(--mci-redis-border); }
.mci-section-heading { height: 44px; min-height: 44px; padding: 0 12px 0 14px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 650; border-bottom: 1px solid var(--mci-redis-border); }
.mci-connection-tree, .mci-namespace-tree { flex: 1; min-height: 0; padding: 8px; overflow: auto; background: transparent; }
.mci-tree-skeleton { padding: 14px; }
.mci-tree-node { width: 100%; min-width: 0; display: flex; align-items: center; justify-content: space-between; }
.mci-tree-node-main { min-width: 0; gap: 7px; }
.mci-tree-node-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mci-tree-node-actions { display: none; white-space: nowrap; }
.mci-tree-node:hover .mci-tree-node-actions { display: inline-flex; }
.mci-tree-node.is-notice { color: #b7791f; }
.mci-namespace-node { width: 100%; gap: 7px; min-width: 0; }
.mci-namespace-count { margin-left: auto; padding: 0 6px; color: var(--mci-redis-muted); font-size: 11px; background: var(--mci-redis-bg); border-radius: 10px; }
.mci-muted { color: var(--mci-redis-muted); font-size: 12px; }
.mci-key-panel { display: flex; flex-direction: column; }
.mci-panel-toolbar { min-height: 74px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: center; gap: 9px; border-bottom: 1px solid var(--mci-redis-border); }
.mci-active-connection { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
.mci-active-connection strong { font-size: 15px; }
.mci-active-connection span { color: var(--mci-redis-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mci-key-actions { display: flex; align-items: center; gap: 8px; }
.mci-db-select { width: 92px; }
.mci-key-search { min-width: 180px; flex: 1; }
.mci-batch-bar { min-height: 42px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; color: #9b2c2c; font-size: 13px; background: #fff5f5; border-bottom: 1px solid #fed7d7; }
.mci-key-table-wrap { flex: 1; min-height: 0; }
.mci-key-table-wrap :deep(.el-empty) { height: 100%; }
.mci-key-name { gap: 7px; font-family: Consolas, Monaco, monospace; font-size: 12px; }
.mci-load-more { height: 46px; display: grid; place-items: center; border-top: 1px solid var(--mci-redis-border); }
.mci-detail-panel { display: flex; flex-direction: column; }
.mci-detail-header { min-height: 72px; padding: 11px 13px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--mci-redis-border); }
.mci-detail-title { font-weight: 700; }
.mci-detail-key { max-width: 440px; margin-top: 4px; color: var(--mci-redis-muted); font: 12px Consolas, Monaco, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mci-detail-actions { display: flex; gap: 5px; }
.mci-detail-content { flex: 1; min-height: 0; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.mci-detail-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.mci-detail-metrics > div { padding: 9px 10px; background: var(--mci-redis-bg); border: 1px solid var(--mci-redis-border); border-radius: 7px; }
.mci-detail-metrics span { display: block; margin-bottom: 4px; color: var(--mci-redis-muted); font-size: 11px; }
.mci-detail-metrics strong { font-size: 13px; }
.mci-editor-shell { flex: 1; min-height: 300px; overflow: hidden; border: 1px solid var(--mci-redis-border); border-radius: 8px; }
.mci-editor-shell :deep(.monaco-container) { height: 100% !important; border: 0; }
.mci-detail-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mci-connection-tabs { margin-top: -10px; }
.mci-connection-form { margin-top: 18px; }
.mci-form-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; }
.mci-form-grid .el-form-item { min-width: 0; }
.mci-form-grid :deep(.el-input-number) { width: 100%; }
.mci-form-unit { margin-left: 7px; color: var(--mci-redis-muted); font-size: 12px; white-space: nowrap; }
.mci-create-grid { display: grid; grid-template-columns: 1fr 180px; gap: 0 14px; }
.mci-create-grid .el-form-item:first-child { grid-column: 1 / -1; }
.mci-create-editor { height: 350px; overflow: hidden; border: 1px solid var(--mci-redis-border); border-radius: 8px; }
.mci-create-editor :deep(.monaco-container) { height: 100% !important; border: 0; }
.mci-ttl-input { width: 100%; margin-top: 20px; }
.mci-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mci-stat-card { padding: 14px; background: var(--mci-redis-bg); border: 1px solid var(--mci-redis-border); border-radius: 9px; }
.mci-stat-card span { display: block; margin-bottom: 7px; color: var(--mci-redis-muted); font-size: 12px; }
.mci-stat-card strong { font-size: 20px; }
.mci-stat-section { margin-top: 22px; }
.mci-stat-section h3 { margin: 0 0 12px; font-size: 15px; }
.mci-stat-section h3 small { margin-left: 7px; color: var(--mci-redis-muted); font-size: 11px; font-weight: 400; }
.mci-type-row { display: grid; grid-template-columns: 95px 1fr 38px; align-items: center; gap: 9px; margin-bottom: 10px; }

@media (max-width: 1440px) {
    .mci-redis-workspace { grid-template-columns: 250px minmax(470px, 1fr) 420px; }
    .mci-detail-metrics { grid-template-columns: repeat(2, 1fr); }
    .mci-key-actions .el-button:nth-last-child(1) { padding-left: 10px; padding-right: 10px; }
}
</style>
