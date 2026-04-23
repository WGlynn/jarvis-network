// ============ Health Endpoint ============
//
// Minimal HTTP server for fly.io health checks + observability.
// /health  → { status: 'ok', uptime_s, usage }
// /metrics → token + call counts (v1 metering foundation)
// ============

import http from 'http';
import { readFileSync } from 'fs';
import { getUsage } from './claude-client.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const START_TIME = Date.now();

let binaryHash = '';
try {
  binaryHash = readFileSync('/app/.verifiability/binary-hash.txt', 'utf8').trim();
} catch {
  /* local dev — no hash file */
}

export function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          uptime_s: Math.floor((Date.now() - START_TIME) / 1000),
          binary_hash: binaryHash || null,
          usage: getUsage(),
        })
      );
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(getUsage()));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
  server.listen(PORT, () => {
    console.log(`[health] Listening on :${PORT}`);
  });
  return server;
}
