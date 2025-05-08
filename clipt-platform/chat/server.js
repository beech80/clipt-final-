import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import clientProm from 'prom-client';

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: '*' } });

const redisUrl = process.env.REDIS_URL;
(async () => {
  const pub = createClient({ url: redisUrl });
  const sub = pub.duplicate();
  await pub.connect(); await sub.connect();
  io.adapter(createAdapter(pub, sub));
})();

// Prometheus metrics
const register = new clientProm.Registry();
clientProm.collectDefaultMetrics({ register });
const connGauge = new clientProm.Gauge({
  name: 'chat_active_connections',
  help: 'Active WebSocket connections'
});
register.registerMetric(connGauge);

app.get('/healthz', (_, res) => res.send('ok'));
app.get('/metrics', async (_, res) => {
  connGauge.set(io.engine.clientsCount);
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

io.on('connection', socket => {
  connGauge.inc();
  socket.on('chat message', msg => io.emit('chat message', msg));
  socket.on('disconnect', () => connGauge.dec());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat listening on port ${PORT}`);
});
