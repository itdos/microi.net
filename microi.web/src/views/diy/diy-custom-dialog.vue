<template>
    <div>
        <!--以弹窗形式打开Form-->
        <el-dialog
            v-if="OpenType != 'Drawer'"
            class="diy-form-container"
            draggable
            :width="width"
            :modal="true"
            :modal-append-to-body="false"
            v-model="ShowDialog"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            append-to-body
        >
            <template #header
                ><div>
                    <div class="pull-left">
                        <i :class="TitleIcon" />
                        {{ title }}
                    </div>
                    <div class="pull-right">
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div></template
            >
            <div class="clear">
                <template v-if="!DiyCommon.IsNull(ComponentName)">
                    <component v-if="!DiyCommon.IsNull(ComponentName)" :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" :pageLifetimes="pageLifetimes" />
                </template>
            </div>
        </el-dialog>
        <!--以抽屉形式打开Form-->
        <el-drawer
            v-if="OpenType == 'Drawer'"
            class="diy-form-container"
            :modal="true"
            :size="width"
            :modal-append-to-body="false"
            v-model="ShowDialog"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :wrapper-closable="false"
            :show-close="false"
            append-to-body
        >
            <template #header
                ><div>
                    <div class="pull-left" style="color: #000; font-size: 15px">
                        <i :class="TitleIcon" />
                        {{ title }}
                    </div>
                    <div class="pull-right">
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div></template
            >

            <div class="clear">
                <!-- && !DiyCommon.IsNull(ComponentPath) -->
                <!-- :DataAppend="GetDataAppend(field)" -->
                <template v-if="!DiyCommon.IsNull(ComponentName)">
                    <component :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" :pageLifetimes="pageLifetimes" />
                </template>
            </div>
        </el-drawer>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
export default {
    name: "DiyCustomDialog",
    directives: {},
    components: {},
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const OsClient = computed(() => diyStore.OsClient);
        return { diyStore, GetCurrentUser, OsClient };
    },
    computed: {},
    props: {
        DataAppend: {
            type: Object,
            default: () => {}
        },
        OpenType: {
            type: String,
            default: ""
        },
        title: {
            type: String,
            default: ""
        },
        TitleIcon: {
            type: String,
            default: ""
        },
        width: {
            type: String,
            default: "50%"
        },
        ComponentName: {
            type: String,
            default: ""
        },
        ComponentPath: {
            type: String,
            default: ""
        },
        visible: {
            type: Boolean,
            default: false
        }
    },
    watch: {},
    data() {
        return {
            ShowDialog: false,
            //生命周期
            pageLifetimes: {
                show: function (e) {}
            }
        };
    },
    mounted() {
        var self = this;
    },
    methods: {
        FormSet() {
            var self = this;
        },
        Show() {
            this.ShowDialog = true;
        },
        CloseDialog() {
            this.ShowDialog = false;
        }
    }
};
</script>

<style lang="scss" scoped></style>
