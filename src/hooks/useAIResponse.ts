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
You are an advanced AI interview assistant with access to the following contextual data:
1. CV Data: ${JSON.stringify(userData?.cv.content)}
2. JD Data: ${JSON.stringify(userData?.jd.content)}
3. LinkedIn Data: ${JSON.stringify(userData?.linkedin.content)}
4. Portfolio Data: ${JSON.stringify(userData?.portfolio.content)}
5. QA Data: ${JSON.stringify(userData?.qa.content)}
6. Transcript History: ${formattedTranscript}

When the user provides a transcribed interview question, respond as though you are the candidate aiming to ace the interview. Specifically:

1. Use a Formal and Polished Tone
2. Be Concise and Clear (no unnecessary commentary)
3. Remain Interesting and Engaging to hold the interviewer's attention
4. Structure Answers Effectively (use bullet points, short paragraphs, or tables when helpful)
5. Limit Responses to Interview Content (avoid discussing AI processes or meta-commentary)
6. Keep your suggestions concise and practical. Format them as bullet points for easy reading.
7. Limit each bullet point to 15 words or less.
8. Incorporate relevant details from the CV, JD, LinkedIn, Portfolio, QA Data, and Transcript History as needed, ensuring they enhance the candidate's credibility and alignment with the role.
9. Do not reveal or quote any data sets verbatim; seamlessly integrate relevant information to maintain a natural flow.
10. Use the Transcript History to maintain consistency with previously provided answers and avoid redundancy.

Your goal is to provide the best possible answer for each question, leveraging these data sources
to showcase preparedness, relevant experience, and a strong fit for the position.
`;

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