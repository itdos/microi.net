import { onMounted, onUnmounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { SITE_URL } from '../config/seo-policy.mjs'

// VitePress 的 transformHead 不随客户端路由重新执行，必须同步页面专属标签。
// 只管理本模块标记的标签，不删除站点验证、统计或用户添加的其它 head 内容。
export function usePageSeo() {
  const { page } = useData()
  const route = useRoute()
  let stop
  onMounted(() => {
    stop = watch([() => page.value, () => route.path], () => {
      const tags = page.value.mciSeoHead || (page.value.isNotFound ? [
        ['meta', { name: 'robots', content: 'noindex, follow' }],
        ['link', { rel: 'canonical', href: `${SITE_URL}/404.html` }]
      ] : null)
      if (!tags) return
      document.head.querySelectorAll('[data-mci-seo]').forEach(node => node.remove())
      for (const [tag, attributes, content] of tags) {
        const node = document.createElement(tag)
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
        node.setAttribute('data-mci-seo', '')
        if (content !== undefined) node.textContent = content
        document.head.appendChild(node)
      }
    }, { immediate: true, flush: 'post' })
  })
  onUnmounted(() => stop?.())
}
