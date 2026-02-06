// @ts-nocheck
import { h } from 'vue'
import DefaultTheme from "vitepress/theme";
import GlowBackground from "./components/GlowBackground.vue";
import ContactCard from "./components/ContactCard.vue";
import "./styles/index.scss";
import "./styles/home-glow.scss";

export default {
    ...DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'layout-top': () => h(GlowBackground)
        })
    },
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        ctx.app.component('ContactCard', ContactCard);
    }
};
