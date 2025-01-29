export interface InterviewSession {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'paused' | 'completed';
  transcriptHistory: TranscriptHistory;
}

export interface InterviewDetails {
  company: string;
  cv: string;
  jobDescriptionLink?: string;
  jobDescriptionText?: string;
  interviewType: string;
}

export interface InterviewFormData extends InterviewDetails {
  id?: string;
  userId?: string;
  status?: 'draft' | 'scheduled' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface TranscriptHistory {
  User: string[];
  Interviewer: string[];
}

export interface TranscriptionBubble {
  id: number;
  text: string;
  timestamp: number;
  isComplete: boolean;
}