import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { connectionController } from './socket-controller';
import { createAdapter } from 'socket.io-redis';
import { Redis } from 'ioredis';

const pubClient = new Redis({
    host: process.env.REDISHOST || 'localhost',
    port: parseInt(process.env.REDISPORT || '6379'),
  });

const subClient = pubClient.duplicate();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    adapter: createAdapter({ pubClient, subClient }),
    cors: { origin: '*'}
});

app.use(express.static('public'));

io.on('connection', connectionController);

const port = parseInt(process.env.PORT || '8080');

server.listen(port, () => {
    console.log(`Server listening on ${port}`);
});