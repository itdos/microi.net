// Only a single child list with no surrounding form sections may own the viewport.
// Mixed forms and multiple relations must remain in the page's normal scroll flow.
export function isStandaloneChildLayout(groups = [], relatedTabs = []) {
  return groups.length === 0 && relatedTabs.length === 1 && relatedTabs[0].type === 'child'
}
