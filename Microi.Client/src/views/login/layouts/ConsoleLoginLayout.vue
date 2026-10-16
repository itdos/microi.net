<template>
    <main class="mci-login-layout mci-login-layout--console">
        <div class="mci-login-console-grid" aria-hidden="true" />
        <aside class="mci-login-console-intro" aria-hidden="true">
            <div class="mci-login-console-eyebrow"><span /> WORKSPACE / ACCESS</div>
            <h1>{{ $t('Msg.FrameworkAppearance.consoleTitleFirst') }}<br />{{ $t('Msg.FrameworkAppearance.consoleTitleLast') }}</h1>
            <p>{{ subtitle || title || $t('Msg.FrameworkAppearance.consoleTagline') }}</p>
            <div class="mci-login-console-diagram">
                <span class="mci-login-console-node">{{ $t('Msg.FrameworkAppearance.workbench') }}</span><i /><span class="mci-login-console-node">{{ $t('Msg.FrameworkAppearance.applications') }}</span><i /><span class="mci-login-console-node">{{ $t('Msg.FrameworkAppearance.collaboration') }}</span>
            </div>
        </aside>
        <section class="mci-login-layout__content"><div class="mci-login-console-bar" aria-hidden="true"><i /><i /><i /><span>ACCESS</span></div><slot /></section>
    </main>
</template>

<script>
export default { props: { title: String, subtitle: String } };
</script>

<style scoped>
.mci-login-layout--console { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(400px, 540px); align-items: center; gap: clamp(40px, 8vw, 160px); padding: 80px max(5vw, 24px) 100px; box-sizing: border-box; position: relative; z-index: 3; color: var(--mci-login-text-strong); }
.mci-login-console-grid { position: absolute; inset: 0; pointer-events: none; opacity: .14; background-image: linear-gradient(var(--mci-login-primary-light) 1px, transparent 1px), linear-gradient(90deg, var(--mci-login-primary-light) 1px, transparent 1px); background-size: 64px 64px; }
.mci-login-console-intro, .mci-login-layout__content { position: relative; z-index: 1; }
.mci-login-console-intro { max-width: 680px; justify-self: end; text-align: left; }
.mci-login-console-eyebrow { font: 11px/1.4 ui-monospace, monospace; letter-spacing: .14em; color: var(--mci-login-primary-light); display: flex; align-items: center; gap: 12px; }
.mci-login-console-eyebrow > span { width: 8px; height: 8px; background: currentColor; border-radius: 2px; }
.mci-login-console-intro h1 { font-size: clamp(38px, 4.5vw, 72px); line-height: 1.2; letter-spacing: -.04em; margin: 28px 0; font-weight: 650; }
.mci-login-console-intro p { font-size: 15px; line-height: 1.8; opacity: .7; }
.mci-login-console-diagram { display: flex; align-items: center; margin-top: 64px; }
.mci-login-console-node { border: 1px solid color-mix(in srgb, var(--mci-login-primary-light) 40%, transparent); padding: 14px 18px; font-size: 12px; border-radius: 4px; }
.mci-login-console-diagram > i { height: 1px; width: 32px; background: var(--mci-login-primary-light); opacity: .4; }
.mci-login-layout__content { min-width: 0; box-sizing: border-box; border: 1px solid color-mix(in srgb, var(--mci-login-primary-light) 28%, transparent); border-radius: var(--mci-login-card-radius); background: var(--mci-login-card-surface); overflow: hidden; }
.mci-login-console-bar { height: 42px; display: flex; align-items: center; gap: 7px; padding: 0 22px; border-bottom: 1px solid color-mix(in srgb, var(--mci-login-primary-light) 18%, transparent); }
.mci-login-console-bar i { width: 6px; height: 6px; border: 1px solid var(--mci-login-primary-light); border-radius: 50%; opacity: .65; }
.mci-login-console-bar span { margin-left: auto; font: 9px/1 ui-monospace, monospace; letter-spacing: .18em; opacity: .6; }
@media(min-width: 1800px) { .mci-login-layout--console { grid-template-columns: minmax(0, 1fr) 600px minmax(0, .15fr); } }
@media(max-width: 900px) { .mci-login-layout--console { grid-template-columns: 1fr; gap: 30px; padding: 40px 24px 96px; } .mci-login-console-intro { justify-self: center; width: min(100%, 520px); } .mci-login-console-intro h1 { font-size: 34px; margin: 20px 0 12px; } .mci-login-console-diagram { display: none; } .mci-login-layout__content { width: min(100%, 520px); justify-self: center; } }
@media(max-width: 600px) { .mci-login-layout--console { padding: 28px 14px 92px; gap: 22px; } .mci-login-console-intro { padding: 0 10px; box-sizing: border-box; } .mci-login-console-intro h1 { font-size: 28px; margin-top: 16px; } .mci-login-console-intro p { margin-bottom: 0; font-size: 12px; } }
</style>
