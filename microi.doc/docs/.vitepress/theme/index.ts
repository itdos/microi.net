// @ts-nocheck
import { h } from 'vue'
import DefaultTheme from "vitepress/theme";
import GlowBackground from "./components/GlowBackground.vue";
import ContactCard from "./components/ContactCard.vue";
import ProductShowcase from "./components/ProductShowcase.vue";
import "./styles/index.scss";
import "./styles/home-glow.scss";

export default {
    ...DefaultTheme,
    Layout: () => {
        return h(DefaultTheme.Layout, null, {
            'layout-top': () => h(GlowBackground),
            'home-features-after': () => h(ProductShowcase)
        })
    },
    enhanceApp(ctx) {
        DefaultTheme.enhanceApp(ctx);
        ctx.app.component('ContactCard', ContactCard);
    }
};
