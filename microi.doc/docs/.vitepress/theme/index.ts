// @ts-nocheck
import { h, Fragment } from 'vue'
import DefaultTheme from "vitepress/theme";
import GlowBackground from "./components/GlowBackground.vue";
import Hero3DBackground from "./components/Hero3DBackground.vue";
import HeroTitle3D from "./components/HeroTitle3D.vue";
import ContactCard from "./components/ContactCard.vue";
import ProductShowcase from "./components/ProductShowcase.vue";
import AiChat from "./components/AiChat.vue";
import UserBar from "./components/UserBar.vue";
import LoginPage from "./components/LoginPage.vue";
import "./styles/index.scss";
import "./styles/home-glow.scss";
import "./styles/mci-site.scss";

export default {
    ...DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'layout-top': () => h(Fragment, null, [h(GlowBackground), h(Hero3DBackground), h(HeroTitle3D)]),
            'home-features-after': () => h(Fragment, null, [h(AiChat), h(ProductShowcase)]),
            'nav-bar-content-after': () => h(UserBar)
        })
    },
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        ctx.app.component('ContactCard', ContactCard);
        ctx.app.component('LoginPage', LoginPage);
    }
};
