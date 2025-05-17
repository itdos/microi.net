
import { GetServerPath } from '@/utils'
// 计算进度
 const calculateProgress = (checkPoint, value) => {
  var count = 0
  for (var i = 0; i < checkPoint.length; i++) {
    if (checkPoint[i].over || checkPoint[i][value]) {
      count++
    }
  }
  return count + '/' + checkPoint.length
}
// 图片处理
const changeTu = (CankaoT) => {
  if (!CankaoT) return []
  const arr = JSON.parse(CankaoT)
  return arr?.map( (item) => {
    return {
      url: GetServerPath(item.Path),
      content: '',
      ...item
    }
  })
}
// 点击风险点滚动到对应位置
const scrollToSection = (sectionId) => {
  console.log(sectionId, '滚动到对应位置')
  const query = uni.createSelectorQuery().in(this); // 确保选择器是在当前组件上下文中
    query.select(`#${sectionId}`).boundingClientRect(rect => {
      console.log(rect, '元素位置');
      if (rect) {
        uni.pageScrollTo({
          scrollTop: rect.top,
          duration: 300 // 滚动动画持续时间，单位 ms
        });
      } else {
        console.error(`未找到ID为'${sectionId}'的元素`);
      }
    }).exec(); // 执行选择器查询
}
export { calculateProgress, changeTu, scrollToSection }
