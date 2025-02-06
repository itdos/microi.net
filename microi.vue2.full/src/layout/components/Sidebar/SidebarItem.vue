<template>
    <div v-if="!item.hidden">
        <template
            v-if="
                hasOneShowingChild(item.children, item) &&
                (!onlyOneChild.children || onlyOneChild.noShowingChildren) &&
                !item.alwaysShow
            "
        >
                <!-- :to="resolvePath(DiyCommon.IsNull(onlyOneChild.Link) ? onlyOneChild.path : onlyOneChild.Link)" -->
                <!-- :to="resolvePath(onlyOneChild.path)" -->
                <!-- @click="GotoLink(onlyOneChild.path)" -->
            <app-link
                v-if="onlyOneChild.meta"
                :to="resolvePath(onlyOneChild)"
            >
                <el-menu-item
                    :index="resolvePath(onlyOneChild)"
                    :class="{ 'submenu-title-noDropdown-microi': !isNest }"
                    :style="GetMenuWordColor()"
                >
                    <item
                        :icon="
                            onlyOneChild.meta.icon ||
                            (item.meta && item.meta.icon)
                        "
                        :title="generateTitle(onlyOneChild.meta.title)"
                        :wordcolor="GetMenuWordColor()"
                    />
                </el-menu-item>
            </app-link>
        </template>

        <el-submenu
            v-else
            ref="subMenu"
            :index="resolvePath(item)"
            popper-append-to-body
            :style="GetMenuWordColor()"
        >
            <template slot="title">
                <item
                    v-if="item.meta"
                    :icon="item.meta && item.meta.icon"
                    :title="generateTitle(item.meta.title)"
                        :wordcolor="GetMenuWordColor()"
                />
            </template>
			<template
                v-for="child in item.children"
            >
				<sidebar-item
					v-if="child.Display"
					:key="child.path"
					:is-nest="true"
					:item="child"
					:base-path="resolvePath(child)"
					class="nest-menu"
                    :style="GetMenuWordColor()"
				/>
			</template>
        </el-submenu>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import path from "path";
import { generateTitle } from "@/utils/i18n";
import { isExternal } from "@/utils/validate";
import Item from "./Item";
import AppLink from "./Link";
import FixiOSBug from "./FixiOSBug";

export default {
    name: "SidebarItem",
    components: { Item, AppLink },
    mixins: [FixiOSBug],
    props: {
        // route object
        item: {
            type: Object,
            required: true,
        },
        isNest: {
            type: Boolean,
            default: false,
        },
        basePath: {
            type: String,
            default: "",
        },
    },
    computed: {
        ...mapState({
        SysConfig: (state) => state.DiyStore.SysConfig,
        })
    },
    data() {
        this.onlyOneChild = null;
        return {};
    },
    methods: {
        GetMenuWordColor(){
            var self = this;
            //如果是已经选中的，应该是获取ActiveMenuColor
            if(self.SysConfig.MenuBg == 'Custom' && !self.DiyCommon.IsNull(self.SysConfig.MenuWordColor)){
                return { color: self.SysConfig.MenuWordColor};
            }
            return { color: 'rgb(255, 255, 255)'};
        },
        hasOneShowingChild(children = [], parent) {
            const showingChildren = children.filter((item) => {
                if (item.hidden) {
                    return false;
                } else {
                    // Temp set(will be used if only has one showing child)
                    this.onlyOneChild = item;
                    return true;
                }
            });

            // When there is only one child router, the child router is displayed by default
            if (showingChildren.length === 1) {
                return true;
            }

            // Show parent if there are no child router to display
            if (showingChildren.length === 0) {
                this.onlyOneChild = {
                    ...parent,
                    path: "",
                    noShowingChildren: true,
                };
                return true;
            }

            return false;
        },
        GotoLink(routePath){
            if(routePath){
                var path = routePath.toString();
                window.open();
            }
        },
        resolvePath(routeModel) {
            var routePath = routeModel.path;
            // console.log('resolvePath', routeModel);
            if(routePath.indexOf('http') > -1){
                // debugger;
            }
            if (isExternal(routePath)) {
                // if(routeModel.UrlParam){
                //     debugger;
                // }
                console.log(routePath + (routeModel.UrlParam ? ('?' + routeModel.UrlParam) : ''));
                return routePath + (routeModel.UrlParam ? ('?' + routeModel.UrlParam) : '');
            }
            if (isExternal(this.basePath)) {
                return this.basePath;
            }
            //by itdos.com  2022-03-31
            if(routePath.startsWith('/iframe')){
                return routePath;
            }
            // if(routeModel.UrlParam){
            //     debugger;
            // }
            var result = '';
            if(routePath){
                result = path.resolve(this.basePath, routePath + (routeModel.UrlParam ? ('?' + routeModel.UrlParam) : ''));
            }else{
                result = path.resolve(this.basePath, routePath);
            }
            return result;
        },

        generateTitle,
    },
};
</script>
