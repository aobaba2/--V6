import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface MarketData {
  symbol: string;
  price: string;
  high: string;
  low: string;
  volume: string;
  priceChangePercent: string;
}

export interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const analyzeMarket = async (symbol: string, klines: KLineData[], currentData: MarketData) => {
  const prompt = `
    你是一个专业的加密货币交易分析师。请分析以下 ${symbol} 的市场数据并提供交易建议。
    
    当前市场概况:
    - 价格: ${currentData.price}
    - 24h 涨跌幅: ${currentData.priceChangePercent}%
    - 24h 最高: ${currentData.high}
    - 24h 最低: ${currentData.low}
    - 成交量: ${currentData.volume}

    最近的价格走势 (K线数据):
    ${klines.slice(-20).map(k => `时间: ${new Date(k.time).toLocaleString()}, 开: ${k.open}, 高: ${k.high}, 低: ${k.low}, 收: ${k.close}`).join('\n')}

    请提供以下分析：
    1. 趋势分析 (看涨/看跌/震荡)
    2. 关键支撑位与阻力位
    3. 风险评估
    4. 操作建议 (买入/卖出/观望) 及理由
    5. 止损与止盈参考位

    请以专业、客观的语气回答，并包含必要的风险提示。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "分析失败，请稍后再试。";
  }
};
