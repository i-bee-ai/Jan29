import { useState, useRef } from 'react';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { TranscriptHistory } from '../types/interview';

interface AIResponse {
  id: string;
  text: string;
  timestamp: number;
}

interface UserData {
  cv: { content: any };
  jd: { content: any };
  linkedin: { content: any };
  portfolio: { content: any };
  qa: { content: any };
}

interface CerebrasStreamResponse {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      'csk-dttm9ywc6dmrjywxmdckj22d8wh9e4f668ceypjmwpjwnyjd': string;
    }
  }
}

const cerebras = new Cerebras({
  apiKey: import.meta.env.VITE_CEREBRAS_API_KEY
});

const createSystemPrompt = (userData: UserData, transcriptHistory: TranscriptHistory) => {
  console.log('Creating system prompt with user data:', {
    cv: userData?.cv,
    jd: userData?.jd,
    linkedin: userData?.linkedin,
    portfolio: userData?.portfolio,
    qa: userData?.qa,
    transcriptHistory: transcriptHistory
  });

  console.log('Current transcript history:', transcriptHistory);

  const formattedTranscript = transcriptHistory.Interviewer.map((text, index) => {
    const response = transcriptHistory.User[index] || '';
    return `Interviewer: ${text}\nUser: ${response}`;
  }).join('\n\n');

  const prompt = `
You are an advanced AI interview assistant with access to:
1. CV Data: ${JSON.stringify(userData?.cv.content)}
2. JD Data: ${JSON.stringify(userData?.jd.content)}
3. LinkedIn Data: ${JSON.stringify(userData?.linkedin.content)}
4. Portfolio Data: ${JSON.stringify(userData?.portfolio.content)}
5. QA Data: ${JSON.stringify(userData?.qa.content)}
6. Transcript History: ${formattedTranscript}

When you receive a question from the interviewer, follow these steps:

1. Identify the interview type (e.g., Technical, Behavioral, Managerial, or Other).
2. Adopt the corresponding expert persona:
   - **Technical**: Detail-oriented, solution-focused, and comfortable discussing technical intricacies.
   - **Behavioral**: Storytelling approach, emphasizing experiences and personal insights.
   - **Managerial**: Leadership-driven, highlighting strategy, collaboration, and decision-making.
   - **Other**: Provide a general, polished response.
3. Identify the question type (skills/experience, portfolio/project, previously answered, or other).
4. If Skills/Experience related, reference CV & JD details to enhance credibility.
5. If Portfolio/Project related, reference Portfolio & LinkedIn highlights.
6. If it appears in QA or has been addressed, refer to QA Data & Transcript History to maintain consistency.
7. Otherwise, provide a generic or clarifying response.
8. In all responses:
   - Use a Formal, Polished Tone
   - Be Concise, Clear, and Engaging
   - Structure answers effectively with bullet points or short paragraphs
   - Limit each bullet point to 15 words or fewer
   - Do not reveal or quote data sets verbatim, but seamlessly integrate relevant details
   - Maintain consistency with previously provided answers
   - Avoid discussing AI processes or meta-commentary

Return a final, structured answer suitable for an interview context.`;

  console.log('Complete system prompt:', prompt);
  return prompt;
};

export const useAIResponse = (userData: UserData) => {
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const controller = useRef<AbortController | null>(null);

  const generateResponse = async (text: string, transcriptHistory: TranscriptHistory) => {
    console.log('Generating AI response for text:', text);
    console.log('Using transcript history:', transcriptHistory);
    
    // Abort previous request if exists
    if (controller.current) {
      controller.current.abort();
    }

    controller.current = new AbortController();

    try {
      const systemPrompt = createSystemPrompt(userData, transcriptHistory);
      console.log('Sending request to LLM with system prompt:', systemPrompt);

      const stream = await cerebras.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        model: 'llama3.3-70b',
        stream: true,
        max_completion_tokens: 8192,
        temperature: 0.2,
        top_p: 1
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const typedChunk = chunk as CerebrasStreamResponse;
        fullResponse += typedChunk.choices[0]?.delta?.content || '';
      }

      if (fullResponse) {
        const formattedResponse = fullResponse.replace(/^[-*]\s/gm, '• ').replace(/\n{3,}/g, '\n\n');
        console.log('Formatted response:', formattedResponse);
        
        setResponses((prev: AIResponse[]) => [...prev, {
          id: crypto.randomUUID(),
          text: formattedResponse,
          timestamp: Date.now()
        }]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error generating AI response:', error);
      }
    } finally {
      if (controller.current?.signal.aborted) {
        controller.current = null;
      }
    }
  };

  return {
    responses,
    generateResponse
  };
}; 