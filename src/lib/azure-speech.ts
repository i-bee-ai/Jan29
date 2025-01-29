import * as speechsdk from 'microsoft-cognitiveservices-speech-sdk';

const AZURE_SPEECH_KEY = 'GC2sTwUN1VJbxqkQ3qWOoKGtYLk5jEVuIQyRbpdYsagBfsZwbETbJQQJ99BAACYeBjFXJ3w3AAAYACOGQ31i';
const AZURE_SPEECH_REGION = 'eastus';

export class AzureSpeechService {
  private recognizer: speechsdk.SpeechRecognizer | null = null;
  private isListening = false;
  private onTranscriptCallback: ((text: string, source: 'mic' | 'tab') => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private source: 'mic' | 'tab';
  private mediaStream: MediaStream | null = null;
  private lastRecognizedText: string = '';

  constructor(source: 'mic' | 'tab', mediaStream?: MediaStream) {
    this.source = source;
    this.mediaStream = mediaStream || null;
  }

  initialize(
    onTranscript: (text: string, source: 'mic' | 'tab') => void,
    onError: (error: string) => void
  ): void {
    try {
      this.onTranscriptCallback = onTranscript;
      this.onErrorCallback = onError;

      const speechConfig = speechsdk.SpeechConfig.fromSubscription(
        AZURE_SPEECH_KEY,
        AZURE_SPEECH_REGION
      );
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.setProfanity(speechsdk.ProfanityOption.Raw);
      speechConfig.outputFormat = speechsdk.OutputFormat.Detailed;
      
      // Set recognition mode to conversation
      speechConfig.setServiceProperty(
        "SPEECH-RecognitionMode",
        "CONVERSATION",
        speechsdk.ServicePropertyChannel.UriQueryParameter
      );

      // Optimize silence timeouts
      speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "2000");
      speechConfig.setProperty(speechsdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "500");

      let audioConfig;
      if (this.source === 'mic') {
        audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
      } else if (this.mediaStream && this.mediaStream.getAudioTracks().length > 0) {
        // Create audio config directly from the media stream
        audioConfig = speechsdk.AudioConfig.fromStreamInput(this.mediaStream);
      } else {
        throw new Error('No audio source available');
      }

      this.recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);
      this.setupRecognition();
      console.log(`Azure Speech Service initialized for ${this.source} in Conversation mode with optimized timeouts`);
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      onError('Speech recognition initialization failed. Please check your connection and try again.');
    }
  }

  private setupRecognition(): void {
    if (!this.recognizer) return;

    // We'll only use recognized event for final results
    this.recognizer.recognized = (_, event) => {
      if (event.result.text) {
        const text = event.result.text.trim();
        // Only send if it's different from the last recognized text
        if (text && text !== this.lastRecognizedText && this.onTranscriptCallback) {
          this.lastRecognizedText = text;
          this.onTranscriptCallback(text, this.source);
        }
      }
    };

    this.recognizer.canceled = (_, event) => {
      const errorMessage = event.errorDetails || 'Unknown error occurred';
      console.error('Recognition canceled:', errorMessage);
      if (this.onErrorCallback) {
        this.onErrorCallback(`Recognition error: ${errorMessage}`);
      }
      this.stopListening();
    };

    this.recognizer.sessionStopped = () => {
      this.stopListening();
    };
  }

  startListening(): void {
    if (this.isListening || !this.recognizer) return;
    
    try {
      this.isListening = true;
      this.lastRecognizedText = ''; // Reset last recognized text
      this.recognizer.startContinuousRecognitionAsync(
        () => console.log(`Recognition started for ${this.source}`),
        error => {
          console.error('Failed to start recognition:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback('Failed to start recognition. Please check your permissions.');
          }
        }
      );
    } catch (error) {
      console.error('Failed to start recognition:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback('Failed to start recognition. Please check your permissions.');
      }
    }
  }

  stopListening(): void {
    if (!this.isListening || !this.recognizer) return;

    try {
      this.isListening = false;
      this.recognizer.stopContinuousRecognitionAsync(
        () => console.log(`Recognition stopped for ${this.source}`),
        error => console.error('Error stopping recognition:', error)
      );
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
  }

  cleanup(): void {
    if (this.recognizer) {
      this.stopListening();
      this.recognizer.close();
      this.recognizer = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
} 