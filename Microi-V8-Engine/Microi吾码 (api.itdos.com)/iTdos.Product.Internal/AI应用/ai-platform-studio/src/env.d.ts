/// <reference types="vite/client" />

interface MicroAppHost {
  getData?: () => Record<string, unknown>
  dispatch?: (payload: Record<string, unknown>) => void
  forceDispatch?: (payload: Record<string, unknown>) => void
}
interface Window {
  microApp?: MicroAppHost
}
