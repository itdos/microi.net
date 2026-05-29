?<template>
    <div class="mci-mobile-page page-profile">
        <!-- 顶部用户卡片（霓虹光晕） -->
        <header class="profile-hero">
            <div class="profile-hero__decor">
                <span class="decor-orb decor-orb--1"></span>
                <span class="decor-orb decor-orb--2"></span>
                <span class="decor-orb decor-orb--3"></span>
            </div>
            <div class="profile-hero__safe-top"></div>

            <!-- <div class="profile-hero__topbar">
                <span class="profile-hero__title"></span>
                <span class="profile-hero__theme" @click="toggleDark">
                    <el-icon><component :is="darkModeIcon" /></el-icon>
                </span>
            </div> -->

            <template v-if="loading">
                <div class="profile-skeleton">
                    <div class="sk-avatar-lg"></div>
                    <div class="sk-stack">
                        <div class="sk-line" style="width: 120px;"></div>
                        <div class="sk-line" style="width: 180px; height: 10px;"></div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class="profile-hero__user">
                    <div class="profile-hero__avatar-wrap">
                        <el-avatar :size="72" :src="userAvatar" class="profile-hero__avatar">
                            {{ currentUser.Name?.charAt(0) || 'U' }}
                        </el-avatar>
                        <span class="profile-hero__avatar-glow"></span>
                    </div>
                    <div class="profile-hero__detail">
                        <div class="profile-hero__name-row">
                            <h2 class="profile-hero__name">{{ currentUser.Name || currentUser.Account || 'Loading...' }}</h2>
                            <span v-if="currentUser.TenantName" class="mci-tag mci-tag--cyan">{{ currentUser.TenantName }}</span>
                        </div>
                        <p class="profile-hero__account">{{ currentUser.Account || '' }}</p>
                        <p v-if="orgInfo" class="profile-hero__org">{{ orgInfo }}</p>
                    </div>
                </div>
            </template>
        </header>

        <!-- 功能列表 -->
        <div class="function-list" v-if="!loading">
            <!-- 图标网格快捷操作 -->
            <div class="quick-grid mci-stagger-item" :style="{ '--mci-index': 0 }">
                <div class="quick-grid__item" @click="showThemePanel = true">
                    <div class="quick-grid__icon quick-grid__icon--primary"><el-icon><Brush /></el-icon></div>
                    <span class="quick-grid__label">主题</span>
                </div>
                <div class="quick-grid__item" @click="showLangSelect = true">
                    <div class="quick-grid__icon quick-grid__icon--cyan"><fa-icon icon="fas fa-globe" /></div>
                    <span class="quick-grid__label">语言</span>
                </div>
                <div class="quick-grid__item" @click="showPasswordDialog = true">
                    <div class="quick-grid__icon quick-grid__icon--gold"><el-icon><Lock /></el-icon></div>
                    <span class="quick-grid__label">修改密码</span>
                </div>
                <div class="quick-grid__item" @click="showAbout = true">
                    <div class="quick-grid__icon quick-grid__icon--pink"><el-icon><InfoFilled /></el-icon></div>
                    <span class="quick-grid__label">关于</span>
                </div>
            </div>

            <!-- 横向列表 -->
            <div class="mci-cell-group mci-stagger-item" :style="{ '--mci-index': 1 }">
                <div v-if="isApk" class="mci-cell" @click="openServerUrlDialog">
                    <div class="mci-cell__icon mci-cell__icon--cyan"><el-icon><Connection /></el-icon></div>
                    <div class="mci-cell__main">
                        <span class="mci-cell__title">服务器地址</span>
                        <span class="mci-cell__desc">{{ currentServerUrl }}</span>
                    </div>
                    <el-icon class="mci-cell__arrow"><ArrowRight /></el-icon>
                </div>
                <div v-if="isIos" class="mci-cell" @click="showIosGuide = true">
                    <div class="mci-cell__icon mci-cell__icon--ios"><fa-icon icon="fab fa-apple" /></div>
                    <div class="mci-cell__main">
                        <span class="mci-cell__title">iOS APP</span>
                        <span class="mci-cell__desc">添加到手机主屏幕</span>
                    </div>
                    <el-icon class="mci-cell__arrow"><ArrowRight /></el-icon>
                </div>
            </div>

            <!-- 退出登录按钮 -->
            <button class="mci-btn mci-btn--danger logout-btn" @click="handleLogout">
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
            </button>
        </div>

        <!-- 主题色面板 -->
        <el-drawer v-model="showThemePanel" direction="btt" size="auto" title="主题设置" class="mci-drawer mci-drawer--above-tabbar" :z-index="2001">
            <!-- 显示模式切换 -->
            <div class="mode-section">
                <div class="mode-section__label">显示模式</div>
                <div class="mode-switch">
                    <div class="mode-switch__item" :class="{ active: darkMode === 'light' }" @click="changeMode('light')">
                        <el-icon :size="20"><Sunny /></el-icon>
                        <span>浅色</span>
                    </div>
                    <div class="mode-switch__item" :class="{ active: darkMode === 'dark' }" @click="changeMode('dark')">
                        <el-icon :size="20"><Moon /></el-icon>
                        <span>深色</span>
                    </div>
                </div>
            </div>
            <!-- 主题色 -->
            <div class="mode-section">
                <div class="mode-section__label">主题色</div>
            </div>
            <div class="theme-grid">
                <div
                    v-for="theme in themeColors"
                    :key="theme.value"
                    class="theme-item"
                    :class="{ active: currentTheme === theme.value }"
                    @click="changeTheme(theme.value)"
                >
                    <div class="theme-color" :style="{ background: theme.value }">
                        <el-icon v-if="currentTheme === theme.value" class="check-icon"><Check /></el-icon>
                    </div>
                    <span class="theme-name">{{ theme.name }}</span>
                </div>
            </div>
        </el-drawer>

        <!-- 修改密码 -->
        <el-dialog
            v-model="showPasswordDialog" draggable align-center
            title="修改密码" width="92%" class="mci-submenu-dialog"
            :close-on-click-modal="false"
        >
            <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-position="top">
                <el-form-item label="原密码" prop="oldPassword">
                    <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入原密码" show-password />
                </el-form-item>
                <el-form-item label="新密码" prop="newPassword">
                    <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showPasswordDialog = false">取消</el-button>
                <el-button type="primary" :loading="passwordLoading" @click="submitPassword">确定</el-button>
            </template>
        </el-dialog>

        <!-- 关于 -->
        <el-dialog v-model="showAbout" title="关于系统" width="92%" class="mci-submenu-dialog" draggable align-center>
            <div class="about-content">
                <img :src="systemLogo" class="about-logo" alt="logo" />
                <h3 class="about-title">{{ systemName }}</h3>
                <p class="about-version">{{ version }}</p>
                <p class="about-company" v-if="companyName">{{ companyName }}</p>
                <div v-if="loginBottomContent" class="about-footer" v-safe-html="loginBottomContent"></div>
            </div>
        </el-dialog>

        <!-- APK 服务器地址 -->
        <el-dialog
            v-if="isApk"
            v-model="showServerUrlDialog" title="修改服务器地址"
            width="92%" class="mci-submenu-dialog" draggable align-center
            :close-on-click-modal="false"
        >
            <div class="server-url-form">
                <div class="current-url-card">
                    <div class="current-url-label">当前服务器</div>
                    <div class="current-url-value">{{ currentServerUrl }}</div>
                </div>
                <div class="new-url-section">
                    <div class="section-title">新地址配置</div>
                    <div class="url-row">
                        <el-select v-model="serverUrlForm.protocol" class="protocol-select" size="large">
                            <el-option label="https://" value="https://" />
                            <el-option label="http://" value="http://" />
                        </el-select>
                        <el-input
                            v-model="serverUrlForm.domain" placeholder="域名或 IP"
                            class="domain-input" size="large" clearable
                            @keyup.enter="confirmServerUrl"
                        />
                    </div>
                    <div class="url-preview" v-if="serverUrlForm.domain">
                        <span class="mci-tag mci-tag--cyan">预览</span>
                        <span class="preview-text">{{ serverUrlForm.protocol }}{{ serverUrlForm.domain }}</span>
                    </div>
                </div>
                <div class="tip-text">
                    <el-icon><InfoFilled /></el-icon>
                    修改后应用将自动重启
                </div>
            </div>
            <template #footer>
                <el-button @click="showServerUrlDialog = false">取消</el-button>
                <el-button type="primary" :loading="serverUrlLoading" @click="confirmServerUrl">保存并重启</el-button>
            </template>
        </el-dialog>

        <!-- 语言选择 -->
        <el-drawer v-model="showLangSelect" direction="btt" size="auto" title="选择语言" class="mci-drawer mci-drawer--above-tabbar" :z-index="2001">
            <div class="lang-list">
                <div
                    v-for="item in SUPPORTED_LOCALES"
                    :key="item.value"
                    class="mci-cell"
                    :class="{ active: language === item.value }"
                    @click="handleSetLanguage(item.value)"
                >
                    <span class="mci-cell__title">{{ item.label }}</span>
                    <el-icon v-if="language === item.value" class="check-icon"><Check /></el-icon>
                </div>
            </div>
        </el-drawer>

        <!-- iOS 添加到主屏幕指引 -->
        <el-drawer
            v-if="isIos"
            v-model="showIosGuide"
            direction="btt"
            size="auto"
            title="添加到主屏幕"
            class="mci-drawer mci-drawer--above-tabbar"
            :z-index="2001"
        >
            <div class="ios-guide">
                <p class="ios-guide__tip">请按以下步骤手动操作：</p>
                <div class="ios-guide__steps">
                    <div class="ios-guide__step">
                        <div class="ios-guide__step-num">1</div>
                        <div class="ios-guide__step-text">
                            点击 Safari 底部中央的
                            <span class="ios-guide__badge">分享</span>
                            按钮（方框+箭头图标 <span class="ios-guide__icon-hint">⬆</span>）
                        </div>
                    </div>
                    <div class="ios-guide__step">
                        <div class="ios-guide__step-num">2</div>
                        <div class="ios-guide__step-text">
                            在弹出菜单中向下滑动，找到并点击
                            <span class="ios-guide__badge">添加到主屏幕</span>
                        </div>
                    </div>
                    <div class="ios-guide__step">
                        <div class="ios-guide__step-num">3</div>
                        <div class="ios-guide__step-text">
                            确认应用名称后，点击右上角
                            <span class="ios-guide__badge">添加</span>
                            即可完成
                        </div>
                    </div>
                </div>
                <p class="ios-guide__hint">添加后从主屏幕打开，将以全屏 App 模式运行，无浏览器导航栏干扰。</p>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
import { DiyCommon } from "@/utils/diy.common.js";
import { ref, computed, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore, useUserStore, useTagsViewStore, useAppStore } from '@/pinia';
import {
    Brush, Lock, InfoFilled, SwitchButton, ArrowRight, Check, Connection, Sunny, Moon
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { removeToken } from '@/utils/auth';
import LocalStorageManager from '@/utils/localStorage-manager';
import { useI18n } from 'vue-i18n';
import { setI18nLocale, SUPPORTED_LOCALES, normalizeLocale } from '@/lang';
import { setThemeColor as applyThemeColor, setThemeMode, getThemeMode } from '@/utils/theme-color.js';

defineOptions({ name: 'mobile_profile' });
import { version as appVersion } from '../../../package.json';

const router = useRouter();
const diyStore = useDiyStore();
const userStore = useUserStore();
const tagsViewStore = useTagsViewStore();
const appStore = useAppStore();
const { locale } = useI18n();

const loading = ref(true);

onMounted(() => {
    setTimeout(() => { loading.value = false; }, 300);
});

const currentUser = computed(() => diyStore.GetCurrentUser);
const userAvatar = computed(() => {
    const avatar = currentUser.value?.Avatar;
    if (avatar) return avatar.startsWith('http') ? avatar : DiyCommon.GetServerPath(avatar);
    return './static/img/nohead-girl.png';
});

const orgInfo = computed(() => {
    const user = currentUser.value;
    if (!user) return '';
    const parts = [];
    if (user.DeptName) parts.push(user.DeptName);
    const roles = user._Roles;
    if (Array.isArray(roles) && roles.length > 0) {
        const roleNames = roles.map(r => r.Name).filter(Boolean);
        if (roleNames.length > 0) parts.push(roleNames.join('、'));
    }
    return parts.join(' · ');
});

const version = computed(() => `v${appVersion}`);
const systemName = computed(() => diyStore.SysConfig?.SysTitle || diyStore.WebTitle || 'Microi 吾码');
const companyName = computed(() => diyStore.SysConfig?.CompanyName || '');
const systemLogo = computed(() => {
    const logo = DiyCommon.GetServerPath(diyStore.SysConfig?.SysLogo || './static/img/logo/microi-logo.svg');
    return logo.startsWith('http') ? logo : DiyCommon.GetServerPath(logo);
});

const loginBottomContent = computed(() => {
    const content = diyStore.SysConfig?.LoginBottomContent;
    if (!content) return '';
    return content
        .replace('$CurrentLang$', currentLang.value)
        .replace('$OsVersion$', version.value)
        .replace('$SysShortTitle$', diyStore.SysConfig?.SysShortTitle || '')
        .replace('$SysTitle$', systemName.value)
        .replace('$CompanyName$', companyName.value);
});

const currentTheme = computed(() => diyStore.themeColor || diyStore.SysConfig?.ThemeColor || '#409eff');

const language = computed(() => normalizeLocale(appStore.language) || 'zh-CN');
const currentLang = computed(() => {
    const found = SUPPORTED_LOCALES.find(l => l.value === language.value);
    return found ? found.label : '简体中文';
});

const themeColors = [
    { name: '紫色', value: '#6C2BD9' },
    { name: '蓝色', value: '#2196F3' },
    { name: '青色', value: '#06B6D4' },
    { name: '粉色', value: '#EC4899' },
    { name: '橙色', value: '#F59E0B' },
    { name: '红色', value: '#E8294A' },
    { name: '绿色', value: '#27AE60' },
    { name: '靛蓝', value: '#3F51B5' },
    { name: '深橙', value: '#FF5722' },
    { name: '灰蓝', value: '#607D8B' },
    { name: '天蓝', value: '#409EFF' },
    { name: '深紫', value: '#673AB7' },
];

const showThemePanel = ref(false);
const showPasswordDialog = ref(false);
const showAbout = ref(false);
const showLangSelect = ref(false);

// === 深色模式切换（与 PC 端 ThemeSelect.vue 同步逻辑）===
const darkMode = ref(getThemeMode());
const darkModeIcon = computed(() => darkMode.value === 'dark' ? Sunny : Moon);
function toggleDark() {
    const next = darkMode.value === 'dark' ? 'light' : 'dark';
    changeMode(next);
}
function changeMode(mode) {
    darkMode.value = mode;
    setThemeMode(mode);
    // 切换模式后重新写入主题色，使 MCI 渐变/阴影按当前模式重算
    const color = currentTheme.value;
    if (color) applyThemeColor(color);
}

// === iOS 检测 ===
const isIos = ref(
    typeof window !== 'undefined' 
    && /iPhone|iPad|iPod/.test(navigator.userAgent) 
    // && !window.navigator.standalone   // 已是 PWA 主屏幕模式则不显示
);
const showIosGuide = ref(false);

// === APK 服务器配置 ===
const isApk = ref(typeof window !== 'undefined' && !!window.plus);
const currentServerUrl = ref(typeof window !== 'undefined' ? window.location.origin : '');
const showServerUrlDialog = ref(false);
const serverUrlLoading = ref(false);
const serverUrlForm = reactive({ protocol: 'https://', domain: '' });

const openServerUrlDialog = () => {
    const url = currentServerUrl.value || window.location.origin;
    if (url.startsWith('https://')) {
        serverUrlForm.protocol = 'https://';
        serverUrlForm.domain = url.slice(8);
    } else if (url.startsWith('http://')) {
        serverUrlForm.protocol = 'http://';
        serverUrlForm.domain = url.slice(7);
    } else {
        serverUrlForm.protocol = 'https://';
        serverUrlForm.domain = url;
    }
    serverUrlLoading.value = false;
    showServerUrlDialog.value = true;
};

const confirmServerUrl = () => {
    const domain = serverUrlForm.domain.trim().replace(/\/$/, '');
    if (!domain) { ElMessage.warning('请输入域名或 IP 地址'); return; }
    const fullUrl = serverUrlForm.protocol + domain;
    ElMessageBox.confirm(
        `将切换服务器地址为\n\n${fullUrl}\n\n确认后应用将自动重启`,
        '确认切换',
        { confirmButtonText: '确定并重启', cancelButtonText: '取消', type: 'warning' }
    ).then(() => {
        serverUrlLoading.value = true;
        try { localStorage.setItem('microi_apk_server_url', fullUrl); } catch (e) {}
        showServerUrlDialog.value = false;
        try {
            if (window.plus) plus.runtime.restart();
            else window.location.href = fullUrl;
        } catch (e) {
            window.location.href = fullUrl;
        }
    }).catch(() => { serverUrlLoading.value = false; });
};

// === 密码 ===
const passwordFormRef = ref(null);
const passwordLoading = ref(false);
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });

const validateConfirmPassword = (rule, value, callback) => {
    if (value !== passwordForm.newPassword) callback(new Error('两次输入的密码不一致'));
    else callback();
};

const passwordRules = {
    oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
    newPassword: [
        { required: true, message: '请输入新密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能小于6位', trigger: 'blur' }
    ],
    confirmPassword: [
        { required: true, message: '请再次输入新密码', trigger: 'blur' },
        { validator: validateConfirmPassword, trigger: 'blur' }
    ]
};

const changeTheme = (color) => {
    // 使用中心化 setter，同时写入 Legacy + Element Plus + MCI 令牌
    applyThemeColor(color);
    diyStore.setThemeColor(color);
    showThemePanel.value = false;
    ElMessage.success('主题已切换');
};

const submitPassword = async () => {
    if (!passwordFormRef.value) return;
    await passwordFormRef.value.validate((valid) => {
        if (valid) {
            passwordLoading.value = true;
            setTimeout(() => {
                passwordLoading.value = false;
                showPasswordDialog.value = false;
                passwordForm.oldPassword = '';
                passwordForm.newPassword = '';
                passwordForm.confirmPassword = '';
                ElMessage.success('密码修改成功，请重新登录');
                setTimeout(() => { handleLogout(false); }, 1500);
            }, 1000);
        }
    });
};

const handleSetLanguage = (lang) => {
    const n = setI18nLocale(lang);
    locale.value = n;
    appStore.setLanguage(n);
    if (DiyCommon?.ChangeLang) DiyCommon.ChangeLang(n, true);
    showLangSelect.value = false;
    ElMessage.success('语言已切换');
};

const handleLogout = (showConfirm = true) => {
    const doLogout = async () => {
        try {
            await userStore.logout();
            removeToken();
            LocalStorageManager.remove('CurrentUser');
            tagsViewStore.delAllViews();
            if (isMiniProgram()) {
                try {
                    window.wx.miniProgram.reLaunch({ url: '/pages/login/index?logout=1' });
                    return;
                } catch (wxErr) { /* 降级 */ }
            }
            router.push('/login');
            ElMessage.success('已退出登录');
        } catch (error) {
            removeToken();
            LocalStorageManager.remove('CurrentUser');
            if (isMiniProgram()) {
                try {
                    window.wx.miniProgram.reLaunch({ url: '/pages/login/index?logout=1' });
                    return;
                } catch (e) {}
            }
            router.push('/login');
        }
    };

    if (showConfirm) {
        ElMessageBox.confirm('确定要退出登录吗？', '提示', {
            confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
        }).then(doLogout).catch(() => {});
    } else {
        doLogout();
    }
};

function isMiniProgram() {
    if (window.__wxjs_environment === 'miniprogram') return true;
    if (/source=miniprogram/.test(location.search)) return true;
    if (window.wx && window.wx.miniProgram) return true;
    return false;
}
</script>

<style lang="scss" scoped>
.page-profile {
    padding-bottom: calc(var(--mci-tabbar-height) + var(--mci-safe-bottom) + var(--mci-space-6));
}

/* === Hero === */
.profile-hero {
    position: relative;
    overflow: hidden;
    background: var(--mci-gradient-primary);
    padding-bottom: var(--mci-space-4);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25),
                0 0 60px var(--mci-color-primary-glow);

    &__safe-top { height: var(--mci-safe-top); }

    &__decor {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
    }

    &__topbar {
        position: relative; z-index: 1;
        display: flex; align-items: center; justify-content: flex-end;
        padding: var(--mci-space-2) var(--mci-space-4) 0;
    }

    &__title {
        font-size: var(--mci-text-lg);
        font-weight: var(--mci-font-bold);
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    &__theme {
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
        border-radius: var(--mci-radius-full);
        cursor: pointer;
        transition: transform var(--mci-duration-fast);

        &:active { transform: scale(0.92); }
    }

    &__user {
        position: relative; z-index: 1;
        display: flex; align-items: center;
        gap: var(--mci-space-4);
        padding: var(--mci-space-2) var(--mci-space-5) var(--mci-space-3);
    }

    &__avatar-wrap {
        position: relative;
    }

    &__avatar-glow {
        position: absolute;
        inset: -6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        filter: blur(10px);
        z-index: 0;
        animation: mciAvatarGlow 3s ease-in-out infinite alternate;
    }

    &__avatar {
        position: relative;
        z-index: 1;
        border: 3px solid rgba(255, 255, 255, 0.7);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        background: var(--mci-gradient-primary);
        color: #fff;
        font-weight: var(--mci-font-bold);
        font-size: 28px;
    }

    &__detail {
        flex: 1;
        min-width: 0;
        color: #fff;
    }

    &__name-row {
        display: flex; align-items: center; flex-wrap: wrap;
        gap: var(--mci-space-2);
        margin-bottom: 4px;
    }

    &__name {
        font-size: var(--mci-text-xl);
        font-weight: var(--mci-font-bold);
        color: #fff;
        margin: 0;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    &__account {
        font-size: var(--mci-text-sm);
        color: rgba(255, 255, 255, 0.85);
        margin: 2px 0;
    }

    &__org {
        font-size: var(--mci-text-xs);
        color: rgba(255, 255, 255, 0.7);
        margin: 2px 0;
    }
}

@keyframes mciAvatarGlow {
    from { opacity: 0.4; transform: scale(1); }
    to   { opacity: 0.7; transform: scale(1.06); }
}

.decor-orb {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);

    &--1 { width: 200px; height: 200px; top: -60px; right: -60px; }
    &--2 { width: 130px; height: 130px; bottom: -40px; left: -30px; }
    &--3 { width: 80px; height: 80px; top: 30%; right: 30%; opacity: 0.6; }
}

/* === 骨架 === */
.profile-skeleton {
    display: flex; align-items: center;
    gap: var(--mci-space-4);
    padding: var(--mci-space-2) var(--mci-space-5) var(--mci-space-4);
    position: relative; z-index: 1;
}

.sk-avatar-lg {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    animation: mciShimmer 1.5s infinite;
    background-size: 400% 100%;
    background-image: linear-gradient(90deg,
        rgba(255,255,255,0.15) 25%,
        rgba(255,255,255,0.3) 50%,
        rgba(255,255,255,0.15) 75%);
}

.sk-stack {
    flex: 1;
    display: flex; flex-direction: column;
    gap: 8px;
}

.sk-line {
    height: 14px;
    border-radius: var(--mci-radius-full);
    background-size: 400% 100%;
    background-image: linear-gradient(90deg,
        rgba(255,255,255,0.15) 25%,
        rgba(255,255,255,0.3) 50%,
        rgba(255,255,255,0.15) 75%);
    animation: mciShimmer 1.5s infinite;
}

@keyframes mciShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* === 功能列表 === */
.function-list {
    margin-top: calc(-1 * var(--mci-space-4));
    padding: 0 var(--mci-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--mci-space-4);
    position: relative;
    z-index: 2;
}

/* === 快捷图标网格 === */
.quick-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--mci-space-2);
    background: var(--mci-bg-elevated, #fff);
    border-radius: var(--mci-radius-lg);
    padding: var(--mci-space-4) var(--mci-space-2);
    box-shadow: var(--mci-shadow-card);

    &__item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        padding: var(--mci-space-2) 0;
        border-radius: var(--mci-radius-md);
        transition: transform var(--mci-duration-fast);

        &:active { transform: scale(0.92); }
    }

    &__icon {
        width: 44px; height: 44px;
        border-radius: var(--mci-radius-md);
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        color: #fff;

        &--primary { background: var(--mci-gradient-primary); }
        &--cyan { background: linear-gradient(135deg, #06B6D4, #22D3EE); }
        &--gold { background: linear-gradient(135deg, #F59E0B, #FBBF24); }
        &--pink { background: linear-gradient(135deg, #EC4899, #F472B6); }
        &--ios { background: linear-gradient(135deg, #555, #1c1c1e); }
    }

    &__label {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-secondary);
    }
}

.theme-preview {
    display: inline-block;
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 2px solid var(--mci-bg-elevated);
    box-shadow: 0 0 0 1px var(--mci-border-color), 0 2px 6px rgba(0,0,0,0.2);
}

/* 退出登录按钮 */
.logout-btn {
    margin-top: var(--mci-space-2);
    width: 100%;
    display: flex; align-items: center; justify-content: center;
    gap: var(--mci-space-2);
}

/* === iOS 添加主屏幕指引 === */
.ios-guide {
    padding: 0 var(--mci-space-2) var(--mci-space-2);

    &__tip {
        font-size: var(--mci-text-sm);
        color: var(--mci-text-secondary);
        margin: 0 0 var(--mci-space-4);
        line-height: 1.6;
    }

    &__steps {
        display: flex;
        flex-direction: column;
        gap: var(--mci-space-4);
        margin-bottom: var(--mci-space-4);
    }

    &__step {
        display: flex;
        align-items: flex-start;
        gap: var(--mci-space-3);
    }

    &__step-num {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--mci-gradient-primary);
        color: #fff;
        font-size: var(--mci-text-sm);
        font-weight: var(--mci-font-bold);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    &__step-text {
        flex: 1;
        font-size: var(--mci-text-sm);
        color: var(--mci-text-primary);
        line-height: 1.7;
        padding-top: 4px;
    }

    &__badge {
        display: inline-block;
        padding: 1px 8px;
        background: var(--mci-color-primary);
        color: #fff;
        border-radius: var(--mci-radius-full);
        font-size: 12px;
        font-weight: var(--mci-font-medium);
        vertical-align: middle;
    }

    &__icon-hint {
        font-size: 15px;
        vertical-align: middle;
    }

    &__hint {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
        line-height: 1.6;
        margin: 0;
        padding: var(--mci-space-3);
        background: var(--mci-bg-card);
        border-radius: var(--mci-radius-md);
        border: 1px solid var(--mci-border-color);
    }
}

/* === 主题色面板样式移至非 scoped 块 === */


/* === 显示模式切换 === */
.mode-section {
    margin-bottom: var(--mci-space-3);

    &__label {
        font-size: var(--mci-text-sm);
        color: var(--mci-text-secondary);
        font-weight: var(--mci-font-medium);
        margin-bottom: var(--mci-space-2);
    }
}

.mode-switch {
    display: flex;
    gap: var(--mci-space-2);

    &__item {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--mci-space-2);
        padding: var(--mci-space-3);
        border-radius: var(--mci-radius-md);
        border: 2px solid var(--mci-border-color);
        background: var(--mci-bg-card, var(--el-bg-color));
        color: var(--mci-text-secondary);
        cursor: pointer;
        transition: all var(--mci-duration-base);
        font-size: var(--mci-text-sm);

        &:active { transform: scale(0.96); }

        &.active {
            border-color: var(--mci-color-primary);
            color: var(--mci-color-primary);
            background: var(--mci-color-primary-bg, rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.08));
        }
    }
}

.theme-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--mci-space-3);
}

.theme-item {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--mci-space-2);
    cursor: pointer;
    padding: var(--mci-space-2) 0;
    border-radius: var(--mci-radius-md);
    transition: transform var(--mci-duration-fast);

    &:active { transform: scale(0.94); }

    &.active .theme-color {
        box-shadow: 0 0 0 3px var(--mci-color-primary), 0 4px 16px var(--mci-color-primary-glow);
    }
}

.theme-color {
    width: 44px; height: 44px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: box-shadow var(--mci-duration-base);
}

.check-icon { color: #fff; font-size: 18px; }

.theme-name {
    font-size: var(--mci-text-xs);
    color: var(--mci-text-secondary);
}

/* === 关于内容 === */
.about-content {
    display: flex; flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mci-space-4) 0;

    .about-logo {
        width: 64px; height: 64px;
        border-radius: var(--mci-radius-md);
        margin-bottom: var(--mci-space-3);
        filter: drop-shadow(0 4px 12px var(--mci-color-primary-glow));
    }
    .about-title {
        font-size: var(--mci-text-lg);
        font-weight: var(--mci-font-bold);
        color: var(--mci-text-primary);
        margin: 0 0 var(--mci-space-1);
    }
    .about-version {
        font-size: var(--mci-text-sm);
        color: var(--mci-text-tertiary);
        margin: 0 0 var(--mci-space-2);
    }
    .about-company {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
        margin: 0;
    }
    .about-footer {
        margin-top: var(--mci-space-3);
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
    }
}

/* === 服务器地址表单 === */
.server-url-form {
    display: flex; flex-direction: column;
    gap: var(--mci-space-4);
}

.current-url-card {
    background: var(--mci-bg-card);
    border: 1px solid var(--mci-border-color);
    border-radius: var(--mci-radius-md);
    padding: var(--mci-space-3);

    .current-url-label {
        font-size: var(--mci-text-xs);
        color: var(--mci-text-tertiary);
        margin-bottom: 6px;
    }
    .current-url-value {
        font-size: var(--mci-text-sm);
        color: var(--mci-text-primary);
        word-break: break-all;
        font-family: var(--mci-font-mono, monospace);
    }
}

.section-title {
    font-size: var(--mci-text-sm);
    color: var(--mci-text-secondary);
    margin-bottom: var(--mci-space-2);
    font-weight: var(--mci-font-medium);
}

.url-row {
    display: flex; gap: var(--mci-space-2);

    .protocol-select { flex: 0 0 110px; }
    .domain-input { flex: 1; }
}

.url-preview {
    display: flex; align-items: center;
    gap: var(--mci-space-2);
    margin-top: var(--mci-space-2);
    padding: var(--mci-space-2) var(--mci-space-3);
    background: var(--mci-bg-card);
    border-radius: var(--mci-radius-md);

    .preview-text {
        font-size: var(--mci-text-sm);
        color: var(--mci-color-primary);
        word-break: break-all;
        font-family: var(--mci-font-mono, monospace);
    }
}

.tip-text {
    display: flex; align-items: center;
    gap: 6px;
    color: var(--mci-text-tertiary);
    font-size: var(--mci-text-xs);
    padding: var(--mci-space-2) var(--mci-space-3);
    background: var(--mci-bg-card);
    border-radius: var(--mci-radius-md);
    border-left: 3px solid var(--mci-color-warning);
}

/* === 语言列表 === */
.lang-list {
    .mci-cell.active .mci-cell__title { color: var(--mci-color-primary); }
    .check-icon {
        color: var(--mci-color-primary);
        font-size: 18px;
    }
}
</style>

<!-- 非 scoped 样式：覆盖 teleport 到 body 的 el-drawer -->
<style lang="scss">
.mci-drawer {
    background: var(--mci-bg-elevated) !important;
    border-top-left-radius: var(--mci-radius-2xl) !important;
    border-top-right-radius: var(--mci-radius-2xl) !important;

    .el-drawer__header {
        padding: var(--mci-space-4);
        margin-bottom: 0;
        border-bottom: 1px solid var(--mci-border-color);
        color: var(--mci-text-primary);
    }
    .el-drawer__title {
        font-size: var(--mci-text-base);
        font-weight: var(--mci-font-semibold);
        color: var(--mci-text-primary);
    }
    .el-drawer__body { padding: var(--mci-space-4); }
}

.mci-drawer--above-tabbar {
    .el-drawer__body {
        padding-bottom: calc(50px + env(safe-area-inset-bottom) + 16px) !important;
    }
}
</style>
