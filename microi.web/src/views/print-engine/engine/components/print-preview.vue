<template>
  <div class="microi-print-engine">
    <div class="mpe-modal" v-if="show">
      <div class="mpe-wrap" @click="close">
        <div class="mpe-box">
          <div class="mpe-modal-box__header" @click.stop="">预览</div>
          <div class="mpe-preview-body">
            <div class="mpe-preview-container" ref="previewContainer"></div>
          </div>
          <div class="mpe-modal-box__footer">
            <el-button type="primary" @click="close">确定</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="print-preview">
import { ref } from 'vue'
import $ from 'jquery'
const show = ref(false)
const previewContainer = ref(null)
const close = () => {
  show.value = false
}
const showModal = (html) => {
  show.value = true
  console.log('showModal', html)
  do {
    setTimeout(() => {
      $('.mpe-preview-container').html(html)
    }, 200)
    return
  } while ($('.mpe-preview-container').length <= 0)
}

defineExpose({
  showModal,
})
</script>

<style lang="scss" scoped>
.microi-print-engine {
  /* 不同模板 间隙 */
  .mpe-preview-container :deep(.hiprint-printTemplate) {
    background: #fff;
    border-bottom: 10px solid #ccc;
  }
  /* 批量打印 间隙 */
  .mpe-preview-container :deep(.hiprint-printTemplate .hiprint-printPanel:not(:last-of-type)) {
    border-bottom: 5px solid #ccc;
  }

  .mpe-preview-body {
    background: #ccc;
    padding: 14px 0;
    display: flex;
    justify-content: center;
    max-height: 70vh;
    overflow: auto;
  }

  /* modal */
  .mpe-modal {
    padding: 0;
    margin: 0;
  }
  .mpe-modal .mpe-mask {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1000;
    height: 100%;
    background-color: #00000073;
  }
  .mpe-modal .mpe-wrap {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1000;
    overflow: auto;
    background-color: #00000073;
    outline: 0;
  }
  .mpe-modal .mpe-wrap .mpe-box {
    position: relative;
    margin: 50px auto;
    width: 80%;
    background: #fff;
    border-radius: 4px;
    z-index: 1001;
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
  }
  .mpe-modal-box__header {
    padding: 10px 14px;
    border-bottom: 1px solid #e9e9e9;
  }
  .mpe-modal-box__footer {
    text-align: end;
    padding: 10px;
  }
  .mpe-modal-box__footer button {
    min-width: 100px;
  }
  .mpe-modal-box__footer button:not(:last-child) {
    margin-right: 10px;
  }
}
</style>
