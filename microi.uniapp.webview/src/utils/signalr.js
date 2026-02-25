/**
 * SignalR WebSocket 客户端 —— 适用于微信小程序 (uni-app)
 * =========================================================
 * 参考 microi.web/src/views/chat 项目的 SignalR 通信协议
 * 使用 uni.connectSocket 实现 WebSocket 连接
 *
 * SignalR JSON 协议说明：
 *   消息以 \x1e (Record Separator) 分隔
 *   type 1 = Invocation    客户端调用服务端方法 / 服务端调用客户端方法
 *   type 2 = StreamItem     (流式传输)
 *   type 3 = Completion     服务端对客户端 invoke 的返回
 *   type 6 = Ping           心跳
 *   type 7 = Close          关闭连接
 */

import { getToken, getUser } from './request.js'
import appConfig from './config.js'

const RS = '\x1e' // Record Separator

class SignalRClient {
  constructor() {
    this.socketTask = null
    this.connected = false
    this.connecting = false
    // 事件处理器: eventName → Set<callback>
    this._handlers = {}
    this._invocationId = 0
    this._pendingCalls = {} // invocationId → { resolve, reject, timer }
    this._messageBuffer = ''
    this._heartbeatTimer = null
    this._reconnectTimer = null
    this._reconnectAttempts = 0
    this._maxReconnectAttempts = 5
    this._destroyed = false
    // 握手 Promise
    this._handshakeResolve = null
    this._handshakeReject = null
    this._handshakeDone = false
  }

  // ==================== 公开 API ====================

  /**
   * 注册服务端回调事件
   * 对应 web 端的 websocket.on('ReceiveXxx', callback)
   */
  on(eventName, callback) {
    if (!this._handlers[eventName]) {
      this._handlers[eventName] = new Set()
    }
    this._handlers[eventName].add(callback)
    return this
  }

  /**
   * 移除回调
   */
  off(eventName, callback) {
    if (!this._handlers[eventName]) return this
    if (callback) {
      this._handlers[eventName].delete(callback)
    } else {
      delete this._handlers[eventName]
    }
    return this
  }

  /**
   * 调用服务端方法（fire-and-forget，不等待返回）
   * 对应 web 端的 websocket.invoke('SendXxx', params)
   *
   * SignalR Hub 的大部分聊天方法都是 fire-and-forget：
   *   客户端 invoke('SendLastContacts', {...})
   *   服务端通过 on('ReceiveSendLastContacts', data) 回调
   */
  send(method, ...args) {
    if (!this.connected) {
      console.warn('[SignalR] send failed: not connected, method:', method)
      return
    }
    const msg = {
      type: 1,
      target: method,
      arguments: args
    }
    this._sendRaw(JSON.stringify(msg) + RS)
  }

  /**
   * 调用服务端方法并等待 Completion 返回
   * （仅用于有明确返回值的 Hub 方法）
   */
  invoke(method, ...args) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected'))
        return
      }

      const id = String(++this._invocationId)
      const timer = setTimeout(() => {
        if (this._pendingCalls[id]) {
          delete this._pendingCalls[id]
          reject(new Error(`Invoke timeout: ${method}`))
        }
      }, 30000)

      this._pendingCalls[id] = { resolve, reject, timer }

      const msg = {
        type: 1,
        invocationId: id,
        target: method,
        arguments: args
      }
      this._sendRaw(JSON.stringify(msg) + RS)
    })
  }

  /**
   * 连接到 SignalR Hub
   */
  async connect() {
    if (this.connected || this.connecting) return true
    this._destroyed = false

    const token = getToken()
    if (!token) {
      console.warn('[SignalR] connect failed: no token')
      return false
    }

    this.connecting = true

    try {
      // Step 1: Negotiate
      const negotiateUrl = `${appConfig.apiBase}/diy-websocket/negotiate?negotiateVersion=1`
      const negotiateRes = await this._httpPost(negotiateUrl, {}, {
        'Authorization': `Bearer ${token}`
      })

      const connectionToken = negotiateRes.connectionToken || negotiateRes.connectionId
      if (!connectionToken) {
        throw new Error('No connectionToken from negotiate')
      }

      // Step 2: 建立 WebSocket 连接
      const wsBase = appConfig.apiBase
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')
      const wsUrl = `${wsBase}/diy-websocket?id=${encodeURIComponent(connectionToken)}&access_token=${encodeURIComponent(token)}`

      await this._connectSocket(wsUrl)

      // Step 3: SignalR 握手
      this._handshakeDone = false
      const handshakePromise = new Promise((resolve, reject) => {
        this._handshakeResolve = resolve
        this._handshakeReject = reject
        setTimeout(() => {
          if (!this._handshakeDone) {
            reject(new Error('Handshake timeout'))
          }
        }, 10000)
      })

      this._sendRaw(JSON.stringify({ protocol: 'json', version: 1 }) + RS)
      await handshakePromise

      // Step 4: 连接成功
      this.connected = true
      this.connecting = false
      this._reconnectAttempts = 0
      this._startHeartbeat()

      console.log('[SignalR] Connected successfully')
      this._emit('_connected')
      return true

    } catch (e) {
      console.error('[SignalR] connect error:', e)
      this.connecting = false
      this._scheduleReconnect()
      return false
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this._destroyed = true
    this._stopHeartbeat()
    this._clearReconnect()

    if (this.socketTask) {
      try {
        this.socketTask.close({ code: 1000 })
      } catch (e) {}
      this.socketTask = null
    }

    this.connected = false
    this.connecting = false
    this._handshakeDone = false
    this._messageBuffer = ''

    // 清理 pending calls
    for (const id of Object.keys(this._pendingCalls)) {
      const p = this._pendingCalls[id]
      clearTimeout(p.timer)
      p.reject(new Error('Disconnected'))
      delete this._pendingCalls[id]
    }
  }

  /**
   * 是否已连接
   */
  get isConnected() {
    return this.connected
  }

  /**
   * 销毁（不再重连）
   */
  destroy() {
    this.disconnect()
    this._handlers = {}
  }

  // ==================== 内部方法 ====================

  _connectSocket(url) {
    return new Promise((resolve, reject) => {
      let resolved = false

      this.socketTask = uni.connectSocket({
        url: url,
        complete: () => {} // 防止警告
      })

      this.socketTask.onOpen(() => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      })

      this.socketTask.onError((err) => {
        console.error('[SignalR] WebSocket error:', err)
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })

      this.socketTask.onMessage((res) => {
        this._onMessage(res.data)
      })

      this.socketTask.onClose((res) => {
        console.log('[SignalR] WebSocket closed:', res.code, res.reason)
        const wasConnected = this.connected
        this.connected = false
        this.connecting = false
        if (wasConnected && !this._destroyed) {
          this._emit('_disconnected')
          this._scheduleReconnect()
        }
      })

      // 超时
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          reject(new Error('WebSocket connect timeout'))
        }
      }, 15000)
    })
  }

  _sendRaw(data) {
    if (!this.socketTask) return
    try {
      this.socketTask.send({ data })
    } catch (e) {
      console.error('[SignalR] send error:', e)
    }
  }

  _onMessage(data) {
    this._messageBuffer += data
    const parts = this._messageBuffer.split(RS)
    // 最后一段可能不完整，保留
    this._messageBuffer = parts.pop() || ''

    for (const part of parts) {
      if (!part.trim()) continue
      try {
        const msg = JSON.parse(part)
        this._processMessage(msg)
      } catch (e) {
        // 可能是乱码或不完整 JSON
      }
    }
  }

  _processMessage(msg) {
    // 握手响应（没有 type 字段）
    if (msg.type === undefined || msg.type === null) {
      this._handshakeDone = true
      if (msg.error) {
        this._handshakeReject && this._handshakeReject(new Error(msg.error))
      } else {
        this._handshakeResolve && this._handshakeResolve()
      }
      this._handshakeResolve = null
      this._handshakeReject = null
      return
    }

    switch (msg.type) {
      case 1: // Invocation（服务端调用客户端方法）
        this._handleInvocation(msg)
        break

      case 3: // Completion（invoke 的返回）
        this._handleCompletion(msg)
        break

      case 6: // Ping → 回复 Pong
        this._sendRaw(JSON.stringify({ type: 6 }) + RS)
        break

      case 7: // Close
        console.log('[SignalR] Server closed connection:', msg.error)
        this.disconnect()
        break

      default:
        break
    }
  }

  _handleInvocation(msg) {
    const target = msg.target
    const args = msg.arguments || []
    const handlers = this._handlers[target]
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch (e) {
          console.error(`[SignalR] handler error for ${target}:`, e)
        }
      }
    }
  }

  _handleCompletion(msg) {
    const pending = this._pendingCalls[msg.invocationId]
    if (!pending) return

    clearTimeout(pending.timer)
    delete this._pendingCalls[msg.invocationId]

    if (msg.error) {
      pending.reject(new Error(msg.error))
    } else {
      pending.resolve(msg.result)
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat()
    // 每 15 秒发送 Ping
    this._heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this._sendRaw(JSON.stringify({ type: 6 }) + RS)
      }
    }, 15000)
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  _scheduleReconnect() {
    if (this._destroyed) return
    this._clearReconnect()

    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.warn('[SignalR] Max reconnect attempts reached')
      this._emit('_reconnectFailed')
      return
    }

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000)
    this._reconnectAttempts++

    console.log(`[SignalR] Reconnect in ${delay}ms (attempt ${this._reconnectAttempts})`)
    this._reconnectTimer = setTimeout(() => {
      if (!this._destroyed && !this.connected && !this.connecting) {
        this.connect()
      }
    }, delay)
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  _emit(eventName, ...args) {
    const handlers = this._handlers[eventName]
    if (handlers) {
      for (const handler of handlers) {
        try { handler(...args) } catch (e) {}
      }
    }
  }

  _httpPost(url, body, headers) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: url,
        method: 'POST',
        data: body || {},
        header: {
          'Content-Type': 'application/json',
          ...(headers || {})
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}`))
          }
        },
        fail: (err) => reject(err)
      })
    })
  }
}

// ==================== 单例管理 ====================
let _instance = null

/**
 * 获取全局 SignalR 客户端实例
 */
export function getSignalR() {
  if (!_instance) {
    _instance = new SignalRClient()
  }
  return _instance
}

/**
 * 连接 SignalR（如果已连接则复用）
 */
export async function connectSignalR() {
  const client = getSignalR()
  if (client.isConnected) return client
  await client.connect()
  return client
}

/**
 * 断开并销毁 SignalR 连接
 */
export function disconnectSignalR() {
  if (_instance) {
    _instance.destroy()
    _instance = null
  }
}

export default SignalRClient
