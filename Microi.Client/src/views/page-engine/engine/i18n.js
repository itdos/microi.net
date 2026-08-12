import { translateEngineLiteral } from '@/lang'

/** Translate built-in Page Engine text while preserving tenant-authored values. */
export const peT = value => translateEngineLiteral('PageEngine', value)
