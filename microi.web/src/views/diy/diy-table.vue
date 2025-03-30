<template>
<div
    id="diy-table"
    class="pluginPage">
    <el-tabs
        id="table-rowlist-tabs"
        v-model="DiyFormEngineTab"
        :class="'table-rowlist-tabs box-card-top-tabs'"
        >
        <el-tab-pane
            :name="'Table'"
            >
            <span slot="label"><i class="el-icon-s-grid"></i> 表单</span>
            <el-row>
                <el-col :span="24">
                    <el-card class="box-card no-padding-body">
                        <el-form
                            size="mini"
                            :model="SearchModel"
                            inline
                            @submit.native.prevent
                            class="keyword-search">
                            <el-form-item
                                :label="$t('Msg.Keyword')"
                                size="mini">
                                <el-button
                                    type="primary"
                                    icon="el-icon-plus"
                                    @click="OpenDiyTable()">{{ $t('Msg.Add') }}</el-button>
                            </el-form-item>
                            <el-form-item
                                size="mini"
                                >
                                <el-input
                                    v-model="SearchModel.Keyword"
                                    @input="GetDiyTable(true)"
                                    :placeholder="$t('Msg.Search')"
                                    class="input-left-borderbg"
                                    style="margin-top:1px;"
                                    >
                                    <el-button slot="append" icon="el-icon-search" @click="GetDiyTable(true)"></el-button>
                                </el-input>
                            </el-form-item>
                            <el-form-item size="mini">
                                <el-dropdown trigger="click" @command="ChangeDataViewType">
                                    <el-button type="primary">
                                        切换视图<i class="el-icon-arrow-down el-icon--right"></i>
                                    </el-button>
                                    <el-dropdown-menu slot="dropdown" class="dropdown-big-button">
                                        <el-dropdown-item command="Card">
                                            <i class="icon el-icon-postcard mr-1"></i> 卡片形式</el-dropdown-item>
                                        <el-dropdown-item command="Table">
                                            <i class="icon el-icon-s-grid mr-1"></i> 表格形式</el-dropdown-item>
                                    </el-dropdown-menu>
                                </el-dropdown>
                            </el-form-item>
                            <el-form-item size="mini">
                                <el-select
                                    v-model="DbRealTableName"
                                    filterable
                                    placeholder="请选择非diy表">
                                    <el-option
                                    v-for="item in NotDiyTableList"
                                    :key="item"
                                    :label="item"
                                    :value="item">
                                    </el-option>
                                </el-select>
                            </el-form-item>
                            <el-form-item size="mini" v-if="!DiyCommon.IsNull(DbRealTableName)">
                                <el-button
                                    type="primary"
                                    icon="el-icon-plus"
                                    :loading="btnLoading"
                                    @click="LoadNotDiyTable()">{{ $t('Msg.Load') }}</el-button>
                            </el-form-item>
                        </el-form>
                        <template v-if="DataViewType == 'Table'">
                            <el-table
                                v-loading="tableLoading"
                                :data="DiyTableList"
                                style="width: 100%"
                                class="diy-table no-border-outside"
                                stripe
                                border
                                >
                                <el-table-column
                                    type="index"
                                    width="50" />
                                <el-table-column
                                    label="表名"
                                    width="180">
                                    <template slot-scope="scope">
                                        {{ scope.row.Name }}
                                        <!-- .replace('Diy_', '') -->
                                    </template>
                                </el-table-column>
                                <el-table-column
                                    prop="Description"
                                    label="描述" />
                                <el-table-column
                                    prop="CreateTime"
                                    :label="$t('Msg.CreateTime')"
                                    width="200" />
                                <el-table-column
                                    fixed="right"
                                    :label="$t('Msg.Operation')"
                                    width="180">
                                    <template slot-scope="scope">
                                        <el-button
                                            type="primary"
                                            size="mini"
                                            class="marginRight5"
                                            icon="el-icon-s-help"
                                            @click="$router.push('/diy/diy-design/' + scope.row.Id)">{{ $t('Msg.Design') }}</el-button>
                                        <el-dropdown trigger="click">
                                            <el-button >
                                                {{ $t('Msg.More') }}<i class="el-icon-arrow-down el-icon--right" />
                                            </el-button>
                                            <el-dropdown-menu
                                                slot="dropdown"
                                                class="table-more-btn">
                                                <el-dropdown-item
                                                    icon="el-icon-edit"
                                                    @click.native="OpenDiyTable(scope.row)">
                                                    {{ $t('Msg.Edit') }}
                                                </el-dropdown-item>
                                                <el-dropdown-item
                                                    icon="el-icon-edit"
                                                    @click.native="OpenDiyTable(model, 'Copy', model.Name)">
                                                    {{ $t('Msg.Copy') }}
                                                </el-dropdown-item>
                                                <el-dropdown-item
                                                    icon="el-icon-delete"
                                                    divided
                                                    @click.native="DelDiyTable(scope.row)">
                                                    {{ $t('Msg.Delete') }}
                                                </el-dropdown-item>

                                            </el-dropdown-menu>
                                        </el-dropdown>
                                    </template>
                                </el-table-column>
                            </el-table>
                            <el-pagination
                            style="margin-top:10px;float:left;margin-bottom:10px;clear:both;"
                            background
                            layout="total, sizes, prev, pager, next, jumper"
                            :total="DiyTableCount"
                            :page-size="DiyTablePageSize"
                            :page-sizes="DiyCommon.PageSizes"
                            @size-change="DiyTableSizeChange"
                            @current-change="DiyTableCurrentChange" />
                        </template>
                    </el-card>
                </el-col>
            </el-row>
            <template v-if="DataViewType == 'Card'">
                <el-row :gutter="20">
                    <el-skeleton
                        style="width: 100%"
                        :loading="tableLoading"
                        animated
                        >
                        <template slot="template">
                            <el-col :xs="24" :span="5"
                                v-for="(model, index) in EmptyData"
                                :key="model.Id"
                                style="margin-top:20px;"
                                >
                                <el-card class="box-card card-data-animate">
                                    <div slot="header">
                                        <el-skeleton-item variant="text" style="width: 100%;" />
                                    </div>
                                    <div class="item">
                                        <el-skeleton-item/>
                                    </div>
                                    <div class="item">
                                        <el-skeleton-item/>
                                    </div>
                                    <div class="bottom-time">
                                        <el-skeleton-item variant="text" style="width: 100%;" />
                                    </div>
                                </el-card>
                            </el-col>
                        </template>
                        <el-col :xs="24" :span="5"
                            v-for="(model, index) in DiyTableList"
                            :key="model.Id"
                            style="margin-top:20px;"
                            >
                            <el-card class="box-card card-data-animate">
                                <div slot="header">
                                    <span class="title">
                                        <i class="el-icon-document"></i>
                                        {{!DiyCommon.IsNull(model.Description) ? model.Description : model.Name}}</span>
                                    <div style="float: right;">
                                        <el-button
                                            type="text"
                                            size="mini"
                                            class="marginRight5"
                                            icon="el-icon-s-help"
                                            @click="$router.push('/diy/diy-design/' + model.Id)">{{ $t('Msg.Design') }}</el-button>
                                        <el-dropdown trigger="click">
                                            <el-button type="text">
                                                {{ $t('Msg.More') }}<i class="el-icon-arrow-down el-icon--right" />
                                            </el-button>
                                            <el-dropdown-menu
                                                slot="dropdown"
                                                class="table-more-btn">
                                                <el-dropdown-item
                                                    icon="el-icon-edit"
                                                    @click.native="OpenDiyTable(model)">
                                                    {{ $t('Msg.Edit') }}
                                                </el-dropdown-item>
                                                <el-dropdown-item
                                                    icon="el-icon-edit"
                                                    @click.native="OpenDiyTable(model, 'Copy', model.Name)">
                                                    {{ $t('Msg.Copy') }}
                                                </el-dropdown-item>
                                                <el-dropdown-item
                                                    icon="el-icon-delete"
                                                    divided
                                                    @click.native="DelDiyTable(model)">
                                                    {{ $t('Msg.Delete') }}
                                                </el-dropdown-item>

                                            </el-dropdown-menu>
                                        </el-dropdown>
                                    </div>
                                </div>
                                <div class="item">
                                    表名: {{model.Name}}
                                </div>
                                <div class="item">
                                    打开方式: {{DiyCommon.IsNull(model.FormOpenType) ? 'Drawer' : model.FormOpenType}}
                                </div>

                                <div class="bottom-time">
                                    <i class="el-icon-time"></i> {{model.CreateTime}}
                                    <div style="float: right;color:cadetblue" v-if="model.ReportId">虚拟表</div>
                                </div>
                            </el-card>
                        </el-col>
                    </el-skeleton>
                </el-row>
                <el-row>
                    <el-col :span="24">
                        <el-pagination
                            style="margin-top:20px;float:left;margin-bottom:10px;clear:both;"
                            background
                            layout="total, sizes, prev, pager, next, jumper"
                            :total="DiyTableCount"
                            :page-size="DiyTablePageSize"
                            :page-sizes="DiyCommon.PageSizes"
                            @size-change="DiyTableSizeChange"
                            @current-change="DiyTableCurrentChange" />
                    </el-col>
                </el-row>
            </template>
        </el-tab-pane>
        <el-tab-pane
            :name="'Component'"
            :lazy="true"
            >
            <span slot="label"><i class="el-icon-setting"></i> 组件</span>
            <DiyTable
                :ref="'refTableChild_DiyComponent'"
                :props-table-id="'73a92e3d-8cd9-4a1f-bfc1-83fbc8e493d5'"
                :props-sys-menu-id="'d0c7a74a-2cfd-41c0-8902-440909f5f30c'"
                    />
        </el-tab-pane>
    </el-tabs>
    <!-- <el-row
     id="openDiyTableModel"
     class="dialog-model"
     style="display:none;">
        <el-col :span="24">
            <el-form
                size="mini"
                :model="CurrentDiyTableModel"
                >
                <el-form-item
                    label="表名"
                    size="mini">
                    <el-input v-model="CurrentDiyTableModel.Name" />
                </el-form-item>
                <el-form-item
                    label="描述"
                    size="mini">
                    <el-input v-model="CurrentDiyTableModel.Description" />
                </el-form-item>
            </el-form>
        </el-col>
    </el-row> -->
    <el-dialog
        v-el-drag-dialog
        width="550px"
        :modal-append-to-body="false"
        :visible.sync="ShowEditModel"
        :title="ShowEditModelTitle"
        :close-on-click-modal="false">
        <el-alert
        class="marginBottom15"
            title="表名建议固定前缀且小写，如：diy_tablename、microi_doc_paper"
            type="info"
            :closable="false"
            show-icon>
        </el-alert>
        <el-form
            size="mini"
            :model="CurrentDiyTableModel"
            label-width="90px">
            <el-form-item
                label="表名"
                size="mini">
                <el-input v-model="CurrentDiyTableModel.Name" />
            </el-form-item>
            <el-form-item
                label="描述"
                size="mini">
                <el-input v-model="CurrentDiyTableModel.Description" />
            </el-form-item>
            <!-- <el-form-item
                label="所属数据库"
                size="mini">
                <el-select
                    v-model="CurrentDiyTableModel.DataBaseId"
                    filterable
                    @change="ChangeDataBase"
                    placeholder="默认主库">
                    <el-option
                    v-for="item in DataBaseList"
                    :key="item.Id"
                    :label="item.DbName"
                    :value="item.Id">
                    </el-option>
                </el-select>
            </el-form-item> -->
        </el-form>
        <span slot="footer" class="dialog-footer">
            <el-button
                :loading="SaveDiyTableLoding"
                type="primary"
                size="mini"
                icon="el-icon-s-help"
                @click="SaveDiyTable">{{ $t('Msg.Save') }}</el-button>
            <el-button
                size="mini"
                icon="el-icon-close"
                @click="ShowEditModel = false">{{ $t('Msg.Cancel') }}</el-button>
        </span>
    </el-dialog>
</div>
</template>

<script>
// import DiyStore from '@/store/diy.store'
import elDragDialog from '@/directive/el-drag-dialog'
import _ from 'underscore'
import { DiyApi,DiyTable } from '@/utils/microi.net.import'
import {
    mapState
} from 'vuex'
export default {
    name: 'diy_table',
    directives: {
        elDragDialog
    },
    components:{
        // DiyTable, //: (resolve) => require(['@/views/diy/diy-table-rowlist'], resolve),
    },
    computed: {
        ...mapState({
            // OsClient: state => state.DiyStore.OsClient
        })
    },
    data() {
        return {
            TableOpType : '',
            OldTableName: '',
            EmptyData: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
            DiyFormEngineTab:'Table',//Component
            btnLoading:false,
            DbRealTableName:'',
            NotDiyTableList:[],
            DataBaseList : [],

            SaveDiyTableLoding: false,
            tableLoading: true,
            ShowEditModelTitle: '',
            ShowEditModel: false,
            SearchModel: {
                Keyword: ''
            },
            DiyTableList: [],
            CurrentDiyTableModel: {
                Name : 'diy_',
                DataBaseId : '',
                DataBaseName : '',
            },
            DiyTableCount: 0,
            DiyTablePageSize: 15,
            DiyTablePageIndex: 1,
            DataViewType:'Card',//Table
        }
    },
    mounted() {
        var self = this
        var dataViewType = localStorage.getItem('DataViewType_' + 'Diy_Table');
        if (!self.DiyCommon.IsNull(dataViewType)) {
            self.DataViewType = dataViewType;
        }
        self.GetDiyTable(true)
        self.GetNotDiyTable();
        // self.GetDataBaseList();
    },
    methods: {
        ChangeDataBase(val){
            var self = this;
            if(val){
                var name = self.DataBaseList.find(item => { return item.Id == val });
                self.CurrentDiyTableModel.DataBaseName = name.DbName;
            }else{
                self.CurrentDiyTableModel.DataBaseName = '';
            }
        },
        GetDataBaseList(){
            var self = this;
            self.DiyCommon.FormEngine.GetTableData({
                FormEngineKey : 'microi_database'
            }, function(result){
                if(result.Code == 1){
                    self.DataBaseList = result.Data;
                }
            });
        },
        GetNotDiyTable(){
            var self = this;
            self.DiyCommon.Post(DiyApi.GetNotDiyTable, {}, function(result){
                if (result.Code == 1) {
                    self.NotDiyTableList = result.Data;
                }
            });
        },
        LoadNotDiyTable(){
            var self = this;
            self.btnLoading = true;
            self.DiyCommon.Post(DiyApi.LoadNotDiyTable, {
                Name : self.DbRealTableName
            }, function(result){
                if (self.DiyCommon.Result(result)) {
                    self.DbRealTableName = '';
                    self.GetDiyTable(true)
                    self.GetNotDiyTable();
                    self.DiyCommon.Tips(self.$t('Msg.Success'));
                }
                self.btnLoading = false;
            },function(){
                self.btnLoading = false;
            });
        },
        ChangeDataViewType(command){
            var self = this;
            self.DataViewType = command;
            localStorage.setItem('DataViewType_' + 'Diy_Table', command);
        },
        DiyTableCurrentChange(val) {
            var self = this
            self.DiyTablePageIndex = val
            self.GetDiyTable()
        },
        DiyTableSizeChange(val) {
            var self = this
            self.DiyTablePageSize = val
            self.DiyTablePageIndex = 1
            self.GetDiyTable(true)
        },
        GetDiyTable(initPageIndex) {
            var self = this
            if (initPageIndex === true) {
                self.DiyTablePageIndex = 1;
            }
            self.tableLoading = true
            self.DiyCommon.Post(DiyApi.GetDiyTable, {
                // OsClient: self.OsClient,
                _PageSize: self.DiyTablePageSize,
                _PageIndex: self.DiyTablePageIndex,
                _Keyword: self.SearchModel.Keyword
            }, function (result) {
                self.tableLoading = false
                if (self.DiyCommon.Result(result)) {
                    self.DiyTableList = result.Data
                    self.DiyTableCount = result.DataCount
                }
            })
        },
        DelDiyTable(m) {
            var self = this
            self.DiyCommon.OsConfirm(self.$t('Msg.ConfirmDelTo') + '【' + m.Name + '】？', function () {
                self.DiyCommon.Post(DiyApi.DelDiyTable, {
                        Id: m.Id
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips(self.$t('Msg.Success'))
                            self.GetDiyTable()
                        }
                    }
                )
            })
        },
        OpenDiyTable(m, type, oldTableName) {
            var self = this
            self.TableOpType = type;
            self.OldTableName = oldTableName;
            var url = DiyApi.UptDiyTable
            var title = self.$t('Msg.Add')
            if(self.TableOpType == 'Copy'){
                title = '复制表';
                self.CurrentDiyTableModel = m;
            }
            else if (self.DiyCommon.IsNull(m)) {
                self.CurrentDiyTableModel = {
                    Name : 'diy_',
                }
                url = DiyApi.AddDiyTable
            } else {
                title = m.Name
                // m.Name = m.Name.replace('Diy_', '')
                self.CurrentDiyTableModel = m
            }
            self.ShowEditModelTitle = title
            self.ShowEditModel = true
        },
        async SaveDiyTable() {
            var self = this
            try {
                self.SaveDiyTableLoding = true;
                if(self.TableOpType == 'Copy'){
                    var copyResult = await self.DiyCommon.ApiEngine.Run('copy_table', {
                        TableId : self.CurrentDiyTableModel.Id,
                        TableName : self.CurrentDiyTableModel.Name,
                        Description : self.CurrentDiyTableModel.Description,
                    });
                    self.SaveDiyTableLoding = false;
                    if (self.DiyCommon.Result(copyResult)) {
                        self.DiyCommon.Tips(self.$t('Msg.Success'))
                        self.GetDiyTable(true)
                        self.ShowEditModel = false
                    }
                    return;
                }
                var url = '/api/diytable/uptDiyTable';
                if (self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
                    url = '/api/diytable/addDiyTable'
                }
                var {
                    ...param
                } = self.CurrentDiyTableModel
                // param.OsClient = self.OsClient
                self.DiyCommon.Post(url, param, function (result) {
                    self.SaveDiyTableLoding = false
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips(self.$t('Msg.Success'))
                        self.GetDiyTable(true)
                        self.ShowEditModel = false
                    }
                })
            } catch (error) {
                console.log(error)
                self.SaveDiyTableLoding = false
            }
        }
    }
}
</script>

<style>

</style>
