<template>
    <el-dialog v-model="dialogShow" width="60%" :before-close="handleClose" append-to-body title="选择图标">
        <template #header>
            <div style="display: flex; align-items: center">
                <el-input style="width: 200px" v-model="searchIcon" placeholder="搜索图标" @input="changeSearchIcon" clearable>
                    <template #suffix>
                        <el-icon class="el-input__icon"><Search /></el-icon>
                    </template>
                </el-input>
                <div v-if="showIcon && selectedIcon" style="margin-left: 20px; display: flex; align-items: center">
                    <span style="margin-right: 10px">当前选择：</span>
                    <el-icon :size="24">
                        <component :is="getIconComponent(selectedIcon)" />
                    </el-icon>
                    <span style="margin-left: 8px; color: #666">{{ selectedIcon }}</span>
                </div>
            </div>
        </template>
        
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
                    <el-icon :size="32">
                        <component :is="item.component" />
                    </el-icon>
                </div>
                <span class="text" :title="item.name">{{ item.name }}</span>
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

// 获取所有 Element Plus 图标列表
const iconList = Object.keys(ElementPlusIcons).map((name) => ({
    name,
    component: ElementPlusIcons[name]
}));

// 模糊搜索
function fuzzyQuery(list, keyword) {
    if (!keyword) return list;
    const lowerKeyword = keyword.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(lowerKeyword));
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
            showIcon: false,
            filteredList: []
        };
    },
    computed: {
        total() {
            return this.searchIcon ? this.filteredList.length : iconList.length;
        },
        displayList() {
            const sourceList = this.searchIcon ? this.filteredList : iconList;
            return listPage(sourceList, this.currentPage, this.pageSize);
        }
    },
    methods: {
        getIconComponent(name) {
            return ElementPlusIcons[name] || ElementPlusIcons.Document;
        },
        show() {
            this.dialogShow = true;
            this.selectedIcon = this.model || "";
            this.showIcon = !!this.model;
        },
        changeSearchIcon() {
            this.currentPage = 1;
            if (this.searchIcon) {
                this.filteredList = fuzzyQuery(iconList, this.searchIcon);
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
    height: 500px;
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
