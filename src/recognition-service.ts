import sdk from 'microsoft-cognitiveservices-speech-sdk';

// Set up environment variables (replace with your own keys if not using env vars)
const speechKey = process.env.AZURE_SPEECH_KEY || 'your_speech_api_key';
const serviceRegion = process.env.AZURE_SPEECH_REGION || 'your_region';

let azureRecognizer: sdk.TranslationRecognizer
let pushStream: sdk.PushAudioInputStream


export type Translations = {
    [key: string]: string
}

export type RecognizedResult = {
    text: string,
    translations: Translations
}

export type Language = 'en-US' | 'pt' | 'es' | 'fr' | 'de'

const start = (
        source: Language,
        target: Language[],
        onRecognized: (result: RecognizedResult) => void,
        onRecognizing: (result: RecognizedResult) => void
    ) => {
    console.log(`translating from ${source} to ${target}`);
    console.log(`Using speech key ${speechKey} in region ${serviceRegion}`);
    const translationConfig = sdk.SpeechTranslationConfig.fromSubscription(speechKey, serviceRegion);
    translationConfig.speechRecognitionLanguage = source ;
    target.forEach(lang => translationConfig.addTargetLanguage(lang));

    pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    azureRecognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

    azureRecognizer.recognized = (s, e) => {
        // Check if the result is a translated speech result
        if(e.result.reason !== sdk.ResultReason.TranslatedSpeech) return
        const translations: Translations = {};
        e.result.translations.languages.forEach((lang: string) => {
            translations[lang] = e.result.translations.get(lang);
        });
        onRecognized({ text: e.result.text, translations });
    };

    azureRecognizer.recognizing = (s, e) => {
        // Check if the result is a translated speech result
        const translations: Translations = {};
        e.result.translations.languages.forEach((lang: string) => {
            translations[lang] = e.result.translations.get(lang);
        });
        onRecognizing({ text: e.result.text, translations });
    };

    azureRecognizer.startContinuousRecognitionAsync(() => {
        console.log('Recognition started...');
    }, (err) => {
        console.log("Error",err)
    })

    return azureRecognizer;
}

const push = (pcmChunk: ArrayBuffer) => {
    if(!pushStream){ 
        throw new Error('Stream is closed') 
    }
    // console.log('Pushing audio chunk', pcmChunk.length);
    const buffer = Buffer.from(pcmChunk);  // Convert to Node.js Buffer
    pushStream.write(buffer);
}

const stop = () => {
    if (pushStream) pushStream.close();
    if (azureRecognizer) {
        azureRecognizer.stopContinuousRecognitionAsync(() => {
            console.log('Recognition stopped');
            azureRecognizer.close();
        });
    }
}

export const recognizer = {
    start,
    stop,
    push
}