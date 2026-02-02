<template>
    <div class="mobile-home">
        <!-- 顶部标题栏 -->
        <div class="home-header">
            <span class="header-title">首页</span>
        </div>

        <!-- 欢迎区域 -->
        <div class="welcome-section">
            <div class="welcome-card">
                <div class="welcome-text">
                    <h2>👋 {{ welcomePrefix }}，{{ currentUser.NickName || '用户' }}</h2>
                    <p>{{ welcomeMessage }}</p>
                </div>
                <div class="welcome-date">
                    <span class="date">{{ currentDate }}</span>
                    <span class="week">{{ currentWeek }}</span>
                </div>
            </div>
        </div>

        <!-- 快捷入口 -->
        <div class="quick-entry">
            <div class="section-title">快捷入口</div>
            <div class="entry-grid">
                <div class="entry-item" @click="goTo('/mobile/workspace')">
                    <div class="entry-icon" style="background: linear-gradient(135deg, #409eff, #66b1ff)">
                        <el-icon><Grid /></el-icon>
                    </div>
                    <span>工作台</span>
                </div>
                <div class="entry-item" @click="goTo('/mobile/message')">
                    <div class="entry-icon" style="background: linear-gradient(135deg, #67c23a, #85ce61)">
                        <el-icon><ChatDotRound /></el-icon>
                    </div>
                    <span>消息</span>
                </div>
                <div class="entry-item" @click="goTo('/mobile/profile')">
                    <div class="entry-icon" style="background: linear-gradient(135deg, #e6a23c, #ebb563)">
                        <el-icon><User /></el-icon>
                    </div>
                    <span>我的</span>
                </div>
                <div class="entry-item" @click="showMore = true">
                    <div class="entry-icon" style="background: linear-gradient(135deg, #909399, #a6a9ad)">
                        <el-icon><MoreFilled /></el-icon>
                    </div>
                    <span>更多</span>
                </div>
            </div>
        </div>

        <!-- 待办事项 -->
        <div class="todo-section">
            <div class="section-header">
                <span class="section-title">待办事项</span>
                <span class="section-more" @click="goTo('/mobile/workspace')">查看全部 ></span>
            </div>
            <div class="todo-list">
                <div v-if="todoList.length > 0" class="todo-items">
                    <div v-for="item in todoList" :key="item.id" class="todo-item">
                        <div class="todo-icon">
                            <el-icon><Bell /></el-icon>
                        </div>
                        <div class="todo-content">
                            <span class="todo-title">{{ item.title }}</span>
                            <span class="todo-time">{{ item.time }}</span>
                        </div>
                        <el-icon class="todo-arrow"><ArrowRight /></el-icon>
                    </div>
                </div>
                <div v-else class="todo-empty">
                    <el-icon><CircleCheck /></el-icon>
                    <span>暂无待办事项</span>
                </div>
            </div>
        </div>

        <!-- 系统公告 -->
        <div class="notice-section">
            <div class="section-header">
                <span class="section-title">系统公告</span>
            </div>
            <div class="notice-list">
                <div v-for="notice in noticeList" :key="notice.id" class="notice-item">
                    <el-icon class="notice-icon"><DocumentCopy /></el-icon>
                    <span class="notice-title">{{ notice.title }}</span>
                    <span class="notice-time">{{ notice.time }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore } from '@/pinia';
import { 
    Grid, ChatDotRound, User, MoreFilled, Bell, 
    ArrowRight, CircleCheck, DocumentCopy 
} from '@element-plus/icons-vue';

const router = useRouter();
const diyStore = useDiyStore();

// 当前用户
const currentUser = computed(() => diyStore.GetCurrentUser);

// 从 SysConfig 获取欢迎信息
const welcomePrefix = computed(() => {
    // 根据当前时间返回不同问候语
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    if (hour < 22) return '晚上好';
    return '夜深了';
});

const welcomeMessage = computed(() => {
    const sysConfig = diyStore.SysConfig;
    if (sysConfig?.SysTitle) {
        return `欢迎使用 ${sysConfig.SysTitle}`;
    }
    if (sysConfig?.SysShortTitle) {
        return `欢迎使用 ${sysConfig.SysShortTitle}`;
    }
    return '欢迎使用 Microi 吾码低代码平台';
});

// 当前日期
const currentDate = computed(() => {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日`;
});

const currentWeek = computed(() => {
    const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weeks[new Date().getDay()];
});

// 显示更多
const showMore = ref(false);

// 模拟待办数据
const todoList = ref([
    { id: 1, title: '审批申请：请假申请 - 张三', time: '10分钟前' },
    { id: 2, title: '审批申请：报销申请 - 李四', time: '30分钟前' },
]);

// 模拟公告数据
const noticeList = ref([
    { id: 1, title: '关于系统升级的通知', time: '2026-01-28' },
    { id: 2, title: '春节假期安排通知', time: '2026-01-25' },
]);

// 跳转
const goTo = (path) => {
    router.push(path);
};
</script>

<style lang="scss" scoped>
.mobile-home {
    min-height: 100vh;
    background: #f5f7fa;
    padding-bottom: 70px;
}

.home-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
    background: #fff;
    border-bottom: 1px solid #ebeef5;
    
    .header-title {
        font-size: 17px;
        font-weight: 600;
        color: #303133;
    }
}

.welcome-section {
    padding: 16px 12px 8px;
    background: var(--color-primary);
    
    .welcome-card {
        background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, var(--color-primary-dark, #2c7acc) 100%);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .welcome-text {
            h2 {
                font-size: 18px;
                font-weight: 600;
                color: #fff;
                margin: 0 0 8px 0;
            }
            
            p {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.85);
                margin: 0;
            }
        }
        
        .welcome-date {
            text-align: right;
            
            .date {
                display: block;
                font-size: 20px;
                font-weight: 600;
                color: #fff;
            }
            
            .week {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.85);
            }
        }
    }
}

.quick-entry {
    padding: 16px 12px;
    
    .section-title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 12px;
    }
    
    .entry-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        background: #fff;
        border-radius: 12px;
        padding: 16px;
        
        .entry-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
            
            &:active {
                opacity: 0.8;
            }
            
            .entry-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 8px;
                
                .el-icon {
                    font-size: 24px;
                    color: #fff;
                }
            }
            
            span {
                font-size: 12px;
                color: #606266;
            }
        }
    }
}

.todo-section,
.notice-section {
    padding: 0 12px 16px;
    
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        
        .section-title {
            font-size: 15px;
            font-weight: 600;
            color: #303133;
        }
        
        .section-more {
            font-size: 13px;
            color: var(--color-primary, #409eff);
            cursor: pointer;
        }
    }
    
    .todo-list {
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        
        .todo-item {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            cursor: pointer;
            
            &:not(:last-child) {
                border-bottom: 1px solid #f5f7fa;
            }
            
            &:active {
                background: #f5f7fa;
            }
            
            .todo-icon {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: #fef0f0;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                
                .el-icon {
                    font-size: 18px;
                    color: #f56c6c;
                }
            }
            
            .todo-content {
                flex: 1;
                
                .todo-title {
                    display: block;
                    font-size: 14px;
                    color: #303133;
                    margin-bottom: 4px;
                }
                
                .todo-time {
                    font-size: 12px;
                    color: #909399;
                }
            }
            
            .todo-arrow {
                font-size: 14px;
                color: #c0c4cc;
            }
        }
        
        .todo-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px;
            
            .el-icon {
                font-size: 40px;
                color: #67c23a;
                margin-bottom: 12px;
            }
            
            span {
                font-size: 14px;
                color: #909399;
            }
        }
    }
    
    .notice-list {
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        
        .notice-item {
            display: flex;
            align-items: center;
            padding: 14px 16px;
            cursor: pointer;
            
            &:not(:last-child) {
                border-bottom: 1px solid #f5f7fa;
            }
            
            &:active {
                background: #f5f7fa;
            }
            
            .notice-icon {
                font-size: 16px;
                color: var(--color-primary, #409eff);
                margin-right: 10px;
            }
            
            .notice-title {
                flex: 1;
                font-size: 14px;
                color: #303133;
            }
            
            .notice-time {
                font-size: 12px;
                color: #909399;
            }
        }
    }
}
</style>
