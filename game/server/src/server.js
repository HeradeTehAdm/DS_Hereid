const http = require("node:http");
const { WebSocketServer } = require("ws");
const { readConfig } = require("./config");

const config = readConfig();
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    const body = JSON.stringify({
      ok: true,
      service: "heradetale-game-server",
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
    });
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }));
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  // Protocol messages and authenticated game sessions are implemented in later stages.
  ws.send(JSON.stringify({ type: "connection.ready", protocolVersion: 1 }));
});

server.listen(config.port, config.host, () => {
  console.log(`[heradetale] listening on http://${config.host}:${config.port}`);
});

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[heradetale] received ${signal}; shutting down`);
  for (const socket of wss.clients) socket.close(1001, "server_shutdown");
  wss.close();
  server.close((error) => {
    if (error) {
      console.error("[heradetale] shutdown failed", error);
      process.exitCode = 1;
    }
  });
  setTimeout(() => {
    for (const socket of wss.clients) socket.terminate();
    process.exit();
  }, 5000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
