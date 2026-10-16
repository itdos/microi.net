<template>
    <main class="mci-login-layout mci-login-layout--original"><slot /></main>
</template>

<script>
export default { props: { title: String, subtitle: String } };
</script>

<style scoped>
.mci-login-layout--original { position: absolute; inset: 0; }
</style>
