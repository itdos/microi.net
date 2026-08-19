import {
  readRetainedListSession,
  removeRetainedListSession,
  writeRetainedListSession
} from './list-session.mjs'

const SNAPSHOT_TTL = 10 * 60 * 1000
let pendingListSnapshot = null

export const listReturnMixin = {
  data() {
    return {
      mciCurrentScrollTop: 0,
      mciSavedScrollTop: 0,
      mciScrollCommand: 0,
      mciDetailReturnPending: false,
      mciListDataChangedPending: false,
      mciListDataChangedEvent: null,
      mciListAnchorId: '',
      mciListAnchorOffset: 0,
      mciListAnchorTimer: null
    }
  },
  onLoad() {
    this._mciListDataChangedListener = (event = {}) => {
      if (typeof this.shouldMciRefreshForDataChange === 'function' &&
        !this.shouldMciRefreshForDataChange(event)) return
      this.mciListDataChangedPending = true
      this.mciListDataChangedEvent = event
    }
    uni.$on('microi:data-changed', this._mciListDataChangedListener)
  },
  onShow() {
    const dataChanged = this.mciListDataChangedPending
    const changedEvent = this.mciListDataChangedEvent
    this.mciListDataChangedPending = false
    this.mciListDataChangedEvent = null
    if (dataChanged && typeof this.onMciListDataChanged === 'function') {
      Promise.resolve(this.onMciListDataChanged(changedEvent)).catch(() => {})
    }
    if (this.mciDetailReturnPending) {
      this.mciDetailReturnPending = false
      pendingListSnapshot = null
      this.$nextTick(() => {
        const target = Math.max(0, Number(this.mciSavedScrollTop || 0))
        this.mciScrollCommand = target > 0 ? target - 1 : 1
        setTimeout(() => {
          this.mciScrollCommand = target
          if (typeof this.onMciListDetailReturned === 'function') this.onMciListDetailReturned(target)
        }, 24)
      })
    }
  },
  onHide() {
    if (!this.mciShouldRetainListSession()) return
    this.mciCaptureListAnchor(() => this.mciSaveRetainedListSnapshot())
  },
  onUnload() {
    if (this.mciShouldRetainListSession()) this.mciSaveRetainedListSnapshot()
    if (this.mciListAnchorTimer) {
      clearTimeout(this.mciListAnchorTimer)
      this.mciListAnchorTimer = null
    }
    if (this._mciListDataChangedListener) {
      uni.$off('microi:data-changed', this._mciListDataChangedListener)
      this._mciListDataChangedListener = null
    }
  },
  methods: {
    handleMciListScroll(event) {
      const top = Number(event && event.detail && event.detail.scrollTop)
      if (!Number.isFinite(top)) return
      this.mciCurrentScrollTop = top
      if (!this.mciShouldRetainListSession()) return
      if (this.mciListAnchorTimer) clearTimeout(this.mciListAnchorTimer)
      this.mciListAnchorTimer = setTimeout(() => {
        this.mciListAnchorTimer = null
        this.mciCaptureListAnchor()
      }, 180)
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
      if (this.mciShouldRetainListSession()) {
        this.mciSaveRetainedListSnapshot()
        this.mciCaptureListAnchor(() => this.mciSaveRetainedListSnapshot())
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
    mciResetListPosition(removeRetained = false) {
      this.mciCurrentScrollTop = 0
      this.mciSavedScrollTop = 0
      this.mciScrollCommand = 0
      this.mciListAnchorId = ''
      this.mciListAnchorOffset = 0
      this.mciDetailReturnPending = false
      pendingListSnapshot = null
      if (removeRetained) this.mciRemoveRetainedListSnapshot()
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
      this.mciScrollCommand = target > 0 ? target - 1 : 1
      this.$nextTick(() => {
        setTimeout(() => { this.mciScrollCommand = target }, 24)
      })
    },
    mciShouldRetainListSession() {
      return typeof this.shouldMciRetainListSession === 'function' && this.shouldMciRetainListSession() === true
    },
    mciListSnapshotKey() {
      if (typeof this.getMciListSnapshotKey !== 'function') return ''
      return String(this.getMciListSnapshotKey() || '').trim()
    },
    mciSaveRetainedListSnapshot() {
      if (!this.mciShouldRetainListSession() || typeof this.getMciListSnapshot !== 'function') return null
      const key = this.mciListSnapshotKey()
      if (!key) return null
      return writeRetainedListSession(key, {
        scrollTop: Math.max(0, Number(this.mciCurrentScrollTop || 0)),
        anchor: {
          id: String(this.mciListAnchorId || ''),
          offset: Number(this.mciListAnchorOffset || 0)
        },
        payload: this.getMciListSnapshot()
      })
    },
    mciReadRetainedListSnapshot(key = '') {
      return readRetainedListSession(key || this.mciListSnapshotKey())
    },
    mciRemoveRetainedListSnapshot(key = '') {
      removeRetainedListSession(key || this.mciListSnapshotKey())
    },
    mciCaptureListAnchor(done) {
      const finish = typeof done === 'function' ? done : () => {}
      if (typeof this.getMciListAnchorConfig !== 'function' || typeof uni === 'undefined' || !uni.createSelectorQuery) {
        finish()
        return
      }
      const config = this.getMciListAnchorConfig() || {}
      if (!config.container || !config.items) {
        finish()
        return
      }
      try {
        const query = uni.createSelectorQuery().in(this)
        query.select(config.container).boundingClientRect()
        query.selectAll(config.items).boundingClientRect()
        query.exec((results = []) => {
          const container = results[0]
          const items = Array.isArray(results[1]) ? results[1] : []
          if (container && items.length) {
            const visible = items.find((item) => item && item.bottom > container.top + 1 && item.top < container.bottom)
            if (visible && visible.id) {
              this.mciListAnchorId = String(visible.id)
              this.mciListAnchorOffset = Number(visible.top - container.top)
            }
          }
          finish()
        })
      } catch (error) {
        finish()
      }
    },
    mciApplyListSnapshotPosition(snapshot = {}) {
      const scrollTop = Math.max(0, Number(snapshot.scrollTop || 0))
      const anchor = snapshot.anchor || {}
      this.mciListAnchorId = String(anchor.id || '')
      this.mciListAnchorOffset = Number(anchor.offset || 0)
      this.mciRestoreListPosition(scrollTop)
      this.mciRestoreListAnchor(anchor, scrollTop)
    },
    mciRestoreListAnchor(anchor = {}, fallbackScrollTop = 0) {
      const id = String(anchor.id || '').trim()
      const desiredOffset = Number(anchor.offset || 0)
      if (!id || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id) || typeof this.getMciListAnchorConfig !== 'function') return
      const config = this.getMciListAnchorConfig() || {}
      if (!config.container || typeof uni === 'undefined' || !uni.createSelectorQuery) return
      this.$nextTick(() => {
        setTimeout(() => {
          try {
            const query = uni.createSelectorQuery().in(this)
            query.select(config.container).boundingClientRect()
            query.select(`#${id}`).boundingClientRect()
            query.exec((results = []) => {
              const container = results[0]
              const item = results[1]
              if (!container || !item) return
              const baseTop = Math.max(0, Number(this.mciCurrentScrollTop || fallbackScrollTop || 0))
              const target = Math.max(0, baseTop + Number(item.top - container.top) - desiredOffset)
              this.mciRestoreListPosition(target)
            })
          } catch (error) {}
        }, 48)
      })
    }
  }
}

export default listReturnMixin
