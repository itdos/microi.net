export interface MicroiV8Client {
  configure(options: Record<string, unknown>): void
  post(url: string, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>
  ApiEngine: { Run(key: string, data?: Record<string, unknown>): Promise<unknown> }
  FormEngine: {
    GetTableData(table: string, params?: Record<string, unknown>): Promise<unknown>
    GetFormData(table: string, params?: Record<string, unknown>): Promise<unknown>
    AddFormData(table: string, data: Record<string, unknown>): Promise<unknown>
    UptFormData(table: string, data: Record<string, unknown>): Promise<unknown>
  }
}

export function createMicroiV8(options?: Record<string, unknown>): MicroiV8Client
declare const V8: MicroiV8Client
export default V8
