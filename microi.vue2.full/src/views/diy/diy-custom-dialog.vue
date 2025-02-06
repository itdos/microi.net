<template>
<div>
    <!--以弹窗形式打开Form-->
    <el-dialog
        v-if="OpenType != 'Drawer'"
        class="diy-form-container"
        v-el-drag-dialog
        :width="width"
        :modal="true"
        :modal-append-to-body="false"
        :visible.sync="ShowDialog"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :destroy-on-close="true"
        :show-close="false"
        append-to-body
        >
        <div slot="title">
            <div class="pull-left">
                <i :class="TitleIcon" />
                {{ title }}
            </div>
            <div class="pull-right">
                <el-button
                    size="mini"
                    icon="el-icon-close"
                    @click="ShowDialog = false;">{{ $t('Msg.Close') }}</el-button>
            </div>
        </div>
        <div class="clear">
           <component
                v-if="!DiyCommon.IsNull(ComponentName)"
                :is="ComponentName" 
                :data-append="DataAppend"
                @FormSet="FormSet"
                pageLifetimes: pageLifetimes
                />
        </div>
    </el-dialog>
    <!--以抽屉形式打开Form-->
    <el-drawer
        v-if="OpenType == 'Drawer'"
        class="diy-form-container"
        :modal="true"
        :size="width"
        :modal-append-to-body="false"
        :visible.sync="ShowDialog"
        :close-on-press-escape="false"
        :destroy-on-close="true"
        :wrapper-closable="false"
        :show-close="false"
        append-to-body
        >
        <div slot="title">
            <div class="pull-left" style="color:#000;font-size:15px;">
                <i :class="TitleIcon" />
                {{ title }}
            </div>
            <div class="pull-right">
                <el-button
                    size="mini"
                    icon="el-icon-close"
                    @click="ShowDialog = false;">{{ $t('Msg.Close') }}</el-button>
            </div>
        </div>

        <div class="clear">
             <!-- && !DiyCommon.IsNull(ComponentPath) -->
                <!-- :data-append="GetDataAppend(field)" -->
            <component
                v-if="!DiyCommon.IsNull(ComponentName)"
                :is="ComponentName" 
                :data-append="DataAppend"
                @FormSet="FormSet"
                pageLifetimes: pageLifetimes
                />
        </div>
    </el-drawer>
</div>
</template>

<script>
import elDragDialog from '@/directive/el-drag-dialog'
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
export default {
    name: 'DiyCustomDialog',
    directives: {
        elDragDialog
    },
	components: {
    },
    computed: {
        GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
		...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
        }),
    },
    props:{
        DataAppend:{
            type: Object,
            default: () => {}
        },
        OpenType:{
            type: String,
            default: ''
        },
        title:{
            type: String,
            default: ''
        },
        TitleIcon:{
            type: String,
            default: ''
        },
        width:{
            type: String,
            default: '50%'
        },
        ComponentName:{
            type: String,
            default: ''
        },
        ComponentPath:{
            type: String,
            default: ''
        },
        visible:{
            type:Boolean,
            default:false
        },
    },
	watch: {
	},
    data() {
        return {
            ShowDialog:false,
            //生命周期
            pageLifetimes:{
                show: function (e) {
                
                },
            },
        }
    },
    mounted() {
        var self = this
    },
    methods: {
		FormSet(){
            var self = this;
        },
        Show(){
            this.ShowDialog = true;
        },
        Close(){
            this.ShowDialog = false;
        },
    }
}
</script>

<style lang="scss" scoped>

</style>
