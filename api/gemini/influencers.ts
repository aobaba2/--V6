import { GoogleGenAI, Type } from "@google/genai";

let aiClient: any = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              avatar: { type: Type.STRING },
              sentiment: { type: Type.STRING, enum: ['bullish', 'bearish', 'neutral'] },
              content: { type: Type.STRING },
              time: { type: Type.STRING }
            },
            required: ['name', 'avatar', 'sentiment', 'content', 'time']
          }
        }
      }
    });

    res.status(200).json({ text: response.text });
  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || "";
    if (errorMsg.includes("credits are depleted") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
      console.warn("Vercel Gemini Influencers Warning: Prepayment credits depleted or rate limit hit.");
      return res.status(429).json({ error: errorMsg });
    }
    console.error("Vercel Gemini Influencers Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "AI influencer fetch failed" });
  }
}
