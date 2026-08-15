<template>
  <div class="go-loading-skeleton" role="status" aria-label="内容加载中">
    <span v-for="index in 6" :key="index"></span>
  </div>
</template>
<style lang="scss" scoped>
@include go('loading-skeleton') {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 18px;
  background: var(--mci-skeleton-surface, var(--el-bg-color, #fff));
  span {
    min-height: 74px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--mci-skeleton-base, var(--el-fill-color-light)) 18%, var(--mci-skeleton-highlight, var(--el-fill-color-lighter)) 48%, var(--mci-skeleton-base, var(--el-fill-color-light)) 78%);
    background-size: 240% 100%;
    animation: goSkeletonShimmer 1.18s ease-in-out infinite;
  }
}

@keyframes goSkeletonShimmer {
  from { background-position: 110% 0; }
  to { background-position: -110% 0; }
}

@media (prefers-reduced-motion: reduce) {
  @include go('loading-skeleton') {
    span { animation: none; }
  }
}
</style>
