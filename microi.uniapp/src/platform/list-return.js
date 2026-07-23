const SNAPSHOT_TTL = 10 * 60 * 1000
let pendingListSnapshot = null

export const listReturnMixin = {
  data() {
    return {
      mciCurrentScrollTop: 0,
      mciSavedScrollTop: 0,
      mciScrollCommand: 0,
      mciDetailReturnPending: false
    }
  },
  onShow() {
    if (!this.mciDetailReturnPending) return
    this.mciDetailReturnPending = false
    pendingListSnapshot = null
    this.$nextTick(() => {
      const target = Math.max(0, Number(this.mciSavedScrollTop || 0))
      this.mciScrollCommand = Math.max(0, target - 1)
      setTimeout(() => {
        this.mciScrollCommand = target
        if (typeof this.onMciListDetailReturned === 'function') this.onMciListDetailReturned(target)
      }, 24)
    })
  },
  methods: {
    handleMciListScroll(event) {
      const top = Number(event && event.detail && event.detail.scrollTop)
      if (Number.isFinite(top)) this.mciCurrentScrollTop = top
    },
    mciMarkDetailReturn() {
      this.mciSavedScrollTop = this.mciCurrentScrollTop
      this.mciDetailReturnPending = true
      if (typeof this.getMciListSnapshotKey === 'function' && typeof this.getMciListSnapshot === 'function') {
        pendingListSnapshot = {
          key: this.getMciListSnapshotKey(),
          createdAt: Date.now(),
          scrollTop: this.mciSavedScrollTop,
          payload: this.getMciListSnapshot()
        }
      }
    },
    mciCancelDetailReturn() {
      this.mciDetailReturnPending = false
      pendingListSnapshot = null
    },
    mciNavigateToDetail(url) {
      this.mciMarkDetailReturn()
      uni.navigateTo({
        url,
        fail: () => this.mciCancelDetailReturn()
      })
    },
    mciResetListPosition() {
      this.mciCurrentScrollTop = 0
      this.mciSavedScrollTop = 0
      this.mciScrollCommand = 0
      this.mciDetailReturnPending = false
      pendingListSnapshot = null
    },
    mciConsumeListSnapshot(key) {
      const snapshot = pendingListSnapshot
      pendingListSnapshot = null
      if (!snapshot || snapshot.key !== key || Date.now() - snapshot.createdAt > SNAPSHOT_TTL) return null
      return snapshot
    },
    mciRestoreListPosition(scrollTop) {
      const target = Math.max(0, Number(scrollTop || 0))
      this.mciCurrentScrollTop = target
      this.mciSavedScrollTop = target
      this.mciScrollCommand = Math.max(0, target - 1)
      this.$nextTick(() => {
        setTimeout(() => { this.mciScrollCommand = target }, 24)
      })
    }
  }
}

export default listReturnMixin
