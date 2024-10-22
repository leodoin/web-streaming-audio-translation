// linear-pcm-processor.js
class LinearPCMProcessor extends AudioWorkletProcessor {
    static BUFFER_SIZE = 8192;
    
    constructor() {
      super();
      this.buffer = new Int16Array(LinearPCMProcessor.BUFFER_SIZE);
      this.offset = 0;
    }
  
    process(inputs) {
      const input = inputs[0][0]; // Mono channel
  
      for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        this.buffer[i + this.offset] =
          sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
  
      this.offset += input.length;
  
      // Once the buffer is filled, send it to the main thread
      if (this.offset >= this.buffer.length) {
        this.flush();
      }
  
      return true;  // Keep processor alive
    }
  
    flush() {
      this.offset = 0;
      this.port.postMessage(this.buffer);  // Send buffer to main thread
    }
  }
  
  registerProcessor('linear-pcm-processor', LinearPCMProcessor);