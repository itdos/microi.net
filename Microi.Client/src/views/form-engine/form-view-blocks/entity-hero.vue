<template>
    <header class="mci-entity-hero" :style="backgroundStyle">
        <div class="mci-entity-hero__shade"></div>
        <div class="mci-entity-hero__identity">
            <div class="mci-entity-hero__avatar">
                <img v-if="image && !imageFailed" :src="image" alt="" @error="imageFailed = true" />
                <span v-else-if="initial" class="mci-entity-hero__initial">{{ initial }}</span>
                <fa-icon v-else :icon="icon || 'far fa-file-alt'" />
            </div>
            <div class="mci-entity-hero__headline">
                <div class="mci-entity-hero__title">{{ title }}</div>
                <div v-if="meta" class="mci-entity-hero__meta">{{ meta }}</div>
            </div>
            <span v-if="status" class="mci-entity-hero__status">{{ status }}</span>
        </div>
        <MetricStrip v-if="metrics.length" class="mci-entity-hero__metrics" :items="metrics" />
    </header>
</template>

<script>
import MetricStrip from "./metric-strip.vue";

export default {
    name: "EntityHero",
    components: { MetricStrip },
    props: {
        title: { type: String, default: "" },
        meta: { type: String, default: "" },
        status: { type: String, default: "" },
        image: { type: String, default: "" },
        icon: { type: String, default: "" },
        background: { type: String, default: "" },
        metrics: { type: Array, default: () => [] }
    },
    data() {
        return { imageFailed: false };
    },
    computed: {
        initial() {
            return Array.from(String(this.title || "").trim())[0] || "";
        },
        backgroundStyle() {
            const value = String(this.background || "").trim();
            if (!value) return {};
            if (/^(#|rgb|linear-gradient|radial-gradient)/i.test(value)) {
                return { background: value };
            }
            return { backgroundImage: `url("${value}")` };
        }
    },
    watch: {
        image() {
            this.imageFailed = false;
        }
    }
};
</script>

<style scoped>
.mci-entity-hero {
    position: relative;
    min-height: 164px;
    padding: 22px 28px 20px;
    overflow: hidden;
    color: #fff;
    background-color: #075b78;
    background-image: linear-gradient(115deg, #064c67 0%, #08718a 58%, #128f91 100%);
    background-position: center;
    background-size: cover;
}

.mci-entity-hero__shade {
    position: absolute;
    inset: 0;
    background:
        linear-gradient(90deg, rgba(1, 35, 53, .9) 0%, rgba(3, 68, 83, .62) 55%, rgba(4, 71, 85, .38) 100%),
        linear-gradient(180deg, rgba(255, 255, 255, .04), rgba(0, 25, 40, .12));
}

.mci-entity-hero__identity,
.mci-entity-hero__metrics {
    position: relative;
    z-index: 1;
}

.mci-entity-hero__identity {
    display: flex;
    align-items: center;
    gap: 16px;
}

.mci-entity-hero__avatar {
    display: grid;
    place-items: center;
    flex: 0 0 64px;
    width: 64px;
    height: 64px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, .45);
    border-radius: 8px;
    background: rgba(255, 255, 255, .94);
    box-shadow: 0 8px 24px rgba(0, 23, 36, .2);
    color: #08718a;
    font-size: 26px;
}

.mci-entity-hero__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.mci-entity-hero__initial {
    font-size: 25px;
    font-weight: 700;
}

.mci-entity-hero__headline {
    min-width: 0;
    flex: 1;
}

.mci-entity-hero__title {
    overflow: hidden;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mci-entity-hero__meta {
    margin-top: 5px;
    overflow: hidden;
    color: rgba(255, 255, 255, .76);
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mci-entity-hero__status {
    align-self: flex-start;
    padding: 6px 11px;
    border: 1px solid rgba(255, 255, 255, .32);
    border-radius: 6px;
    background: rgba(255, 255, 255, .16);
    box-shadow: 0 4px 12px rgba(0, 30, 44, .12);
    font-size: 13px;
    white-space: nowrap;
}

.mci-entity-hero__metrics {
    margin-top: 18px;
}

@media (max-width: 720px) {
    .mci-entity-hero {
        min-height: 164px;
        padding: 22px 18px;
    }

    .mci-entity-hero__title {
        font-size: 20px;
    }
}
</style>
