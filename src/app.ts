import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { connectionController } from './socket-controller';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', connectionController);

const port = parseInt(process.env.PORT || '8080');

server.listen(port, () => {
    console.log(`Server listening on ${port}`);
});