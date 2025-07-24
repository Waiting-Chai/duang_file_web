const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  // In development, the WebSocket server is on localhost:8081.
  // In production, you would replace this with your actual server URL.
  // The `ws_host` would likely be the same as `window.location.host`.
  wsUrl: isProduction ? `wss://${window.location.host}/ws` : 'ws://localhost:8081/ws',
};