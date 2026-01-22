<template>
    <div>
        <el-upload
            v-if="FormMode != 'View'"
            :ref="field.Component + '_' + field.Name"
            :show-file-list="false"
            class="upload-drag-style"
            :action="DiyApi.Upload()"
            :data="{
                Path: '/file',
                Limit: field.Config.FileUpload.Limit,
                Preview: false
            }"
            :headers="{ authorization: 'Bearer ' + DiyCommon.Authorization() }"
            drag
            :multiple="field.Config.FileUpload.Multiple"
            :limit="field.Config.FileUpload.Multiple == true ? field.Config.FileUpload.MaxCount : 1"
            :before-upload="
                (file) => {
                    return BeforeFileUpload(file, field);
                }
            "
            :on-success="
                (result, file, fileList) => {
                    return FileUploadSuccess(result, file, fileList, field);
                }
            "
            :on-remove="
                (file, fileList) => {
                    return FileUploadRemove(file, fileList, field);
                }
            "
        >
            <i class="el-icon-upload" />
            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
            <div slot="tip" class="el-upload__tip">
                {{ field.Config.FileUpload.Tips }}
            </div>
        </el-upload>
        <!--如果是单文件，并且不等于空，则直接显示下载路径-->
        <div v-if="!field.Config.FileUpload.Multiple && !DiyCommon.IsNull(FormDiyTableModel[field.Name])" style="">
            {{ GetUploadPath(field) }}
            <i :class="FormDiyTableModel[field.Name] == '正在上传中...' ? 'el-icon-loading mr-1' : 'el-icon-document mr-1'"></i>
            <a class="mr-2" :href="FormDiyTableModel[field.Name + '_' + field.Name + '_RealPath']" target="_blank">
                {{ FormDiyTableModel[field.Name] }}
            </a>
            <el-button type="text" v-if="FormMode != 'View'" icon="el-icon-delete" @click="DelSingleUpload(field)"> </el-button>
        </div>
        <!--如果是多文件，并且不等于空，则显示列表-->
        <template v-else-if="field.Config.FileUpload.Multiple && !DiyCommon.IsNull(FormDiyTableModel[field.Name]) && FormDiyTableModel[field.Name].length > 0">
            <el-table :data="GetFileUpladFils(field)" :show-header="false">
                <el-table-column type="index" width="35"> </el-table-column>
                <el-table-column width="35">
                    <template slot-scope="scope">
                        <i :class="scope.row.State == 0 ? 'el-icon-loading' : 'el-icon-document'"></i>
                    </template>
                </el-table-column>
                <el-table-column>
                    <template slot-scope="scope">
                        {{ GetUploadPath(field, scope.row) }}
                        <a class="fileupload-a" :href="FormDiyTableModel[field.Name + '_' + scope.row.Id + '_RealPath']" target="_blank">
                            {{ scope.row.Name }}
                        </a>
                    </template>
                </el-table-column>
                <el-table-column width="100" prop="Size"> </el-table-column>
                <el-table-column v-if="FormMode != 'View'" width="35">
                    <template slot-scope="scope">
                        <el-button type="text" icon="el-icon-delete" @click="DelUploadFiles(scope.row, field)"> </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <!-- <div v-for="(file, index) in FormDiyTableModel[field.Name]"
            :key="file.Id + index"
            class="fileupload-file-item"
            style=""
        >
            {{GetUploadPath(field, file.Path, field.Config.FileUpload.Limit, file.Id)}}
            <a class="fileupload-a"
                :href="FormDiyTableModel[field.Name + '_' + file.Id + '_RealPath']" target="_blank">
                {{file.Name}}
            </a>
        </div> -->
        </template>
    </div>
</template>

<script>
export default {
    name: "file-upload",
    data() {
        return {};
    },

    components: {},

    computed: {},

    mounted() {},

    methods: {
        GetFieldValue(field, form) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.AsName)) {
                return form[field.AsName];
            }
            return form[field.Name];
        }
    }
};
</script>

<style lang="scss" scoped></style>
