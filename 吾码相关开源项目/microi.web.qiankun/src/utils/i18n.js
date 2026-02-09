// translate router.meta.title, be used in breadcrumb sidebar tagsview
export function generateTitle(title) {
  const hasKey = this.microi_vue.$te('route.' + title)

  if (hasKey) {
    // $t :this method from vue-i18n, inject in @/lang/index.js
    const translatedTitle = this.microi_vue.$t('route.' + title)

    return translatedTitle
  }
  return title
}
