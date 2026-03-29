<template>
    <el-dialog v-model="dialogShow" width="60%" :before-close="handleClose" append-to-body title="选择图标"
        draggable
        align-center>
        <template #header>
            <div style="display: flex; align-items: center">
                <el-radio-group v-model="iconSource" size="small" style="margin-right: 12px" @change="changeIconSource">
                    <el-radio-button label="fa">FontAwesome</el-radio-button>
                    <el-radio-button label="ep">Element Plus</el-radio-button>
                </el-radio-group>
                <el-input style="width: 200px" v-model="searchIcon" placeholder="搜索图标" @input="changeSearchIcon" clearable>
                    <template #suffix>
                        <el-icon class="el-input__icon"><Search /></el-icon>
                    </template>
                </el-input>
                <div v-if="showIcon && selectedIcon" style="margin-left: 20px; display: flex; align-items: center">
                    <span style="margin-right: 10px">当前选择：</span>
                    <template v-if="selectedIconSource === 'fa'">
                        <font-awesome-icon :icon="parseFaIcon(selectedIcon)" style="font-size: 24px" />
                    </template>
                    <template v-else>
                        <el-icon :size="24"><component :is="getEpComponent(selectedIcon)" /></el-icon>
                    </template>
                    <span style="margin-left: 8px; color: #666">{{ selectedIcon }}</span>
                </div>
            </div>
        </template>
        
        <!-- FontAwesome 分类 Tab -->
        <el-radio-group v-if="iconSource === 'fa'" v-model="faCategory" size="small" style="margin-bottom: 12px" @change="changeFaCategory">
            <el-radio-button label="solid">Solid</el-radio-button>
            <el-radio-button label="regular">Regular</el-radio-button>
            <el-radio-button label="brands">Brands</el-radio-button>
        </el-radio-group>

        <el-row class="list-box" :gutter="8">
            <el-col
                v-for="item in displayList"
                :key="item.name"
                :xs="8"
                :sm="6"
                :md="4"
                :lg="3"
                :xl="2"
                class="w-icon"
                @click="chooseIcon(item)"
                :class="{ active: selectedIcon === item.name }"
            >
                <div class="icon-box">
                    <template v-if="item.source === 'fa'">
                        <font-awesome-icon :icon="item.faDef" style="font-size: 28px" />
                    </template>
                    <template v-else>
                        <el-icon :size="32"><component :is="item.component" /></el-icon>
                    </template>
                </div>
                <span class="text" :title="item.displayName || item.name">{{ item.displayName || item.name }}</span>
            </el-col>
        </el-row>
        
        <div v-if="displayList.length === 0" class="empty-tip">
            <el-empty description="未找到匹配的图标" />
        </div>

        <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            @current-change="handleCurrentChange"
            style="margin-top: 16px; justify-content: center"
        />
        
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="close">取 消</el-button>
                <el-button type="primary" @click="confirm">确 定</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script>
import * as ElementPlusIcons from "@element-plus/icons-vue";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";

// 确保图标库已加载
library.add(fas, far, fab);

// 构建 FontAwesome 图标列表
function buildFaIconList(prefix, categoryDefs) {
    const list = [];
    if (!categoryDefs) return list;
    for (const [iconName, def] of Object.entries(categoryDefs)) {
        if (!iconName || !def) continue;
        list.push({
            name: prefix + " fa-" + iconName,
            displayName: iconName,
            source: "fa",
            faDef: [prefix, iconName]
        });
    }
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const faSolidList = buildFaIconList("fas", library.definitions.fas);
const faRegularList = buildFaIconList("far", library.definitions.far);
const faBrandsList = buildFaIconList("fab", library.definitions.fab);

// Element Plus 图标列表
const epIconList = Object.keys(ElementPlusIcons).map((name) => ({
    name: name,
    displayName: name,
    source: "ep",
    component: ElementPlusIcons[name]
}));

// 模糊搜索
function fuzzyQuery(list, keyword) {
    if (!keyword) return list;
    const lowerKeyword = keyword.toLowerCase();
    return list.filter((item) => (item.displayName || item.name).toLowerCase().includes(lowerKeyword));
}

// 分页
function listPage(list, page, pageSize) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return list.slice(start, end);
}

export default {
    name: "Fontawesome",
    components: {
        ...ElementPlusIcons
    },
    emits: ["update:model"],
    props: {
        model: {
            type: String,
            default: ""
        }
    },
    data() {
        return {
            currentPage: 1,
            pageSize: 60,
            dialogShow: false,
            searchIcon: "",
            selectedIcon: "",
            selectedIconSource: "fa",
            showIcon: false,
            filteredList: [],
            iconSource: "fa",     // "fa" | "ep"
            faCategory: "solid"   // "solid" | "regular" | "brands"
        };
    },
    computed: {
        currentSourceList() {
            if (this.iconSource === "ep") return epIconList;
            if (this.faCategory === "regular") return faRegularList;
            if (this.faCategory === "brands") return faBrandsList;
            return faSolidList;
        },
        total() {
            return this.searchIcon ? this.filteredList.length : this.currentSourceList.length;
        },
        displayList() {
            const sourceList = this.searchIcon ? this.filteredList : this.currentSourceList;
            return listPage(sourceList, this.currentPage, this.pageSize);
        }
    },
    methods: {
        getEpComponent(name) {
            return ElementPlusIcons[name] || ElementPlusIcons.Document;
        },
        parseFaIcon(iconStr) {
            let prefix = "fas";
            if (/\bfar\b/.test(iconStr)) prefix = "far";
            else if (/\bfab\b/.test(iconStr)) prefix = "fab";
            const match = iconStr.match(/fa-([\w-]+)/);
            return match ? [prefix, match[1]] : ["fas", "question"];
        },
        show() {
            this.dialogShow = true;
            this.selectedIcon = this.model || "";
            this.showIcon = !!this.model;
            // 自动检测当前图标类型
            if (this.selectedIcon) {
                if (/\bfa[srb]?\s+fa-/.test(this.selectedIcon) || /^fa-/.test(this.selectedIcon)) {
                    this.iconSource = "fa";
                    this.selectedIconSource = "fa";
                } else {
                    this.iconSource = "ep";
                    this.selectedIconSource = "ep";
                }
            }
        },
        changeIconSource() {
            this.currentPage = 1;
            this.searchIcon = "";
            this.filteredList = [];
        },
        changeFaCategory() {
            this.currentPage = 1;
            if (this.searchIcon) {
                this.filteredList = fuzzyQuery(this.currentSourceList, this.searchIcon);
            } else {
                this.filteredList = [];
            }
        },
        changeSearchIcon() {
            this.currentPage = 1;
            if (this.searchIcon) {
                this.filteredList = fuzzyQuery(this.currentSourceList, this.searchIcon);
            } else {
                this.filteredList = [];
            }
        },
        handleClose(done) {
            done();
        },
        chooseIcon(item) {
            this.showIcon = false;
            this.selectedIcon = item.name;
            this.selectedIconSource = item.source;
            this.$nextTick(() => {
                this.showIcon = true;
            });
        },
        confirm() {
            this.$emit("update:model", this.selectedIcon);
            this.$nextTick(() => {
                this.close();
            });
        },
        initData() {
            this.currentPage = 1;
            this.searchIcon = "";
            this.selectedIcon = "";
            this.filteredList = [];
            this.showIcon = false;
        },
        close() {
            this.initData();
            this.dialogShow = false;
        },
        handleCurrentChange(val) {
            this.currentPage = val;
        }
    }
};
</script>

<style lang="scss" scoped>
.list-box {
    height: auto;
    overflow: auto;
}
.w-icon {
    height: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    margin-bottom: 8px;
    overflow: hidden;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    
    &.active {
        background-color: var(--el-color-primary);
        color: #fff;
        .text {
            color: #fff;
        }
    }
    
    .icon-box {
        width: 100%;
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px 0;
    }
    
    &:hover:not(.active) {
        background-color: var(--el-color-primary-light-9);
    }
    
    .text {
        font-size: 11px;
        color: #666;
        padding: 4px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        width: 100%;
    }
}

.empty-tip {
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
