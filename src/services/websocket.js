let socket
let pingInterval

export function connectWebSocket(onBlock) {
  const WS_URL = 'wss://node.mainnet.alephium.org/ws'
  socket = new WebSocket(WS_URL)

  socket.onopen = () => {
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
    clearInterval(pingInterval)
    setTimeout(() => connectWebSocket(onBlock), 1000)
  }
}

export function closeWebSocket() {
  if (socket) {
    socket.close()
    clearInterval(pingInterval)
  }
}
