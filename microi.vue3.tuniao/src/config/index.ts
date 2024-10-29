import { Microi } from "./microi.uniapp.js"
const configHttp = {
	apiHost: uni.getStorageSync('ApiBase') || Microi.ApiBase,
	osClient: uni.getStorageSync('OsClient') || Microi.OsClient,
	ImgBaseUrl: Microi.FileServer,
	uploadActionUrl: uni.getStorageSync('ApiBase') || Microi.ApiBase + Microi.Api.Upload,
}
export default configHttp
export const UPLOAD_URL = 'https://vue3service.tuniaokj.com/upload/image'
// export * from './upload-headers'
export const uploadHeaders = {
  requireid: 'microi',
}
