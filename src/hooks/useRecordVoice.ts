import { useState, useRef, useCallback, useEffect } from 'react';
import { DeepgramSpeechService } from '../lib/deepgram-speech';
import { TranscriptHistory, TranscriptionBubble } from '../types/interview';

export const useRecordVoice = () => {
  const [micBubbles, setMicBubbles] = useState<TranscriptionBubble[]>([]);
  const [tabBubbles, setTabBubbles] = useState<TranscriptionBubble[]>([]);
  const [recording, setRecording] = useState<boolean>(false);
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptHistory>({
    User: [],
    Interviewer: []
  });
  const generateResponseRef = useRef<((text: string, history: TranscriptHistory) => void) | null>(null);
  const micServiceRef = useRef<DeepgramSpeechService | null>(null);
  const tabServiceRef = useRef<DeepgramSpeechService | null>(null);
  const bubbleCounter = useRef<number>(0);
  const tabStreamRef = useRef<MediaStream | null>(null);

  const handleTranscription = useCallback((text: string, source: 'mic' | 'tab') => {
    const newBubble: TranscriptionBubble = {
      id: bubbleCounter.current++,
      text,
      timestamp: Date.now(),
      isComplete: true
    };

    if (source === 'mic') {
      console.log('🎤 Microphone Transcription:', text);
      setMicBubbles(prev => [...prev, newBubble]);
      setTranscriptHistory(prev => ({
        ...prev,
        User: [...prev.User, text]
      }));
    } else {
      console.log('🎧 Tab Audio Transcription:', text);
      setTabBubbles(prev => [...prev, newBubble]);
      setTranscriptHistory(prev => ({
        ...prev,
        Interviewer: [...prev.Interviewer, text]
      }));
      if (generateResponseRef.current) {
        generateResponseRef.current(text, transcriptHistory);
      }
    }
  }, [transcriptHistory]);

  const handleError = useCallback((error: string) => {
    console.error('Speech recognition error:', error);
  }, []);

  const getPermissions = async () => {
    try {
      // Get tab audio with processing options
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: true
      });

      // Store the tab stream for video display
      tabStreamRef.current = displayStream;

      // Create a clone of the stream for audio processing
      const audioStream = new MediaStream(displayStream.getAudioTracks());

      // Initialize microphone service
      micServiceRef.current = new DeepgramSpeechService('mic');
      await micServiceRef.current.initialize(handleTranscription, handleError);

      // Initialize tab audio service with the audio stream
      tabServiceRef.current = new DeepgramSpeechService('tab', audioStream);
      await tabServiceRef.current.initialize(handleTranscription, handleError);

      setRecording(true);
      
      // Start listening on both services
      micServiceRef.current.startListening();
      tabServiceRef.current.startListening();
    } catch (error) {
      console.error('Error getting permissions:', error);
      if (tabStreamRef.current) {
        tabStreamRef.current.getTracks().forEach(track => track.stop());
        tabStreamRef.current = null;
      }
    }
  };

  const stopRecording = useCallback(() => {
    setRecording(false);
    
    if (micServiceRef.current) {
      micServiceRef.current.cleanup();
      micServiceRef.current = null;
    }
    
    if (tabServiceRef.current) {
      tabServiceRef.current.cleanup();
      tabServiceRef.current = null;
    }

    if (tabStreamRef.current) {
      tabStreamRef.current.getTracks().forEach(track => track.stop());
      tabStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    recording,
    stopRecording,
    micBubbles,
    tabBubbles,
    getPermissions,
    transcriptHistory,
    tabStreamRef,
    setGenerateResponse: (callback: (text: string, history: TranscriptHistory) => void) => {
      generateResponseRef.current = callback;
    }
  };
}; 