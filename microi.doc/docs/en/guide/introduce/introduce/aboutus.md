---
layout: page
---
<script setup>
import {
VPTeamPage
VPTeamPageTitle
VPTeamMembers
} from 'vitepress/theme'

const members = [
{
avatar: '/icon.png ',
name: 'Microi my code ',
Title: 'Open Source Low Code-Create Open Source Ecosy ',
// links: [
// { icon: 'github', link: 'https://github.com/yyx990803'}
// { icon: 'twitter', link: 'https://twitter.com/youyuxi'}
//]
},
]
</script>

<VPTeamPage>
<VPTeamPageTitle>
<template #title>
About Us
</template>
<template #lead>
Xiao Wu Technology is a brand of Ningbo Xiao Wu Technology Co., Ltd. Focus on large-scale Internet applications, custom software development, intelligent hardware, cross-industry general software products.
</template>
</VPTeamPageTitle>
<VPTeamMembers
:members="members"
/>
</VPTeamPage>