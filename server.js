// HexSmash Server
// Authoritative logic, anti-cheat, matchmaking

import { WebSocketServer } from "ws";
import https from "https";

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

const ROOMS = new Map();
const TICK_RATE = 50;

// ---------- Room helpers ----------

function createRoom() {
  return {
    players: new Map(),
    tiles: new Map()
  };
}

function findRoom() {
  for (const room of ROOMS.values()) {
    if (room.players.size < 12) return room;
  }
  const room = createRoom();
  ROOMS.set(Math.random(), room);
  return room;
}

// ---------- WebSocket handling ----------

wss.on("connection", ws => {
  const room = findRoom();
  const id = Math.random().toString(36).slice(2);
  const color = `hsl(${Math.random() * 360},100%,60%)`;

  const player = {
    id,
    x: 400,
    y: 300,
    dx: 0,
    dy: 0,
    score: 0,
    smashCooldown: 0,
    color
  };

  room.players.set(ws, player);

  ws.send(JSON.stringify({
    type: "init",
    id,
    color
  }));

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // ✅ Anti-cheat: input only
    if (data.type === "input") {
      player.dx = Math.max(-1, Math.min(1, data.dx || 0));
      player.dy = Math.max(-1, Math.min(1, data.dy || 0));

      if (data.smash && player.smashCooldown <= 0) {
        player.smashCooldown = 60;
        player.score += 5;
      }
    }
  });

  ws.on("close", () => {
    room.players.delete(ws);
  });
});

// ---------- Game loop ----------

setInterval(() => {
  ROOMS.forEach(room => {
    room.players.forEach(player => {
      player.x += player.dx * 3;
      player.y += player.dy * 3;
      player.smashCooldown--;
    });

    const snapshot = {
      type: "state",
      players: [...room.players.values()]
    };

    room.players.forEach((_, ws) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(snapshot));
      }
    });
  });
}, TICK_RATE);

// ---------- Render keep-alive (free tier) ----------

setInterval(() => {
  if (process.env.RENDER_EXTERNAL_URL) {
    https.get(process.env.RENDER_EXTERNAL_URL);
  }
}, 10 * 60 * 1000);

console.log(`✅ HexSmash server running on port ${PORT}`);
