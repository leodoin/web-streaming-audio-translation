const sdk = require('microsoft-cognitiveservices-speech-sdk');
const recorder = require('node-record-lpcm16');

// Set up environment variables (replace with your own keys if not using env vars)
const speechKey = process.env.AZURE_SPEECH_KEY || 'your_speech_api_key';
const serviceRegion = process.env.AZURE_SPEECH_REGION || 'your_region';
console.log(`Using speech key ${speechKey} in region ${serviceRegion}`);
const sampleRateHertz = 16000;  // Sample rate for Azure Speech API

function translateSpeechFromMic() {
    const translationConfig = sdk.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
    translationConfig.speechRecognitionLanguage = "en-US";
    const translateTo = ["fr", "es", "de"];
    translateTo.forEach(lang => translationConfig.addTargetLanguage(lang));

    const pushStream = sdk.AudioInputStream.createPushStream();

    // Use the custom PushStream as the audio input for the recognizer
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

    console.log("Starting translation from microphone input...");

    recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.TranslatedSpeech) {
            console.log(`Recognized: ${e.result.text}`);

            // Print out the translations in the target languages
            translateTo.forEach(lang => {
                const translation = e.result.translations.get(lang);
                console.log(`Translation [${lang}]: ${translation}`);
            });
        } else if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
            console.log(`Recognized: ${e.result.text} (no translation available)`);
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
            console.log("No speech could be recognized.");
        }
    };

    recognizer.sessionStarted = () => {
        console.log("Session started.");
    };

    recognizer.sessionStopped = () => {
        console.log("Session stopped.");
        recorder.stop();
    };

    recognizer.canceled = (s, e) => {
        console.error(`CANCELED: ${e.reason}`);
        recognizer.close();
        recorder.stop();
    };

    recognizer.startContinuousRecognitionAsync(() => {
        console.log("Recognition started...");
        console.log("Translation started. Speak into your microphone...");
    }, (err) => {
        console.error(`ERROR: ${err}`);
        recognizer.close();
        recorder.stop();
    });

    // Start recording and pipe the microphone input into the custom stream
    recorder
        .record({
            sampleRateHertz: sampleRateHertz,
            threshold: 0,
            verbose: false,
            recordProgram: 'rec',  // Or "sox", depending on what you have installed
            silence: '10.0',  // Stop after 10 seconds of silence
        })
        .stream()
        .on('error', console.error)
        .on('data', (chunk) => {
            // console.log(`Received ${chunk.length} bytes of data.`);
            pushStream.write(chunk);
        })
        .on('end', () => {
            pushStream.close();
        });
}

translateSpeechFromMic();