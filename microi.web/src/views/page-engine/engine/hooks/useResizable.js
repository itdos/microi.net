import { ref, onBeforeUnmount } from 'vue'
const useResizable = (curObj, property) => {
  const isResizing = ref(false)
  let startY
  let startValue
  const startResize = (event) => {
    isResizing.value = true
    startY = event.clientY
    if (curObj.value.type == 'pannel') {
      startValue = curObj.value.wrapperOption[property]
    }
    else {
      startValue = curObj.value.widgetOption[property]
    }
    document.addEventListener('mousemove', resize)
    document.addEventListener('mouseup', stopResize)
  }
  const resize = (event) => {
    if (isResizing.value) {
      let newValue = startValue + (event.clientY - startY)
      if (curObj.value.type == 'pannel') {
        curObj.value.wrapperOption[property] = newValue
      }
      else {
        curObj.value.widgetOption[property] = newValue
      }
    }
  }
  const stopResize = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', resize)
    document.removeEventListener('mouseup', stopResize)
  }
  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', resize)
    document.removeEventListener('mouseup', stopResize)
  })
  return {
    startResize
  }
}
export default useResizable