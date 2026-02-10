<template>
    <div class="mobile-profile">
        <!-- 骨架屏 -->
        <template v-if="loading">
            <!-- 用户信息卡片骨架 -->
            <div class="user-card">
                <div class="user-card-bg"></div>
                <div class="user-info">
                    <el-skeleton animated>
                        <template #template>
                            <div style="display: flex; align-items: center;">
                                <el-skeleton-item variant="circle" style="width: 72px; height: 72px;" />
                                <div style="margin-left: 16px;">
                                    <el-skeleton-item variant="text" style="width: 100px; height: 24px; margin-bottom: 8px;" />
                                    <el-skeleton-item variant="text" style="width: 150px; height: 16px;" />
                                </div>
                            </div>
                        </template>
                    </el-skeleton>
                </div>
            </div>
            <!-- 功能列表骨架 -->
            <div class="function-list">
                <div v-for="n in 3" :key="'skeleton-group-' + n" class="function-group">
                    <div v-for="m in (n === 1 ? 1 : 2)" :key="'skeleton-item-' + m" class="function-item">
                        <el-skeleton animated>
                            <template #template>
                                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <el-skeleton-item variant="circle" style="width: 20px; height: 20px;" />
                                        <el-skeleton-item variant="text" style="width: 80px; height: 18px;" />
                                    </div>
                                    <el-skeleton-item variant="text" style="width: 16px; height: 16px;" />
                                </div>
                            </template>
                        </el-skeleton>
                    </div>
                </div>
            </div>
        </template>

        <!-- 真实内容 -->
        <template v-else>
            <!-- 用户信息卡片 -->
        <div class="user-card">
            <div class="user-card-bg"></div>
            <div class="user-info">
                <el-avatar :size="72" :src="userAvatar" class="user-avatar">
                    {{ currentUser.Name?.charAt(0) || 'U' }}
                </el-avatar>
                <div class="user-detail">
                    <h2 class="user-name">{{ currentUser.Name || currentUser.Account || 'Loading...' }}</h2>
                    <p class="user-account">账号: {{ currentUser.Account || 'Loading...' }}</p>
                </div>
            </div>
        </div>

        <!-- 功能列表 -->
        <div class="function-list">
            <!-- 主题设置 -->
            <div class="function-group">
                <div class="function-item" @click="showThemePanel = true">
                    <div class="item-left">
                        <el-icon class="item-icon"><Brush /></el-icon>
                        <span class="item-title">主题切换</span>
                    </div>
                    <div class="item-right">
                        <span class="item-value">
                            <span class="theme-preview" :style="{ background: currentTheme }"></span>
                        </span>
                        <el-icon><ArrowRight /></el-icon>
                    </div>
                </div>
                
                <div class="function-item" @click="showLangSelect = true">
                    <div class="item-left">
                        <el-icon class="item-icon"><fa-icon icon="fas fa-globe" /></el-icon>
                        <span class="item-title">语言切换</span>
                    </div>
                    <div class="item-right">
                        <span class="item-value">{{ currentLang }}</span>
                        <el-icon><ArrowRight /></el-icon>
                    </div>
                </div>
            </div>

            <!-- 账号安全 -->
            <div class="function-group">
                <div class="function-item" @click="showPasswordDialog = true">
                    <div class="item-left">
                        <el-icon class="item-icon"><Lock /></el-icon>
                        <span class="item-title">修改密码</span>
                    </div>
                    <div class="item-right">
                        <el-icon><ArrowRight /></el-icon>
                    </div>
                </div>
                
                <div class="function-item" @click="showAbout = true">
                    <div class="item-left">
                        <el-icon class="item-icon"><InfoFilled /></el-icon>
                        <span class="item-title">关于系统</span>
                    </div>
                    <div class="item-right">
                        <span class="item-value">{{ version }}</span>
                        <el-icon><ArrowRight /></el-icon>
                    </div>
                </div>
            </div>

            <!-- 退出登录 -->
            <div class="function-group">
                <div class="function-item logout-item" @click="handleLogout">
                    <div class="item-left">
                        <el-icon class="item-icon"><SwitchButton /></el-icon>
                        <span class="item-title">退出登录</span>
                    </div>
                </div>
            </div>
        </div>
        </template>

        <!-- 主题选择面板 -->
        <el-drawer
            v-model="showThemePanel"
            direction="btt"
            size="auto"
            title="选择主题"
            class="theme-drawer"
        >
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

        <!-- 修改密码弹窗 -->
        <el-dialog
            v-model="showPasswordDialog"
            title="修改密码"
            width="90%"
            class="password-dialog"
            :close-on-click-modal="false"
        >
            <el-form 
                ref="passwordFormRef"
                :model="passwordForm" 
                :rules="passwordRules"
                label-position="top"
            >
                <el-form-item label="原密码" prop="oldPassword">
                    <el-input 
                        v-model="passwordForm.oldPassword" 
                        type="password"
                        placeholder="请输入原密码"
                        show-password
                    />
                </el-form-item>
                <el-form-item label="新密码" prop="newPassword">
                    <el-input 
                        v-model="passwordForm.newPassword" 
                        type="password"
                        placeholder="请输入新密码"
                        show-password
                    />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input 
                        v-model="passwordForm.confirmPassword" 
                        type="password"
                        placeholder="请再次输入新密码"
                        show-password
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showPasswordDialog = false">取消</el-button>
                <el-button type="primary" :loading="passwordLoading" @click="submitPassword">
                    确定
                </el-button>
            </template>
        </el-dialog>

        <!-- 关于系统弹窗 -->
        <el-dialog
            v-model="showAbout"
            title="关于系统"
            width="90%"
            class="about-dialog"
        >
            <div class="about-content">
                <img :src="systemLogo" class="about-logo" alt="logo" />
                <h3 class="about-title">{{ systemName }}</h3>
                <p class="about-version">{{ version }}</p>
                <p class="about-company" v-if="companyName">{{ companyName }}</p>
                <div v-if="loginBottomContent" class="about-footer" v-html="loginBottomContent"></div>
            </div>
        </el-dialog>
        
        <!-- 语言选择弹窗 -->
        <el-drawer
            v-model="showLangSelect"
            direction="btt"
            size="auto"
            title="选择语言"
            class="lang-drawer"
        >
            <div class="lang-list">
                <div 
                    class="lang-item"
                    :class="{ active: language === 'zh-CN' }"
                    @click="handleSetLanguage('zh-CN')"
                >
                    <span class="lang-name">中文</span>
                    <el-icon v-if="language === 'zh-CN'" class="check-icon"><Check /></el-icon>
                </div>
                <div 
                    class="lang-item"
                    :class="{ active: language === 'en' }"
                    @click="handleSetLanguage('en')"
                >
                    <span class="lang-name">English</span>
                    <el-icon v-if="language === 'en'" class="check-icon"><Check /></el-icon>
                </div>
            </div>
        </el-drawer>
    </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDiyStore, useUserStore, useTagsViewStore, useAppStore } from '@/pinia';
import { 
    Brush, Lock, InfoFilled, SwitchButton, ArrowRight, Check 
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { removeToken } from '@/utils/auth';
import LocalStorageManager from '@/utils/localStorage-manager';
import { useI18n } from 'vue-i18n';

// 定义组件名称，用于 keep-alive 缓存
defineOptions({
    name: 'mobile_profile'
});
import { version as appVersion } from '../../../package.json';

const router = useRouter();
const diyStore = useDiyStore();
const userStore = useUserStore();
const tagsViewStore = useTagsViewStore();
const appStore = useAppStore();
const { locale } = useI18n();

// 加载状态
const loading = ref(true);

// 初始化
onMounted(() => {
    // 用户数据通常已经在登录时加载，短暂延迟后显示内容
    setTimeout(() => {
        loading.value = false;
    }, 300);
});

// 当前用户
const currentUser = computed(() => diyStore.GetCurrentUser);
const userAvatar = computed(() => {
    const avatar = currentUser.value?.Avatar;
    if (avatar) {
        return avatar.startsWith('http') ? avatar : window.DiyCommon.GetServerPath(avatar);
    }
    return './static/img/nohead-girl.png';
});

// 版本号 - 从 package.json 获取
const version = computed(() => {
    return `v${appVersion}`;
});

// 系统信息
const systemName = computed(() => diyStore.SysConfig?.SysTitle || diyStore.WebTitle || 'Microi 吾码');
const companyName = computed(() => diyStore.SysConfig?.CompanyName || '');
const systemLogo = computed(() => {
    const logo = window.DiyCommon.GetServerPath(diyStore.SysConfig?.SysLogo || './static/img/logo/microi-logo.svg');
    return logo.startsWith('http') ? logo : window.DiyCommon.GetServerPath(logo);
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

// 当前主题
const currentTheme = computed(() => diyStore.themeColor || '#409eff');

// 当前语言
const language = computed(() => appStore.language || 'zh-CN');
const currentLang = computed(() => {
    const langMap = {
        'zh-CN': '中文',
        'en': 'English'
    };
    return langMap[language.value] || '中文';
});

// 主题颜色列表
const themeColors = [
    { name: '蓝色', value: '#409eff' },
    { name: '橙色', value: '#E67E22' },
    { name: '红色', value: '#E74C3C' },
    { name: '绿色', value: '#27AE60' },
    { name: '紫色', value: '#9B59B6' },
    { name: '粉色', value: '#E91E63' },
    { name: '青色', value: '#00BCD4' },
    { name: '靛蓝', value: '#3F51B5' },
    { name: '深橙', value: '#FF5722' },
    { name: '棕色', value: '#795548' },
    { name: '灰蓝', value: '#607D8B' },
    { name: '黑色', value: '#424242' },
];

// 弹窗状态
const showThemePanel = ref(false);
const showPasswordDialog = ref(false);
const showAbout = ref(false);
const showLangSelect = ref(false);

// 密码表单
const passwordFormRef = ref(null);
const passwordLoading = ref(false);
const passwordForm = reactive({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
});

// 密码验证规则
const validateConfirmPassword = (rule, value, callback) => {
    if (value !== passwordForm.newPassword) {
        callback(new Error('两次输入的密码不一致'));
    } else {
        callback();
    }
};

const passwordRules = {
    oldPassword: [
        { required: true, message: '请输入原密码', trigger: 'blur' }
    ],
    newPassword: [
        { required: true, message: '请输入新密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能小于6位', trigger: 'blur' }
    ],
    confirmPassword: [
        { required: true, message: '请再次输入新密码', trigger: 'blur' },
        { validator: validateConfirmPassword, trigger: 'blur' }
    ]
};

// 切换主题
const changeTheme = (color) => {
    // 设置 CSS 变量
    document.documentElement.style.setProperty('--color-primary', color);
    
    // 计算文字颜色
    const brightness = getColorBrightness(color);
    const textColor = brightness > 180 ? '#303133' : '#ffffff';
    document.documentElement.style.setProperty('--color-primary-text', textColor);
    
    // 保存到 store 和 localStorage
    diyStore.themeColor = color;
    localStorage.setItem('Microi.themeColor', color);
    
    showThemePanel.value = false;
    ElMessage.success('主题已切换');
};

// 计算颜色亮度
const getColorBrightness = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
};

// 提交密码修改
const submitPassword = async () => {
    if (!passwordFormRef.value) return;
    
    await passwordFormRef.value.validate((valid) => {
        if (valid) {
            passwordLoading.value = true;
            
            // 模拟API调用
            setTimeout(() => {
                passwordLoading.value = false;
                showPasswordDialog.value = false;
                
                // 重置表单
                passwordForm.oldPassword = '';
                passwordForm.newPassword = '';
                passwordForm.confirmPassword = '';
                
                ElMessage.success('密码修改成功，请重新登录');
                
                // 退出登录
                setTimeout(() => {
                    handleLogout(false);
                }, 1500);
            }, 1000);
        }
    });
};

// 切换语言
const handleSetLanguage = (lang) => {
    locale.value = lang;
    localStorage.setItem('language', lang);
    if (window.DiyCommon?.ChangeLang) {
        window.DiyCommon.ChangeLang(lang);
    }
    showLangSelect.value = false;
    ElMessage.success('语言已切换');
};

// 退出登录
const handleLogout = (showConfirm = true) => {
    const doLogout = async () => {
        try {
            // 调用 userStore 的 logout 方法（与 PC 端保持一致）
            await userStore.logout();
            // 清除本地存储
            removeToken();
            LocalStorageManager.remove('CurrentUser');
            // 清除标签页视图
            tagsViewStore.delAllViews();
            // 跳转到登录页
            router.push('/login');
            ElMessage.success('已退出登录');
        } catch (error) {
            console.error('退出登录失败:', error);
            // 即使出错也要确保清除本地数据并跳转
            removeToken();
            LocalStorageManager.remove('CurrentUser');
            router.push('/login');
        }
    };
    
    if (showConfirm) {
        ElMessageBox.confirm('确定要退出登录吗？', '提示', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }).then(doLogout).catch(() => {});
    } else {
        doLogout();
    }
};
</script>

<style lang="scss" scoped>
.mobile-profile {
    min-height: 100vh;
    background: #f5f7fa;
    // padding-bottom: 70px;
}

.user-card {
    position: relative;
    padding-top: 20px;
    margin-bottom: 12px;
    background: var(--color-primary);
    
    .user-card-bg {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 120px;
        background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, var(--color-primary-dark, #2c7acc) 100%);
    }
    
    .user-info {
        position: relative;
        display: flex;
        align-items: center;
        padding: 20px;
        
        .user-avatar {
            border: 3px solid #fff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .user-detail {
            margin-left: 16px;
            
            .user-name {
                font-size: 20px;
                font-weight: 600;
                color: #fff !important;
                margin: 0 0 6px 0;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            }
            
            .user-account {
                font-size: 13px;
                color: rgba(255, 255, 255, 0.95) !important;
                margin: 0;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }
        }
    }
}

.function-list {
    padding: 0 12px;
    
    .function-group {
        background: #fff;
        border-radius: 12px;
        margin-bottom: 12px;
        overflow: hidden;
        
        .function-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            cursor: pointer;
            transition: background 0.2s;
            
            &:not(:last-child) {
                border-bottom: 1px solid #f5f7fa;
            }
            
            &:active {
                background: #f5f7fa;
            }
            
            .item-left {
                display: flex;
                align-items: center;
                
                .item-icon {
                    font-size: 20px;
                    color: var(--color-primary, #409eff);
                    margin-right: 12px;
                }
                
                .item-title {
                    font-size: 15px;
                    color: #303133;
                }
            }
            
            .item-right {
                display: flex;
                align-items: center;
                
                .item-value {
                    font-size: 14px;
                    color: #909399;
                    margin-right: 8px;
                }
                
                .theme-preview {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                
                .el-icon {
                    font-size: 14px;
                    color: #c0c4cc;
                }
            }
            
            &.logout-item {
                .item-icon {
                    color: #f56c6c;
                }
                .item-title {
                    color: #f56c6c;
                }
            }
        }
    }
}

// 主题选择抽屉
:deep(.theme-drawer) {
    .el-drawer__header {
        margin-bottom: 0;
        padding: 16px;
        border-bottom: 1px solid #ebeef5;
    }
    
    .el-drawer__body {
        padding: 20px;
        padding-bottom: calc(90px + env(safe-area-inset-bottom));
    }
}

.theme-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    
    .theme-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        
        &:active {
            opacity: 0.8;
        }
        
        .theme-color {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            transition: transform 0.2s;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            
            .check-icon {
                font-size: 24px;
                color: #fff;
            }
        }
        
        &.active .theme-color {
            transform: scale(1.1);
        }
        
        .theme-name {
            font-size: 12px;
            color: #606266;
        }
    }
}

// 关于系统弹窗
.about-content {
    text-align: center;
    padding: 20px 0;
    
    .about-logo {
        width: 80px;
        height: 80px;
        margin-bottom: 16px;
        object-fit: contain;
    }
    
    .about-title {
        font-size: 20px;
        font-weight: 600;
        color: #303133;
        margin: 0 0 8px 0;
    }
    
    .about-version {
        font-size: 14px;
        color: #909399;
        margin: 0 0 8px 0;
    }
    
    .about-company {
        font-size: 14px;
        color: #606266;
        margin: 0 0 16px 0;
    }
    
    .about-footer {
        font-size: 13px;
        color: #909399;
        line-height: 1.6;
        padding: 0 10px;
        
        :deep(p) {
            margin: 8px 0;
        }
    }
}

// 语言选择抽屉
:deep(.lang-drawer) {
    .el-drawer__header {
        margin-bottom: 0;
        padding: 16px;
        border-bottom: 1px solid #ebeef5;
    }
    
    .el-drawer__body {
        padding: 0;
        padding-bottom: calc(90px + env(safe-area-inset-bottom));
    }
}

.lang-list {
    .lang-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        cursor: pointer;
        transition: background 0.2s;
        border-bottom: 1px solid #f5f7fa;
        
        &:active {
            background: #f5f7fa;
        }
        
        &.active {
            background: #f0f9ff;
            
            .lang-name {
                color: var(--color-primary, #409eff);
                font-weight: 600;
            }
        }
        
        .lang-name {
            font-size: 15px;
            color: #303133;
        }
        
        .check-icon {
            font-size: 20px;
            color: var(--color-primary, #409eff);
        }
    }
}
</style>
