import sdk from 'microsoft-cognitiveservices-speech-sdk';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import e from 'express';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const recognizer = Recognizer();

server.listen(3000, () => {
    console.log(`Server listening on http://localhost:3000`);
});


io.on('connection', (socket) => {
    console.log(`Client connected via Socket.io: ${socket.id}`);

    socket.on('startStream', () => {
        console.log('Starting stream...');
        const rec = recognizer.start({
            source: 'en-US',
            target: ['pt', 'fr', 'es', 'de'],

        });

        rec.onRecognizing = (s,e) => {
            console.log('Recognizing:', e);
        }
        rec.onRecognized = (s,e) => {
            console.log('Recognized:', e);
        }

        rec.onCanceled = (s,e) => {
            console.log('Canceled:', e);
        }
    });

    socket.on('audioChunk', (pcmChunk) => {
        recognizer.push(pcmChunk);
    });

    socket.on('endOfStream', () => {
        console.log('End of stream');
        recognizer.stop();
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected, closing recognizer...');
        recognizer.stop();
    });

    socket.on('ping', () => {
        console.log('Received ping');
        socket.emit('pong');
    });

});

function Recognizer() {
    // Set up environment variables (replace with your own keys if not using env vars)
    const speechKey = process.env.AZURE_SPEECH_KEY || 'your_speech_api_key';
    const serviceRegion = process.env.AZURE_SPEECH_REGION || 'your_region';
    let recognizer
    let pushStream
    let testStream

    const start = ({source, target, onRecognized, onRecognizing}) => {
        console.log(`translating from ${source} to ${target}`);
        console.log(`Using speech key ${speechKey} in region ${serviceRegion}`);
        const translationConfig = sdk.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
        translationConfig.speechRecognitionLanguage = source ;
        target.forEach(lang => translationConfig.addTargetLanguage(lang));

        testStream = fs.createWriteStream('test.pcm');
    
        pushStream = sdk.AudioInputStream.createPushStream();
        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        recognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

        console.log(recognizer)

        recognizer.onRecognized = (s,e) => {
            console.log('Recognized:', e.result.text);
            if (e.result.reason === sdk.ResultReason.TranslatedSpeech) {
                const translations = {}
                e.result.translations.privMap.privKeys.forEach((lang, index) => {
                    translations[lang] = e.result.translations.privMap.privValues[index];
                })
                onRecognized({ text: e.result.text, translations });
            }
        };

        recognizer.onRecognizing = (s,e ) => {
            console.log('Recognizing:', e.result.text);
            const translations = {}
            e.result.translations.privMap.privKeys.forEach((lang, index) => {
                translations[lang] = e.result.translations.privMap.privValues[index];
            })
            onRecognizing({ text: e.result.text, translations });
        };

        recognizer.startContinuousRecognitionAsync(() => {
            console.log('Recognition started...');
        }, (err) => {
            console.log("Error",err)
        })

        return recognizer;
    }

    const push = (pcmChunk) => {
        if(!pushStream || pushStream.isClosed){ 
            throw new Error('Stream is closed') 
        }
        // console.log('Pushing audio chunk', pcmChunk.length);
        const buffer = Buffer.from(pcmChunk);  // Convert to Node.js Buffer
        pushStream.write(buffer);
        testStream.write(buffer);
    }

    const stop = () => {
        if (pushStream) pushStream.close();
        if(testStream) testStream.close();
        if (recognizer) {
            recognizer.stopContinuousRecognitionAsync(() => {
                console.log('Recognition stopped');
                recognizer.close();
            });
        }
    }

    return {
        start,
        stop,
        push
    }
}