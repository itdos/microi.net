<template>
    <div class="diy-file-download-dialog">
        <div class="download-toolbar">
            <div class="download-summary">
                共 {{ files.length }} 个附件，已选 {{ selectedFiles.length }} 个可下载文件
            </div>
            <div class="download-actions">
                <el-button size="small" @click="toggleSelectAll">{{ allReadableSelected ? '清空选择' : '全选可下载文件' }}</el-button>
                <el-button size="small" type="primary" :loading="zipLoading" :disabled="selectedFiles.length === 0" @click="downloadZip">
                    下载zip包
                </el-button>
            </div>
        </div>

        <el-table :data="files" border stripe class="download-file-table" max-height="min(56vh, 560px)">
            <el-table-column label="选择" width="72" align="center">
                <template #default="scope">
                    <el-checkbox
                        :model-value="selectedIds.includes(scope.row._key)"
                        :disabled="!canReadFile(scope.row) || !getFilePath(scope.row)"
                        @change="value => setSelected(scope.row, value)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="文件名" min-width="260" show-overflow-tooltip>
                <template #default="scope">
                    <span :class="{ 'is-unauthorized': !canReadFile(scope.row) }">{{ displayName(scope.row) }}</span>
                </template>
            </el-table-column>
            <el-table-column label="上传人" width="180" show-overflow-tooltip>
                <template #default="scope">{{ uploaderName(scope.row) }}</template>
            </el-table-column>
            <el-table-column label="上传时间" width="180">
                <template #default="scope">{{ uploadTime(scope.row) || '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120" align="center">
                <template #default="scope">
                    <el-tag v-if="canReadFile(scope.row)" type="success" size="small">有权限</el-tag>
                    <el-tag v-else type="info" size="small">无权限</el-tag>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
                <template #default="scope">
                    <el-button
                        v-if="canReadFile(scope.row) && getFilePath(scope.row)"
                        type="primary"
                        link
                        size="small"
                        :loading="downloadingKey === scope.row._key"
                        @click="downloadSingle(scope.row)"
                    >下载</el-button>
                    <span v-else class="muted-action">无权限</span>
                </template>
            </el-table-column>
            <template #empty><el-empty description="暂无附件" :image-size="72" /></template>
        </el-table>

        <div class="download-dialog-hint">无权限附件仍保留在列表中，服务端会再次校验记录、字段和角色权限。</div>
    </div>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from 'vue';
import { canReadFile } from '@/utils/file-role-permission';

const props = defineProps({
    DataAppend: {
        type: Object,
        default: () => ({})
    }
});

const instance = getCurrentInstance();
const DiyCommon = instance?.appContext?.config?.globalProperties?.DiyCommon;
const selectedIds = ref([]);
const zipLoading = ref(false);
const downloadingKey = ref('');

const parseValue = value => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
    if (typeof value !== 'string' || !value.trim()) return [];
    const text = value.trim();
    if (text.startsWith('[') || text.startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
        } catch (_) {
            // 老数据可能直接保存路径，继续走字符串兼容分支。
        }
    }
    return [{ Path: value, Name: value.split(/[\\/]/).pop() }];
};

const files = computed(() => parseValue(props.DataAppend?.Files).map((file, index) => ({
    ...(file || {}),
    _key: String(file?.Id || file?.Path || file?.FilePathName || `file-${index}`) + `-${index}`
})));

const getFilePath = file => String(file?.Path || file?.FilePathName || file?.path || '').trim();
const displayName = file => {
    if (!canReadFile(file)) return file?.Name || file?.name || '无权限附件';
    const path = getFilePath(file);
    return file?.Name || file?.name || path.split(/[\\/]/).pop() || '附件';
};
const uploaderName = file => file?.UploaderName || file?.Uploader?.Name || file?.UploaderAccount || file?.Uploader?.Account || file?.UploadUserName || file?.UserName || file?.Account || '—';
const uploadTime = file => file?.UploadTime || file?.Uploader?.UploadTime || file?.CreateTime || file?.createTime || '';
const readableFiles = computed(() => files.value.filter(file => canReadFile(file) && getFilePath(file)));
const selectedFiles = computed(() => readableFiles.value.filter(file => selectedIds.value.includes(file._key)));
const allReadableSelected = computed(() => readableFiles.value.length > 0 && selectedFiles.value.length === readableFiles.value.length);

watch(files, value => {
    const available = new Set(value.filter(file => canReadFile(file) && getFilePath(file)).map(file => file._key));
    selectedIds.value = selectedIds.value.filter(id => available.has(id));
    if (selectedIds.value.length === 0) selectedIds.value = Array.from(available);
}, { immediate: true });

const setSelected = (file, checked) => {
    if (!canReadFile(file) || !getFilePath(file)) return;
    if (checked) {
        if (!selectedIds.value.includes(file._key)) selectedIds.value = [...selectedIds.value, file._key];
    } else {
        selectedIds.value = selectedIds.value.filter(id => id !== file._key);
    }
};

const toggleSelectAll = () => {
    selectedIds.value = allReadableSelected.value ? [] : readableFiles.value.map(file => file._key);
};

const contextBody = () => ({
    ...(props.DataAppend?.Context || {}),
    FormEngineKey: props.DataAppend?.Context?.FormEngineKey || props.DataAppend?.FormEngineKey,
    FormDataId: props.DataAppend?.Context?.FormDataId || props.DataAppend?.FormDataId,
    FieldId: props.DataAppend?.Context?.FieldId || props.DataAppend?.FieldId,
    SysMenuId: props.DataAppend?.Context?.SysMenuId || props.DataAppend?.SysMenuId,
    _TableChildAuth: props.DataAppend?.Context?._TableChildAuth || props.DataAppend?._TableChildAuth
});

const showError = message => {
    if (DiyCommon?.Tips) DiyCommon.Tips(message, false);
    else console.error(message);
};

const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
    }, 1000);
};

const downloadSingle = async file => {
    const path = getFilePath(file);
    if (!canReadFile(file) || !path) return;
    downloadingKey.value = file._key;
    try {
        if (!DiyCommon?.PostAsync) {
            showError('文件下载服务未初始化');
            return;
        }
        const result = await DiyCommon.PostAsync('/apiengine/platform-private-file-url', {
            ...contextBody(),
            FilePathName: path
        }, null, null, 'json');
        if (!DiyCommon.Result(result) || !result.Data) {
            showError(result?.Msg || '文件下载地址获取失败');
            return;
        }
        const url = String(result.Data);
        const link = document.createElement('a');
        link.href = url;
        link.download = displayName(file);
        link.target = '_blank';
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 1000);
    } catch (error) {
        showError(error?.message || '文件下载失败');
    } finally {
        downloadingKey.value = '';
    }
};

const downloadZip = async () => {
    const paths = selectedFiles.value.map(getFilePath).filter(Boolean);
    if (paths.length === 0) return;
    if (!DiyCommon?.GetApiBase || !DiyCommon?.Authorization) {
        showError('文件下载服务未初始化');
        return;
    }
    zipLoading.value = true;
    try {
        const response = await fetch(`${String(DiyCommon.GetApiBase()).replace(/\/+$/, '')}/api/HDFS/DownloadFilesZip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                authorization: `Bearer ${DiyCommon.Authorization()}`
            },
            body: JSON.stringify({
                ...contextBody(),
                FilePathNames: paths,
                ArchiveName: props.DataAppend?.ArchiveName || '附件下载.zip'
            })
        });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.toLowerCase().includes('zip')) {
            let message = '文件压缩下载失败';
            try {
                const payload = await response.json();
                message = payload?.Msg || payload?.message || message;
            } catch (_) { }
            showError(message);
            return;
        }
        downloadBlob(await response.blob(), props.DataAppend?.ArchiveName || '附件下载.zip');
    } catch (error) {
        showError(error?.message || '文件压缩下载失败');
    } finally {
        zipLoading.value = false;
    }
};
</script>

<style scoped>
.diy-file-download-dialog { display: flex; flex-direction: column; gap: 12px; min-height: 300px; }
.download-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.download-summary, .download-dialog-hint { color: var(--el-text-color-secondary); font-size: 13px; }
.download-actions { display: flex; gap: 8px; }
.download-file-table { width: 100%; }
.is-unauthorized { color: var(--el-text-color-secondary); }
.muted-action { color: var(--el-text-color-placeholder); font-size: 12px; }
.download-dialog-hint { padding: 4px 0; }
</style>
