/**
 * AudioStudio - Production Audio & Speech Module
 * Features:
 * 1. Continuous Speech Recognition (Voice-to-Text dictation).
 * 2. MediaRecorder Voice Note Recorder with live Canvas Waveform visualizer.
 * 3. Web Audio API synthesized Ambient Soundscapes (Rain, Cafe, Ocean, Binaural Beats) for focus.
 */

class AudioStudio {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        
        // Voice Note Recorder state
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.recordingTimer = null;

        // Ambient Soundscape state
        this.audioCtx = null;
        this.ambientNodes = {};
        this.activeSoundscape = null;
    }

    /**
     * Initialize Speech-to-Text Dictation
     */
    initSpeechRecognition(onResultCallback, onErrorCallback) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition API not supported in this browser.');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (onResultCallback) {
                onResultCallback(finalTranscript, interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            if (onErrorCallback) onErrorCallback(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        return true;
    }

    toggleSpeech(onResultCallback, onErrorCallback, onStatusChange) {
        if (!this.recognition) {
            const supported = this.initSpeechRecognition(onResultCallback, onErrorCallback);
            if (!supported) {
                if (onErrorCallback) onErrorCallback('Speech recognition not supported in browser.');
                return;
            }
        }

        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            if (onStatusChange) onStatusChange(false);
        } else {
            try {
                this.recognition.start();
                this.isListening = true;
                if (onStatusChange) onStatusChange(true);
            } catch (e) {
                console.error('Speech start error:', e);
            }
        }
    }

    /**
     * Start Voice Note Recording with live Canvas Waveform
     */
    async startVoiceRecording(canvasElement, onTimeUpdate) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Microphone access not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        // Audio Context for Canvas Visualizer
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const ctx = canvasElement ? canvasElement.getContext('2d') : null;

        const drawWaveform = () => {
            if (!this.isRecording) return;
            requestAnimationFrame(drawWaveform);

            analyser.getByteFrequencyData(dataArray);

            if (ctx && canvasElement) {
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                const barWidth = (canvasElement.width / bufferLength) * 1.5;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvasElement.height;
                    ctx.fillStyle = `rgba(167, 139, 250, ${0.4 + (barHeight / canvasElement.height) * 0.6})`;
                    ctx.fillRect(x, canvasElement.height - barHeight, barWidth - 1, barHeight);
                    x += barWidth;
                }
            }
        };

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingStartTime = Date.now();

        drawWaveform();

        if (onTimeUpdate) {
            this.recordingTimer = setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                onTimeUpdate(elapsedSec);
            }, 1000);
        }
    }

    /**
     * Stop Voice Note Recording & return Base64 Audio Data URL
     */
    async stopVoiceRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            clearInterval(this.recordingTimer);
            this.isRecording = false;

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Stop stream tracks
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    resolve(reader.result);
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    // ==================== WEB AUDIO SYNTHESIZED SOUNDSCAPES ====================

    getAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    /**
     * Play synthesized ambient noise (Rain, Ocean, Binaural Beats, Forest)
     */
    toggleAmbientSoundscape(type, volume = 0.3) {
        if (this.activeSoundscape === type) {
            this.stopAmbientSoundscape();
            return false;
        }

        this.stopAmbientSoundscape();
        const ctx = this.getAudioContext();

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(volume, ctx.currentTime);
        masterGain.connect(ctx.destination);

        if (type === 'rain') {
            // Pink noise generator for rain
            const bufferSize = ctx.sampleRate * 2;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11;
                b6 = white * 0.115926;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            whiteNoise.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, ctx.currentTime);

            whiteNoise.connect(filter);
            filter.connect(masterGain);
            whiteNoise.start();

            this.ambientNodes = { sources: [whiteNoise], masterGain };
        } else if (type === 'binaural') {
            // Binaural Beats (Alpha waves ~10Hz difference for focus)
            const oscL = ctx.createOscillator();
            const oscR = ctx.createOscillator();
            const merger = ctx.createChannelMerger(2);

            oscL.frequency.setValueAtTime(200, ctx.currentTime); // 200 Hz Left
            oscR.frequency.setValueAtTime(210, ctx.currentTime); // 210 Hz Right (10Hz Alpha beat)

            oscL.connect(merger, 0, 0);
            oscR.connect(merger, 0, 1);
            merger.connect(masterGain);

            oscL.start();
            oscR.start();

            this.ambientNodes = { sources: [oscL, oscR], masterGain };
        } else if (type === 'ocean') {
            // Low-pass modulated noise simulating ocean waves
            const bufferSize = ctx.sampleRate * 3;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, ctx.currentTime);

            // Modulate filter frequency for wave motion
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(0.1, ctx.currentTime); // 10s wave cycle
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(300, ctx.currentTime);

            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);

            noise.connect(filter);
            filter.connect(masterGain);

            lfo.start();
            noise.start();

            this.ambientNodes = { sources: [noise, lfo], masterGain };
        }

        this.activeSoundscape = type;
        return true;
    }

    stopAmbientSoundscape() {
        if (this.ambientNodes && this.ambientNodes.sources) {
            this.ambientNodes.sources.forEach(src => {
                try { src.stop(); } catch (e) {}
            });
        }
        this.ambientNodes = {};
        this.activeSoundscape = null;
    }

    setAmbientVolume(vol) {
        if (this.ambientNodes && this.ambientNodes.masterGain && this.audioCtx) {
            this.ambientNodes.masterGain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        }
    }
}

// Global Audio Studio Singleton
const audioStudio = new AudioStudio();
