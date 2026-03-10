/**
 * go-view i18n 适配层
 * 提供 langList 等必要导出
 */
import { LangEnum } from '@goview/enums/styleEnum'

export const langList = [
  {
    label: '中文',
    key: LangEnum.ZH
  },
  {
    label: 'English',
    key: LangEnum.EN
  }
]

// $t 函数直接返回 key（中文环境无需翻译）
export const t = (key: string) => key

export default {
  langList,
  t
}
