<template>
    <div>
        <div
            id="divLogin"
            class="mci-login-page"
            :data-login-style="ResolvedLoginStyle"
            :class="{
                'is-wallpaper-transitioning': WallpaperTransitioning,
                'is-theme-transitioning': ThemeTransitioning
            }"
            :data-login-wallpaper="ActiveLoginWallpaperName"
        >
            <div class="login-wallpaper-stage" aria-hidden="true">
                <div
                    v-if="PreviousLoginWallpaperUrl"
                    class="login-wallpaper-layer login-wallpaper-layer--previous"
                    :style="PreviousLoginBackgroundStyle"
                />
                <div
                    class="login-wallpaper-layer login-wallpaper-layer--current"
                    :style="LoginBackgroundStyle"
                />
                <span class="login-wallpaper-vignette" />
            </div>
            <component :is="LoginLayoutComponent" :title="WebTitle" :subtitle="SystemSubTitle">
            <div class="divLoginCenter" :style="{ opacity: '1' }">
                <div class="loginCenterBgCover" />
                <div class="login-brand" :class="{ 'has-subtitle': !!SystemSubTitle }">
                    <div
                        class="login-system-logo"
                        :class="{ 'is-fallback': !SystemLogoUrl || SystemLogoLoadFailed }"
                    >
                        <img
                            v-if="SystemLogoUrl && !SystemLogoLoadFailed"
                            :src="SystemLogoUrl"
                            :alt="(WebTitle || '吾码') + ' Logo'"
                            @error="HandleSystemLogoError"
                        />
                        <span v-else class="login-system-logo-fallback" aria-hidden="true">
                            {{ SystemLogoFallbackText }}
                        </span>
                        <span class="login-system-logo-ring" aria-hidden="true" />
                    </div>
                    <div class="login-title">
                        <div>
                            {{ WebTitle }}
                        </div>
                        <span v-if="SystemSubTitle">{{ SystemSubTitle }}</span>
                    </div>
                </div>

                <!-- 账号输入框 -->
                <div class="login-input-param">
                    <el-input 
                        v-model="Account" 
                        type="text" 
                        size="large"
                        :placeholder="$t('Msg.InputAccount')"
                        autocomplete="username"
                        @input="HandleAccountInput"
                    >
                        <template #prefix>
                            <div
                                class="input-icon-wrapper account-avatar-wrapper"
                                :class="{ 'has-avatar': CurrentAccountAvatarUrl }"
                            >
                                <img
                                    v-if="CurrentAccountAvatarUrl"
                                    :src="CurrentAccountAvatarUrl"
                                    class="account-avatar-img"
                                    alt=""
                                    @error="HandleCurrentAccountAvatarError"
                                />
                                <el-icon v-else><User /></el-icon>
                            </div>
                        </template>
                        <template #suffix>
                            <el-popover
                                v-model:visible="AccountHistoryVisible"
                                placement="bottom-end"
                                trigger="click"
                                :width="340"
                                :teleported="true"
                                popper-class="login-account-history-popper"
                            >
                                <template #reference>
                                    <button
                                        type="button"
                                        class="input-suffix-action account-history-trigger"
                                        :class="{ 'is-open': AccountHistoryVisible }"
                                        :aria-expanded="AccountHistoryVisible ? 'true' : 'false'"
                                        aria-label="选择历史登录帐号"
                                        title="选择历史登录帐号"
                                        @mousedown.prevent
                                    >
                                        <el-icon><ArrowDown /></el-icon>
                                    </button>
                                </template>
                                <div class="account-history-panel">
                                    <div class="account-history-header">
                                        <div>
                                            <strong>历史登录帐号</strong>
                                            <span>选择后自动回填帐号和密码</span>
                                        </div>
                                        <button
                                            v-if="RememberedAccounts.length > 0"
                                            type="button"
                                            class="account-history-clear"
                                            @click="ClearRememberedAccounts"
                                        >
                                            清空
                                        </button>
                                    </div>
                                    <div v-if="RememberedAccounts.length > 0" class="account-history-list">
                                        <div
                                            v-for="item in RememberedAccounts"
                                            :key="item.Account"
                                            class="account-history-item"
                                            :class="{ 'is-current': IsCurrentRememberedAccount(item) }"
                                        >
                                            <button
                                                type="button"
                                                class="account-history-main"
                                                @click="SelectRememberedAccount(item)"
                                            >
                                                <span class="account-history-avatar">
                                                    <img
                                                        v-if="GetRememberedAvatarSource(item)"
                                                        :src="GetRememberedAvatarSource(item)"
                                                        alt=""
                                                        @error="HandleRememberedAvatarError(item)"
                                                    />
                                                    <el-icon v-else><User /></el-icon>
                                                </span>
                                                <span class="account-history-copy">
                                                    <strong>{{ item.Account }}</strong>
                                                    <span>{{ item.DisplayName || '已记住密码' }}</span>
                                                </span>
                                                <el-icon v-if="IsCurrentRememberedAccount(item)" class="account-history-check"><Check /></el-icon>
                                            </button>
                                            <button
                                                type="button"
                                                class="account-history-delete"
                                                :aria-label="'删除帐号 ' + item.Account"
                                                :title="'删除帐号 ' + item.Account"
                                                @click.stop="RemoveRememberedAccount(item)"
                                            >
                                                <el-icon><Delete /></el-icon>
                                            </button>
                                        </div>
                                    </div>
                                    <div v-else class="account-history-empty">
                                        <span class="account-history-avatar">
                                            <el-icon><User /></el-icon>
                                        </span>
                                        <div>
                                            <strong>暂无历史帐号</strong>
                                            <span>勾选“记住密码”并登录成功后会显示在这里</span>
                                        </div>
                                    </div>
                                </div>
                            </el-popover>
                        </template>
                    </el-input>
                </div>

                <!-- 密码输入框 -->
                <div class="login-input-param pwd">
                    <el-input 
                        v-model="Pwd" 
                        :type="showPassword ? 'text' : 'password'" 
                        size="large"
                        :placeholder="$t('Msg.InputPwd')" 
                        autocomplete="current-password"
                        @keyup.enter="Login"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper">
                                <el-icon><Key /></el-icon>
                            </div>
                        </template>
                        <template #suffix>
                            <button
                                type="button"
                                class="input-suffix-action"
                                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                                :title="showPassword ? '隐藏密码' : '显示密码'"
                                @mousedown.prevent
                                @click="showPassword = !showPassword"
                            >
                                <el-icon
                                    class="password-visibility-icon"
                                >
                                    <View v-if="showPassword" />
                                    <Hide v-else />
                                </el-icon>
                            </button>
                        </template>
                    </el-input>
                </div>

                <!-- 验证码输入框 -->
                <div v-if="EnableCaptcha" class="login-input-param captcha">
                    <el-input 
                        v-model="CaptchaValue" 
                        type="text" 
                        size="large"
                        placeholder="请输入验证码计算结果（0 ~ 9）" 
                        @keyup.enter="Login"
                        maxlength="6"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper">
                                <el-icon><Lock /></el-icon>
                            </div>
                        </template>
                        <template #append v-if="EnableCaptcha">
                            <div class="captcha-wrapper">
                                <img 
                                    id="CaptchaImg" 
                                    src="" 
                                    class="captcha-img" 
                                    @click="GetCaptcha()" 
                                    title="点击刷新验证码"
                                />
                            </div>
                        </template>
                    </el-input>
                </div>

                <div class="login-preferences-row">
                    <el-checkbox
                        v-model="RememberPassword"
                        class="remember-password-checkbox"
                        :class="{ 'is-remembered': RememberPassword }"
                    >
                        <span class="remember-password-label">记住密码</span>
                    </el-checkbox>
                    <div class="login-appearance-actions" aria-label="登录页外观设置">
                        <ThemeSelect :show-mode="false">
                            <template #trigger>
                                <button
                                    type="button"
                                    class="login-appearance-button login-theme-trigger"
                                    aria-label="更改主题色"
                                    title="更改主题色"
                                >
                                    <el-icon><Brush /></el-icon>
                                    <span>主题色</span>
                                </button>
                            </template>
                        </ThemeSelect>
                        <button
                            type="button"
                            class="login-appearance-button login-wallpaper-trigger"
                            :class="{ 'is-loading': WallpaperLoading || !!PreviousLoginWallpaperUrl }"
                            :disabled="WallpaperLoading || !!PreviousLoginWallpaperUrl"
                            aria-label="随机更换登录壁纸"
                            title="随机更换登录壁纸"
                            @click="ChangeLoginWallpaper"
                        >
                            <el-icon><RefreshRight /></el-icon>
                            <span>换壁纸</span>
                        </button>
                    </div>
                </div>

                <!-- 登录按钮与紧凑免密入口 -->
                <div v-if="PageType != 'BindWeChat'" class="login-button-wrapper">
                    <button
                        type="button"
                        :disabled="LoginWaiting"
                        :aria-busy="LoginWaiting ? 'true' : 'false'"
                        @click="Login"
                        class="login-button"
                        :class="{ 'is-charging': LoginWaiting }"
                    >
                        <span class="login-button-energy" aria-hidden="true">
                            <span class="login-button-energy-beam" />
                        </span>
                        <span class="login-button-content">
                            <el-icon v-if="LoginWaiting" class="is-loading"><Loading /></el-icon>
                            <el-icon v-else><Unlock /></el-icon>
                            <span>{{ LoginButtonText }}</span>
                        </span>
                    </button>
                    <div class="identity-login-entry">
                        <button
                            type="button"
                            class="identity-login-button"
                            :disabled="!!IdentityLoginWaiting || LoginWaiting"
                            :aria-busy="IdentityLoginWaiting ? 'true' : 'false'"
                            aria-haspopup="dialog"
                            :aria-expanded="LoginMethodsVisible ? 'true' : 'false'"
                            @click.stop="OpenLoginMethods"
                        >
                            <span class="identity-login-button__icon" aria-hidden="true">
                                <el-icon v-if="IdentityLoginWaiting" class="is-loading"><Loading /></el-icon>
                                <el-icon v-else><Key /></el-icon>
                            </span>
                            <span class="identity-login-button__copy">
                                <strong>{{ IdentityLoginWaiting ? '验证中' : '登录方式' }}</strong>
                                <small>{{ IdentityLoginWaiting ? '请完成验证' : '免密 · 扫码' }}</small>
                            </span>
                            <span class="identity-login-button__arrow" aria-hidden="true">↗</span>
                        </button>
                    </div>
                </div>

                <Teleport to="body">
                    <transition name="login-methods-modal">
                        <div
                            v-if="LoginMethodsVisible"
                            class="login-methods-overlay"
                            role="presentation"
                            @click.self="CloseLoginMethods"
                        >
                            <section
                                ref="loginMethodsDialog"
                                class="login-methods-panel"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="login-methods-title"
                                aria-describedby="login-methods-description"
                                tabindex="-1"
                            >
                                <div class="login-methods-aurora" aria-hidden="true"><i /><i /><i /></div>
                                <header class="login-methods-heading">
                                    <span class="login-methods-orbit" aria-hidden="true"><i /><i /><i /></span>
                                    <div>
                                        <span class="login-methods-kicker">SECURE ACCESS</span>
                                        <strong id="login-methods-title">选择登录方式</strong>
                                        <p id="login-methods-description">选择适合当前设备的验证方式，成功后安全进入当前系统</p>
                                    </div>
                                    <button type="button" class="login-methods-close" aria-label="关闭登录方式" @click="CloseLoginMethods">×</button>
                                </header>
                                <div v-if="DefaultLoginMethodsHidden" class="login-methods-empty" role="status">
                                    <span class="login-methods-empty__icon" aria-hidden="true">!</span>
                                    <span>
                                        <strong>常用登录方式暂未开放</strong>
                                        <small v-if="LoginMethodItems.length">常用登录方式均已隐藏，下方仍可使用系统已启用的其他验证方式。</small>
                                        <small v-else>请使用账号密码登录，或联系系统管理员开启至少一种登录方式。</small>
                                    </span>
                                </div>
                                <div v-if="LoginMethodItems.length" class="login-method-bubbles" role="list">
                                    <button
                                        v-for="(method, methodIndex) in LoginMethodItems"
                                        :key="method.key"
                                        type="button"
                                        role="listitem"
                                        class="login-method-bubble"
                                        :class="[`is-${method.tone}`, { 'is-unavailable': !method.available }]"
                                        :style="{ '--bubble-index': methodIndex }"
                                        :disabled="!!IdentityLoginWaiting || LoginWaiting || !method.available"
                                        :aria-label="`${method.name}：${method.description}`"
                                        @click.stop="StartLoginMethod(method)"
                                    >
                                        <span class="login-method-bubble-icon" aria-hidden="true">{{ method.glyph }}</span>
                                        <span class="login-method-bubble-copy">
                                            <strong>{{ method.name }}</strong>
                                            <small>{{ method.description }}</small>
                                        </span>
                                        <span class="login-method-bubble-status">{{ method.status }}</span>
                                        <span class="login-method-bubble-go" aria-hidden="true">→</span>
                                    </button>
                                </div>
                                <footer class="login-methods-footnote">
                                    <span><el-icon><Lock /></el-icon> 敏感密钥只在可信后端处理</span>
                                    <span>登录成功后仍遵循当前租户的角色、菜单和数据权限</span>
                                </footer>
                            </section>
                        </div>
                    </transition>
                </Teleport>

                <!-- 隐私协议 -->
                <div v-if="SysConfig.EnablePrivacyPolicy" class="privacy-policy-wrapper">
                    <el-checkbox v-model="CheckPrivacyPolicy" class="privacy-checkbox">
                        <span class="privacy-text" @click.stop="ShowPrivacyPolicy = true">
                            {{ SysConfig.PrivacyPolicyName || "同意隐私协议" }}
                        </span>
                    </el-checkbox>
                </div>

                <!-- 底部提示 -->
                <div class="bottomTips">
                    <p v-if="SysConfig.EnableReg" class="register-link">
                        <a href="javascript:;" @click="OpenReg">
                            <el-icon><UserFilled /></el-icon>
                            <span>立即注册</span>
                        </a>
                    </p>
                    <p v-if="PageType == 'BindWeChat'">
                        <el-button type="primary" size="small" @click="BindWeChat()">
                            <el-icon><Right /></el-icon>
                            <span>立即绑定</span>
                        </el-button>
                    </p>
                    <div class="bottom-content" v-safe-html="LoginBottomContent"></div>
                </div>
            </div>
            </component>
            <div class="divLoginTime">
                <div style="position: absolute; bottom: 0; left: 0">
                    <p>{{ CurrentTime.Format("HH:mm:ss") }}</p>
                    <p>
                        {{ DiyCommon.Months[CurrentTime.getMonth()] + DiyCommon.GetLanDate(CurrentTime.getDate()) + ", " + DiyCommon.Weeks[CurrentTime.getDay()] }}
                    </p>
                </div>
            </div>

            <el-dialog width="800px" 
                :append-to-body="true" 
                v-model="ShowPrivacyPolicy" 
                :title="SysConfig.PrivacyPolicyName || '同意隐私协议'" 
                :close-on-click-modal="false"
                draggable
                align-center>
                <div v-safe-html="SysConfig.PrivacyPolicy" style="width: 100%; text-align: left"></div>
            </el-dialog>

            <el-dialog
                v-model="ShowTotpLogin"
                width="470px"
                :append-to-body="true"
                title="Authenticator 免密码登录"
                :close-on-click-modal="false"
                :show-close="false"
                align-center
                class="totp-login-shell"
                modal-class="totp-login-modal"
            >
                <template #header>
                    <div class="totp-login-header">
                        <div class="totp-security-orb" aria-hidden="true">
                            <span>6</span>
                            <i />
                        </div>
                        <div class="totp-login-heading">
                            <span>无密码安全验证</span>
                            <h2>Authenticator 登录</h2>
                            <p>输入当前动态口令，即可安全进入系统</p>
                        </div>
                        <button
                            type="button"
                            class="totp-login-close"
                            aria-label="关闭 Authenticator 登录"
                            title="关闭"
                            @click="ShowTotpLogin = false"
                        >
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                </template>
                <div class="totp-login-dialog">
                    <div class="totp-login-aurora" aria-hidden="true">
                        <i /><i /><i />
                    </div>
                    <div class="totp-field">
                        <label for="totp-login-account">登录账号</label>
                        <el-input
                            id="totp-login-account"
                            ref="totpAccountInput"
                            v-model="TotpLoginAccount"
                            size="large"
                            autocomplete="username"
                            placeholder="请输入已绑定验证器的账号"
                            clearable
                        >
                            <template #prefix><el-icon><User /></el-icon></template>
                        </el-input>
                    </div>
                    <div class="totp-field totp-code-field">
                        <div class="totp-field-label">
                            <label for="totp-login-code">一次性动态口令</label>
                            <span>每 30 秒更新</span>
                        </div>
                        <el-input
                            id="totp-login-code"
                            ref="totpCodeInput"
                            v-model="TotpLoginCode"
                            size="large"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="6"
                            placeholder="000 000"
                            clearable
                            @input="NormalizeTotpLoginCode"
                            @keyup.enter="LoginWithTotp"
                        >
                            <template #prefix><el-icon><Lock /></el-icon></template>
                        </el-input>
                    </div>
                    <div class="totp-security-notes" aria-label="安全说明">
                        <span><el-icon><Check /></el-icon>免输密码</span>
                        <span><el-icon><Check /></el-icon>动态口令</span>
                        <span><el-icon><Check /></el-icon>验证码不留存</span>
                    </div>
                    <div class="totp-login-actions">
                        <button type="button" class="totp-cancel-button" @click="ShowTotpLogin = false">取消</button>
                        <button
                            type="button"
                            class="totp-submit-button"
                            :disabled="IdentityLoginWaiting === 'Totp'"
                            :aria-busy="IdentityLoginWaiting === 'Totp' ? 'true' : 'false'"
                            @click="LoginWithTotp"
                        >
                            <span class="totp-submit-shine" aria-hidden="true" />
                            <el-icon v-if="IdentityLoginWaiting === 'Totp'" class="is-loading"><Loading /></el-icon>
                            <el-icon v-else><Unlock /></el-icon>
                            <span>{{ IdentityLoginWaiting === 'Totp' ? '正在验证...' : '安全登录' }}</span>
                        </button>
                    </div>
                </div>
            </el-dialog>

            <!-- 用户注册对话框 -->
            <el-dialog 
                width="500px" 
                :append-to-body="true" 
                v-model="ShowRegSysUser" 
                title="用户注册" 
                :close-on-click-modal="false" 
                draggable
                align-center
                class="register-dialog"
            >
                <el-form ref="form" :model="RegModel" label-width="100px" class="register-form">
                    <el-form-item label="手机号" prop="Phone">
                        <el-input 
                            v-model="RegModel.Phone" 
                            placeholder="请输入手机号"
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="密码" prop="Pwd">
                        <el-input 
                            v-model="RegModel.Pwd" 
                            type="password"
                            placeholder="请输入密码"
                            show-password
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="重复密码" prop="Pwd2">
                        <el-input 
                            v-model="RegModel.Pwd2" 
                            type="password"
                            placeholder="请再次输入密码"
                            show-password
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="图形验证码">
                        <el-input 
                            v-model="RegCaptchaValue" 
                            placeholder="请输入图形验证码"
                            clearable
                        >
                            <template #append>
                                <img 
                                    id="CaptchaImgReg" 
                                    class="reg-captcha-img" 
                                    src="" 
                                    @click="GetCaptcha(null, '#CaptchaImgReg', 'RegCaptchaId')" 
                                    title="点击刷新验证码"
                                />
                            </template>
                        </el-input>
                    </el-form-item>
                    <el-form-item label="短信验证码">
                        <el-input 
                            v-model="RegModel.SmsCaptchaValue" 
                            placeholder="请输入短信验证码"
                            clearable
                        >
                            <template #append>
                                <el-button 
                                    type="primary" 
                                    link 
                                    @click="SendSms"
                                    class="sms-button"
                                >
                                    获取验证码
                                </el-button>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="ShowRegSysUser = false">取消</el-button>
                        <el-button type="primary" @click="Reg()">提交</el-button>
                    </div>
                </template>
            </el-dialog>
        </div>
    </div>
</template>

<script>
import { ArrowDown, Brush, Check, Delete, User, Key, Lock, UserFilled, Loading, RefreshRight, Right, Unlock, View, Hide } from "@element-plus/icons-vue";
import ThemeSelect from "@/layout/components/ThemeSelect.vue";
import loginBusinessMixin, { setupLoginState } from "./login-business.mixin.js";
import OriginalLoginLayout from "./layouts/OriginalLoginLayout.vue";
import MinimalLoginLayout from "./layouts/MinimalLoginLayout.vue";
import SplitLoginLayout from "./layouts/SplitLoginLayout.vue";
import ConsoleLoginLayout from "./layouts/ConsoleLoginLayout.vue";
import { resolveLoginStyle } from "./login-style.js";

const loginLayouts = { Original: OriginalLoginLayout, Minimal: MinimalLoginLayout, Split: SplitLoginLayout, Console: ConsoleLoginLayout };

export default {
    name: "Login",
    components: { ArrowDown, Brush, Check, Delete, User, Key, Lock, UserFilled, Loading, RefreshRight, Right, Unlock, View, Hide, ThemeSelect },
    mixins: [loginBusinessMixin],
    // Vue 不合并 mixin.setup；显式调用同一业务入口，保留 Pinia、路由及响应式引用。
    setup: setupLoginState,
    computed: {
        ResolvedLoginStyle() {
            return resolveLoginStyle(this.diyStore.loginStyle, this.SysConfig?.LoginStyle);
        },
        LoginLayoutComponent() {
            return loginLayouts[this.ResolvedLoginStyle];
        }
    }
};
</script>

<style lang="scss" scoped>
/* 加载旋转动画 */
.is-loading {
    animation: rotating 2s linear infinite;
}

@keyframes rotating {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

/* ==================== 品牌标题与系统 Logo ==================== */
.login-brand {
    --mci-login-brand-height: 40px;
    --mci-login-brand-subtitle-line-height: 20px;
    --mci-login-brand-subtitle-gap: 2px;
    position: relative;
    z-index: 1;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: left;

    &.has-subtitle {
        --mci-login-brand-height: 58px;
    }

    .login-title {
        width: auto;
        height: var(--mci-login-brand-height);
        min-width: 0;
        max-width: calc(100% - var(--mci-login-brand-height) - 14px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;

        > div {
            overflow: hidden;
            line-height: var(--mci-login-brand-height);
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        > span {
            overflow: hidden;
            line-height: var(--mci-login-brand-subtitle-line-height);
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    &.has-subtitle .login-title > div {
        line-height: calc(
            var(--mci-login-brand-height) - var(--mci-login-brand-subtitle-line-height) - var(--mci-login-brand-subtitle-gap)
        );
    }
}

.login-system-logo {
    width: var(--mci-login-brand-height);
    height: var(--mci-login-brand-height);
    padding: 3px;
    box-sizing: border-box;
    position: relative;
    flex: 0 0 var(--mci-login-brand-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    background: var(--mci-login-logo-bg);
    box-shadow: var(--mci-login-logo-shadow);

    img {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: 50%;
        object-fit: contain;
    }

    &.is-fallback {
        background: var(--mci-login-button-gradient);
    }
}

.login-system-logo-fallback {
    color: var(--mci-login-on-primary);
    font-size: clamp(16px, 2vw, 21px);
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
}

.login-system-logo-ring {
    position: absolute;
    inset: -4px;
    z-index: -1;
    border: 0;
    border-radius: 50%;
    background: var(--mci-login-logo-halo);
    filter: blur(3px);
    opacity: 0.5;
    pointer-events: none;
    transform: scale(0.94);
    animation: mciLoginLogoPulse 5.2s ease-in-out infinite;
}

/* ==================== 登录输入框样式 ==================== */
.login-input-param {
    margin-bottom: 20px;

    :deep(.el-input-group__append) {
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none !important;
    }

    :deep(.el-input) {
        .el-input__wrapper {
            min-height: 48px;
            box-sizing: border-box;
            border: 0;
            border-radius: var(--mci-login-control-radius);
            background: var(--mci-login-input-bg);
            box-shadow: inset 0 0 0 1px transparent, var(--mci-login-input-shadow) !important;
            padding: 0;
            overflow: hidden;
            transition: box-shadow 180ms ease, background 180ms ease;

            &:hover {
                background: var(--mci-login-input-bg-hover);
                box-shadow: inset 0 0 0 1px var(--mci-login-input-border-hover), var(--mci-login-input-shadow) !important;
            }

            &.is-focus {
                background: var(--mci-login-input-bg-hover);
                box-shadow: inset 0 0 0 1px var(--mci-login-input-border-focus), var(--mci-login-input-focus-shadow) !important;
            }
        }

        .el-input__prefix {
            margin-right: 0;
            overflow: hidden;
            border-radius: var(--mci-login-control-radius) 0 0 var(--mci-login-control-radius);
        }

        .el-input__suffix {
            margin-left: 0;
        }
        
        .el-input__inner {
            padding-left: 8px;
            height: 46px;
            color: var(--mci-login-input-text) !important;
            caret-color: var(--mci-login-primary);
            -webkit-text-fill-color: var(--mci-login-input-text) !important;

            &::placeholder {
                color: var(--mci-login-input-placeholder) !important;
                -webkit-text-fill-color: var(--mci-login-input-placeholder) !important;
                opacity: 1;
            }

            &:-webkit-autofill,
            &:-webkit-autofill:hover,
            &:-webkit-autofill:focus {
                -webkit-text-fill-color: var(--mci-login-input-text) !important;
                caret-color: var(--mci-login-input-text);
            }
        }
    }
}

.login-input-param.captcha {
    :deep(.el-input) {
        border: 0;
        border-radius: var(--mci-login-control-radius);
        background: var(--mci-login-input-bg);
        box-shadow: inset 0 0 0 1px transparent, var(--mci-login-input-shadow);
        overflow: hidden;
        transition: box-shadow 180ms ease, background 180ms ease;

        &:hover {
            background: var(--mci-login-input-bg-hover);
            box-shadow: inset 0 0 0 1px var(--mci-login-input-border-hover), var(--mci-login-input-shadow);
        }

        &:focus-within {
            background: var(--mci-login-input-bg-hover);
            box-shadow: inset 0 0 0 1px var(--mci-login-input-border-focus), var(--mci-login-input-focus-shadow);
        }
    }

    :deep(.el-input .el-input__wrapper) {
        min-height: 46px;
        border: 0;
        border-radius: var(--mci-login-control-radius) 0 0 var(--mci-login-control-radius);
        background: transparent;
        box-shadow: none !important;
    }
}

.account-avatar-wrapper.has-avatar {
    background: rgba(255, 255, 255, 0.96);
    box-shadow: none;
}

.account-avatar-img {
    width: 30px;
    height: 30px;
    display: block;
    border-radius: 50%;
    object-fit: cover;
    background: var(--el-fill-color-light, #f5f7fa);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.input-suffix-action {
    width: 44px;
    height: 46px;
    padding: 0;
    border: 0;
    outline: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-secondary, #909399);
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    transition: color 180ms ease, background-color 180ms ease, transform 180ms ease;

    &:hover,
    &:focus-visible {
        color: var(--el-color-primary);
        background: var(--el-fill-color-light, #f5f7fa);
    }

    &:active {
        transform: scale(0.94);
    }

    .el-icon {
        font-size: 18px;
    }
}

.account-history-trigger .el-icon {
    transition: transform 180ms ease;
}

.account-history-trigger.is-open .el-icon {
    transform: rotate(180deg);
}

.login-preferences-row {
    min-height: 44px;
    margin: -4px 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    text-align: left;
}

.login-appearance-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-left: auto;
}

.login-appearance-button {
    height: 44px;
    min-width: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--mci-login-control-radius);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--mci-login-text-strong);
    background: var(--mci-login-control-bg);
    box-shadow: var(--mci-login-control-shadow);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: transform 180ms ease, background-color 180ms ease, opacity 180ms ease;

    &:hover,
    &:focus-visible {
        background: var(--mci-login-control-bg-hover);
        transform: translateY(-1px);
    }

    &:focus-visible {
        outline: 2px solid var(--mci-login-electric);
        outline-offset: 2px;
    }

    &:active {
        transform: scale(0.97);
    }

    &:disabled {
        cursor: wait;
        opacity: 0.72;
    }

    .el-icon {
        font-size: 16px;
    }

    &.is-loading .el-icon {
        animation: rotating 1.4s linear infinite;
    }
}

.remember-password-checkbox {
    height: 44px !important;
    min-height: 44px !important;
    padding: 0 14px 0 10px;
    box-sizing: border-box;
    border: 0;
    border-radius: var(--mci-login-control-radius);
    flex: 0 0 auto;
    background: var(--mci-login-control-bg);
    box-shadow: var(--mci-login-control-shadow);
    transition: transform 180ms ease, background-color 180ms ease;

    &:hover {
        background: var(--mci-login-control-bg-hover);
        transform: translateY(-1px);
    }

    &:active {
        transform: scale(0.98);
    }

    &.is-remembered {
        background: var(--mci-login-control-active-bg);
    }

    :deep(.el-checkbox__input) {
        display: inline-flex;
        align-items: center;
    }

    :deep(.el-checkbox__label) {
        padding-left: 9px;
        color: var(--mci-login-text-strong);
    }

    :deep(.el-checkbox__inner) {
        width: 18px;
        height: 18px;
        border: 1px solid var(--mci-login-checkbox-border);
        border-radius: 5px;
        background: var(--mci-login-checkbox-bg);
        transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
    }

    :deep(.el-checkbox__inner::after) {
        width: 4px;
        height: 8px;
        left: 8px;
        top: 8px;
        border-width: 0 2px 2px 0;
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
        border-color: transparent;
        background: var(--mci-login-button-gradient);
        box-shadow: none;
        transform: scale(1.02);
    }

    :deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
        outline: none;
    }

    :deep(.el-checkbox__original:focus-visible + .el-checkbox__inner) {
        outline: 2px solid var(--mci-login-electric);
        outline-offset: 2px;
    }
}

.remember-password-label {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.35px;
}

:global(.login-account-history-popper.el-popper) {
    max-width: calc(100vw - 24px);
    padding: 0 !important;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--el-border-color-light, #e4e7ed) !important;
    border-radius: 14px !important;
    background: var(--el-bg-color-overlay, #fff) !important;
    box-shadow: 0 16px 42px rgba(31, 41, 55, 0.2), 0 3px 10px rgba(31, 41, 55, 0.08) !important;
}

:global(.login-account-history-popper .account-history-panel) {
    color: var(--el-text-color-primary, #303133);
}

:global(.login-account-history-popper .account-history-header) {
    min-height: 64px;
    padding: 13px 14px 11px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: linear-gradient(135deg, var(--el-color-primary-light-9, #ecf5ff), var(--el-bg-color-overlay, #fff));
}

:global(.login-account-history-popper .account-history-header > div) {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

:global(.login-account-history-popper .account-history-header strong) {
    font-size: 14px;
    line-height: 1.35;
}

:global(.login-account-history-popper .account-history-header span) {
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.35;
}

:global(.login-account-history-popper .account-history-clear) {
    min-width: 44px;
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    color: var(--el-color-danger, #f56c6c);
    background: transparent;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-clear:hover),
:global(.login-account-history-popper .account-history-clear:focus-visible) {
    background: var(--el-color-danger-light-9, #fef0f0);
    outline: none;
}

:global(.login-account-history-popper .account-history-list) {
    max-height: 304px;
    padding: 8px;
    overflow: auto;
}

:global(.login-account-history-popper .account-history-item) {
    min-height: 58px;
    display: flex;
    align-items: stretch;
    border-radius: 10px;
    transition: background-color 180ms ease;
}

:global(.login-account-history-popper .account-history-item:hover),
:global(.login-account-history-popper .account-history-item.is-current) {
    background: var(--el-color-primary-light-9, #ecf5ff);
}

:global(.login-account-history-popper .account-history-main) {
    min-width: 0;
    min-height: 58px;
    padding: 8px 6px 8px 8px;
    border: 0;
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-main:focus-visible) {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
    border-radius: 10px;
}

:global(.login-account-history-popper .account-history-avatar) {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 50%;
    color: var(--mci-text-on-primary, #fff);
    background: var(--el-color-primary);
    box-shadow: 0 3px 10px rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.22);
}

:global(.login-account-history-popper .account-history-avatar img) {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

:global(.login-account-history-popper .account-history-copy) {
    min-width: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
}

:global(.login-account-history-popper .account-history-copy strong) {
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:global(.login-account-history-popper .account-history-copy span) {
    overflow: hidden;
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:global(.login-account-history-popper .account-history-check) {
    flex: 0 0 auto;
    color: var(--el-color-primary);
    font-size: 16px;
}

:global(.login-account-history-popper .account-history-delete) {
    width: 40px;
    min-height: 44px;
    padding: 0;
    border: 0;
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-placeholder, #a8abb2);
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-delete:hover),
:global(.login-account-history-popper .account-history-delete:focus-visible) {
    color: var(--el-color-danger, #f56c6c);
    background: var(--el-color-danger-light-9, #fef0f0);
    outline: none;
}

:global(.login-account-history-popper .account-history-empty) {
    min-height: 112px;
    padding: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

:global(.login-account-history-popper .account-history-empty > div) {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

:global(.login-account-history-popper .account-history-empty strong) {
    font-size: 13px;
}

:global(.login-account-history-popper .account-history-empty span:not(.account-history-avatar)) {
    max-width: 220px;
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.5;
}

/* 图标容器样式 */
.input-icon-wrapper {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0px;
    margin-right: 10px;
    border-radius: var(--mci-login-control-radius) 0 0 var(--mci-login-control-radius);
    color: var(--mci-login-on-primary);
    background: var(--mci-login-button-gradient);
    transition: opacity 180ms ease;
    
    .el-icon {
        font-size: 20px;
    }
}

/* 验证码样式 */
.captcha-wrapper {
    padding: 0;
    background: transparent;
    
    .captcha-img {
        height: 46px;
        width: 120px;
        cursor: pointer;
        display: block;
        border-radius: 0 var(--mci-login-control-radius) var(--mci-login-control-radius) 0;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
}

/* ==================== 登录按钮样式 ==================== */
.login-button-wrapper {
    margin-top: 18px;
    margin-bottom: 20px;
    display: flex;
    align-items: stretch;
    gap: 10px;
}

.login-button {
    width: auto;
    flex: 1 1 auto;
    min-height: 54px;
    padding: 0 24px;
    border: 0;
    border-radius: var(--mci-login-control-radius);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--mci-login-on-primary);
    background: var(--mci-login-button-gradient);
    background-size: 180% 100%;
    box-shadow: var(--mci-login-button-shadow);
    font-family: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 1.6px;
    cursor: pointer;
    isolation: isolate;
    animation: mciLoginButtonAura 6s ease-in-out infinite;
    transition: transform 180ms ease, opacity 180ms ease;

    &::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: inherit;
        background: var(--mci-login-button-depth);
        opacity: 0.7;
        pointer-events: none;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        transform: translateY(-2px);
    }

    &:focus-visible {
        outline: 3px solid var(--mci-login-focus-ring);
        outline-offset: 3px;
    }

    &:active:not(:disabled) {
        transform: scale(0.985);
    }

    &:disabled {
        cursor: wait;
        opacity: 0.9;
    }

    &.is-charging .login-button-energy-beam,
    &.is-charging .login-button-energy::after {
        animation-duration: 880ms;
    }
}

.login-button-content {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-shadow: 0 1px 8px var(--mci-login-text-shadow);

    .el-icon {
        font-size: 19px;
    }
}

.identity-login-button {
    flex: 0 0 132px;
    width: 132px;
    min-height: 54px;
    position: relative;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 12px;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.46);
    border-radius: var(--mci-login-control-radius);
    color: #fff;
    background: linear-gradient(145deg, rgba(18, 39, 68, 0.76), rgba(7, 19, 39, 0.58));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 10px 24px rgba(4, 13, 30, 0.18);
    backdrop-filter: blur(18px) saturate(135%);
    cursor: pointer;
    transition: transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;

    &::before {
        content: "";
        width: 68px;
        height: 68px;
        position: absolute;
        top: -46px;
        right: -22px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--el-color-primary) 65%, #63e6ff);
        filter: blur(15px);
        opacity: 0.48;
        pointer-events: none;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.86);
        background: linear-gradient(145deg, rgba(25, 55, 94, 0.86), rgba(7, 19, 39, 0.68));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 16px 32px rgba(4, 13, 30, 0.26);
    }

    &:focus-visible {
        outline: 3px solid var(--mci-login-focus-ring);
        outline-offset: 2px;
    }

    &:disabled {
        opacity: 0.64;
        cursor: progress;
    }
}

.identity-login-button__icon {
    width: 34px;
    height: 34px;
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.32);
    border-radius: 11px;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08));
    box-shadow: inset 0 1px rgba(255, 255, 255, 0.28);
    font-size: 17px;
}

.identity-login-button__copy {
    position: relative;
    z-index: 1;
    min-width: 0;
    display: grid;
    gap: 3px;
    text-align: left;
}

.identity-login-button__copy strong {
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
}

.identity-login-button__copy small {
    color: rgba(255, 255, 255, 0.68);
    font-size: 9px;
    line-height: 1;
    white-space: nowrap;
}

.identity-login-button__arrow {
    position: relative;
    z-index: 1;
    color: rgba(255, 255, 255, 0.76);
    font-size: 12px;
    transition: transform 180ms ease;
}

.identity-login-button:hover .identity-login-button__arrow {
    transform: translate(2px, -2px);
}

.identity-login-entry {
    width: 132px;
    flex: 0 0 132px;
    display: flex;
}

:global(.totp-login-modal) {
    background: rgba(2, 8, 23, 0.68) !important;
    backdrop-filter: blur(15px) saturate(128%);
    -webkit-backdrop-filter: blur(15px) saturate(128%);
}

:global(.totp-login-shell.el-dialog) {
    width: 470px;
    max-width: calc(100vw - 28px);
    margin: auto;
    overflow: hidden;
    border: 1px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.3);
    border-radius: 28px;
    color: var(--el-text-color-primary, #172033);
    background: rgba(255, 255, 255, 0.96);
    background:
        radial-gradient(circle at 95% -8%, rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.18), transparent 42%),
        color-mix(in srgb, var(--el-bg-color, #fff) 96%, transparent);
    box-shadow:
        0 36px 100px rgba(2, 8, 23, 0.48),
        0 0 48px rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.2),
        inset 0 1px rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(28px) saturate(145%);
    -webkit-backdrop-filter: blur(28px) saturate(145%);
}

:global(.totp-login-shell .el-dialog__header) {
    margin: 0;
    padding: 26px 28px 19px;
    border-bottom: 1px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.12);
}

:global(.totp-login-shell .el-dialog__body) {
    padding: 0;
}

:global(html[data-theme="dark"] .totp-login-shell.el-dialog) {
    background:
        radial-gradient(circle at 95% -8%, rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.2), transparent 42%),
        rgba(13, 20, 35, 0.97);
}

.totp-login-header {
    display: grid;
    grid-template-columns: 66px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 16px;
    text-align: left;
}

.totp-security-orb {
    width: 66px;
    height: 66px;
    position: relative;
    display: grid;
    place-items: center;
    border-radius: 22px;
    color: var(--mci-text-on-primary, #fff);
    background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.3), transparent 42%),
        var(--mci-gradient-primary, linear-gradient(135deg, #6c2bd9, #2196f3));
    box-shadow:
        0 16px 34px rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.34),
        inset 0 1px rgba(255, 255, 255, 0.5);

    span {
        position: relative;
        z-index: 1;
        font-size: 27px;
        font-weight: 900;
        line-height: 1;
        text-shadow: 0 2px 8px rgba(3, 8, 28, 0.28);
    }

    i {
        position: absolute;
        inset: -7px;
        border: 1px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.3);
        border-radius: 26px;
        opacity: 0.8;
        animation: mciTotpOrbPulse 2.8s ease-in-out infinite;
    }
}

.totp-login-heading {
    min-width: 0;

    > span {
        display: block;
        margin-bottom: 4px;
        color: var(--mci-color-primary, var(--el-color-primary, #409eff));
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
    }

    h2 {
        margin: 0;
        color: var(--el-text-color-primary, #172033);
        font-size: 23px;
        line-height: 1.25;
        letter-spacing: -0.02em;
    }

    p {
        margin: 5px 0 0;
        color: var(--el-text-color-secondary, #64748b);
        font-size: 12px;
        line-height: 1.5;
    }
}

.totp-login-close {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--el-border-color-lighter, #e8ecf3);
    border-radius: 12px;
    display: grid;
    place-items: center;
    align-self: start;
    color: var(--el-text-color-secondary, #64748b);
    background: var(--el-fill-color-light, rgba(241, 245, 249, 0.76));
    cursor: pointer;
    transition: color 180ms ease, background-color 180ms ease, transform 180ms ease;

    span {
        font-size: 24px;
        font-weight: 300;
        line-height: 1;
        transform: translateY(-1px);
    }

    &:hover,
    &:focus-visible {
        color: var(--el-color-primary, #409eff);
        background: rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.1);
        transform: rotate(5deg);
    }

    &:focus-visible {
        outline: 2px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.42);
        outline-offset: 2px;
    }
}

.totp-login-dialog {
    position: relative;
    display: grid;
    gap: 18px;
    padding: 24px 28px 28px;
    overflow: hidden;
    text-align: left;

    > :not(.totp-login-aurora) {
        position: relative;
        z-index: 1;
    }
}

.totp-login-aurora {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;

    i {
        position: absolute;
        border-radius: 50%;
        filter: blur(34px);
        opacity: 0.14;
    }

    i:nth-child(1) { width: 130px; height: 130px; top: -70px; right: 4%; background: var(--mci-color-primary, #409eff); }
    i:nth-child(2) { width: 90px; height: 90px; bottom: 4%; left: -40px; background: #9b63e8; }
    i:nth-child(3) { width: 72px; height: 72px; right: 12%; bottom: -42px; background: #24c7af; }
}

.totp-field {
    display: grid;
    gap: 8px;

    label {
        color: var(--el-text-color-regular, #334155);
        font-size: 13px;
        font-weight: 750;
    }

    :deep(.el-input__wrapper) {
        min-height: 50px;
        padding: 1px 15px;
        border: 1px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.15);
        border-radius: 15px;
        background: var(--el-fill-color-blank, rgba(255, 255, 255, 0.9));
        box-shadow: 0 8px 22px rgba(13, 24, 50, 0.07);
        transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    :deep(.el-input__wrapper:hover) {
        border-color: rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.42);
    }

    :deep(.el-input__wrapper.is-focus) {
        border-color: var(--mci-color-primary, var(--el-color-primary, #409eff));
        box-shadow:
            0 0 0 4px rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.12),
            0 10px 26px rgba(13, 24, 50, 0.1);
        transform: translateY(-1px);
    }

    :deep(.el-input__prefix) {
        color: var(--mci-color-primary, var(--el-color-primary, #409eff));
        font-size: 18px;
    }
}

.totp-field-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    span {
        color: var(--el-text-color-placeholder, #94a3b8);
        font-size: 11px;
    }
}

.totp-code-field :deep(.el-input__inner) {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.32em;
    font-variant-numeric: tabular-nums;
}

.totp-security-notes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    span {
        min-height: 28px;
        padding: 0 10px;
        border: 1px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.13);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--el-text-color-secondary, #64748b);
        background: rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.06);
        font-size: 11px;
        font-weight: 650;
    }

    .el-icon {
        color: var(--el-color-success, #22a06b);
        font-size: 13px;
    }
}

.totp-login-actions {
    display: grid;
    grid-template-columns: 106px minmax(0, 1fr);
    gap: 12px;
    margin-top: 2px;

    button {
        min-height: 48px;
        border-radius: 15px;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
    }
}

.totp-cancel-button {
    border: 1px solid var(--el-border-color, #d8dee9);
    color: var(--el-text-color-regular, #334155);
    background: var(--el-fill-color-blank, rgba(255, 255, 255, 0.86));
    transition: border-color 180ms ease, color 180ms ease, transform 180ms ease;

    &:hover,
    &:focus-visible {
        border-color: rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.48);
        color: var(--mci-color-primary, var(--el-color-primary, #409eff));
        transform: translateY(-1px);
    }
}

.totp-submit-button {
    position: relative;
    overflow: hidden;
    border: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--mci-text-on-primary, #fff);
    background: var(--mci-gradient-primary, linear-gradient(135deg, #6c2bd9, #2196f3));
    box-shadow: 0 14px 30px rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.3);
    transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;

    > :not(.totp-submit-shine) {
        position: relative;
        z-index: 1;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 18px 38px rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.4);
    }

    &:focus-visible {
        outline: 2px solid rgba(var(--mci-color-primary-rgb, 64, 158, 255), 0.52);
        outline-offset: 3px;
    }

    &:disabled {
        cursor: wait;
        opacity: 0.72;
    }
}

.totp-submit-shine {
    width: 42%;
    height: 180%;
    position: absolute;
    top: -40%;
    left: -55%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.46), transparent);
    transform: skewX(-18deg);
    animation: mciTotpSubmitShine 2.8s ease-in-out infinite;
}

@media (max-width: 520px) {
    :global(.totp-login-shell .el-dialog__header) {
        padding: 22px 20px 17px;
    }

    .totp-login-header {
        grid-template-columns: 54px minmax(0, 1fr) 44px;
        gap: 12px;
    }

    .totp-security-orb {
        width: 54px;
        height: 54px;
        border-radius: 18px;

        i { border-radius: 22px; }
    }

    .totp-login-heading h2 { font-size: 19px; }
    .totp-login-heading p { font-size: 11px; }

    .totp-login-dialog {
        gap: 16px;
        padding: 21px 20px 22px;
    }

    .totp-login-actions {
        grid-template-columns: 88px minmax(0, 1fr);
    }
}

.login-methods-overlay {
    position: fixed;
    inset: 0;
    z-index: 4200;
    display: grid;
    place-items: center;
    padding: 24px;
    overflow: hidden;
    background: rgba(2, 10, 24, 0.68);
    backdrop-filter: blur(16px) saturate(125%);
}

.login-methods-panel {
    width: min(940px, calc(100vw - 48px));
    max-height: calc(100dvh - 48px);
    box-sizing: border-box;
    position: relative;
    padding: 28px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 30%, var(--el-border-color-light));
    border-radius: 32px;
    color: var(--el-text-color-primary);
    background:
        radial-gradient(circle at 96% 0, color-mix(in srgb, var(--el-color-primary) 22%, transparent), transparent 40%),
        radial-gradient(circle at 0 100%, color-mix(in srgb, var(--el-color-success) 11%, transparent), transparent 34%),
        color-mix(in srgb, var(--el-bg-color) 96%, transparent);
    box-shadow: 0 38px 110px rgba(0, 8, 24, 0.48), inset 0 1px color-mix(in srgb, #fff 65%, transparent);
    backdrop-filter: blur(26px) saturate(145%);
    scrollbar-width: thin;
}

.login-methods-aurora {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
}

.login-methods-aurora i {
    position: absolute;
    border-radius: 50%;
    filter: blur(46px);
    opacity: 0.22;
}

.login-methods-aurora i:nth-child(1) { width: 270px; height: 270px; top: -190px; left: 18%; background: #617bff; }
.login-methods-aurora i:nth-child(2) { width: 220px; height: 220px; right: -130px; bottom: 3%; background: #28d4c2; }
.login-methods-aurora i:nth-child(3) { width: 150px; height: 150px; left: -90px; bottom: -70px; background: #9b63e8; }

.login-methods-modal-enter-active,
.login-methods-modal-leave-active {
    transition: opacity 220ms ease;
}

.login-methods-modal-enter-active .login-methods-panel,
.login-methods-modal-leave-active .login-methods-panel {
    transition: transform 360ms cubic-bezier(.16, 1, .3, 1), opacity 220ms ease;
}

.login-methods-modal-enter-from,
.login-methods-modal-leave-to {
    opacity: 0;
}

.login-methods-modal-enter-from .login-methods-panel,
.login-methods-modal-leave-to .login-methods-panel {
    opacity: 0;
    transform: translateY(28px) scale(0.96);
}

:global(body.mci-login-methods-open) {
    overflow: hidden;
}

.login-methods-heading {
    min-height: 68px;
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) 42px;
    align-items: center;
    gap: 16px;
    margin-bottom: 22px;
}

.login-methods-heading > div {
    min-width: 0;
    display: grid;
    gap: 5px;
}

.login-methods-heading strong {
    font-size: clamp(22px, 2.7vw, 30px);
    line-height: 1.12;
    letter-spacing: 0.4px;
}

.login-methods-heading p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.55;
}

.login-methods-kicker {
    color: var(--mci-color-primary-on-surface, var(--el-color-primary));
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.4px;
}

.login-methods-orbit {
    width: 58px;
    height: 58px;
    position: relative;
    border: 1px solid color-mix(in srgb, var(--mci-color-primary-on-surface, var(--el-color-primary)) 35%, transparent);
    border-radius: 20px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--mci-color-primary-on-surface, var(--el-color-primary)) 18%, var(--el-bg-color)), color-mix(in srgb, var(--mci-color-primary-on-surface, var(--el-color-primary)) 5%, var(--el-bg-color)));
    box-shadow: 0 14px 34px color-mix(in srgb, var(--mci-color-primary-on-surface, var(--el-color-primary)) 18%, transparent), inset 0 1px color-mix(in srgb, #fff 70%, transparent);
    animation: mciLoginOrbitFloat 5s ease-in-out infinite;
}

.login-methods-orbit i {
    width: 8px;
    height: 8px;
    position: absolute;
    top: 50%;
    left: 50%;
    border-radius: 50%;
    background: var(--mci-color-primary-on-surface, var(--el-color-primary));
    box-shadow: 0 0 13px color-mix(in srgb, var(--mci-color-primary-on-surface, var(--el-color-primary)) 70%, transparent);
}

.login-methods-orbit i:nth-child(1) { transform: translate(-50%, -50%); }
.login-methods-orbit i:nth-child(2) { transform: translate(15px, -20px) scale(0.65); }
.login-methods-orbit i:nth-child(3) { transform: translate(-22px, 11px) scale(0.45); }

.login-methods-close {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 1px solid var(--el-border-color-light);
    border-radius: 14px;
    color: var(--el-text-color-secondary);
    background: color-mix(in srgb, var(--el-fill-color-light) 72%, transparent);
    font-size: 25px;
    line-height: 1;
    cursor: pointer;
    transition: transform 180ms ease, color 180ms ease, border-color 180ms ease;
}

.login-methods-close:hover,
.login-methods-close:focus-visible {
    transform: rotate(6deg) scale(1.05);
    border-color: color-mix(in srgb, var(--el-color-primary) 46%, var(--el-border-color));
    color: var(--mci-color-primary-on-surface, var(--el-color-primary));
    outline: none;
}

.login-method-bubbles {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
}

.login-methods-empty {
    position: relative;
    z-index: 1;
    min-height: 112px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px;
    border: 1px dashed color-mix(in srgb, var(--el-color-warning) 45%, var(--el-border-color-light));
    border-radius: 20px;
    color: var(--el-text-color-primary);
    background: color-mix(in srgb, var(--el-color-warning) 8%, var(--el-fill-color-lighter));
}

.login-methods-empty__icon {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    background: var(--el-color-warning);
    font-size: 22px;
    font-weight: 800;
}

.login-methods-empty > span:last-child {
    min-width: 0;
    display: grid;
    gap: 6px;
}

.login-methods-empty strong {
    font-size: 15px;
    line-height: 1.4;
}

.login-methods-empty small {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.6;
}

.login-method-bubble {
    --bubble-accent: var(--el-color-primary);
    min-width: 0;
    min-height: 148px;
    padding: 18px;
    position: relative;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 24px;
    grid-template-rows: 1fr auto;
    gap: 11px 13px;
    overflow: hidden;
    text-align: left;
    color: var(--el-text-color-primary);
    border: 1px solid color-mix(in srgb, var(--bubble-accent) 28%, var(--el-border-color-light));
    border-radius: 24px 24px 24px 10px;
    background:
        radial-gradient(circle at 100% 0, color-mix(in srgb, var(--bubble-accent) 20%, transparent), transparent 45%),
        color-mix(in srgb, var(--el-fill-color-lighter) 78%, transparent);
    box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
    cursor: pointer;
    transform-origin: 50% 100%;
    animation: mciLoginBubbleIn 420ms cubic-bezier(.2,.8,.2,1) both;
    animation-delay: calc(var(--bubble-index) * 46ms);
    transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
}

.login-method-bubble:hover:not(:disabled),
.login-method-bubble:focus-visible:not(:disabled) {
    z-index: 2;
    transform: translateY(-4px) scale(1.018);
    border-color: color-mix(in srgb, var(--bubble-accent) 58%, var(--el-border-color));
    box-shadow: 0 15px 34px color-mix(in srgb, var(--bubble-accent) 18%, transparent);
    outline: none;
}

.login-method-bubble.is-passkey { --bubble-accent: #5b8cff; }
.login-method-bubble.is-totp { --bubble-accent: #9b63e8; }
.login-method-bubble.is-face { --bubble-accent: #16a7a0; }
.login-method-bubble.is-microi { --bubble-accent: #2376f3; }
.login-method-bubble.is-gitee { --bubble-accent: #c71d23; }
.login-method-bubble.is-wechat { --bubble-accent: #07c160; }
.login-method-bubble.is-github { --bubble-accent: #59636e; }

.login-method-bubble:disabled {
    opacity: 0.58;
    cursor: not-allowed;
    filter: saturate(0.55);
}

.login-method-bubble-icon {
    width: 48px;
    height: 48px;
    grid-row: 1 / 3;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: start;
    border-radius: 50%;
    color: #fff;
    background: linear-gradient(145deg, color-mix(in srgb, var(--bubble-accent) 72%, #fff), var(--bubble-accent));
    box-shadow: 0 8px 20px color-mix(in srgb, var(--bubble-accent) 30%, transparent), inset 0 1px 1px #ffffff88;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.4px;
}

.login-method-bubble-copy {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 4px;
}

.login-method-bubble-copy strong {
    font-size: 15px;
    line-height: 1.35;
}

.login-method-bubble-copy small {
    color: var(--el-text-color-secondary);
    font-size: 11px;
    line-height: 1.55;
}

.login-method-bubble.is-microi .login-method-bubble-icon {
    background: linear-gradient(145deg, #1d66d8, #1554bd);
}

.login-method-bubble.is-microi .login-method-bubble-copy small {
    color: var(--el-text-color-regular);
}

.login-method-bubble-status {
    width: fit-content;
    grid-column: 2;
    padding: 2px 7px;
    border: 1px solid color-mix(in srgb, var(--bubble-accent) 22%, transparent);
    border-radius: 999px;
    color: color-mix(in srgb, var(--bubble-accent) 78%, var(--el-text-color-primary));
    background: color-mix(in srgb, var(--bubble-accent) 8%, transparent);
    font-size: 10px;
    line-height: 1.5;
}

.login-method-bubble-go {
    width: 24px;
    height: 24px;
    grid-column: 3;
    grid-row: 1 / 3;
    display: grid;
    align-self: center;
    place-items: center;
    border-radius: 50%;
    color: color-mix(in srgb, var(--bubble-accent) 82%, var(--el-text-color-primary));
    background: color-mix(in srgb, var(--bubble-accent) 10%, transparent);
    transition: transform 180ms ease;
}

.login-method-bubble:hover:not(:disabled) .login-method-bubble-go {
    transform: translateX(3px);
}

.login-methods-footnote {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-placeholder);
    font-size: 11px;
    line-height: 1.55;
}

.login-methods-footnote span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
}

.login-methods-footnote .el-icon {
    flex: 0 0 auto;
    color: var(--mci-color-primary-on-surface, var(--el-color-primary));
}

@keyframes mciLoginBubbleIn {
    from { opacity: 0; transform: translateY(16px) scale(0.86); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes mciLoginOrbitFloat {
    0%, 100% { transform: translateY(0) rotate(0); }
    50% { transform: translateY(-4px) rotate(3deg); }
}

.login-button-energy {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    border-radius: inherit;
    opacity: 0.92;
    pointer-events: none;

    &::after {
        content: "";
        width: 58%;
        height: 2px;
        position: absolute;
        top: 50%;
        left: -62%;
        border-radius: 999px;
        background: var(--mci-login-energy-trace);
        box-shadow: var(--mci-login-energy-trace-shadow);
        opacity: 0;
        transform: translateX(0) translateY(-50%);
        animation: mciLoginCurrentTrace 3.4s ease-in-out infinite;
    }
}

.login-button-energy-beam {
    width: 44%;
    height: 210%;
    position: absolute;
    top: -55%;
    left: -54%;
    border-radius: 50%;
    background: var(--mci-login-energy-beam);
    opacity: 0;
    transform: translateX(0) skewX(-18deg);
    animation: mciLoginEnergySweep 3.4s ease-in-out infinite;
}

/* ==================== 隐私协议样式 ==================== */
.privacy-policy-wrapper {
    margin-bottom: 20px;
    text-align: center;
    
    .privacy-checkbox {
        :deep(.el-checkbox__label) {
            color: #fff;
            font-size: 13px;
        }
        
        :deep(.el-checkbox__inner) {
            border-color: rgba(255, 255, 255, 0.6);
            background-color: transparent;
        }
        
        :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
            background-color: var(--el-color-primary);
            border-color: var(--el-color-primary);
        }
    }
    
    .privacy-text {
        cursor: pointer;
        text-decoration: underline;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
}

/* ==================== 底部提示样式 ==================== */
.bottomTips {
    text-align: center;
    margin-top: 20px;
    color: rgba(255, 255, 255, 0.9);
    
    p {
        margin-bottom: 12px;
        padding: 0 10px;
    }
    
    a {
        color: #fff;
        text-decoration: none;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        
        .el-icon {
            font-size: 16px;
        }
        
        &:hover {
            opacity: 0.8;
            text-decoration: underline;
        }
    }
    
    .register-link {
        a {
            font-size: 13px;
            font-weight: 500;
        }
    }
    
    :deep(.bottom-content) {
        font-size: 12px;
        line-height: 1.6;
        opacity: 0.85;
        
        p {
            margin: 8px 0;
        }
        a {
            color: #fff !important;
        }
    }
}

/* ==================== 系统预览图片样式 ==================== */
.imgSystemPreview {
    width: 370px;
    display: block;
    margin-bottom: 15px;
    border-radius: 8px;
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
        transform: scale(1.02);
    }
    
    &.active {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border: 2px solid var(--el-color-primary);
        transform: scale(1.05);
    }
}

/* ==================== 注册对话框样式 ==================== */
.register-dialog {
    :deep(.el-dialog__body) {
        padding: 20px 30px;
    }
    
    .register-form {
        .el-form-item {
            margin-bottom: 22px;
        }
    }
    
    .reg-captcha-img {
        height: 32px;
        cursor: pointer;
        display: block;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
    
    .sms-button {
        font-size: 13px;
        padding: 0 15px;
    }
    
    .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
}

/* ==================== 主登录容器样式 ==================== */
#divLogin {
    --mci-login-card-radius: 24px;
    --mci-login-control-radius: 12px;
    --mci-login-primary: var(--mci-color-primary, var(--el-color-primary, #409eff));
    --mci-login-primary-rgb: var(--mci-color-primary-rgb, var(--el-color-primary-rgb, 64, 158, 255));
    --mci-login-primary-light: var(--mci-color-primary-light, var(--el-color-primary-light-3, #79bbff));
    --mci-login-primary-strong: var(--mci-color-primary-strong, var(--mci-color-primary-dark, var(--el-color-primary-dark-2, #337ecc)));
    --mci-login-on-primary: var(--mci-text-on-primary, #ffffff);
    --mci-login-primary-gradient: var(--mci-gradient-primary, linear-gradient(135deg, var(--mci-login-primary-strong), var(--mci-login-primary-light)));
    --mci-login-text-strong: #ffffff;
    --mci-login-text-shadow: rgba(8, 20, 48, 0.42);
    --mci-login-electric: color-mix(in srgb, var(--mci-login-primary-light) 68%, #e7fdff);
    --mci-login-electric-soft: rgba(var(--mci-login-primary-rgb), 0.72);
    --mci-login-focus-ring: rgba(var(--mci-login-primary-rgb), 0.42);
    --mci-login-logo-bg: rgba(255, 255, 255, 0.96);
    --mci-login-logo-shadow: 0 10px 28px rgba(8, 20, 48, 0.24), 0 0 22px rgba(var(--mci-login-primary-rgb), 0.28);
    --mci-login-logo-halo: radial-gradient(circle, rgba(var(--mci-login-primary-rgb), 0.48) 0%, rgba(var(--mci-login-primary-rgb), 0.18) 50%, transparent 72%);
    --mci-login-input-bg: linear-gradient(115deg, rgba(var(--mci-login-primary-rgb), 0.1), rgba(248, 250, 255, 0.97) 32%);
    --mci-login-input-bg-hover: linear-gradient(115deg, rgba(var(--mci-login-primary-rgb), 0.16), rgba(255, 255, 255, 0.99) 38%);
    --mci-login-input-border-hover: rgba(var(--mci-login-primary-rgb), 0.52);
    --mci-login-input-border-focus: rgba(var(--mci-login-primary-rgb), 0.92);
    --mci-login-input-text: #1f2937;
    --mci-login-input-placeholder: #64748b;
    --mci-login-input-shadow: 0 10px 26px rgba(5, 16, 38, 0.18);
    --mci-login-input-focus-shadow: 0 0 0 3px rgba(var(--mci-login-primary-rgb), 0.2), 0 12px 28px rgba(5, 16, 38, 0.22);
    --mci-login-control-bg: rgba(var(--mci-login-primary-rgb), 0.22);
    --mci-login-control-bg-hover: rgba(var(--mci-login-primary-rgb), 0.32);
    --mci-login-control-active-bg: rgba(var(--mci-login-primary-rgb), 0.44);
    --mci-login-control-shadow: 0 8px 22px rgba(4, 13, 34, 0.2);
    --mci-login-checkbox-bg: rgba(255, 255, 255, 0.12);
    --mci-login-checkbox-border: rgba(211, 232, 255, 0.72);
    --mci-login-button-gradient: var(--mci-login-primary-gradient);
    --mci-login-button-depth: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 48%, rgba(20, 30, 108, 0.16));
    --mci-login-button-shadow: 0 15px 34px rgba(var(--mci-login-primary-rgb), 0.38), 0 0 30px rgba(var(--mci-login-primary-rgb), 0.25);
    --mci-login-energy-beam: linear-gradient(90deg, transparent 0%, rgba(var(--mci-login-primary-rgb), 0.12) 20%, rgba(255, 255, 255, 0.64) 50%, rgba(var(--mci-login-primary-rgb), 0.14) 80%, transparent 100%);
    --mci-login-energy-trace: linear-gradient(90deg, transparent 0%, rgba(var(--mci-login-primary-rgb), 0.36) 24%, #ffffff 72%, transparent 100%);
    --mci-login-energy-trace-shadow: 0 0 12px rgba(var(--mci-login-primary-rgb), 0.82);
    --mci-login-card-surface: linear-gradient(145deg, rgba(var(--mci-login-primary-rgb), 0.52), rgba(10, 18, 47, 0.88) 58%, rgba(var(--mci-login-primary-rgb), 0.34));
    --mci-login-card-glow: linear-gradient(135deg, var(--mci-login-primary-light), var(--mci-login-primary) 46%, var(--mci-login-primary-strong));
    --mci-login-card-shadow: 0 28px 90px rgba(3, 9, 28, 0.5), 0 0 48px rgba(var(--mci-login-primary-rgb), 0.36), 0 0 96px rgba(var(--mci-login-primary-rgb), 0.24);
    --mci-login-card-surface-mobile: linear-gradient(145deg, rgba(var(--mci-login-primary-rgb), 0.68), rgba(10, 18, 47, 0.94) 62%, rgba(var(--mci-login-primary-rgb), 0.48));
    --mci-login-card-shadow-mobile: 0 18px 46px rgba(3, 9, 28, 0.46), 0 0 32px rgba(var(--mci-login-primary-rgb), 0.28), 0 0 58px rgba(var(--mci-login-primary-rgb), 0.2);
    font-size: 12px;
    position: fixed;
    isolation: isolate;
    background-color: var(--taskbar-color);
    width: 100%;
    height: 100%;
    z-index: 99;
    color: var(--mci-login-text-strong);
    text-align: center;
    left: 0;
    top: 0;
    transition: opacity 0.7s ease;
    overflow: hidden;
    display: block !important;

    &::after {
        content: "";
        position: absolute;
        inset: -18%;
        z-index: 1;
        pointer-events: none;
        opacity: 0;
        background:
            radial-gradient(circle at 18% 78%, rgba(var(--mci-login-primary-rgb), 0.3), transparent 31%),
            radial-gradient(circle at 82% 18%, rgba(var(--mci-login-primary-rgb), 0.38), transparent 34%);
        transform: scale(0.82) rotate(-4deg);
    }

    &.is-theme-transitioning::after {
        animation: mciLoginThemeWash 720ms cubic-bezier(0.22, 0.72, 0.24, 1) both;
    }

    .login-title {
        font-size: 28px;
        font-weight: bold;
        line-height: 1.18;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        
        span {
            display: block;
            margin-top: var(--mci-login-brand-subtitle-gap);
            font-size: 16px !important;
            font-weight: normal;
            opacity: 0.9;
        }
    }

    .divLoginCenter {
        width: 500px;
        max-width: calc(100vw - 32px);
        padding: 40px;
        box-sizing: border-box;
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 3;
        transform: translate(-50%, -50%);
        margin-top: 0 !important;
        transition: opacity 0.7s ease;
        border-radius: var(--mci-login-card-radius);
        isolation: isolate;

        &::before {
            content: "";
            position: absolute;
            inset: -7px;
            z-index: -2;
            border: 0;
            border-radius: calc(var(--mci-login-card-radius) + 7px);
            background: var(--mci-login-card-glow);
            filter: blur(18px);
            opacity: 0.48;
            pointer-events: none;
            transform: scale(0.975);
            animation: mciLoginCardBreath 4.8s ease-in-out infinite;
        }

        :deep(.el-checkbox__input.is-checked + .el-checkbox__label){
            color: #fff !important;
        }
    }

    @media (min-width: 1200px) {
        .divLoginCenter {
            // 固定外框为原宽屏实际视觉宽度，避免 1366px 下滚动条出现后跨断点导致退出登录时骤然变窄。
            width: 620px;
            padding: 50px 60px;
        }
    }
    
    @media (max-width: 768px) {
        .divLoginCenter {
            width: calc(100vw - 24px);
            max-width: 500px;
            padding: 30px 25px;
        }

        .login-preferences-row {
            min-height: 44px;
            align-items: center;
            flex-direction: row;
            justify-content: space-between;
        }

        .remember-password-checkbox {
            height: 44px !important;
            min-height: 44px !important;
        }

        .login-appearance-button {
            width: 44px;
            padding: 0;

            span {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }
        }

        .login-brand {
            --mci-login-brand-height: 36px;
            --mci-login-brand-subtitle-line-height: 18px;
            margin-bottom: 24px;
            gap: 12px;

            &.has-subtitle {
                --mci-login-brand-height: 50px;
            }

            .login-title {
                max-width: calc(100% - var(--mci-login-brand-height) - 12px);
            }
        }

        .login-title {
            font-size: 24px;
            
            span {
                font-size: 14px !important;
            }
        }
    }
}

/* ==================== 登录背景遮罩样式 ==================== */
.loginCenterBgCover {
    width: 100%;
    height: 100%;
    position: absolute;
    background: var(--mci-login-card-surface);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    left: 0;
    top: 0;
    z-index: -1;
    border: 0;
    border-radius: var(--mci-login-card-radius);
    box-shadow: var(--mci-login-card-shadow);
}

@media (max-width: 768px) {
    .loginCenterBgCover {
        background: var(--mci-login-card-surface-mobile);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        box-shadow: var(--mci-login-card-shadow-mobile);
    }

    #divLogin .divLoginCenter::before {
        display: none;
    }
}

/* ==================== 时间显示样式 ==================== */
#divLogin .divLoginTime {
    left: 5%;
    bottom: 7.5%;
    width: 400px;
    height: auto;
    position: fixed;
    z-index: 2;
    transition: all 0.7s ease;
    
    p {
        text-align: left;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        margin: 5px 0;
        font-weight: 300;
        letter-spacing: 1px;
    }
}

/* ==================== 响应式字体大小 ==================== */
@media (max-width: 767px) {
    #divLogin .divLoginTime p {
        font-size: 18px;
    }
}

@media (min-width: 768px) {
    #divLogin .divLoginTime p {
        font-size: 24px;
    }
}

@media (min-width: 992px) {
    #divLogin .divLoginTime p {
        font-size: 30px;
    }
}

@media (min-width: 1200px) {
    #divLogin .divLoginTime p {
        font-size: 30px;
    }
}

/* ==================== 对话框通用优化 ==================== */
:deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
    
    .el-dialog__header {
        padding: 20px 30px;
        background: linear-gradient(135deg, var(--el-color-primary-light-3) 0%, var(--el-color-primary) 100%);
        
        .el-dialog__title {
            color: #fff;
            font-weight: 500;
        }
        
        .el-dialog__headerbtn .el-dialog__close {
            color: #fff;
            
            &:hover {
                color: rgba(255, 255, 255, 0.8);
            }
        }
    }
}

/* ==================== 动画效果 ==================== */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translate(-50%, -45%);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%);
    }
}

@keyframes mciLoginCardBreath {
    0%, 100% {
        opacity: 0.38;
        transform: scale(0.975);
    }
    50% {
        opacity: 0.78;
        transform: scale(1.018);
    }
}

@keyframes mciLoginLogoPulse {
    0%, 100% {
        opacity: 0.38;
        transform: scale(0.94);
    }
    50% {
        opacity: 0.72;
        transform: scale(1.06);
    }
}

@keyframes mciLoginButtonAura {
    0%, 100% {
        background-position: 0% 50%;
    }
    50% {
        background-position: 100% 50%;
    }
}

@keyframes mciLoginEnergySweep {
    0%, 46% {
        opacity: 0;
        transform: translateX(0) skewX(-18deg);
    }
    58% {
        opacity: 0.86;
    }
    78%, 100% {
        opacity: 0;
        transform: translateX(350%) skewX(-18deg);
    }
}

@keyframes mciLoginCurrentTrace {
    0%, 38% {
        opacity: 0;
        transform: translateX(0) translateY(-50%);
    }
    52%, 72% {
        opacity: 0.88;
    }
    86%, 100% {
        opacity: 0;
        transform: translateX(285%) translateY(-50%);
    }
}

@keyframes mciLoginThemeWash {
    0% {
        opacity: 0;
        transform: scale(0.82) rotate(-4deg);
    }
    42% {
        opacity: 0.7;
    }
    100% {
        opacity: 0;
        transform: scale(1.16) rotate(3deg);
    }
}

@keyframes mciTotpOrbPulse {
    0%, 100% {
        opacity: 0.34;
        transform: scale(0.92);
    }
    50% {
        opacity: 0.86;
        transform: scale(1.04);
    }
}

@keyframes mciTotpSubmitShine {
    0%, 34% {
        opacity: 0;
        transform: translateX(0) skewX(-18deg);
    }
    48% {
        opacity: 0.9;
    }
    72%, 100% {
        opacity: 0;
        transform: translateX(420%) skewX(-18deg);
    }
}

.divLoginCenter {
    animation: fadeInUp 0.6s ease-out;
}

@media (prefers-reduced-motion: reduce) {
    .divLoginCenter,
    .divLoginCenter::before,
    .login-system-logo-ring,
    .login-button,
    .login-methods-orbit,
    .login-method-bubble,
    .login-button-energy::after,
    .login-button-energy-beam,
    .totp-security-orb i,
    .totp-submit-shine,
    .is-loading {
        animation: none !important;
    }

    .remember-password-checkbox,
    .login-wallpaper-layer--current {
        transition: none !important;
    }

    #divLogin.is-theme-transitioning::after {
        animation: none !important;
        opacity: 0 !important;
    }

    .login-button:hover:not(:disabled),
    .login-button:focus-visible:not(:disabled),
    .login-method-bubble:hover:not(:disabled),
    .login-method-bubble:focus-visible:not(:disabled),
    .remember-password-checkbox:hover {
        transform: none;
    }

    .login-methods-modal-enter-active,
    .login-methods-modal-leave-active,
    .login-methods-modal-enter-active .login-methods-panel,
    .login-methods-modal-leave-active .login-methods-panel {
        transition-duration: 1ms !important;
    }
}

.login-wallpaper-stage {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--taskbar-color);
    pointer-events: none;
}

.login-wallpaper-layer {
    position: absolute;
    inset: -2%;
    background-color: var(--taskbar-color);
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    will-change: opacity, transform;
}

.login-wallpaper-layer--previous {
    z-index: 0;
    opacity: 1;
    transform: scale(1.018);
}

.login-wallpaper-layer--current {
    z-index: 1;
    opacity: 1;
    transform: scale(1.018);
    transition:
        opacity 760ms cubic-bezier(0.22, 0.72, 0.24, 1),
        transform 980ms cubic-bezier(0.22, 0.72, 0.24, 1);
}

#divLogin.is-wallpaper-transitioning .login-wallpaper-layer--current {
    opacity: 0;
    transform: scale(1.065);
    transition: none;
}

.login-wallpaper-vignette {
    position: absolute;
    inset: 0;
    z-index: 2;
    background:
        linear-gradient(120deg, rgba(1, 7, 20, 0.12), transparent 42%),
        radial-gradient(circle at center, transparent 56%, rgba(1, 7, 20, 0.18) 100%);
}

@media (max-width: 820px) {
    .login-method-bubbles {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 600px) {
    .login-methods-overlay {
        place-items: end center;
        padding: max(10px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom));
    }

    .login-methods-panel {
        width: 100%;
        max-height: calc(100dvh - max(18px, env(safe-area-inset-top)));
        padding: 20px 16px 18px;
        border-radius: 27px 27px 18px 18px;
    }

    .login-methods-heading {
        min-height: 54px;
        grid-template-columns: 46px minmax(0, 1fr) 38px;
        gap: 11px;
        margin-bottom: 17px;
    }

    .login-methods-orbit {
        width: 46px;
        height: 46px;
        border-radius: 15px;
    }

    .login-methods-orbit i:nth-child(2) { transform: translate(11px, -16px) scale(0.6); }
    .login-methods-orbit i:nth-child(3) { transform: translate(-17px, 7px) scale(0.42); }

    .login-methods-heading strong {
        font-size: 20px;
    }

    .login-methods-heading p {
        font-size: 11px;
        line-height: 1.4;
    }

    .login-methods-kicker {
        display: none;
    }

    .login-methods-close {
        width: 38px;
        height: 38px;
        border-radius: 12px;
    }

    .login-method-bubbles {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .login-methods-empty {
        min-height: 96px;
        padding: 15px;
        border-radius: 18px;
    }

    .login-method-bubble {
        min-height: 98px;
        padding: 14px;
        grid-template-columns: 44px minmax(0, 1fr) 24px;
        gap: 7px 11px;
        border-radius: 20px 20px 20px 9px;
    }

    .login-method-bubble-icon {
        width: 44px;
        height: 44px;
    }

    .login-method-bubble-copy strong {
        font-size: 14px;
    }

    .login-method-bubble-copy small {
        font-size: 10px;
    }

    .login-methods-footnote {
        align-items: flex-start;
        flex-direction: column;
        gap: 6px;
        margin-top: 14px;
        padding-top: 13px;
        font-size: 9px;
    }

    .identity-login-button,
    .identity-login-entry {
        width: 124px;
        flex-basis: 124px;
    }

    .identity-login-button {
        grid-template-columns: 32px minmax(0, 1fr) 10px;
        gap: 6px;
        padding-inline: 8px;
    }

    .identity-login-button__icon {
        width: 32px;
        height: 32px;
    }

    .identity-login-button__copy strong {
        font-size: 11px;
    }
}

/* ==================== 按钮统一样式 ==================== */
:deep(.el-button) {
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
}

</style>

<style lang="scss" scoped src="./login-layouts.scss"></style>

<style lang="scss" src="./login-appearance.scss"></style>
