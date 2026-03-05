import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: string;
  sentiment: number; // -1 to 1
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

export async function analyzeSalesCall(audioBase64: string, mimeType: string): Promise<CallAnalysis> {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze this sales call recording. 
    1. Provide a diarized transcript with timestamps and sentiment for each segment.
    2. Provide a coaching card with 3 things the salesperson did well and 3 missed opportunities.
    3. Provide a brief summary of the call.
    
    The sentiment should be a number between -1 (negative/low engagement) and 1 (positive/high engagement).
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
                },
                required: ["speaker", "text", "timestamp", "sentiment"],
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
