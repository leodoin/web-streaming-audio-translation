const sdk = require('microsoft-cognitiveservices-speech-sdk');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const fs = require('fs');
const path = require('path');


// Set up environment variables (replace with your own keys if not using env vars)
const speechKey = process.env.AZURE_SPEECH_KEY || 'your_speech_api_key';
const serviceRegion = process.env.AZURE_SPEECH_REGION || 'your_region';
console.log(`Using speech key ${speechKey} in region ${serviceRegion}`);

let recognizer;
let pushStream;
let fileStream;


io.on('connection', (socket) => {
    console.log('Client connected via Socket.io');

    socket.on('ping', () => {
        console.log('Received ping');
        socket.emit('pong');
    });


    socket.on('startStream', () => {
        console.log('Starting stream...');

        const obj = setAzureSdk();
        recognizer = obj.recognizer;
        pushStream = obj.pushStream;
        fileStream = pcmFileStream('output');
    
    
        recognizer.recognizing = (s, e) => {
            console.log('Interim result:', e.result.text);
            socket.emit('interimResult', { text: e.result.text });
        };
    
        recognizer.recognized = (s, e) => {
            // Check if the result is a translated speech result
            if (e.result.reason === sdk.ResultReason.TranslatedSpeech) {
                console.log(`Final result: ${e.result.text}`);
                console.log('Translations:', e.result.translations);
                const translations = {}
                e.result.translations.privMap.privKeys.forEach((lang, index) => {
                    console.log('Language:', lang);
                    console.log('Index:', index);
                    console.log('Translation:', e.result.translations.privMap.privValues[index]);
                    translations[lang] = e.result.translations.privMap.privValues[index];
                })
                console.log({ text: e.result.text, translations });
                socket.emit('finalResult', { text: e.result.text, translations });
            }
        };

        recognizer?.startContinuousRecognitionAsync(() => {
            console.log('Recognition started...');
        }, (err) => {
            console.error('Error starting recognition:', err);
        });
    })

    // Handle incoming audio chunks from the client
    socket.on('audioChunk', (pcmChunk) => {
        // console.log('Received PCM audio chunk');
        const buffer = Buffer.from(pcmChunk);  // Convert to Node.js Buffer
        // console.debug('Received audio chunk, size:', buffer.length);
        pushStream.write(buffer);
        fileStream.write(buffer);
    });

    socket.on('endOfStream', () => {
        console.log('End of stream');
        closeStream(pushStream, fileStream, recognizer);
        // playPCMFile(path.join(__dirname, 'public', 'output.pcm'));
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected, closing streams...');
        closeStream(pushStream, fileStream, recognizer);
    });
});

function closeStream(pushStream, fileStream, recognizer) {
    pushStream?.close();
    fileStream?.end();
    recognizer?.stopContinuousRecognitionAsync(() => {
        console.log('Recognition stopped');
        recognizer?.close();
    });
}

function pcmFileStream(fileName) {
    const outputFilePath = path.join(__dirname, 'public',  `${fileName}.pcm`);
    return fs.createWriteStream(outputFilePath);
}

function setAzureSdk(){
    // Set up Azure Speech SDK
    const translationConfig = sdk.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
    translationConfig.speechRecognitionLanguage = 'en-US';
    const translateTo = ['pt', 'fr', 'es', 'de'];
    translateTo.forEach(lang => translationConfig.addTargetLanguage(lang));

    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

    return {recognizer, pushStream};
}

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});