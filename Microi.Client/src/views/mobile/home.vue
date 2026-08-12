<template>
    <div class="mci-mobile-page page-home">
        <!-- 顶部导航栏 -->
        <header class="mci-navbar">
            <span class="mci-navbar__action"></span>
            <h1 class="mci-navbar__title">{{ $t("Msg.Mobile.home.title") }}</h1>
            <span class="mci-navbar__action" @click="goTo('/mobile/message')">
                <el-icon><Bell /></el-icon>
            </span>
        </header>

        <!-- 欢迎卡片：渐变背景 + 霓虹光晕 -->
        <section class="welcome-section">
            <div class="welcome-card mci-card mci-card--neon">
                <div class="welcome-text">
                    <h2 class="welcome-greet">
                        <span>👋 {{ welcomePrefix }}</span>
                        <span class="mci-text-gradient">{{ currentUser.Name || currentUser.Account }}</span>
                    </h2>
                    <p class="welcome-msg">{{ welcomeMessage }}</p>
                </div>
                <div class="welcome-date">
                    <span class="date">{{ currentDate }}</span>
                    <span class="week">{{ currentWeek }}</span>
                </div>
            </div>
        </section>

        <!-- 快捷入口 -->
        <section class="entry-section">
            <div class="mci-section-title">
                <span>{{ $t("Msg.Mobile.home.quickAccess") }}</span>
            </div>
            <div class="entry-grid">
                <div
                    v-for="(item, idx) in entries"
                    :key="item.path || item.label"
                    class="entry-item mci-stagger-item"
                    :style="{ '--mci-index': idx }"
                    @click="onEntryClick(item)"
                >
                    <div class="entry-icon" :class="`entry-icon--${item.tone}`">
                        <el-icon><component :is="item.icon" /></el-icon>
                    </div>
                    <span class="entry-label">{{ item.label }}</span>
                </div>
            </div>
        </section>

        <!-- 待办事项 -->
        <section class="list-section">
            <div class="mci-section-title">
                <span>{{ $t("Msg.Mobile.home.todo") }}</span>
                <span class="mci-section-title__more" @click="goTo('/mobile/workspace')">
                    {{ $t("Msg.Mobile.home.viewAll") }}
                    <el-icon><ArrowRight /></el-icon>
                </span>
            </div>
            <div class="mci-cell-group">
                <template v-if="todoList.length > 0">
                    <div
                        v-for="(item, idx) in todoList"
                        :key="item.id"
                        class="mci-cell mci-stagger-item"
                        :style="{ '--mci-index': idx }"
                        @click="goTo('/mobile/workspace')"
                    >
                        <div class="mci-cell__icon mci-cell__icon--danger">
                            <el-icon><Bell /></el-icon>
                        </div>
                        <div class="mci-cell__body">
                            <span class="mci-cell__title">{{ item.title }}</span>
                            <span class="mci-cell__sub">{{ item.time }}</span>
                        </div>
                        <el-icon class="mci-cell__arrow"><ArrowRight /></el-icon>
                    </div>
                </template>
                <div v-else class="empty-state">
                    <el-icon class="empty-icon"><CircleCheck /></el-icon>
                    <span>{{ $t("Msg.Mobile.home.noTodo") }}</span>
                </div>
            </div>
        </section>

        <!-- 系统公告 -->
        <section class="list-section">
            <div class="mci-section-title">
                <span>{{ $t("Msg.Mobile.home.announcements") }}</span>
            </div>
            <div class="mci-cell-group">
                <template v-if="noticeList.length > 0">
                    <div
                        v-for="(notice, idx) in noticeList"
                        :key="notice.id"
                        class="mci-cell mci-stagger-item"
                        :style="{ '--mci-index': idx }"
                    >
                        <div class="mci-cell__icon mci-cell__icon--info">
                            <el-icon><DocumentCopy /></el-icon>
                        </div>
                        <div class="mci-cell__body">
                            <span class="mci-cell__title">{{ notice.title }}</span>
                            <span class="mci-cell__sub">{{ notice.time }}</span>
                        </div>
                        <span class="mci-tag mci-tag--primary">{{ $t("Msg.Mobile.home.announcement") }}</span>
                    </div>
                </template>
                <div v-else class="empty-state">
                    <el-icon class="empty-icon"><DocumentCopy /></el-icon>
                    <span>{{ $t("Msg.Mobile.home.noAnnouncements") }}</span>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDiyStore } from '@/pinia';
import { DiyCommon } from '@/utils/diy.common';
import {
    Grid, ChatDotRound, User, MoreFilled, Bell,
    ArrowRight, CircleCheck, DocumentCopy
} from '@element-plus/icons-vue';

defineOptions({
    name: 'mobile_home'
});

const router = useRouter();
const diyStore = useDiyStore();
const { t, locale } = useI18n();

const currentUser = computed(() => diyStore.GetCurrentUser);

const welcomePrefix = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return t('Msg.Mobile.home.lateNight');
    if (hour < 9) return t('Msg.Mobile.home.goodMorning');
    if (hour < 12) return t('Msg.Mobile.home.goodForenoon');
    if (hour < 14) return t('Msg.Mobile.home.goodNoon');
    if (hour < 18) return t('Msg.Mobile.home.goodAfternoon');
    if (hour < 22) return t('Msg.Mobile.home.goodEvening');
    return t('Msg.Mobile.home.lateNight');
});

const welcomeMessage = computed(() => {
    const sysConfig = diyStore.SysConfig;
    if (sysConfig?.SysTitle) {
        return t('Msg.Mobile.home.welcomeSystem', { name: sysConfig.SysTitle });
    }
    if (sysConfig?.SysShortTitle) {
        return t('Msg.Mobile.home.welcomeSystem', { name: sysConfig.SysShortTitle });
    }
    return t('Msg.Mobile.home.welcomeMicroi');
});

const currentDate = computed(() => {
    return new Intl.DateTimeFormat(locale.value || 'zh-CN', { month: 'long', day: 'numeric' }).format(new Date());
});

const currentWeek = computed(() => {
    return new Intl.DateTimeFormat(locale.value || 'zh-CN', { weekday: 'long' }).format(new Date());
});

const entries = computed(() => [
    { label: t('Msg.Mobile.home.workbench'), icon: Grid, tone: 'primary', path: '/mobile/workspace' },
    { label: t('Msg.Mobile.home.messages'), icon: ChatDotRound, tone: 'cyan', path: '/mobile/message' },
    { label: t('Msg.Mobile.home.mine'), icon: User, tone: 'gold', path: '/mobile/profile' },
    { label: t('Msg.Mobile.home.more'), icon: MoreFilled, tone: 'pink', action: 'more' }
]);

const showMore = ref(false);

const todoList = ref([]);
const noticeList = ref([]);

function formatBusinessTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale.value || 'zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(date);
}

async function loadTodoList() {
    const result = await DiyCommon.PostAsync('/api/WorkFlow/getWFWork', {
        WorkType: 'Todo', _PageIndex: 1, _PageSize: 3, _Keyword: ''
    });
    if (!result || result.Code !== 1) return;
    todoList.value = (Array.isArray(result.Data) ? result.Data : []).map(item => ({
        id: item.Id,
        title: item.FlowTitle || item.NodeName || item.Id,
        time: formatBusinessTime(item.CreateTime)
    }));
}

async function loadNoticeList() {
    const result = await DiyCommon.FormEngine.GetTableData({
        FormEngineKey: 'diy_notice',
        _PageSize: 3,
        _PageIndex: 1,
        _OrderBy: 'CreateTime',
        _OrderByType: 'DESC',
        _SelectFields: ['Id', 'Biaoti', 'Fenlei', 'CreateTime']
    });
    if (!result || result.Code !== 1) return;
    noticeList.value = (Array.isArray(result.Data) ? result.Data : []).map(item => ({
        id: item.Id,
        title: item.Biaoti || item.Fenlei || item.Id,
        time: formatBusinessTime(item.CreateTime)
    }));
}

onMounted(async () => {
    const results = await Promise.allSettled([loadTodoList(), loadNoticeList()]);
    results.filter(item => item.status === 'rejected').forEach(item => {
        console.warn('[mobile-home] business data load failed', item.reason);
    });
});



function goTo(path) {
    router.push(path);
}

function onEntryClick(item) {
    if (item.path) {
        goTo(item.path);
    } else if (item.action === 'more') {
        showMore.value = true;
    }
}
</script>

<style lang="scss" scoped>
.page-home {
    padding-bottom: calc(var(--mci-tabbar-height) + var(--mci-safe-bottom) + var(--mci-space-6));
}

/* === 欢迎卡片 === */
.welcome-section {
    padding: var(--mci-space-4);
}

.welcome-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--mci-space-4);
    padding: var(--mci-space-5);
    overflow: hidden;
    position: relative;

    &::before {
        content: '';
        position: absolute;
        top: -50%;
        right: -20%;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(114, 43, 255, 0.25) 0%, transparent 70%);
        pointer-events: none;
    }
}

.welcome-text {
    flex: 1;
    min-width: 0;
    position: relative;
    z-index: 1;
}

.welcome-greet {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: var(--mci-text-lg);
    font-weight: var(--mci-font-bold);
    color: var(--mci-text-primary);
    margin: 0 0 var(--mci-space-2) 0;
}

.welcome-msg {
    font-size: var(--mci-text-sm);
    color: var(--mci-text-secondary);
    margin: 0;
}

.welcome-date {
    text-align: right;
    flex-shrink: 0;

    .date {
        display: block;
        font-size: var(--mci-text-xl);
        font-weight: var(--mci-font-bold);
        background: var(--mci-gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .week {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
    }
}

/* === 快捷入口 === */
.entry-section {
    padding: 0 var(--mci-space-4) var(--mci-space-4);
}

.entry-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--mci-space-3);
    background: var(--mci-bg-card);
    border: 1px solid var(--mci-border-color);
    border-radius: var(--mci-radius-xl);
    padding: var(--mci-space-4);
    box-shadow: var(--mci-shadow-card);
}

.entry-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--mci-space-2);
    cursor: pointer;
    padding: var(--mci-space-2) 0;
    min-height: var(--mci-touch-target);
    transition: transform var(--mci-duration-fast) var(--mci-ease-out);

    &:active { transform: scale(0.92); }
}

.entry-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--mci-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mci-text-on-primary);

    .el-icon { font-size: 22px; }

    &--primary {
        background: var(--mci-gradient-primary);
        box-shadow: 0 4px 12px var(--mci-color-primary-glow);
    }
    &--cyan {
        background: linear-gradient(135deg, #00F5D4 0%, #29B8FF 100%);
        box-shadow: 0 4px 12px rgba(0, 245, 212, 0.3);
    }
    &--gold {
        background: var(--mci-gradient-gold);
        color: #1A1A2E;
        box-shadow: 0 4px 12px rgba(255, 209, 0, 0.3);
    }
    &--pink {
        background: linear-gradient(135deg, #FF6EC7 0%, #FF2E63 100%);
        box-shadow: 0 4px 12px rgba(255, 110, 199, 0.3);
    }
}

.entry-label {
    font-size: var(--mci-text-xs);
    color: var(--mci-text-secondary);
    font-weight: var(--mci-font-medium);
}

/* === 列表区块 === */
.list-section {
    padding: 0 var(--mci-space-4) var(--mci-space-4);
}

.mci-section-title__more {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    .el-icon { font-size: 12px; }
}

.mci-cell__icon--danger {
    background: linear-gradient(135deg, rgba(255, 46, 99, 0.4), rgba(255, 110, 199, 0.4));
    color: var(--mci-color-accent-red);
}
.mci-cell__icon--info {
    background: linear-gradient(135deg, rgba(0, 245, 212, 0.4), rgba(41, 184, 255, 0.4));
    color: var(--mci-color-accent-cyan);
}

/* === 空状态 === */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--mci-space-10);
    color: var(--mci-text-tertiary);
    font-size: var(--mci-text-sm);

    .empty-icon {
        font-size: 40px;
        color: var(--mci-color-success);
        margin-bottom: var(--mci-space-3);
        filter: drop-shadow(0 0 8px currentColor);
    }
}
</style>
