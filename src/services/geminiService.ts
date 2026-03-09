import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: string;
  sentiment: number; // -1 to 1
  confidence: number; // 0 to 1
}

export interface CoachingInsights {
  strengths: string[];
  opportunities: string[];
  summary: string;
}

export interface CallAnalysis {
  transcript: TranscriptSegment[];
  insights: CoachingInsights;
  overallSentiment: number;
}

export async function analyzeSalesCall(audioBase64: string, mimeType: string, customInstructions?: string): Promise<CallAnalysis> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this sales call recording. 
    1. Provide a diarized transcript with timestamps, sentiment, and confidence score for each segment.
    2. Provide a coaching card with 3 things the salesperson did well and 3 missed opportunities.
    3. Provide a brief summary of the call.
    
    ${customInstructions ? `SPECIAL COACHING FOCUS: ${customInstructions}` : ""}

    The sentiment should be a number between -1 (negative/low engagement) and 1 (positive/high engagement).
    The confidence should be a number between 0 and 1 representing the AI's confidence in the transcription accuracy for that segment.
    Identify speakers as "Sales Representative" and "Customer".
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  sentiment: { type: Type.NUMBER },
                  confidence: { type: Type.NUMBER },
                },
                required: ["speaker", "text", "timestamp", "sentiment", "confidence"],
              },
            },
            insights: {
              type: Type.OBJECT,
              properties: {
                strengths: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                opportunities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                summary: { type: Type.STRING },
              },
              required: ["strengths", "opportunities", "summary"],
            },
            overallSentiment: { type: Type.NUMBER },
          },
          required: ["transcript", "insights", "overallSentiment"],
        },
      },
    });

    if (!response.text) {
      throw new Error("EMPTY_RESPONSE");
    }

    const result = JSON.parse(response.text);
    return result as CallAnalysis;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    if (error.message?.includes("quota") || error.message?.includes("429")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (error.message?.includes("safety") || error.message?.includes("blocked")) {
      throw new Error("SAFETY_BLOCK");
    }
    if (error.message?.includes("invalid") || error instanceof SyntaxError) {
      throw new Error("INVALID_FORMAT");
    }
    
    throw new Error(error.message || "UNKNOWN_ERROR");
  }
}

export interface LiveCoachingCallbacks {
  onTranscript: (text: string, speaker: string, sentiment: number) => void;
  onCoachingTip: (tip: string) => void;
  onAudioData?: (base64Audio: string) => void;
  onError: (error: any) => void;
  onClose: () => void;
}

export async function connectLiveCoaching(callbacks: LiveCoachingCallbacks) {
  const model = "gemini-2.5-flash-native-audio-preview-09-2025";
  
  const sessionPromise = ai.live.connect({
    model,
    callbacks: {
      onopen: () => {
        console.log("Live coaching session opened");
      },
      onmessage: async (message: LiveServerMessage) => {
        // Handle model response (coaching tips)
        if (message.serverContent?.modelTurn) {
          const parts = message.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.text) {
              callbacks.onCoachingTip(part.text);
            }
            if (part.inlineData && callbacks.onAudioData) {
              callbacks.onAudioData(part.inlineData.data);
            }
          }
        }

        // Handle transcription and sentiment if provided in server content
        // Note: Real-time sentiment might be part of the model's text response 
        // or we can prompt the model to output it in a specific format.
      },
      onerror: (err) => {
        callbacks.onError(err);
      },
      onclose: () => {
        callbacks.onClose();
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: `
        You are an expert Sales Coach. 
        Listen to the salesperson's live audio.
        1. Provide brief, actionable coaching tips in real-time when you notice something important.
        2. Be encouraging but direct.
        3. Focus on discovery, empathy, and objection handling.
        Keep tips short (under 15 words) so they don't distract the salesperson.
      `,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Zephyr" }
        }
      }
    }
  });

  return sessionPromise;
}
