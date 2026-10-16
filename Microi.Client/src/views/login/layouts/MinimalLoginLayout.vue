<template>
    <main class="mci-login-layout mci-login-layout--minimal">
        <div class="mci-login-minimal-mark" aria-hidden="true"><span /> <span /></div>
        <section class="mci-login-layout__content"><slot /></section>
        <div class="mci-login-minimal-signature" aria-hidden="true">WORK, SIMPLY.</div>
    </main>
</template>

<script>
export default { props: { title: String, subtitle: String } };
</script>

<style scoped>
.mci-login-layout--minimal { min-height: 100dvh; display: grid; place-items: center; padding: 48px 24px 100px; box-sizing: border-box; position: relative; z-index: 3; }
.mci-login-layout__content { width: min(100%, 520px); }
.mci-login-minimal-mark { position: absolute; inset: 32px auto auto 36px; display: flex; gap: 6px; transform: rotate(-12deg); }
.mci-login-minimal-mark span { width: 11px; height: 28px; background: var(--mci-login-primary); border-radius: 3px; }
.mci-login-minimal-mark span + span { height: 18px; margin-top: 10px; opacity: .45; }
.mci-login-minimal-signature { position: absolute; right: 36px; bottom: 36px; letter-spacing: .2em; font-size: 10px; color: var(--mci-login-input-placeholder); }
@media(max-width: 600px) { .mci-login-layout--minimal { padding: 64px 18px 92px; } .mci-login-minimal-mark { top: 22px; left: 24px; } .mci-login-minimal-signature { right: 24px; bottom: 26px; } }
</style>
