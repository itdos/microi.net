export function showRowActionSheet(actions = [], onSelect, offset = 0) {
  const source = Array.isArray(actions) ? actions : []
  const page = source.slice(offset, offset + 5)
  if (!page.length) return
  const hasMore = offset + page.length < source.length
  uni.showActionSheet({
    itemList: page.map((action) => action.label || action.Label || '操作').concat(hasMore ? ['更多操作…'] : []),
    success: ({ tapIndex }) => {
      if (hasMore && tapIndex === page.length) {
        showRowActionSheet(source, onSelect, offset + page.length)
        return
      }
      const action = page[tapIndex]
      if (action && typeof onSelect === 'function') onSelect(action)
    }
  })
}

