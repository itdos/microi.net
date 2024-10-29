<template>
<div>
        <!-- :ref="'refTableChild_' + field.Name" -->
    <DiyTable
        :table-child-table-row-id="TableRowId"
        :container-class="ContainerClass"
        :table-child-field-label="TableChildFieldLabel"
        :table-child-table-id="TableChildTableId"
        :table-child-sys-menu-id="TableChildSysMenuId"
        :table-child-fk-field-name="TableChildFkFieldName"
        :table-child-callback-field="TableChildCallbackField"
        :table-child-form-mode="TableChildFormMode"
        :father-form-model="FatherFormModel"
        :table-child-data="TableChildData"
        :search-append="SearchAppend"></DiyTable>
</div>
</template>

<script>
import {DiyTable} from 'microi.net'
export default {
    name: 'DiyTableRowListTemp',
    components: {
        DiyTable
    },
    props: {
        TableRowId: {
            type: String,
            default: ''
        },
        //
        ContainerClass: {
            type: String,
            default: ''
        },
        //子表的DiyTableId
        TableChildTableId: {
            type: String,
            default: ''
        },
        //子表模块配置Id
        TableChildSysMenuId: {
            type: String,
            default: ''
        },
        //
        TableChildFkFieldName:{
            type: String,
            default: ''
        },
        //
        TableChildCallbackField:{
            type: String,
            default: ''
        },
        // TableChildFkValue:{
        //     type: String,
        //     default: ''
        // },
        TableChildTableRowId:{
            type: String,
            default: ''
        },
        FatherFormModel:{
            type: Object,
            default() {
                return {}
            }
        },
        //
        TableChildFieldLabel:{
            type: String,
            default: ''
        },
        //
        TableChildFormMode:{
            type: String,
            default: ''
        },
        //子表数据，由DiyForm传进来，会直接赋值到Table表格
        TableChildData:{
            type : Array,
            default() {
                return []
            }
        },
        //追加搜索条件.{'FieldName' : value, 'FieldName': value}
        SearchAppend:{
            type: Object,
            default() {
                return {}
            }
        },
        // //设置搜索条件.{'FieldName' : value, 'FieldName': value}
        // SearchSet:{
        //     type: Object,
        //     default() {
        //         return {}
        //     }
        // },
    },
    data() {
        return {

        }
    },

    mounted() {
        var self = this
    },
    methods: {

    }
}
</script>

<style lang="scss" scoped>

</style>
