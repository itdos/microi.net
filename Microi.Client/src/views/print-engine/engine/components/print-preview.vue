<template>
  <div class="mpe-preview-wrapper">
    <div class="mpe-modal" v-if="show">
      <div class="mpe-wrap" @click="close">
        <div class="mpe-box" @click.stop="">
          <div class="mpe-modal-box__header">
            <span class="mpe-modal-title">打印预览</span>
            <button class="mpe-modal-close" @click="close">&times;</button>
          </div>
          <div class="mpe-preview-body">
            <div class="mpe-preview-container" ref="previewContainer"></div>
          </div>
          <div class="mpe-modal-box__footer">
            <el-button type="primary" @click="close">关闭预览</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="print-preview">
import { ref, nextTick } from 'vue'
import $ from 'jquery'
const show = ref(false)
const previewContainer = ref(null)
const close = () => {
  show.value = false
}
const showModal = (html) => {
  show.value = true
  // 使用 nextTick 确保 DOM 已更新（v-if="show" 生效后），再填充 HTML
  nextTick(() => {
    if (previewContainer.value) {
      $(previewContainer.value).html(html)
    }
  })
}

defineExpose({
  showModal,
})
</script>

<style lang="scss" scoped>
$primary: #667eea;
$primary-dark: #764ba2;

.mpe-preview-wrapper {
  /* 不同模板 间隙 */
  .mpe-preview-container :deep(.hiprint-printTemplate) {
    background: #fff;
    border-bottom: 10px solid #e2e8f0;
    border-radius: 2px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }
  /* 批量打印 间隙 */
  .mpe-preview-container :deep(.hiprint-printTemplate .hiprint-printPanel:not(:last-of-type)) {
    border-bottom: 5px solid #e2e8f0;
  }

  .mpe-preview-body {
    background: #e2e8f0;
    padding: 20px;
    display: flex;
    justify-content: center;
    max-height: 72vh;
    overflow: auto;
  }

  /* modal */
  .mpe-modal {
    padding: 0;
    margin: 0;
  }
  .mpe-modal .mpe-wrap {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1000;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    outline: 0;
    animation: mpe-fade-in 0.2s ease;
  }
  @keyframes mpe-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .mpe-modal .mpe-wrap .mpe-box {
    position: relative;
    margin: 40px auto;
    width: 85%;
    max-width: 1200px;
    background: #fff;
    border-radius: 12px;
    z-index: 1001;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    animation: mpe-slide-up 0.3s ease;
  }
  @keyframes mpe-slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .mpe-modal-box__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    background: linear-gradient(135deg, #1a1c2e 0%, #2d3250 100%);
  }
  .mpe-modal-title {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.5px;
  }
  .mpe-modal-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 22px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.2s;
    &:hover { color: #fff; }
  }
  .mpe-modal-box__footer {
    text-align: end;
    padding: 12px 20px;
    border-top: 1px solid #e2e8f0;
    background: #fafafa;
  }
  .mpe-modal-box__footer button {
    min-width: 100px;
  }
}
</style>
