const socket = io('http://localhost:3000');

let audioContext;
let audioWorkletNode;

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioContext = new AudioContext({ sampleRate: 16000 });

    // Load the AudioWorklet processor
    await audioContext.audioWorklet.addModule('linear-pcm-processor.js');

    // Create the MediaStreamSource
    const source = audioContext.createMediaStreamSource(stream);

    // Create AudioWorkletNode
    audioWorkletNode = new AudioWorkletNode(audioContext, 'linear-pcm-processor');
    
    // Connect the source to the worklet
    source.connect(audioWorkletNode);
    audioWorkletNode.connect(audioContext.destination);  // Optional, to avoid garbage collection

    // Handle audio data emitted by the AudioWorkletNode
    audioWorkletNode.port.onmessage = (event) => {
        const pcmData = event.data;
        console.log('Sending PCM data chunk to server:', pcmData);
        socket.emit('audioChunk', pcmData);  // Send 16-bit PCM data to the server
    };

    console.log('Microphone recording started...');
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
}

function stopRecording() {
    if (audioContext) {
        audioContext.close();
    }

    console.log('Microphone recording stopped.');
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
}

document.getElementById('start').addEventListener('click', startRecording);
document.getElementById('stop').addEventListener('click', stopRecording);

socket.on('finalResult', (data) => {
    let translations = `<p><strong>Original:</strong> ${data.text}</p>`;
    Object.keys(data.translations).forEach(lang => {
        translations += `<p><strong>${lang}:</strong> ${data.translations[lang]}</p>`;
    });
    document.getElementById('results').innerHTML += translations;
});