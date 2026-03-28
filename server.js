/**
 * WorldCall Signaling Server
 * Deploy this FREE on Railway.app, Render.com, or Fly.io
 *
 * Install: npm install ws
 * Run:     node server.js
 * Port:    8080 (set PORT env var to override)
 */

const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// rooms: Map<roomCode, Set<WebSocket>>
const rooms = new Map();

function getRoomPeers(room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  return rooms.get(room);
}

function broadcast(room, message, exclude = null) {
  const peers = getRoomPeers(room);
  const data = JSON.stringify(message);
  peers.forEach(peer => {
    if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
      peer.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type, room } = msg;
    if (!room) return;

    if (type === 'join') {
      currentRoom = room;
      const peers = getRoomPeers(room);

      if (peers.size > 0) {
        // Notify existing peer that someone joined
        broadcast(room, { type: 'peer-joined' });
      }

      peers.add(ws);
      console.log(`[+] Peer joined room "${room}" (${peers.size} peers)`);

    } else if (['offer','answer','ice-candidate'].includes(type)) {
      // Relay to other peers in the room
      broadcast(room, msg, ws);

    } else if (type === 'chat') {
      broadcast(room, { type: 'chat', text: msg.text }, ws);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      const peers = getRoomPeers(currentRoom);
      peers.delete(ws);
      broadcast(currentRoom, { type: 'peer-left' });
      if (peers.size === 0) rooms.delete(currentRoom);
      console.log(`[-] Peer left room "${currentRoom}" (${peers.size} remaining)`);
    }
  });

  ws.on('error', () => {});
});

console.log(`WorldCall signaling server running on ws://localhost:${PORT}`);
