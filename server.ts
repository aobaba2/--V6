import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Binance API Proxy to avoid CORS
  app.get("/api/binance/*", async (req, res) => {
    try {
      const binancePath = req.params[0];
      const query = new URLSearchParams(req.query as any).toString();
      const url = `https://api.binance.com/${binancePath}${query ? `?${query}` : ""}`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`Binance proxy status ${response.status} representing failure:`, text.substring(0, 500));
        return res.status(response.status).json({ error: `Binance returned status ${response.status}`, details: text.substring(0, 200) });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Binance Proxy Error:", error);
      res.status(500).json({ error: "Failed to fetch from Binance", message: error?.message || "" });
    }
  });

  // Gemini Market Analysis Proxy
  app.post("/api/gemini/analyze", async (req, res) => {
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
          tools: [{ googleSearch: {} }]
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || "";
      if (errorMsg.includes("credits are depleted") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
        console.warn("Gemini Analyze Warning: Prepayment credits depleted or rate limit hit.");
        return res.status(429).json({ error: errorMsg });
      }
      console.error("Gemini Analyze Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "AI analysis failed" });
    }
  });

  // Gemini Influencer Insights Proxy
  app.post("/api/gemini/influencers", async (req, res) => {
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
       res.json({ text: response.text });
    } catch (error: any) {
       const errorMsg = error?.message || error?.toString() || "";
       if (errorMsg.includes("credits are depleted") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("429")) {
         console.warn("Gemini Influencers Warning: Prepayment credits depleted or rate limit hit.");
         return res.status(429).json({ error: errorMsg });
       }
       console.error("Gemini Influencers Error:", error);
       res.status(500).json({ error: error instanceof Error ? error.message : "AI influencer fetch failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
