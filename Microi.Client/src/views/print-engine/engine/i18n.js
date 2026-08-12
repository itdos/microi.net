import { translateEngineLiteral } from '@/lang'

/** Translate built-in Print Engine text while preserving template content. */
export const printT = value => translateEngineLiteral('PrintEngine', value)
