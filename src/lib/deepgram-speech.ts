import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

export class DeepgramSpeechService {
  private client: ReturnType<typeof createClient>;
  private connection: any;
  private isListening = false;
  private onTranscriptCallback: ((text: string, source: 'mic' | 'tab') => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private source: 'mic' | 'tab';
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(source: 'mic' | 'tab', mediaStream?: MediaStream) {
    this.source = source;
    this.mediaStream = mediaStream || null;
    this.client = createClient(DEEPGRAM_API_KEY);
  }

  async initialize(
    onTranscript: (text: string, source: 'mic' | 'tab') => void,
    onError: (error: string) => void
  ): Promise<void> {
    try {
      this.onTranscriptCallback = onTranscript;
      this.onErrorCallback = onError;

      if (this.source === 'mic') {
        try {
          // Request microphone access
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (error) {
          console.error('Error accessing microphone:', error);
          onError('Failed to access microphone. Please check your permissions.');
          return;
        }
      }

      // Create a live transcription connection
      this.connection = this.client.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        punctuate: true,
        interim_results: false
      });

      // Set up event listeners
      await this.setupEventListeners();
      console.log(`Deepgram Speech Service initialized for ${this.source}`);
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      onError('Speech recognition initialization failed. Please check your connection and try again.');
    }
  }

  private async setupEventListeners(): Promise<void> {
    if (!this.connection) return;

    return new Promise((resolve) => {
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('Connection opened');
        resolve();

        this.connection.on(LiveTranscriptionEvents.Close, () => {
          console.log('Connection closed');
          this.isListening = false;
          if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
          }
        });

        this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          if (transcript && this.onTranscriptCallback) {
            console.log(`Received transcript for ${this.source}:`, transcript);
            this.onTranscriptCallback(transcript, this.source);
          }
        });

        this.connection.on(LiveTranscriptionEvents.Error, (error: any) => {
          console.error('Transcription error:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(`Transcription error: ${error.message || 'Unknown error'}`);
          }
        });
      });
    });
  }

  private startStreamingAudio(): void {
    if (!this.mediaStream || !this.connection || this.mediaRecorder) return;

    try {
      // Create a MediaRecorder to capture audio data
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm',
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isListening && this.connection) {
          // Send the audio data to Deepgram
          this.connection.send(event.data);
        }
      };

      // Start recording with a smaller timeslice for more frequent data
      this.mediaRecorder.start(250);
      
      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback('Error recording audio');
        }
      };
    } catch (error) {
      console.error('Error starting audio streaming:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to start audio streaming');
      }
    }
  }

  startListening(): void {
    if (this.isListening) return;
    
    try {
      this.isListening = true;
      if (this.mediaStream) {
        this.startStreamingAudio();
      }
      console.log(`Recognition started for ${this.source}`);
    } catch (error) {
      console.error('Failed to start recognition:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to start recognition. Please check your permissions.');
      }
    }
  }

  stopListening(): void {
    if (!this.isListening) return;

    try {
      this.isListening = false;
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
        this.mediaRecorder = null;
      }
      console.log(`Recognition stopped for ${this.source}`);
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  cleanup(): void {
    this.stopListening();
    
    if (this.connection) {
      this.connection.close();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
} 
