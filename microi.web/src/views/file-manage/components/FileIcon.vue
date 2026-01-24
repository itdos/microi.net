<template>
  <div class="file-icon-wrapper" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- 图片类型 - 显示缩略图占位 -->
    <div v-if="isImage" class="image-preview" :style="iconStyle">
      <el-icon :size="iconFontSize" color="#10b981">
        <Picture />
      </el-icon>
    </div>
    <!-- 其他文件类型 - 显示图标 -->
    <div v-else class="file-type-icon" :style="iconStyle">
      <el-icon :size="iconFontSize" :color="iconColor">
        <component :is="iconComponent" />
      </el-icon>
      <span v-if="showExtension && size >= 60" class="file-extension">{{ extension }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Document,
  Picture,
  VideoPlay,
  Headset,
  FolderOpened,
  Files,
  Cpu,
  Grid,
  Tickets,
  Document as DocIcon,
  DocumentCopy,
  Film,
  Postcard,
  Monitor
} from '@element-plus/icons-vue'

const props = defineProps({
  type: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 80
  },
  showExtension: {
    type: Boolean,
    default: true
  }
})

// 文件扩展名
const extension = computed(() => {
  return props.type?.toUpperCase() || ''
})

// 是否是图片
const isImage = computed(() => {
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico']
  return imageTypes.includes(props.type?.toLowerCase())
})

// 图标字体大小
const iconFontSize = computed(() => {
  return Math.max(24, props.size * 0.5)
})

// 图标样式
const iconStyle = computed(() => ({
  width: props.size + 'px',
  height: props.size + 'px'
}))

// 根据文件类型返回图标组件
const iconComponent = computed(() => {
  const type = props.type?.toLowerCase()
  
  const iconMap = {
    // 文档类
    docx: Document,
    doc: Document,
    txt: Document,
    md: Document,
    rtf: Document,
    
    // 表格类
    xlsx: Grid,
    xls: Grid,
    csv: Grid,
    
    // PDF
    pdf: Tickets,
    
    // 演示文稿
    pptx: Postcard,
    ppt: Postcard,
    
    // 图片类
    jpg: Picture,
    jpeg: Picture,
    png: Picture,
    gif: Picture,
    bmp: Picture,
    svg: Picture,
    webp: Picture,
    ico: Picture,
    psd: Picture,
    
    // 视频类
    mp4: VideoPlay,
    avi: VideoPlay,
    mov: VideoPlay,
    mkv: VideoPlay,
    wmv: VideoPlay,
    flv: VideoPlay,
    
    // 音频类
    mp3: Headset,
    wav: Headset,
    flac: Headset,
    aac: Headset,
    ogg: Headset,
    
    // 压缩包
    zip: Files,
    rar: Files,
    '7z': Files,
    tar: Files,
    gz: Files,
    
    // 可执行文件
    exe: Cpu,
    msi: Cpu,
    dmg: Cpu,
    app: Cpu,
    
    // CAD设计文件
    dwg: Monitor,
    dxf: Monitor,
    
    // 其他
    iso: Monitor,
    rp: DocumentCopy
  }
  
  return iconMap[type] || Document
})

// 根据文件类型返回图标颜色
const iconColor = computed(() => {
  const type = props.type?.toLowerCase()
  
  const colorMap = {
    // CAD设计文件
    dwg: '#0284c7',
    dxf: '#0284c7',
    // 文档类 - 蓝色
    docx: '#2563eb',
    doc: '#2563eb',
    txt: '#64748b',
    md: '#475569',
    rtf: '#2563eb',
    
    // 表格类 - 绿色
    xlsx: '#16a34a',
    xls: '#16a34a',
    csv: '#16a34a',
    
    // PDF - 红色
    pdf: '#dc2626',
    
    // 演示文稿 - 橙色
    pptx: '#ea580c',
    ppt: '#ea580c',
    
    // 图片类 - 青色
    jpg: '#0891b2',
    jpeg: '#0891b2',
    png: '#0891b2',
    gif: '#0891b2',
    bmp: '#0891b2',
    svg: '#0891b2',
    webp: '#0891b2',
    ico: '#0891b2',
    psd: '#6366f1',
    
    // 视频类 - 紫色
    mp4: '#9333ea',
    avi: '#9333ea',
    mov: '#9333ea',
    mkv: '#9333ea',
    wmv: '#9333ea',
    flv: '#9333ea',
    
    // 音频类 - 粉色
    mp3: '#db2777',
    wav: '#db2777',
    flac: '#db2777',
    aac: '#db2777',
    ogg: '#db2777',
    
    // 压缩包 - 黄色
    zip: '#ca8a04',
    rar: '#ca8a04',
    '7z': '#ca8a04',
    tar: '#ca8a04',
    gz: '#ca8a04',
    
    // 可执行文件 - 灰色
    exe: '#475569',
    msi: '#475569',
    dmg: '#475569',
    app: '#475569',
    
    // 其他
    iso: '#6366f1',
    rp: '#8b5cf6'
  }
  
  return colorMap[type] || '#64748b'
})
</script>

<style lang="scss" scoped>
.file-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  
  .image-preview,
  .file-type-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border: 1px solid #e2e8f0;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  
  .file-extension {
    position: absolute;
    bottom: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.9);
    padding: 1px 4px;
    border-radius: 2px;
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
