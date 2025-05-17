/**
 * 预加载工具
 * 用于在应用启动时预加载关键数据和资源
 */

// 预加载首页数据
export const preloadIndexData = async (Microi) => {
  try {
    // 检查是否有缓存数据
    const cacheData = uni.getStorageSync('index_data')
    
    // 如果没有缓存数据或缓存数据已过期，则从服务器获取
    if (!cacheData || isDataExpired('index_data_time')) {
      const userInfo = Microi.GetCurrentUser()
      if (userInfo && userInfo.Id) {
        console.log('预加载首页数据...')
        const res = await Microi.ApiEngine.Run('mobile_index_data', {
          UserId: userInfo.Id
        })
        
        if (res && res.Code === 1) {
          // 保存数据到缓存
          uni.setStorageSync('index_data', res.Data)
          // 记录缓存时间
          uni.setStorageSync('index_data_time', Date.now())
          console.log('首页数据预加载成功')
          return res.Data
        }
      }
    } else {
      console.log('使用缓存的首页数据')
      return typeof cacheData === 'string' ? JSON.parse(cacheData) : cacheData
    }
  } catch (error) {
    console.error('预加载首页数据失败:', error)
  }
  return null
}

// 预加载常用图片资源
export const preloadImages = (imageList) => {
  if (!imageList || !imageList.length) return
  
  console.log('预加载图片资源...')
  imageList.forEach(imgUrl => {
    // 创建Image对象预加载图片
    const img = new Image()
    img.src = imgUrl
  })
}

// 检查数据是否过期（默认30分钟过期）
export const isDataExpired = (timeKey, expirationTime = 30 * 60 * 1000) => {
  try {
    const lastUpdateTime = uni.getStorageSync(timeKey)
    if (!lastUpdateTime) return true
    
    const now = Date.now()
    return (now - lastUpdateTime) > expirationTime
  } catch (e) {
    return true
  }
}

// 预加载所有关键资源
export const preloadAllResources = async (Microi) => {
  console.log('开始预加载资源...')
  
  // 预加载首页数据
  const indexData = await preloadIndexData(Microi)
  
  // 预加载常用图标
  const commonIcons = [
    '/static/img/logo.png',
    // 添加其他常用图标
  ]
  
  // 如果有首页数据，提取其中的图标进行预加载
  if (indexData && indexData.Tabs) {
    const tabIcons = indexData.Tabs
      .filter(tab => tab.Icon)
      .map(tab => tab.Icon)
    
    preloadImages([...commonIcons, ...tabIcons])
  } else {
    preloadImages(commonIcons)
  }
  
  console.log('资源预加载完成')
}
