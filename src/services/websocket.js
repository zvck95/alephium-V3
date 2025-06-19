let socket
let pingInterval
let endpointIndex = 0
const ENDPOINTS = [
  'wss://node.mainnet.alephium.org/events',
  'wss://node.mainnet.alephium.org/ws'
]

export function connectWebSocket(onBlock, onStatusChange) {
  const url = ENDPOINTS[endpointIndex]
  onStatusChange?.('connecting')
  socket = new WebSocket(url)

  socket.onopen = () => {
    onStatusChange?.('connected')
    clearInterval(pingInterval)
    pingInterval = setInterval(() => {
      try {
        socket.send('ping')
      } catch (e) {
        // ignore ping errors
      }
    }, 30000)
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'new-block' && onBlock) {
        onBlock(data.block)
      }
    } catch (e) {
      console.error('WebSocket parse error', e)
    }
  }
  socket.onerror = (e) => {
    console.error('WebSocket error', e)
  }

  socket.onclose = () => {
    onStatusChange?.('disconnected')
    clearInterval(pingInterval)
    endpointIndex = (endpointIndex + 1) % ENDPOINTS.length
    setTimeout(() => connectWebSocket(onBlock, onStatusChange), 1000)
  }
}

export function closeWebSocket(onStatusChange) {
  if (socket) {
    socket.close()
    clearInterval(pingInterval)
    onStatusChange?.('disconnected')
  }
}
