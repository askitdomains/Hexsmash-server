(Authoritative logic, anti‑cheat, matchmaking)
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3000 });

const ROOMS = new Map();
const TICK_RATE = 50;

function createRoom() {
  return {
    players: new Map(),
    tiles: new Map(),
    powerups: [],
    started: false
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

wss.on("connection", ws => {
  const room = findRoom();
  const id = Math.random().toString(36).slice(2);
  const color = `hsl(${Math.random()*360},100%,60%)`;

  const player = {
    id,
    x: 0, y: 0,
    dx: 0, dy: 0,
    score: 0,
    shield: false,
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
    const data = JSON.parse(msg);
    const p = room.players.get(ws);
    if (!p) return;

    // ✅ Anti-cheat: input only
    if (data.type === "input") {
      p.dx = Math.max(-1, Math.min(1, data.dx));
      p.dy = Math.max(-1, Math.min(1, data.dy));
      if (data.smash && p.smashCooldown <= 0) {
        p.smashCooldown = 60;
        captureAdjacent(room, p);
      }
    }
  });

  ws.on("close", () => room.players.delete(ws));
});

function captureAdjacent(room, p) {
  room.tiles.forEach(tile => {
    const dx = tile.x - p.x;
    const dy = tile.y - p.y;
    if (Math.hypot(dx, dy) < 60) {
      tile.owner = p.color;
      p.score++;
    }
  });
}

setInterval(() => {
  ROOMS.forEach(room => {
    room.players.forEach(p => {
      p.x += p.dx * 3;
      p.y += p.dy * 3;
      p.smashCooldown--;
    });

    const state = {
      type: "state",
      players: [...room.players.values()],
      tiles: [...room.tiles.values()],
      powerups: room.powerups
    };

    room.players.forEach((_p, ws) =>
      ws.send(JSON.stringify(state))
    );
  });
}, TICK_RATE);
