<template>
    <main class="mci-login-layout mci-login-layout--split">
        <aside class="mci-login-split-story" aria-hidden="true">
            <span class="mci-login-split-label">YOUR WORKSPACE</span>
            <div class="mci-login-split-copy"><h1>{{ title }}</h1><p>{{ subtitle || $t('Msg.FrameworkAppearance.splitTagline') }}</p></div>
            <svg class="mci-login-split-object" viewBox="0 0 540 360" fill="none">
                <rect x="82" y="36" width="344" height="234" rx="14" />
                <path d="M82 82H426M114 59H120M135 59H141M156 59H162M113 113H202M113 137H178M113 161H193" />
                <rect x="225" y="112" width="169" height="126" rx="6" />
                <rect x="136" y="204" width="162" height="114" rx="10" />
                <path d="M159 233H231M159 253H272M159 273H247" />
            </svg>
            <span class="mci-login-split-footnote">{{ $t('Msg.FrameworkAppearance.splitFootnote') }}</span>
        </aside>
        <section class="mci-login-layout__content"><slot /></section>
    </main>
</template>

<script>
export default { props: { title: String, subtitle: String } };
</script>

<style scoped>
.mci-login-layout--split { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr); position: relative; z-index: 3; }
.mci-login-split-story { min-height: 100dvh; position: relative; padding: clamp(36px, 5vw, 100px); box-sizing: border-box; overflow: hidden; background: var(--mci-login-primary-strong); color: var(--mci-login-on-primary); display: flex; flex-direction: column; justify-content: center; text-align: left; }
.mci-login-split-label { font-size: 11px; letter-spacing: .22em; opacity: .8; }
.mci-login-split-copy { position: relative; z-index: 1; }
.mci-login-split-copy h1 { font-size: clamp(34px, 3.8vw, 64px); font-weight: 650; line-height: 1.18; letter-spacing: -.03em; margin: 24px 0; overflow-wrap: anywhere; }
.mci-login-split-copy p { font-size: 16px; opacity: .88; line-height: 1.8; margin: 0; }
.mci-login-split-object { width: min(100%, 540px); margin-top: 32px; stroke: currentColor; stroke-width: 1.5; }
.mci-login-split-object rect { fill: color-mix(in srgb, currentColor 6%, transparent); }
.mci-login-split-footnote { font-size: 12px; opacity: .8; margin-top: 20px; }
.mci-login-layout__content { display: grid; place-items: center; padding: 64px 36px 96px; box-sizing: border-box; }
@media(max-width: 1000px) { .mci-login-layout--split { grid-template-columns: minmax(0, .8fr) minmax(400px, 1fr); } .mci-login-split-story { padding: 36px; } .mci-login-layout__content { padding-inline: 24px; } }
@media(max-width: 760px) { .mci-login-layout--split { grid-template-columns: 1fr; } .mci-login-split-story { min-height: 176px; padding: 24px; justify-content: flex-start; } .mci-login-split-copy h1 { font-size: 28px; margin: 14px 0 8px; } .mci-login-split-copy p { font-size: 13px; } .mci-login-split-object, .mci-login-split-footnote { display: none; } .mci-login-layout__content { padding: 32px 20px 92px; align-content: start; } }
</style>
