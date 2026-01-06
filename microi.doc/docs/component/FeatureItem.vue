<template>
  <div class="feature-item">
    <span v-for="(part, index) in parsedContent" :key="index">
      <strong v-if="part.type === 'highlight'" style="color: #1890ff;">
        [{{ part.content }}]
      </strong>
      <a v-else-if="part.type === 'link'" :href="part.href" style="color: #1890ff; text-decoration: none;">
        {{ part.text }}
      </a>
      <span v-else>{{ part.content }}</span>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  content: String
})

const parsedContent = computed(() => {
  const result = []
  let text = props.content
  
  // 正则匹配 {{highlight:内容}} 和 {{link:地址:[文本]}}
  const regex = /\{\{(highlight|link):([^}]+)\}\}/g
  let lastIndex = 0
  let match
  
  while ((match = regex.exec(text)) !== null) {
    // 添加普通文本
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      })
    }
    
    const type = match[1]
    const content = match[2]
    
    if (type === 'highlight') {
      result.push({
        type: 'highlight',
        content: content
      })
    } else if (type === 'link') {
      // 解析链接格式 link:/doc/api/index:[去看看]
      const linkMatch = content.match(/^([^:]+):\[([^\]]+)\]$/)
      if (linkMatch) {
        result.push({
          type: 'link',
          href: linkMatch[1],
          text: linkMatch[2]
        })
      }
    }
    
    lastIndex = regex.lastIndex
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.slice(lastIndex)
    })
  }
  
  return result
})
</script>