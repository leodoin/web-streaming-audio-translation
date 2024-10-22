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

// Create a writable stream for the output file
const outputFilePath = path.join(__dirname, 'output.pcm');
const fileStream = fs.createWriteStream(outputFilePath);

console.log('Output file:', outputFilePath);


// Set up environment variables (replace with your own keys if not using env vars)
const speechKey = process.env.AZURE_SPEECH_KEY || 'your_speech_api_key';
const serviceRegion = process.env.AZURE_SPEECH_REGION || 'your_region';

io.on('connection', (socket) => {
    console.log('Client connected via Socket.io');

    // Set up Azure Speech SDK
    const translationConfig = sdk.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
    translationConfig.speechRecognitionLanguage = 'en-US';
    const translateTo = ['fr', 'es', 'de'];
    translateTo.forEach(lang => translationConfig.addTargetLanguage(lang));

    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
        console.log('Interim result:', e.result.text);
        socket.emit('interimResult', { text: e.result.text });
    };

    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.TranslatedSpeech) {
            console.log(`Final result: ${e.result.text}`);
            const translations = {};
            translateTo.forEach(lang => {
                translations[lang] = e.result.translations.get(lang);
            });
            socket.emit('finalResult', { text: e.result.text, translations });
        }
    };

    recognizer.startContinuousRecognitionAsync(() => {
        console.log('Recognition started...');
    }, (err) => {
        console.error('Error starting recognition:', err);
    });

    // Handle incoming audio chunks from the client
    socket.on('audioChunk', (pcmChunk) => {
        // console.log('Received PCM audio chunk');
        const buffer = Buffer.from(pcmChunk);  // Convert to Node.js Buffer
        console.log('Received audio chunk, size:', buffer.length);
        pushStream.write(buffer);
        fileStream.write(buffer);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected, closing streams...');
        pushStream.close();
        recognizer.close();
        playPCMFile(outputFilePath);
    });
});

// Start the server
server.listen(3000, () => {
    console.log('Server is running on port 3000');
});