---
Layout: page
---
<Scriptセットアップ>
インポート {
Vp teampage,
Vp teampagetitle,
Vp teammembers
} From 'vitepress/ed'

Const members = [
{
Avatar: '/icon.png',
Name: 「microi吾コード」
Title: 「オープンソース低コード-オープンソース生態」
// Links: [
// {Icon: 'github', link: 'https:// github.com/yyx990803' },
// {Icon: 'twitter '、link: 'https:// twitter _ youyuxi'}
//]
},
]
</Script>

<Vp teampage>
<Vp teampagetitle>
<Template # title>
私たちについて
</Template>
<Template # lead>
小吾科技は寧波小吾科技有限公司のブランドです。大規模なインターネットアプリケーション、カスタムソフトウェア開発、スマートハードウェア、業界を越えた汎用ソフトウェア製品に集中する。
</Template>
</Vp teampagetitle>
<Vp teammembers
: Members = "members"
/>
</Vp teampage>