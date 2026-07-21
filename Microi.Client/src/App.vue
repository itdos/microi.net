<template>
    <el-config-provider :locale="elementLocale">
        <div id="app-microi" :class="GetAppClass()">
            <router-view />
        </div>
    </el-config-provider>
</template>

<script>
import { computed, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";
import { ElConfigProvider } from "element-plus";
import { useDiyStore, useSettingsStore, useAppStore } from "@/pinia";
import { getElementLocale, normalizeLocale } from "@/lang";
import { setThemeMode as applyThemeMode } from "@/utils/theme-color.js";
// import drag from '@/views/form-engine/utils/dos.common';
// import { DiyFormDialog, DiyChat } from "@/utils/microi.net.import";
export default {
    name: "App",
    components: { ElConfigProvider },
    setup() {
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();
        const appStore = useAppStore();
        const instance = getCurrentInstance();
        const { Microi } = instance.appContext.config.globalProperties;

        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const CurrentTime = computed(() => diyStore.CurrentTime);
        const DesktopBg = computed(() => diyStore.DesktopBg);
        const LoginCover = computed(() => diyStore.LoginCover);
        const OsClient = computed(() => diyStore.OsClient);
        const Lang = computed(() => diyStore.Lang);
        const title = computed(() => settingsStore.title);
        const WebTitle = computed(() => diyStore.WebTitle);
        const SystemSubTitle = computed(() => diyStore.SystemSubTitle);
        const ClientCompany = computed(() => diyStore.ClientCompany);
        const ClientCompanyUrl = computed(() => diyStore.ClientCompanyUrl);
        const DiyChatShow = computed(() => diyStore.DiyChat.Show);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);
        const ShowClassicLeft = computed(() => diyStore.ShowClassicLeft);
        // Element Plus 语言包跟随 appStore.language 实时切换
        const elementLocale = computed(() =>
            getElementLocale(normalizeLocale(appStore.language) || "zh-CN")
        );
        return {
            diyStore,
            settingsStore,
            appStore,
            elementLocale,
            GetCurrentUser,
            CurrentTime,
            DesktopBg,
            LoginCover,
            OsClient,
            Lang,
            title,
            WebTitle,
            SystemSubTitle,
            ClientCompany,
            ClientCompanyUrl,
            DiyChatShow,
            ShowClassicTop,
            ShowClassicLeft
        };
    },
    data() {
        return {
            // 存储定时器引用，用于组件销毁时清理，防止内存泄漏
            timers: [],
            // plusready 事件处理函数引用
            plusreadyHandler: null,
            // 浏览器标签页从休眠/后台恢复时立即检查 Token 是否需要续签
            authResumeHandler: null,
            behaviorVisibilityHandler: null,
            behaviorPageHideHandler: null
        };
    },
    watch: {},

    async mounted() {
        // console.log("-------> App.vue mounted");
        if(window && window.location && window.location.href) {
            console.log('当前URL：', window.location.href);
        } else {
            console.log('无法获取当前URL');
        }
        var self = this;

        // 初始化窗口大小监听，用于响应式布局
        self.WindowResize();
        window.addEventListener('resize', self.WindowResize);

        // 检测是否在小程序 webview 中运行（用于隐藏顶部/底部菜单）
        self.diyStore.detectMiniProgram();

        // 初始化主题色的文字颜色变量
        this.initThemeColorDefaults();

        // 恢复 MCI 亮/暗模式（localStorage 'mci-theme'）
        this.restoreMciMode();

        // 清除遗留的 OpenClaw 风格主题状态（一次性迁移）
        try {
            localStorage.removeItem('microi_oc_theme');
            var _appEl = document.getElementById('app-microi');
            if (_appEl && (_appEl.getAttribute('data-theme') || '').indexOf('openclaw') === 0) {
                _appEl.removeAttribute('data-theme');
            }
            document.body.classList.remove('oc-theme-dark', 'oc-theme-light');
            document.documentElement.classList.remove('oc-theme-dark', 'oc-theme-light');
        } catch (e) {}

        if (window.plus) {
            self.PageInit();
        } else {
            // 保存事件处理函数引用，以便销毁时移除
            self.plusreadyHandler = function () {
                self.PageInit();
            };
            document.addEventListener("plusready", self.plusreadyHandler, false);
        }
        if (!self.DiyCommon.isClientApp) {
            self.PageInit();
        }

        self.authResumeHandler = function () {
            if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
            self.RefreshTokenWithLock();
        };
        document.addEventListener("visibilitychange", self.authResumeHandler, false);
        window.addEventListener("focus", self.authResumeHandler, false);
        window.addEventListener("pageshow", self.authResumeHandler, false);
        self.behaviorVisibilityHandler = function () {
            self.DiyCommon.UserBehaviorSignal({
                Action: document.visibilityState === "hidden" ? "PageHidden" : "PageVisible"
            }, document.visibilityState === "hidden");
        };
        self.behaviorPageHideHandler = function () {
            self.DiyCommon.UserBehaviorSignal({ Action: "PageClosed" }, true);
        };
        document.addEventListener("visibilitychange", self.behaviorVisibilityHandler, false);
        window.addEventListener("pagehide", self.behaviorPageHideHandler, false);

        // ===== 5+App 返回键：Vue Router 路由感知处理 =====
        // permission.js 的 router.afterEach 在每次路由完成后设置 window.__microi_isRootPage
        // 这里读取该标志，完全避免 $route.path 的异步时序问题
        ;(function() {
            var isApkEnv = !!(window.plus || navigator.userAgent.indexOf('Html5Plus') > -1);
            if (!isApkEnv) return;
            var _lastBack = 0;
            var _backHandling = false; // 防止连续手势重复触发
            window.__microi_handleBack = function() {
                if (_backHandling) return;
                _backHandling = true;
                setTimeout(function() { _backHandling = false; }, 400);

                // window.__microi_isRootPage 由 router.afterEach 在导航完成后设置
                // 初始值 undefined 视为 false（还在加载中），走 back
                var isRoot = !!window.__microi_isRootPage;
                if (!isRoot) {
                    try { self.$router.back(); } catch(e) { window.history.back(); }
                    return;
                }
                // 在根页面：双击退出
                var now = Date.now();
                if (now - _lastBack < 2000) {
                    try { plus.runtime.quit(); } catch(e) {}
                } else {
                    _lastBack = now;
                    try { plus.nativeUI.toast('再按一次退出应用', { duration: 'short' }); } catch(e) {}
                }
            };
        })();

        self.$nextTick(function () {
            var timer = setInterval(function () {
                try {
                    self.$refs.refDiyChat.InitSignalROnEvent(timer);
                } catch (error) {}
            }, 1000);
            // 保存定时器引用
            self.timers.push(timer);
        });
    },
    beforeUnmount() {
        var self = this;
        // 清理窗口大小监听
        window.removeEventListener('resize', self.WindowResize);
        // 清理所有定时器，防止内存泄漏
        self.timers.forEach(function (timer) {
            clearInterval(timer);
        });
        self.timers = [];
        // 移除 plusready 事件监听器
        if (self.plusreadyHandler) {
            document.removeEventListener("plusready", self.plusreadyHandler, false);
        }
        if (self.authResumeHandler) {
            document.removeEventListener("visibilitychange", self.authResumeHandler, false);
            window.removeEventListener("focus", self.authResumeHandler, false);
            window.removeEventListener("pageshow", self.authResumeHandler, false);
        }
        if (self.behaviorVisibilityHandler) {
            document.removeEventListener("visibilitychange", self.behaviorVisibilityHandler, false);
        }
        if (self.behaviorPageHideHandler) {
            window.removeEventListener("pagehide", self.behaviorPageHideHandler, false);
        }
        // 清理 Android 返回键处理
        window.__microi_handleBack = null;
    },
    methods: {
        // 窗口大小变化处理
        WindowResize() {
            var isPhoneView = window.innerWidth <= 768;
            this.diyStore.setIsPhoneView(isPhoneView);
        },
        // 恢复 MCI 亮/暗模式（localStorage 'mci-theme'）
        restoreMciMode() {
            try {
                var mode = localStorage.getItem('mci-theme');
                if (mode !== 'light' && mode !== 'dark') {
                    mode = 'light';
                }
                // 通过 setThemeMode 应用：暗色时会基于当前主题色生成主题色调暗色调色板
                applyThemeMode(mode);
            } catch (e) {}
        },
        // 初始化主题色的文字颜色变量
        initThemeColorDefaults() {
            // 获取当前计算出的主题色
            const computedStyle = window.getComputedStyle(document.documentElement);
            const primaryColor = computedStyle.getPropertyValue('--color-primary').trim() || '#409eff';

            // 计算亮度
            const brightness = this.getColorBrightness(primaryColor);
            const textColor = brightness > 180 ? '#303133' : '#ffffff';

            // 设置--color-primary-text变量
            document.documentElement.style.setProperty('--color-primary-text', textColor);
        },
        // 计算颜色亮度 (0-255)
        getColorBrightness(color) {
            let r, g, b;
            if (color.startsWith('#')) {
                const hex = color.replace('#', '');
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            } else if (color.startsWith('rgb')) {
                const rgb = color.match(/\d+/g);
                r = parseInt(rgb[0]);
                g = parseInt(rgb[1]);
                b = parseInt(rgb[2]);
            }
            // 使用相对亮度公式计算亮度
            return (r * 299 + g * 587 + b * 114) / 1000;
        },
        GetAppClass: function () {
            var result = "";
            if (this.ShowClassicLeft == 0) {
                result += " ShowClassicLeft0 ";
            }
            if (this.ShowClassicTop == 0) {
                result += " ShowClassicTop0 ";
            }
            return result;
        },
        async RefreshTokenWithLock() {
            var self = this;
            var refresh = async function () {
                // 获得锁后必须重读共享存储；另一个标签页可能已经完成续签。
                var authorization = self.$localStorageManager.get("Token");
                var expires = self.$localStorageManager.get("TokenExpires");
                if (!authorization || !expires || new Date() < new Date(expires)) return false;
                await new Promise(function (resolve) {
                    self.DiyCommon.Post(
                        "/api/SysUser/refreshToken",
                        { authorization: authorization },
                        function (result) {
                            if (!result || result.Code !== 1) {
                                self.DiyCommon.Result(result);
                            }
                            resolve();
                        },
                        function () { resolve(); }
                    );
                });
                return true;
            };

            // Edge/Chrome 支持 Web Locks，同一租户的多个浏览器 Tab 只允许一个执行续签。
            if (navigator.locks && typeof navigator.locks.request === "function") {
                return await navigator.locks.request(
                    "microi-auth-refresh:" + self.DiyCommon.GetOsClient(),
                    refresh
                );
            }
            // 非 Web Locks 环境至少保证当前 Tab 内不会重复续签。
            if (!window.__MicroiRefreshTokenPromise) {
                window.__MicroiRefreshTokenPromise = refresh().finally(function () {
                    window.__MicroiRefreshTokenPromise = null;
                });
            }
            return await window.__MicroiRefreshTokenPromise;
        },
        async PageInit() {
            var self = this;
            // 匿名路由由页面组件自行做静默登录态校验。这里不能调用全局
            // GetCurrentUser，否则无 Token 的公有 OnlyOffice 预览会弹出“请重新登录”。
            if (self.IsAnonymousRoute()) return;
            await self.RefreshTokenWithLock();
            self.GetCurrentUserApp();
            // 保存定时器引用，防止内存泄漏
            var refreshTokenTimer = window.setInterval(self.RefreshToken, 1000 * 60);
            self.timers.push(refreshTokenTimer);
        },
        IsAnonymousRoute() {
            var matched = this.$route && this.$route.matched;
            if (Array.isArray(matched) && matched.some(function (record) {
                return record && record.meta && record.meta.anonymous === true;
            })) return true;
            // App mounted 可能早于 Hash 路由完成首次匹配，使用当前 hash 做启动期兜底。
            var hashPath = typeof window !== "undefined" ? String(window.location.hash || "").split("?")[0] : "";
            return hashPath === "#/online-office" || hashPath === "#/online-office/";
        },
        GetCurrentUserApp() {
            var self = this;
            self.DiyCommon.Get(self.DiyApi.GetCurrentUser(), {}, function (result) {
                if (self.DiyCommon.Result(result)) {
                    // diyStore 在 setup 中已初始化，直接调用
                    if (self.diyStore && typeof self.diyStore.setCurrentUser === 'function') {
                        self.diyStore.setCurrentUser(result.Data);
                    } else {
                        // 备用方案：使用全局的 useDiyStore
                        const { useDiyStore } = require('@/pinia');
                        const pinia = require('@/pinia').default;
                        const store = useDiyStore(pinia);
                        store.setCurrentUser(result.Data);
                    }
                    self.TryConnectWebSocketAfterCurrentUser();
                }
            });
        },
        TryConnectWebSocketAfterCurrentUser() {
            var self = this;
            self.$nextTick(function () {
                if (typeof window.tryConnectWebSocket !== "function") {
                    return;
                }
                setTimeout(function () {
                    window.tryConnectWebSocket();
                }, 500);
            });
        },
        async RefreshToken() {
            var self = this;
            await self.RefreshTokenWithLock();
        },
        SwitchDiyChatShow() {
            var self = this;
            self.diyStore.setDiyChatShow(!self.DiyChatShow);
            if (self.DiyChatShow) {
                // self.$websocket
                //   .invoke("SendLastContacts", {
                //     UserId: self.GetCurrentUser.Id,
                //     ContactUserId: "",
                //     OsClient: self.DiyCommon.GetOsClient()
                //   })
                //   .then((res) => {})
                //   .catch((err) => {
                //     console.log("获取最近联系人列表失败：", err);
                //   });
            }
        }
    }
};
</script>
