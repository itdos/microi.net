<template>
    <div class="diy-fileupload">
        <el-upload
            v-if="FormMode != 'View' && field.Visible"
            ref="uploadRef"
            drag
            :multiple="field.Config.FileUpload.Multiple === true"
            :limit="field.Config.FileUpload.MaxCount"
            :action="GetUploadUrl(field)"
            :data="{
                Path: '/file',
                Limit: field.Config.FileUpload.Limit,
                Preview: false
            }"
            :headers="GetUploadHeaders()"
            :before-upload="(file) => BeforeFileUpload(file)"
            :on-exceed="() => onExceed()"
            :on-success="(result, file, fileList) => FileUploadSuccess(result, file, fileList)"
            :on-remove="(file, fileList) => FileUploadRemove(file, fileList)"
            :show-file-list="false"
        >
            <el-icon class="el-icon--upload">
                <upload-filled />
            </el-icon>
            <div class="el-upload__text">拖拽文件到此处，或<em>点击上传</em></div>
            <template #tip>
                <div class="el-upload__tip">{{ field.Config.FileUpload.Tips }}</div>
            </template>
        </el-upload>

        <!-- 单文件显示 - 编辑/新增模式 -->
        <div v-if="FormMode != 'View' && field.Visible && !field.Config.FileUpload.Multiple && !DiyCommon.IsNull(modelValue) && modelValue != '正在上传中...'"
            class="single-file-display">
            <div class="file-info">
                <el-icon class="file-icon">
                    <component :is="getFileIcon(GetFileName(modelValue))" />
                </el-icon>
                <div class="file-detail">
                    <span class="file-name" @click="GoUrl(FormDiyTableModel[field.Name + '_' + field.Name + '_RealPath'])">
                        {{ GetFileName(modelValue) }}
                    </span>
                    <span class="file-size">{{ getSingleFileSize() }}</span>
                </div>
            </div>
            <el-button @click="ConfirmDelSingleUpload()" type="danger" size="small" :icon="Delete" link>删除</el-button>
        </div>

        <!-- 查看模式 - 单文件 -->
        <div v-if="FormMode == 'View' && !field.Config.FileUpload.Multiple && !DiyCommon.IsNull(modelValue) && modelValue != '正在上传中...'"
            class="single-file-display view-mode">
            <div class="file-info">
                <el-icon class="file-icon">
                    <component :is="getFileIcon(GetFileName(modelValue))" />
                </el-icon>
                <div class="file-detail">
                    <span class="file-name" @click="GoUrl(FormDiyTableModel[field.Name + '_' + field.Name + '_RealPath'])">
                        {{ GetFileName(modelValue) }}
                    </span>
                    <span class="file-size">{{ getSingleFileSize() }}</span>
                </div>
            </div>
        </div>

        <!-- 多文件显示 -->
        <div
            v-if="field.Config.FileUpload.Multiple == true && showMultipleFileList"
            ref="sortableContainer"
            class="multiple-files-list"
        >
            <div v-for="(file, index) in fileListComputed" :key="file.Id" class="file-item" :data-id="file.Id">
                <div class="file-item-content">
                    <el-icon class="drag-handle"><Rank /></el-icon>
                    <el-icon class="file-icon">
                        <component :is="getFileIcon(file.Name)" />
                    </el-icon>
                    <div class="file-details">
                        <div class="file-name-wrapper">
                            <el-input 
                                v-if="FormMode == 'Edit'" 
                                v-model="file.Name" 
                                size="small"
                                class="file-name-input"
                            />
                            <span 
                                v-else
                                class="file-name" 
                                @click="GoUrl(FormDiyTableModel[field.Name + '_' + file.Id + '_RealPath'])"
                            >
                                {{ file.Name }}
                            </span>
                        </div>
                        <span class="file-size">{{ formatFileSize(file.Size) }}</span>
                        <el-tag v-if="file.State == 0" type="info" size="small">待上传</el-tag>
                        <el-tag v-else-if="file.State == 1" type="success" size="small">已上传</el-tag>
                        <el-tag v-else type="danger" size="small">失败</el-tag>
                    </div>
                    <el-button 
                        v-if="FormMode != 'View'" 
                        size="small" 
                        type="danger" 
                        :icon="Delete" 
                        @click="ConfirmDelUploadFiles(file)"
                        link
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, getCurrentInstance, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { UploadFilled, Document, Delete, Rank, Picture, FolderOpened, Grid, VideoPlay, Tickets } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import Sortable from 'sortablejs';

// Props定义
const props = defineProps({
    modelValue: {
        type: [String, Array, Object],
        default: ''
    },
    field: {
        type: Object,
        required: true
    },
    FormDiyTableModel: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ''
    },
    SysConfig: {
        type: Object,
        default: () => ({})
    },
    DiyTableModel: {
        type: Object,
        default: () => ({})
    },
    TableRowId: {
        type: String,
        default: ''
    }
});

// Emits定义
const emit = defineEmits(['update:modelValue', 'CallbackRunV8Code', 'CallbackGoUrl']);

// 获取全局属性（正确的Vue3方式）
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
const DiyApi = instance.appContext.config.globalProperties.DiyApi;

// 响应式数据
const uploadRef = ref(null);
const sortableContainer = ref(null);
let sortableInstance = null;

// 处理兼容老数据：将字符串转换为对象格式
const normalizeValue = (value) => {
    if (DiyCommon.IsNull(value) || value === '正在上传中...') {
        return value;
    }
    
    // 如果是数组，直接返回
    if (Array.isArray(value)) {
        return value;
    }
    
    // 如果已经是对象，直接返回
    if (typeof value === 'object' && value !== null) {
        return value;
    }
    
    // 如果是字符串
    if (typeof value === 'string') {
        // 如果以{开头，说明是JSON字符串，解析它
        if (value.startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error('JSON解析失败:', e);
                // 解析失败，按老数据处理
            }
        }
        
        // 老数据（纯路径字符串），包装成新格式
        if (value && value !== '[]' && value !== '[ ]') {
            const fileName = value.split('/').pop();
            return {
                Id: 'legacy_' + new Date().getTime(),
                Name: fileName,
                Size: '',
                CreateTime: '',
                Path: value,
                State: 1
            };
        }
    }
    
    return value;
};

// 计算属性
const getMultipleFlag = computed(() => {
    return props.field.Config.FileUpload.Multiple === true || props.field.Config.FileUpload.Multiple === 'true';
});

// 是否显示多文件列表
const showMultipleFileList = computed(() => {
    return !DiyCommon.IsNull(props.modelValue) &&
           props.modelValue != '正在上传中...' &&
           Array.isArray(props.modelValue) &&
           props.modelValue.length > 0;
});

// 文件列表计算属性 - 用于响应式更新
const fileListComputed = computed(() => {
    if (!Array.isArray(props.modelValue)) return [];
    return props.modelValue.filter(file => file && file.Id);
});

// 根据文件扩展名获取图标组件
const getFileIcon = (fileName) => {
    if (!fileName) return Document;
    const ext = fileName.toLowerCase().split('.').pop();
    
    const iconMap = {
        // 图片
        jpg: Picture, jpeg: Picture, png: Picture, gif: Picture, bmp: Picture, svg: Picture, webp: Picture,
        // 文档
        doc: Document, docx: Document, txt: Document, rtf: Document, md: Document,
        // 表格
        xls: Grid, xlsx: Grid, csv: Grid,
        // PDF
        pdf: Tickets,
        // 压缩包
        zip: FolderOpened, rar: FolderOpened, '7z': FolderOpened, tar: FolderOpened, gz: FolderOpened,
        // 视频
        mp4: VideoPlay, avi: VideoPlay, mkv: VideoPlay, mov: VideoPlay, wmv: VideoPlay, flv: VideoPlay,
        // 音频
        // mp3: AudioFilled, wav: AudioFilled, flac: AudioFilled, ape: AudioFilled, aac: AudioFilled
    };
    
    return iconMap[ext] || Document;
};

// 初始化拖动排序
const initSortable = () => {
    if (sortableContainer.value && props.FormMode != 'View') {
        sortableInstance = Sortable.create(sortableContainer.value, {
            animation: 150,
            handle: '.drag-handle',
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                if (oldIndex === newIndex) return;
                
                const files = [...props.modelValue];
                const movedItem = files.splice(oldIndex, 1)[0];
                files.splice(newIndex, 0, movedItem);
                
                emit('update:modelValue', files);
                console.log('文件排序更新:', files);
            }
        });
    }
};

// 获取上传URL
const GetUploadUrl = (field) => {
    return DiyApi.Upload();
};

// 获取上传请求头
const GetUploadHeaders = () => {
    return {
        'authorization': 'Bearer ' + DiyCommon.Authorization()
    };
};

// 上传文件超出限制
const onExceed = () => {
    DiyCommon.Tips(`最多只能上传${props.field.Config.FileUpload.MaxCount}个文件`, false);
};

// 上传前的钩子
const BeforeFileUpload = (file) => {
    console.log('=== BeforeFileUpload START ===');
    console.log('file:', file);
    console.log('isMultiple:', getMultipleFlag.value);
    
    if (!getMultipleFlag.value) {
        // 单文件模式：设置上传中状态
        props.FormDiyTableModel[props.field.Name] = '正在上传中...';
        emit('update:modelValue', '正在上传中...');
        console.log('【单文件】设置上传中状态');
    } else {
        // 多文件模式：添加State=0的占位文件（与旧版本一致）
        console.log('【多文件】准备上传，file.uid:', file.uid);
        if (!Array.isArray(props.FormDiyTableModel[props.field.Name])) {
            props.FormDiyTableModel[props.field.Name] = [];
        }
        props.FormDiyTableModel[props.field.Name].push({
            Id: file.uid,
            State: 0,
            Name: file.name,
            Size: file.size
        });
        emit('update:modelValue', props.FormDiyTableModel[props.field.Name]);
        console.log('【多文件】添加占位文件，State=0');
    }
    
    console.log('=== BeforeFileUpload END ===');
    return true;
};

// 文件上传移除
const FileUploadRemove = (file, fileList) => {
    if (!props.field.Config.FileUpload.Multiple) {
        props.FormDiyTableModel[props.field.Name] = '';
        emit('update:modelValue', '');
    }
};

// 上传成功的钩子
const FileUploadSuccess = (result, file, fileList) => {
    console.log('=== FileUploadSuccess 被调用了 ===');
    console.log('原始 result:', result);
    console.log('原始 file:', file);
    console.log('原始 file.response:', file.response);
    console.log('原始 fileList:', fileList);
    console.log('fieldName:', props.field.Name);
    console.log('isMultiple:', getMultipleFlag.value);
    console.log('Limit:', props.field.Config.FileUpload.Limit);
    
    // 检查 DiyCommon.Result 的返回值
    const isSuccess = DiyCommon.Result(result);
    console.log('DiyCommon.Result(result) 返回:', isSuccess);
    
    if (isSuccess) {
        // 关键修复：使用 file.response.Data 而不是 result.Data
        const responseData = file.response?.Data || result.Data;
        const uploadedFileId = responseData.Id || file.uid;
        const uploadedFilePath = responseData.Path;
        
        if (getMultipleFlag.value) {
            // 多文件模式：查找并更新占位文件的State（与旧版本一致）
            let filesJson = props.FormDiyTableModel[props.field.Name];
            if (!Array.isArray(filesJson)) filesJson = [];
            
            console.log('【多文件】当前文件列表:', JSON.parse(JSON.stringify(filesJson)));
            console.log('【多文件】查找file.uid:', file.uid);
            console.log('【多文件】uploadedFileId:', uploadedFileId);
            
            // 查找并更新现有文件
            let isHave = false;
            filesJson.forEach((element) => {
                if (element.Id == file.uid) {
                    console.log('【多文件】✓ 找到匹配文件，更新State为1');
                    element.Id = uploadedFileId;
                    element.Size = responseData.Size;
                    element.CreateTime = responseData.CreateTime;
                    element.Path = uploadedFilePath;
                    element.State = 1;
                    element.Name = responseData.Name || file.name;
                    isHave = true;
                }
            });
            
            // 如果没找到，则添加新文件
            if (!isHave) {
                console.log('【多文件】× 未找到匹配文件，添加新文件');
                const pushed = responseData || {};
                if (!pushed.Id) pushed.Id = file.uid;
                pushed.State = 1;
                filesJson.push(pushed);
            }
            
            // 更新FormDiyTableModel和emit
            props.FormDiyTableModel[props.field.Name] = filesJson;
            emit('update:modelValue', filesJson);
            console.log('【多文件】更新后的文件列表:', JSON.parse(JSON.stringify(filesJson)));

            // 立即设置RealPath
            console.log('【多文件】准备设置RealPath，fileId:', uploadedFileId, 'path:', uploadedFilePath);
            setRealPath(uploadedFileId, uploadedFilePath, props.field.Config.FileUpload.Limit);
        } else {
            // 单文件模式 - 存储为JSON字符串
            console.log('【单文件】上传成功，Path:', uploadedFilePath);
            const singleFileObject = {
                Id: uploadedFileId,
                Name: responseData.Name || file.name,
                Size: responseData.Size,
                CreateTime: responseData.CreateTime,
                Path: uploadedFilePath,
                State: 1
            };
            // 存储为JSON字符串
            const jsonString = JSON.stringify(singleFileObject);
            props.FormDiyTableModel[props.field.Name] = jsonString;
            emit('update:modelValue', jsonString);
            console.log('【单文件】存储的JSON字符串:', jsonString);
            console.log('【单文件】验证存储类型:', typeof props.FormDiyTableModel[props.field.Name]);
            console.log('【单文件】验证字符串是否正确:', props.FormDiyTableModel[props.field.Name].charAt ? '是字符串' : '不是字符串');
            
            // 使用nextTick确保modelValue更新后再设置RealPath
            nextTick(() => {
                console.log('【单文件】nextTick - modelValue已更新:', props.modelValue);
                console.log('【单文件】准备设置RealPath，fileId:', props.field.Name, 'path:', uploadedFilePath);
                setRealPath(props.field.Name, uploadedFilePath, props.field.Config.FileUpload.Limit);
            });
        }

        if (props.field.Config && props.field.Config.Upload && props.field.Config.Upload.onChange) {
            emit('CallbackRunV8Code', { field: props.field });
        }
        
        console.log('=== FileUploadSuccess END ===');
    } else {
        console.error('【上传失败】接口返回失败:', result);
    }
};

// 设置RealPath
const setRealPath = (fileId, filePath, isLimit) => {
    const pathKey = props.field.Name + '_' + fileId + '_RealPath';
    console.log('=== setRealPath START ===');
    console.log('参数 fileId:', fileId);
    console.log('参数 filePath:', filePath);
    console.log('参数 isLimit:', isLimit);
    console.log('计算出的 pathKey:', pathKey);
    console.log('FormDiyTableModel当前值:', props.FormDiyTableModel[pathKey]);
    
    if (isLimit === true) {
        // 私有文件，需要获取临时URL
        props.FormDiyTableModel[pathKey] = './static/img/loading.gif';
        console.log('【私有文件】设置loading状态');
        
        DiyCommon.Post(
            '/api/HDFS/GetPrivateFileUrl',
            {
                FilePathName: filePath,
                HDFS: props.SysConfig.HDFS || 'Aliyun',
                FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                FormDataId: props.TableRowId,
                FieldId: props.field.Id
            },
            (privateResult) => {
                if (DiyCommon.Result(privateResult)) {
                    props.FormDiyTableModel[pathKey] = privateResult.Data;
                    console.log('【私有文件】URL获取成功:', privateResult.Data);
                    console.log('【私有文件】pathKey:', pathKey, '最终值:', props.FormDiyTableModel[pathKey]);
                } else {
                    props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                    console.error('【私有文件】URL获取失败');
                }
            },
            () => {
                props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                console.error('【私有文件】URL请求异常');
            }
        );
    } else {
        // 公开文件，直接拼接路径
        const serverPath = DiyCommon.GetServerPath(filePath);
        props.FormDiyTableModel[pathKey] = serverPath;
        console.log('【公开文件】路径设置完成');
        console.log('【公开文件】pathKey:', pathKey);
        console.log('【公开文件】serverPath:', serverPath);
        console.log('【公开文件】验证设置成功:', props.FormDiyTableModel[pathKey]);
    }
    
    console.log('=== setRealPath END ===');
};

// 确认删除上传的文件
const ConfirmDelUploadFiles = (file) => {
    ElMessageBox.confirm(
        `确定要删除文件 "${file.Name}" 吗？`,
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(() => {
        DelUploadFiles(file);
    }).catch(() => {});
};

// 删除上传的文件
const DelUploadFiles = (file) => {
    const files = props.FormDiyTableModel[props.field.Name].filter(f => f.Id !== file.Id);
    props.FormDiyTableModel[props.field.Name] = files;
    emit('update:modelValue', files);
};

// 确认删除单文件
const ConfirmDelSingleUpload = () => {
    const fileName = GetFileName(props.modelValue);
    ElMessageBox.confirm(
        `确定要删除文件 "${fileName}" 吗？`,
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(() => {
        DelSingleUpload();
    }).catch(() => {});
};

// 删除单文件上传
const DelSingleUpload = () => {
    delete props.FormDiyTableModel[props.field.Name];
    delete props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'];
    
    props.FormDiyTableModel[props.field.Name] = '';
    props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'] = '';
    
    if (uploadRef.value) {
        uploadRef.value.clearFiles();
    }
    
    emit('update:modelValue', '');
};

// 获取文件列表
const GetFileUpladFils = () => {
    var files = props.FormDiyTableModel[props.field.Name];
    if (!Array.isArray(files)) {
        return [];
    }
    return files;
};

// 获取文件列表（Element UI格式）
const GetFileList = (field) => {
    try {
        var fieldValue = props.FormDiyTableModel[field.Name];
        
        if (DiyCommon.IsNull(fieldValue) || fieldValue === '正在上传中...') {
            return [];
        }
        
        if (field.Config.FileUpload.Multiple != true) {
            var fileName;
            var fileUrl;
            
            // 如果是对象（单文件JSON格式），从对象中读取
            if (typeof fieldValue === 'object' && fieldValue !== null) {
                fileName = fieldValue.Name || '';
                fileUrl = fieldValue.Path || '';
            } else {
                // 兼容老数据（字符串格式）
                fileName = GetFileName(fieldValue);
                fileUrl = fieldValue;
            }
            
            if (field.Config.FileUpload.Limit == false) {
                return [{
                    name: fileName,
                    url: DiyCommon.GetFileServer() + fileUrl
                }];
            }
            return [{
                name: fileName,
                url: fileUrl
            }];
        }
        
        if (Array.isArray(fieldValue)) {
            return JsonToFileList(fieldValue);
        }
        
        return [];
    } catch (error) {
        console.error('GetFileList error:', error);
        return [];
    }
};

// 转换为文件列表
const JsonToFileList = (arr) => {
    return arr.map(element => ({
        name: element.Name,
        url: element.Path,
        Id: element.Id
    }));
};

// 打开URL
const GoUrl = (url) => {
    console.log('GoUrl called with:', url);
    if (DiyCommon.IsNull(url) || url === './static/img/loading.gif' || url === './static/img/img-load-fail.jpg') {
        console.warn('Invalid URL:', url);
        DiyCommon.Tips('文件路径未就绪，请稍后再试', false);
        return;
    }
    
    if (
        props.SysConfig &&
        (props.SysConfig.Is_online_office || props.SysConfig.OnlyOfficeApiBase) &&
        (url.indexOf('.doc') != -1 ||
            url.indexOf('.docx') != -1 ||
            url.indexOf('.xls') != -1 ||
            url.indexOf('.xlsx') != -1 ||
            url.indexOf('.ppt') != -1 ||
            url.indexOf('.pptx') != -1)
    ) {
        emit('CallbackGoUrl', url);
    } else {
        window.open(url, '_blank');
    }
};

// 获取文件名
const GetFileName = (path) => {
    // 先规范化数据
    const normalized = normalizeValue(path);
    
    if (DiyCommon.IsNull(normalized)) {
        return '';
    }
    // 如果是对象（单文件JSON格式），直接返回Name
    if (typeof normalized === 'object' && normalized !== null) {
        return normalized.Name || '';
    }
    // 如果是字符串路径，从路径中提取文件名
    var arr = normalized.split('/');
    return arr[arr.length - 1];
};

// 格式化文件大小
const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    if (bytes < k) return bytes + ' B';
    if (bytes < k * k) return (bytes / k).toFixed(2) + ' KB';
    if (bytes < k * k * k) return (bytes / (k * k)).toFixed(2) + ' MB';
    return (bytes / (k * k * k)).toFixed(2) + ' GB';
};

// 获取单文件的大小
const getSingleFileSize = () => {
    // 先规范化数据
    const normalized = normalizeValue(props.modelValue);
    
    // 如果是对象（单文件JSON格式），从对象中读取Size
    if (typeof normalized === 'object' && normalized !== null && normalized.Size) {
        return formatFileSize(normalized.Size);
    }
    // 兼容老数据（字符串格式）- 尝试从旧的FileSize字段读取
    const sizeKey = props.field.Name + '_FileSize';
    const size = props.FormDiyTableModel[sizeKey];
    return formatFileSize(size);
};

// 获取上传后的下载地址（用于View模式）
const GetUploadPath = (field, file) => {
    // 获取文件路径：如果是单文件对象，从Path字段获取；否则使用原值或file.Path
    var filePathName;
    if (DiyCommon.IsNull(file)) {
        var fieldValue = props.FormDiyTableModel[field.Name];
        // 先规范化数据
        const normalized = normalizeValue(fieldValue);
        // 如果是对象（单文件JSON格式），取Path字段
        if (typeof normalized === 'object' && normalized !== null && normalized.Path) {
            filePathName = normalized.Path;
        } else {
            filePathName = normalized;
        }
    } else {
        filePathName = file.Path;
    }
    
    if (DiyCommon.IsNull(filePathName) || Array.isArray(filePathName)) {
        return;
    }
    
    if (filePathName === '[]' || filePathName === '[ ]' || filePathName === 'null' || filePathName === 'undefined') {
        return;
    }

    var limit = field.Config[field.Component].Limit;
    var fileId = field.Name;

    if (limit !== true) {
        var serverPath = DiyCommon.GetServerPath(filePathName);
        props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'] = serverPath;
    } else {
        var nowPath = props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'];
        
        if (DiyCommon.IsNull(nowPath) || nowPath == './static/img/loading.gif') {
            props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'] = './static/img/loading.gif';
            if (filePathName != './static/img/loading.gif' && filePathName != '正在上传中...') {
                DiyCommon.Post(
                    '/api/HDFS/GetPrivateFileUrl',
                    {
                        FilePathName: filePathName,
                        HDFS: props.SysConfig.HDFS || 'Aliyun',
                        FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                        FormDataId: props.TableRowId,
                        FieldId: field.Id
                    },
                    (result) => {
                        if (DiyCommon.Result(result)) {
                            props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'] = result.Data;
                        } else {
                            props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'] = './static/img/img-load-fail.jpg';
                        }
                    },
                    () => {
                        props.FormDiyTableModel[field.Name + '_' + fileId + '_RealPath'] = './static/img/img-load-fail.jpg';
                    }
                );
            }
        }
    }
};

// 监听modelValue变化
watch(
    () => props.modelValue,
    (newVal) => {
        if (props.FormMode == 'View' && !DiyCommon.IsNull(newVal) && !getMultipleFlag.value) {
            GetUploadPath(props.field, null);
        }
    },
    { immediate: true }
);

// 监听文件列表变化，重新初始化sortable
watch(
    () => showMultipleFileList.value,
    async (newVal) => {
        if (newVal) {
            await nextTick();
            initSortable();
        }
    }
);

// 组件挂载后初始化
onMounted(() => {
    if (showMultipleFileList.value) {
        nextTick(() => {
            initSortable();
        });
    }
});

// 组件卸载前清理
onBeforeUnmount(() => {
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    uploadRef.value = null;
});
</script>

<style lang="scss" scoped>
.diy-fileupload {
    width: 100%;

    .single-file-display {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0px;
        margin-top: 5px;
        background: #f5f7fa;
        border: 1px solid #e4e7ed;
        border-radius: 4px;
        transition: all 0.2s;

        &:hover {
            background: #ecf5ff;
            border-color: #409eff;
        }

        &.view-mode {
            background: #fafafa;
            
            &:hover {
                background: #f0f0f0;
            }
        }

        .file-info {
            display: flex;
            align-items: center;
            flex: 1;
            gap: 8px;
            min-width: 0;

            .file-icon {
                font-size: 20px;
                color: #409eff;
                flex-shrink: 0;
            }

            .file-detail {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 8px;

                .file-name {
                    color: #409eff;
                    cursor: pointer;
                    font-size: 14px;
                    transition: color 0.2s;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;

                    &:hover {
                        color: #66b1ff;
                        text-decoration: underline;
                    }
                }

                .file-size {
                    color: #909399;
                    font-size: 12px;
                    flex-shrink: 0;
                }
            }
        }
    }

    .multiple-files-list {
        margin-top: 0px;
        border: 1px solid #e4e7ed;
        border-radius: 4px;
        overflow: hidden;

        .file-item {
            border-bottom: 1px solid #e4e7ed;
            transition: background 0.2s;

            &:last-child {
                border-bottom: none;
            }

            &:hover {
                background: #f5f7fa;
            }

            .file-item-content {
                display: flex;
                align-items: center;
                padding: 0px;
                gap: 8px;

                .drag-handle {
                    font-size: 16px;
                    color: #909399;
                    cursor: move;
                    flex-shrink: 0;
                    
                    &:hover {
                        color: #409eff;
                    }
                }

                .file-icon {
                    font-size: 20px;
                    color: #606266;
                    flex-shrink: 0;
                }

                .file-details {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;

                    .file-name-wrapper {
                        flex: 1;
                        min-width: 0;

                        .file-name-input {
                            :deep(.el-input__wrapper) {
                                padding: 2px 8px;
                            }
                        }
                    }

                    .file-name {
                        color: #409eff;
                        cursor: pointer;
                        font-size: 14px;
                        flex: 1;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        transition: color 0.2s;

                        &:hover {
                            color: #66b1ff;
                            text-decoration: underline;
                        }
                    }

                    .file-size {
                        color: #909399;
                        font-size: 12px;
                        flex-shrink: 0;
                    }

                    .el-tag {
                        flex-shrink: 0;
                    }
                }
            }
        }
    }
}
</style>
