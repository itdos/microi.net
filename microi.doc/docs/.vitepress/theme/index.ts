// @ts-nocheck
import { defineComponent, h, Fragment, nextTick, provide } from 'vue'
import { useData, useRoute } from 'vitepress'
import DefaultTheme from "vitepress/theme";
import ContactCard from "./components/ContactCard.vue";
import ProductShowcase from "./components/ProductShowcase.vue";
import AiStudioHome from "./components/AiStudioHome.vue";
import AppDetail from "./components/AppDetail.vue";
import UserBar from "./components/UserBar.vue";
import LoginPage from "./components/LoginPage.vue";
import ProfilePage from "./components/ProfilePage.vue";
import ProfileLocaleSwitch from "./components/ProfileLocaleSwitch.vue";
import MciNugetStats from "./components/MciNugetStats.vue";
import { getDocVisualProfile } from './doc-visual-profiles.js';
import "./styles/index.scss";
import "./styles/home-glow.scss";
import "./styles/mci-site.scss";
import "./styles/doc-readable.scss";
import "./styles/mainstream.scss";
import "./styles/ai-studio-home.scss";
import "./styles/edition-comparison.scss";
import "./styles/nuget-downloads.scss";
import "./styles/micro-app.scss";
import "./styles/file-manage.scss";
import "./styles/unity-integration.scss";

const APPEARANCE_KEY = 'vitepress-theme-appearance'

function persistExplicitAppearance(isDark: boolean) {
    if (typeof window === 'undefined') return
    const value = isDark ? 'dark' : 'light'
    try {
        const oldValue = window.localStorage.getItem(APPEARANCE_KEY)
        window.localStorage.setItem(APPEARANCE_KEY, value)
        window.dispatchEvent(new StorageEvent('storage', {
            key: APPEARANCE_KEY,
            oldValue,
            newValue: value,
            storageArea: window.localStorage,
            url: window.location.href
        }))
    } catch {
        // Storage can be unavailable in hardened/private browser contexts.
    }
}

const MicroiLayout = defineComponent({
    name: 'MicroiLayout',
    setup() {
        const { isDark } = useData()
        const route = useRoute()

        // VitePress/VueUse otherwise stores `auto` when the chosen appearance
        // happens to match the operating system. The site exposes only two
        // choices, so persist the user's click as an explicit light/dark choice.
        provide('toggle-appearance', () => {
            const nextIsDark = !isDark.value
            isDark.value = nextIsDark
            nextTick(() => persistExplicitAppearance(nextIsDark))
        })

        return () => {
            const visualProfile = getDocVisualProfile(route.path || '')
            const layoutClass = visualProfile
                ? `mci-doc-profile mci-doc-profile--${visualProfile}`
                : undefined

            return h(DefaultTheme.Layout, { class: layoutClass }, {
                'nav-bar-content-after': () => h(Fragment, null, [h(ProfileLocaleSwitch), h(UserBar)]),
                'sidebar-nav-after': () => /^(?:\/en)?\/doc\//.test(route.path || '')
                    ? h(MciNugetStats, { variant: 'sidebar' })
                    : null
            })
        }
    }
})

export default {
    ...DefaultTheme,
    Layout: MicroiLayout,
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        ctx.app.component('ContactCard', ContactCard);
        ctx.app.component('LoginPage', LoginPage);
        ctx.app.component('ProfilePage', ProfilePage);
        ctx.app.component('AiStudioHome', AiStudioHome);
        ctx.app.component('ProductShowcase', ProductShowcase);
        ctx.app.component('AppDetail', AppDetail);
        ctx.app.component('MciNugetStats', MciNugetStats);
    }
};
