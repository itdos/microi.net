<template>
    <div class="diy-imgupload">
        <!-- 上传组件 - 编辑/新增模式 -->
        <el-upload
            v-if="FormMode != 'View' && field.Visible"
            ref="uploadRef"
            drag
            :multiple="field.Config.ImgUpload.Multiple === true"
            :limit="field.Config.ImgUpload.MaxCount"
            :action="GetUploadUrl()"
            :data="{
                Path: '/img',
                Limit: field.Config.ImgUpload.Limit,
                Preview: field.Config.ImgUpload.Preview
            }"
            :headers="GetUploadHeaders()"
            :before-upload="(file) => BeforeImgUpload(file)"
            :on-exceed="() => onExceed()"
            :on-success="(result, file, fileList) => ImgUploadSuccess(result, file, fileList)"
            :on-remove="(file, fileList) => ImgUploadRemove(file, fileList)"
            :show-file-list="false"
        >
            <el-icon class="el-icon--upload">
                <upload-filled />
            </el-icon>
            <div class="el-upload__text">将图片拖到此处，或<em>点击上传</em></div>
            <template #tip>
                <div class="el-upload__tip">{{ field.Config.ImgUpload.Tips }}</div>
            </template>
        </el-upload>

        <!-- 单图片显示 - 编辑/新增模式 -->
        <div v-if="FormMode != 'View' && field.Visible && !getMultipleFlag && isValidSingleImgValue(modelValue)" 
            class="single-img-display">
            <el-image
                :src="getImageDisplayPath()"
                :preview-src-list="[getImageDisplayPath()]"
                fit="cover"
                class="preview-image"
            />
            <div class="img-actions">
                <span class="img-name">{{ GetFileName(modelValue) }}</span>
                <span class="img-size">{{ getSingleImgSize() }}</span>
                <el-button 
                    type="danger" 
                    size="small" 
                    :icon="Delete" 
                    @click="ConfirmDelSingleUpload()"
                    link
                >
                    删除
                </el-button>
            </div>
        </div>

        <!-- 查看模式 - 单图片 -->
        <div v-if="FormMode == 'View' && !getMultipleFlag && isValidSingleImgValue(modelValue)" 
            class="single-img-display view-mode">
            <el-image
                :src="getImageDisplayPath()"
                :preview-src-list="[getImageDisplayPath()]"
                fit="cover"
                class="preview-image"
            />
            <div class="img-info">
                <span class="img-name">{{ GetFileName(modelValue) }}</span>
                <span class="img-size">{{ getSingleImgSize() }}</span>
            </div>
        </div>

        <!-- 多图片显示 -->
        <div
            v-if="getMultipleFlag && showMultipleImgList"
            ref="sortableContainer"
            class="multiple-imgs-list"
        >
            <el-card
                v-for="img in imageListComputed"
                :key="img.Id"
                class="img-card"
                :data-id="img.Id"
                :body-style="{ padding: '0px' }"
            >
                <el-icon class="drag-handle"><Rank /></el-icon>
                <el-image
                    :src="FormDiyTableModel[field.Name + '_' + img.Id + '_RealPath']"
                    :preview-src-list="GetImgUploadImgs()"
                    fit="cover"
                    class="card-image"
                />
                <div class="card-footer">
                    <div class="img-detail">
                        <div class="img-name" :title="img.Name">
                            <el-input 
                                v-if="FormMode == 'Edit' || FormMode == 'Add'" 
                                v-model="img.Name" 
                                size="small"
                            />
                            <span v-else>{{ img.Name }}</span>
                        </div>
                        <div class="img-meta">
                            <span class="img-size">{{ formatFileSize(img.Size) }}</span>
                            <time v-if="img.CreateTime" class="img-time">{{ img.CreateTime }}</time>
                        </div>
                        <el-tag v-if="img.State == 0" type="info" size="small">待上传</el-tag>
                        <el-tag v-else-if="img.State == 1" type="success" size="small">已上传</el-tag>
                        <el-tag v-else type="danger" size="small">失败</el-tag>
                    </div>
                    <el-button 
                        v-if="FormMode != 'View'" 
                        type="danger" 
                        size="small"
                        :icon="Delete" 
                        @click="ConfirmDelUploadImgs(img)"
                        link
                    />
                </div>
            </el-card>
        </div>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            title="图片上传配置"
            width="500px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <el-form label-width="140px" label-position="left" size="small">
                <el-form-item label="禁止匿名访问">
                    <el-switch v-model="configForm.Limit" active-color="#ff6c04" inactive-color="#ccc" />
                    <div class="form-item-tip">开启后图片将通过私有链接访问</div>
                </el-form-item>
                
                <el-form-item label="多图片上传">
                    <el-switch v-model="configForm.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    <div class="form-item-tip">开启后支持上传多张图片</div>
                </el-form-item>
                
                <el-form-item label="最大允许上传个数">
                    <el-input-number v-model="configForm.MaxCount" :min="1" :max="100" />
                    <div class="form-item-tip">多图片上传时的最大数量限制</div>
                </el-form-item>
                
                <el-form-item label="上传说明">
                    <el-input v-model="configForm.Tips" placeholder="如：支持jpg、png、gif格式" />
                    <div class="form-item-tip">显示在上传区域下方的提示文字</div>
                </el-form-item>
                
                <el-form-item label="是否压缩">
                    <el-switch v-model="configForm.Preview" active-color="#ff6c04" inactive-color="#ccc" />
                    <div class="form-item-tip">开启后会自动生成压缩预览图</div>
                </el-form-item>
                
                <el-form-item label="最大体积(M)">
                    <el-input-number v-model="configForm.MaxSize" :min="1" :max="1024" />
                    <div class="form-item-tip">单张图片的最大体积限制，单位MB</div>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, getCurrentInstance, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { UploadFilled, Delete, Rank } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import Sortable from 'sortablejs';

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

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
const emit = defineEmits(['update:modelValue', 'CallbackRunV8Code']);

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
const DiyApi = instance.appContext.config.globalProperties.DiyApi;

// 响应式数据
const uploadRef = ref(null);
const sortableContainer = ref(null);
let sortableInstance = null;

// 配置弹窗相关
const configDialogVisible = ref(false);
const configForm = ref({
    Limit: false,
    Multiple: false,
    MaxCount: 10,
    Tips: '',
    Preview: false,
    MaxSize: 10
});

// 打开配置弹窗
const openConfig = () => {
    // 初始化配置表单
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.ImgUpload) {
        props.field.Config.ImgUpload = {};
    }
    configForm.value = {
        Limit: props.field.Config.ImgUpload.Limit || false,
        Multiple: props.field.Config.ImgUpload.Multiple || false,
        MaxCount: props.field.Config.ImgUpload.MaxCount || 10,
        Tips: props.field.Config.ImgUpload.Tips || '',
        Preview: props.field.Config.ImgUpload.Preview || false,
        MaxSize: props.field.Config.ImgUpload.MaxSize || 10
    };
    configDialogVisible.value = true;
};

// 保存配置
const saveConfig = () => {
    // 保存配置到 field.Config.ImgUpload
    if (!props.field.Config.ImgUpload) {
        props.field.Config.ImgUpload = {};
    }
    props.field.Config.ImgUpload.Limit = configForm.value.Limit;
    props.field.Config.ImgUpload.Multiple = configForm.value.Multiple;
    props.field.Config.ImgUpload.MaxCount = configForm.value.MaxCount;
    props.field.Config.ImgUpload.Tips = configForm.value.Tips;
    props.field.Config.ImgUpload.Preview = configForm.value.Preview;
    props.field.Config.ImgUpload.MaxSize = configForm.value.MaxSize;
    
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法给父组件
defineExpose({
    openConfig
});

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
    return props.field.Config.ImgUpload.Multiple === true || props.field.Config.ImgUpload.Multiple === 'true';
});

// 是否显示多图片列表
const showMultipleImgList = computed(() => {
    return !DiyCommon.IsNull(props.modelValue) &&
           props.modelValue != '正在上传中...' &&
           Array.isArray(props.modelValue) &&
           props.modelValue.length > 0;
});

// 图片列表计算属性
const imageListComputed = computed(() => {
    if (!Array.isArray(props.modelValue)) return [];
    return props.modelValue.filter(img => img && img.Id);
});

// 验证单图片值是否有效
const isValidSingleImgValue = (value) => {
    // 先规范化数据
    const normalized = normalizeValue(value);
    
    if (DiyCommon.IsNull(normalized)) return false;
    if (normalized === '正在上传中...') return false;
    if (normalized === '[]' || normalized === '[ ]') return false;
    if (normalized === 'null' || normalized === 'undefined') return false;
    if (Array.isArray(normalized)) return false;
    // 如果是对象（单图片JSON格式），检查Path字段
    if (typeof normalized === 'object' && normalized !== null) {
        return !DiyCommon.IsNull(normalized.Path);
    }
    return true;
};

// 获取图片显示路径
const getImageDisplayPath = () => {
    const pathKey = props.field.Name + '_' + props.field.Name + '_RealPath';
    const realPath = props.FormDiyTableModel[pathKey];
    
    if (!DiyCommon.IsNull(realPath) && realPath !== './static/img/loading.gif') {
        return realPath;
    }
    
    // 如果RealPath还未设置，返回loading图片
    return './static/img/loading.gif';
};

// 初始化拖动排序
const initSortable = () => {
    // 确保容器存在且FormMode不是View
    if (!sortableContainer.value || props.FormMode === 'View') {
        return;
    }
    
    // 如果已经初始化过，先销毁
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    
    // 使用nextTick确保DOM完全渲染
    nextTick(() => {
        if (sortableContainer.value) {
            sortableInstance = Sortable.create(sortableContainer.value, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: (evt) => {
                    const { oldIndex, newIndex } = evt;
                    if (oldIndex === newIndex) return;
                    
                    const images = [...props.modelValue];
                    const movedItem = images.splice(oldIndex, 1)[0];
                    images.splice(newIndex, 0, movedItem);
                    
                    emit('update:modelValue', images);
                    console.log('图片排序更新:', images);
                }
            });
            console.log('Sortable初始化成功');
        } else {
            console.warn('Sortable初始化失败：容器不存在');
        }
    });
};

// 获取上传URL
const GetUploadUrl = () => {
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
    DiyCommon.Tips(`最多只能上传${props.field.Config.ImgUpload.MaxCount}张图片`, false);
};

// 上传前的钩子
const BeforeImgUpload = (file) => {
    console.log('=== BeforeImgUpload START ===');
    console.log('file:', file);
    console.log('isMultiple:', getMultipleFlag.value);
    
    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
        DiyCommon.Tips('只能上传图片文件！', false);
        return false;
    }
    
    if (!getMultipleFlag.value) {
        // 单图片模式：设置上传中状态
        props.FormDiyTableModel[props.field.Name] = '正在上传中...';
        emit('update:modelValue', '正在上传中...');
        console.log('【单图片】设置上传中状态');
    } else {
        // 多图片模式：添加State=0的占位图片
        console.log('【多图片】准备上传，file.uid:', file.uid);
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
        console.log('【多图片】添加占位图片，State=0');
    }
    
    console.log('=== BeforeImgUpload END ===');
    return true;
};

// 图片上传移除
const ImgUploadRemove = (file, fileList) => {
    if (!getMultipleFlag.value) {
        props.FormDiyTableModel[props.field.Name] = '';
        emit('update:modelValue', '');
    }
};

// 上传成功的钩子
const ImgUploadSuccess = (result, file, fileList) => {
    console.log('=== ImgUploadSuccess 被调用了 ===');
    console.log('原始 result:', result);
    console.log('原始 file:', file);
    console.log('原始 file.response:', file.response);
    
    const isSuccess = DiyCommon.Result(result);
    console.log('DiyCommon.Result(result) 返回:', isSuccess);
    
    if (isSuccess) {
        const responseData = file.response?.Data || result.Data;
        const uploadedImgId = responseData.Id || file.uid;
        const uploadedImgPath = responseData.Path;
        
        if (getMultipleFlag.value) {
            // 多图片模式
            let imgsJson = props.FormDiyTableModel[props.field.Name];
            if (!Array.isArray(imgsJson)) imgsJson = [];
            
            console.log('【多图片】当前图片列表:', JSON.parse(JSON.stringify(imgsJson)));
            console.log('【多图片】查找file.uid:', file.uid);
            
            let isHave = false;
            imgsJson.forEach((element) => {
                if (element.Id == file.uid) {
                    console.log('【多图片】✓ 找到匹配图片，更新State为1');
                    element.Id = uploadedImgId;
                    element.Size = responseData.Size;
                    element.CreateTime = responseData.CreateTime;
                    element.Path = uploadedImgPath;
                    element.State = 1;
                    element.Name = responseData.Name || file.name;
                    isHave = true;
                }
            });
            
            if (!isHave) {
                console.log('【多图片】× 未找到匹配图片，添加新图片');
                const pushed = responseData || {};
                if (!pushed.Id) pushed.Id = file.uid;
                pushed.State = 1;
                imgsJson.push(pushed);
            }
            
            props.FormDiyTableModel[props.field.Name] = imgsJson;
            emit('update:modelValue', imgsJson);
            console.log('【多图片】更新后的图片列表:', JSON.parse(JSON.stringify(imgsJson)));

            // 立即设置RealPath
            setRealPath(uploadedImgId, uploadedImgPath, props.field.Config.ImgUpload.Limit);
        } else {
            // 单图片模式 - 存储为JSON字符串
            console.log('【单图片】上传成功，Path:', uploadedImgPath);
            const singleImgObject = {
                Id: uploadedImgId,
                Name: responseData.Name || file.name,
                Size: responseData.Size,
                CreateTime: responseData.CreateTime,
                Path: uploadedImgPath,
                State: 1
            };
            // 存储为JSON字符串
            const jsonString = JSON.stringify(singleImgObject);
            props.FormDiyTableModel[props.field.Name] = jsonString;
            emit('update:modelValue', jsonString);
            console.log('【单图片】存储的JSON字符串:', jsonString);
            console.log('【单图片】验证存储类型:', typeof props.FormDiyTableModel[props.field.Name]);
            console.log('【单图片】验证字符串是否正确:', props.FormDiyTableModel[props.field.Name].charAt ? '是字符串' : '不是字符串');
            
            nextTick(() => {
                console.log('【单图片】nextTick - modelValue已更新:', props.modelValue);
                setRealPath(props.field.Name, uploadedImgPath, props.field.Config.ImgUpload.Limit);
            });
        }

        if (props.field.Config && props.field.Config.Upload && props.field.Config.Upload.onChange) {
            emit('CallbackRunV8Code', { field: props.field });
        }
        
        console.log('=== ImgUploadSuccess END ===');
    } else {
        console.error('【上传失败】接口返回失败:', result);
    }
};

// 设置RealPath
const setRealPath = (imgId, imgPath, isLimit) => {
    const pathKey = props.field.Name + '_' + imgId + '_RealPath';
    console.log('=== setRealPath START ===');
    console.log('参数 imgId:', imgId);
    console.log('参数 imgPath:', imgPath);
    console.log('参数 isLimit:', isLimit);
    console.log('计算出的 pathKey:', pathKey);
    
    if (isLimit === true) {
        // 私有图片，需要获取临时URL
        props.FormDiyTableModel[pathKey] = './static/img/loading.gif';
        console.log('【私有图片】设置loading状态');
        
        DiyCommon.Post(
            '/api/HDFS/GetPrivateFileUrl',
            {
                FilePathName: imgPath,
                HDFS: props.SysConfig.HDFS || 'Aliyun',
                FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                FormDataId: props.TableRowId,
                FieldId: props.field.Id
            },
            (privateResult) => {
                if (DiyCommon.Result(privateResult)) {
                    props.FormDiyTableModel[pathKey] = privateResult.Data;
                    console.log('【私有图片】URL获取成功:', privateResult.Data);
                } else {
                    props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                    console.error('【私有图片】URL获取失败');
                }
            },
            () => {
                props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                console.error('【私有图片】URL请求异常');
            }
        );
    } else {
        // 公开图片，直接拼接路径
        const serverPath = DiyCommon.GetServerPath(imgPath);
        props.FormDiyTableModel[pathKey] = serverPath;
        console.log('【公开图片】路径设置完成');
        console.log('【公开图片】serverPath:', serverPath);
    }
    
    console.log('=== setRealPath END ===');
};

// 确认删除图片
const ConfirmDelUploadImgs = (img) => {
    ElMessageBox.confirm(
        `确定要删除图片 "${img.Name}" 吗？`,
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(() => {
        DelUploadImgs(img);
    }).catch(() => {});
};

// 删除多图片
const DelUploadImgs = (img) => {
    const images = props.FormDiyTableModel[props.field.Name].filter(i => i.Id !== img.Id);
    props.FormDiyTableModel[props.field.Name] = images;
    emit('update:modelValue', images);
};

// 确认删除单图片
const ConfirmDelSingleUpload = () => {
    const imgName = GetFileName(props.modelValue);
    ElMessageBox.confirm(
        `确定要删除图片 "${imgName}" 吗？`,
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

// 删除单图片
const DelSingleUpload = () => {
    delete props.FormDiyTableModel[props.field.Name];
    delete props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'];
    delete props.FormDiyTableModel[props.field.Name + '_FileSize'];
    
    props.FormDiyTableModel[props.field.Name] = '';
    props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'] = '';
    
    if (uploadRef.value) {
        uploadRef.value.clearFiles();
    }
    
    emit('update:modelValue', '');
};

// 获取文件名
const GetFileName = (path) => {
    // 先规范化数据
    const normalized = normalizeValue(path);
    
    if (DiyCommon.IsNull(normalized)) {
        return '';
    }
    // 如果是对象（单图片JSON格式），直接返回Name
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

// 获取单图片的大小
const getSingleImgSize = () => {
    // 先规范化数据
    const normalized = normalizeValue(props.modelValue);
    
    // 如果是对象（单图片JSON格式），从对象中读取Size
    if (typeof normalized === 'object' && normalized !== null && normalized.Size) {
        return formatFileSize(normalized.Size);
    }
    // 兼容老数据（字符串格式）- 尝试从旧的FileSize字段读取
    const sizeKey = props.field.Name + '_FileSize';
    const size = props.FormDiyTableModel[sizeKey];
    return formatFileSize(size);
};

// 获取多图片预览列表
const GetImgUploadImgs = () => {
    const arr = props.FormDiyTableModel[props.field.Name];
    if (!Array.isArray(arr)) return [];
    
    const result = [];
    arr.forEach((img) => {
        const path = props.FormDiyTableModel[props.field.Name + '_' + img.Id + '_RealPath'];
        if (!DiyCommon.IsNull(path) && path !== './static/img/loading.gif') {
            result.push(path);
        }
    });
    return result;
};

// 获取上传后的下载地址（用于View模式）
const GetUploadPath = (img) => {
    // 获取图片路径：如果是单图片对象，从Path字段获取；否则使用原值或img.Path
    let imgPathName;
    if (DiyCommon.IsNull(img)) {
        const fieldValue = props.FormDiyTableModel[props.field.Name];
        // 先规范化数据
        const normalized = normalizeValue(fieldValue);
        // 如果是对象（单图片JSON格式），取Path字段
        if (typeof normalized === 'object' && normalized !== null && normalized.Path) {
            imgPathName = normalized.Path;
        } else {
            imgPathName = normalized;
        }
    } else {
        imgPathName = img.Path;
    }
    
    if (DiyCommon.IsNull(imgPathName) || Array.isArray(imgPathName)) {
        return;
    }
    
    if (imgPathName === '[]' || imgPathName === '[ ]' || imgPathName === 'null' || imgPathName === 'undefined') {
        return;
    }

    const limit = props.field.Config.ImgUpload.Limit;
    const imgId = props.field.Name;

    if (limit !== true) {
        const serverPath = DiyCommon.GetServerPath(imgPathName);
        props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = serverPath;
    } else {
        const nowPath = props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'];
        
        if (DiyCommon.IsNull(nowPath) || nowPath == './static/img/loading.gif') {
            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/loading.gif';
            if (imgPathName != './static/img/loading.gif' && imgPathName != '正在上传中...') {
                DiyCommon.Post(
                    '/api/HDFS/GetPrivateFileUrl',
                    {
                        FilePathName: imgPathName,
                        HDFS: props.SysConfig.HDFS || 'Aliyun',
                        FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                        FormDataId: props.TableRowId,
                        FieldId: props.field.Id
                    },
                    (result) => {
                        if (DiyCommon.Result(result)) {
                            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = result.Data;
                        } else {
                            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/img-load-fail.jpg';
                        }
                    },
                    () => {
                        props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/img-load-fail.jpg';
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
            GetUploadPath(null);
        }
    },
    { immediate: true }
);

// 监听图片列表变化，重新初始化sortable
watch(
    () => showMultipleImgList.value,
    async (newVal) => {
        if (newVal) {
            await nextTick();
            initSortable();
        }
    }
);

// 组件挂载后初始化
onMounted(() => {
    if (showMultipleImgList.value) {
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
.diy-imgupload {
    width: 100%;

    .single-img-display {
        margin-top: 8px;
        display: inline-flex;
        flex-direction: column;
        gap: 8px;

        &.view-mode {
            .img-actions {
                justify-content: flex-start;
            }
        }

        .preview-image {
            width: 175px;
            height: 175px;
            border-radius: 4px;
            border: 1px solid #e4e7ed;
        }

        .img-actions, .img-info {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;

            .img-name {
                flex: 1;
                font-size: 14px;
                color: #606266;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .img-size {
                font-size: 12px;
                color: #909399;
                flex-shrink: 0;
            }
        }
    }

    .multiple-imgs-list {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .img-card {
            width: 140px;
            position: relative;
            cursor: move;
            transition: all 0.2s;

            &:hover {
                box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
            }

            .drag-handle {
                position: absolute;
                top: 4px;
                left: 4px;
                font-size: 18px;
                color: #fff;
                cursor: move;
                z-index: 1;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                padding: 2px;
                
                &:hover {
                    background: rgba(0, 0, 0, 0.7);
                }
            }

            .card-image {
                width: 140px;
                height: 140px;
            }

            .card-footer {
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 4px;

                .img-detail {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;

                    .img-name {
                        font-size: 12px;
                        color: #606266;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;

                        :deep(.el-input) {
                            .el-input__wrapper {
                                padding: 2px 6px;
                            }
                            .el-input__inner {
                                font-size: 12px;
                            }
                        }
                    }

                    .img-meta {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 4px;
                        font-size: 11px;
                        color: #909399;

                        .img-size {
                            flex-shrink: 0;
                        }

                        .img-time {
                            flex: 1;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    }
                }

                .el-button {
                    align-self: flex-end;
                    margin-top: 2px;
                }
            }
        }
    }
}

.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
