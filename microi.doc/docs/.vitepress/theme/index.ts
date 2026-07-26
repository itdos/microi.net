// @ts-nocheck
import { h, Fragment } from 'vue'
import DefaultTheme from "vitepress/theme";
import ContactCard from "./components/ContactCard.vue";
import ProductShowcase from "./components/ProductShowcase.vue";
import AiStudioHome from "./components/AiStudioHome.vue";
import AppDetail from "./components/AppDetail.vue";
import UserBar from "./components/UserBar.vue";
import LoginPage from "./components/LoginPage.vue";
import ProfilePage from "./components/ProfilePage.vue";
import ProfileLocaleSwitch from "./components/ProfileLocaleSwitch.vue";
import "./styles/index.scss";
import "./styles/home-glow.scss";
import "./styles/mci-site.scss";
import "./styles/mainstream.scss";
import "./styles/ai-studio-home.scss";

export default {
    ...DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'nav-bar-content-after': () => h(Fragment, null, [h(ProfileLocaleSwitch), h(UserBar)])
        })
    },
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        ctx.app.component('ContactCard', ContactCard);
        ctx.app.component('LoginPage', LoginPage);
        ctx.app.component('ProfilePage', ProfilePage);
        ctx.app.component('AiStudioHome', AiStudioHome);
        ctx.app.component('ProductShowcase', ProductShowcase);
        ctx.app.component('AppDetail', AppDetail);
    }
};
