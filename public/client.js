const socket = io('http://localhost:8080');

const audioManager = getAudioManager();

setupSocket(socket);

async function startRecording() {
    // Start recording audio from the microphone
    audioWorkletNode = await audioManager.start()
    // Handle audio data emitted by the AudioWorkletNode
    audioWorkletNode.port.onmessage = (event) => {
        const pcmData = event.data;
        // console.log('Sending PCM data chunk to server:', pcmData);
        socket.emit('audioChunk', pcmData);  // Send 16-bit PCM data to the server
    };
    console.log('Microphone recording started...');
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = false;
    socket.emit('startStream');
};

function setupSocket(socket){

    console.log('Client connected via Socket.io');

    socket.on('pong', () => {
        console.log('Received pong');
    });

    socket.on('interimResult', (data) => {
        let translations = `<p><strong>Original:</strong> ${data.text}</p>`;
        Object.keys(data.translations).forEach(lang => {
            translations += `<p><strong>${lang}:</strong> ${data.translations[lang]}</p>`;
        });
        updateInterimResult(translations);
    });

    socket.on('finalResult', (data) => {
        console.log('Final result:');
        let translations = `<p><strong>Original:</strong> ${data.text}</p>`;
        Object.keys(data.translations).forEach(lang => {
            translations += `<p><strong>${lang}:</strong> ${data.translations[lang]}</p>`;
        });
        appendFinalResult(translations);
    });

    socket.on('disconnect', (data) => {
        console.log('Client disconnected, stopping recording...');
        stopRecording();
    });
}

function getAudioManager() {
    let audioContext
    const createAudioWorkletNode = async () => {
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
        audioWorkletNode.connect(audioContext.destination);

        return audioWorkletNode;
    };
    const closeAudioContext = () => {
        if (audioContext) {
            audioContext.close();
        }
    }
    return {
        start: createAudioWorkletNode,
        stop: closeAudioContext
    }
};

function ping() {
    socket.emit('ping');
    console.log('Sent ping');
}

function stopRecording() {
    audioManager.stop();
    console.log('Microphone recording stopped.');
    document.getElementById('start').disabled = false;
    document.getElementById('stop').disabled = true;
    socket.emit('endOfStream');
}

function updateInterimResult(text) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = text;  // Use innerHTML to preserve formatting
}

function appendFinalResult(text) {
    const historyDiv = document.getElementById('history');
    const resultElement = document.createElement('div');
    resultElement.className = 'final';
    resultElement.innerHTML = text;  // Use innerHTML to preserve formatting
    historyDiv.appendChild(resultElement);
    historyDiv.scrollTop = historyDiv.scrollHeight;  // Auto-scroll to the bottom
}


document.getElementById('ping').addEventListener('click', ping);
document.getElementById('start').addEventListener('click', startRecording);
document.getElementById('stop').addEventListener('click', stopRecording);
