import { recognizer } from "./recognition-service";
import { Socket } from "socket.io";

export const connectionController = (socket: Socket) => {
    console.log(`Client connected via Socket.io: ${socket.id}`);

    socket.on('startStream', () => {
        console.log('Starting stream...');
        recognizer.start(
            'en-US',
            ['pt', 'fr', 'es', 'de'],
            (finalResult) => {
                console.log('Recognized:', finalResult);
                socket.emit('finalResult',finalResult);
            },
            (interimResult) => {
                console.log('Recognizing:', interimResult);
                socket.emit('interimResult',interimResult);
            }
        );
    });

    socket.on('audioChunk', (pcmChunk) => {
        recognizer.push(pcmChunk);
    });

    socket.on('endOfStream', () => {
        console.log('End of stream');
        recognizer.stop();
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected, closing recognizerService...');
        recognizer.stop();
    });

    socket.on('ping', () => {
        console.log('Received ping');
        socket.emit('pong');
    });

};