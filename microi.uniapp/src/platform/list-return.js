const SNAPSHOT_TTL = 10 * 60 * 1000
let pendingListSnapshot = null

export const listReturnMixin = {
  data() {
    return {
      xjyCurrentScrollTop: 0,
      xjySavedScrollTop: 0,
      xjyScrollCommand: 0,
      xjyDetailReturnPending: false
    }
  },
  onShow() {
    if (!this.xjyDetailReturnPending) return
    this.xjyDetailReturnPending = false
    pendingListSnapshot = null
    this.$nextTick(() => {
      const target = Math.max(0, Number(this.xjySavedScrollTop || 0))
      this.xjyScrollCommand = Math.max(0, target - 1)
      setTimeout(() => {
        this.xjyScrollCommand = target
        if (typeof this.onXjyListDetailReturned === 'function') this.onXjyListDetailReturned(target)
      }, 24)
    })
  },
  methods: {
    handleXjyListScroll(event) {
      const top = Number(event && event.detail && event.detail.scrollTop)
      if (Number.isFinite(top)) this.xjyCurrentScrollTop = top
    },
    xjyMarkDetailReturn() {
      this.xjySavedScrollTop = this.xjyCurrentScrollTop
      this.xjyDetailReturnPending = true
      if (typeof this.getXjyListSnapshotKey === 'function' && typeof this.getXjyListSnapshot === 'function') {
        pendingListSnapshot = {
          key: this.getXjyListSnapshotKey(),
          createdAt: Date.now(),
          scrollTop: this.xjySavedScrollTop,
          payload: this.getXjyListSnapshot()
        }
      }
    },
    xjyCancelDetailReturn() {
      this.xjyDetailReturnPending = false
      pendingListSnapshot = null
    },
    xjyNavigateToDetail(url) {
      this.xjyMarkDetailReturn()
      uni.navigateTo({
        url,
        fail: () => this.xjyCancelDetailReturn()
      })
    },
    xjyResetListPosition() {
      this.xjyCurrentScrollTop = 0
      this.xjySavedScrollTop = 0
      this.xjyScrollCommand = 0
      this.xjyDetailReturnPending = false
      pendingListSnapshot = null
    },
    xjyConsumeListSnapshot(key) {
      const snapshot = pendingListSnapshot
      pendingListSnapshot = null
      if (!snapshot || snapshot.key !== key || Date.now() - snapshot.createdAt > SNAPSHOT_TTL) return null
      return snapshot
    },
    xjyRestoreListPosition(scrollTop) {
      const target = Math.max(0, Number(scrollTop || 0))
      this.xjyCurrentScrollTop = target
      this.xjySavedScrollTop = target
      this.xjyScrollCommand = Math.max(0, target - 1)
      this.$nextTick(() => {
        setTimeout(() => { this.xjyScrollCommand = target }, 24)
      })
    }
  }
}

export default listReturnMixin
