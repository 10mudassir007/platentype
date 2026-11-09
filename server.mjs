import { createServer } from "node:http";
import os from "node:os";

import next from "next";

import { attachRealtime } from "./server/realtime.mjs";

const dev = !process.argv.includes("--prod") && process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });
const handle = app.getRequestHandler();

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return addresses;
}

await app.prepare();

server.on("request", (request, response) => {
  handle(request, response);
});

attachRealtime(server);

server.listen(port, hostname, () => {
  const mode = dev ? "development" : "production";
  console.log(`> Platen listening on http://localhost:${port} (${mode})`);
  for (const address of lanAddresses()) {
    console.log(`> LAN duel: ${address}`);
  }
});

server.on("error", (error) => {
  console.error("Platen server error:", error);
  process.exitCode = 1;
});
