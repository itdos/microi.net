<template>
    <div id="divOsSystemSetting" class="microi-desktop-secmenu" style="height: 100%; display: none">
        <div class="pluginPage-aero" />
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12 marginTop20" style="text-align: center; font-size: 18px">
                    {{ DiyCommon.GetLangValue(sysMenu, "Name") }}
                </div>
                <div class="col-md-offset-4 col-md-4 col-sm-offset-3 col-sm-6 col-xs-offset-2 col-xs-8 marginTop20" style="text-align: center">
                    <div class="input-group">
                        <input type="text" class="form-control" placeholder="查找功能模块" />
                        <div class="input-group-addon" style="background-color: var(--theme-color)">
                            <el-icon style="color: var(--bg-color)"><Search /></el-icon>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row items">
                <div v-for="m in SecondMenuList" :key="m.Id" class="col-lg-3 col-md-4 col-sm-6 col-xs-12">
                    <div class="item" @click.stop="OpenDesktopItem(m)">
                        <div class="float-left" style="width: 40px">
                            <!-- 使用 Element Plus Operation 图标作为默认图标 -->
                            <el-icon v-if="DiyCommon.IsNull(m.IconClass)"><Operation /></el-icon>
                            <i v-else :class="m.IconClass" />
                        </div>
                        <div class="rightContent">
                            <div class="title">{{ DiyCommon.GetLangValue(m, "Name") }}</div>
                            <div class="child">
                                {{ DiyCommon.GetLangValue(m, "Description") }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Search, Operation } from "@element-plus/icons-vue";
import { computed } from "vue";
import { useDiyStore } from "@/stores";
export default {
    components: {
        Search,
        Operation
    },
    props: {
        sysMenu: Object
    },
    setup() {
        const diyStore = useDiyStore();
        const DesktopBg = computed(() => diyStore.DesktopBg);
        const CurrentTime = computed(() => diyStore.CurrentTime);
        const LoginCover = computed(() => diyStore.LoginCover);
        const OsClient = computed(() => diyStore.OsClient);
        const Lang = computed(() => diyStore.Lang);
        return {
            diyStore,
            DesktopBg,
            CurrentTime,
            LoginCover,
            OsClient,
            Lang
        };
    },
    mounted() {
        var self = this;
        if (!self.DiyCommon.IsNull(self.sysMenu) && !self.DiyCommon.IsNull(self.sysMenu._Child)) {
            self.SecondMenuList = self.sysMenu._Child;
        }
        self.$nextTick(function () {
            //self.FastClick.attach(document.querySelector('.layx-window'))
        });
    },
    data() {
        return {
            SecondMenuList: []
        };
    },
    methods: {
        OpenDesktopItem(sysMenu) {
            var self = this;
            self.$parent.OpenDesktopItem(sysMenu);

            // layx.updateZIndex(sysMenu.Id);
        }
    }
};
</script>

<style></style>
