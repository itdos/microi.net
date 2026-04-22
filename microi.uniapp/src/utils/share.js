export default {
  onShareAppMessage() {
    try {
      const title = (this && (this.title || this.pageTitle)) || (this && this.$route && this.$route.meta && this.$route.meta.title) || '微应用分享'
      let path = '/pages/index/index'
      let query = ''
      if (typeof getCurrentPages === 'function') {
        const pages = getCurrentPages()
        if (pages && pages.length) {
          const current = pages[pages.length - 1]
          if (current && current.route) path = '/' + current.route
          if (current && current.options) {
            const opts = current.options
            query = Object.keys(opts).map(k => `${k}=${opts[k]}`).join('&')
          }
        }
      } else if (this && this.$route && this.$route.path) {
        path = this.$route.path
        if (this.$route.query) query = Object.keys(this.$route.query).map(k => `${k}=${this.$route.query[k]}`).join('&')
      }
      if (query) path += (path.indexOf('?') === -1 ? '?' : '&') + query
      return { title, path, imageUrl: '' }
    } catch (e) {
      return { title: '微应用分享', path: '/pages/index/index', imageUrl: '' }
    }
  },
  onShareTimeline() {
    try {
      const title = (this && (this.title || this.pageTitle)) || (this && this.$route && this.$route.meta && this.$route.meta.title) || '微应用分享'
      let query = ''
      if (typeof getCurrentPages === 'function') {
        const pages = getCurrentPages()
        if (pages && pages.length) {
          const current = pages[pages.length - 1]
          if (current && current.options) {
            const opts = current.options
            query = Object.keys(opts).map(k => `${k}=${opts[k]}`).join('&')
          }
        }
      }
      return { title, query, imageUrl: '' }
    } catch (e) {
      return { title: '微应用分享', query: '', imageUrl: '' }
    }
  }
}
