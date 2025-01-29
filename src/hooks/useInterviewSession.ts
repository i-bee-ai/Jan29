import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { InterviewSession, TranscriptHistory } from '../types/interview';

export function useInterviewSession() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);

  // Load active session on mount
  useEffect(() => {
    if (user) {
      loadActiveSession();
    }
  }, [user]);

  const loadActiveSession = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('userId', user?.id)
        .eq('status', 'active')
        .single();

      if (fetchError && !fetchError.message.includes('no rows')) {
        throw fetchError;
      }

      if (data) {
        setActiveSession(data as InterviewSession);
      }
    } catch (err) {
      console.error('Error loading active session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load active session');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Create new session
      const newSession: Partial<InterviewSession> = {
        userId: user.id,
        startTime: new Date().toISOString(),
        status: 'active',
        transcriptHistory: {
          User: [],
          Interviewer: []
        }
      };

      const { data, error: insertError } = await supabase
        .from('interview_sessions')
        .insert([newSession])
        .select()
        .single();

      if (insertError) throw insertError;

      const session = data as InterviewSession;
      setActiveSession(session);
      return session;
    } catch (err) {
      console.error('Error starting session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTranscriptHistory = async (transcriptHistory: TranscriptHistory) => {
    if (!activeSession) return;

    try {
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({ transcriptHistory })
        .eq('id', activeSession.id);

      if (updateError) throw updateError;

      setActiveSession(prev => prev ? { ...prev, transcriptHistory } : null);
    } catch (err) {
      console.error('Error updating transcript history:', err);
      setError(err instanceof Error ? err.message : 'Failed to update transcript history');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;

    try {
      setLoading(true);
      const { error: updateError } = await supabase
        .from('interview_sessions')
        .update({
          status: 'completed',
          endTime: new Date().toISOString()
        })
        .eq('id', activeSession.id);

      if (updateError) throw updateError;

      setActiveSession(null);
    } catch (err) {
      console.error('Error ending session:', err);
      setError(err instanceof Error ? err.message : 'Failed to end session');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    activeSession,
    startSession,
    endSession,
    updateTranscriptHistory
  };
} 