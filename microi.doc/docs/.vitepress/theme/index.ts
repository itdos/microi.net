// @ts-nocheck
import { h, Fragment } from 'vue'
import DefaultTheme from "vitepress/theme";
import GlowBackground from "./components/GlowBackground.vue";
import Hero3DBackground from "./components/Hero3DBackground.vue";
import HeroTitle3D from "./components/HeroTitle3D.vue";
import ContactCard from "./components/ContactCard.vue";
import ProductShowcase from "./components/ProductShowcase.vue";
import UserBar from "./components/UserBar.vue";
import LoginPage from "./components/LoginPage.vue";
import ProfilePage from "./components/ProfilePage.vue";
import ProfileLocaleSwitch from "./components/ProfileLocaleSwitch.vue";
import SiteStyleSwitch from "./components/SiteStyleSwitch.vue";
import MainstreamHomeBand from "./components/MainstreamHomeBand.vue";
import { initSiteStyle } from "./site-style";
import "./styles/index.scss";
import "./styles/home-glow.scss";
import "./styles/mci-site.scss";
import "./styles/mainstream.scss";

export default {
    ...DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'layout-top': () => h(Fragment, null, [h(GlowBackground), h(Hero3DBackground), h(HeroTitle3D), h(SiteStyleSwitch, { floating: true })]),
            'home-hero-after': () => h(MainstreamHomeBand),
            'home-features-after': () => h(ProductShowcase),
            'nav-bar-content-after': () => h(Fragment, null, [h(ProfileLocaleSwitch), h(SiteStyleSwitch), h(UserBar)])
        })
    },
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        initSiteStyle();
        ctx.app.component('ContactCard', ContactCard);
        ctx.app.component('LoginPage', LoginPage);
        ctx.app.component('ProfilePage', ProfilePage);
    }
};
