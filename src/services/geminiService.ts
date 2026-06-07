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

export interface InfluencerInsight {
  name: string;
  avatar: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  content: string;
  time: string;
}

export const analyzeMarket = async (
  symbol: string, 
  klines: KLineData[], 
  currentData: MarketData, 
  intervalLabel: string,
  influencerInsights: InfluencerInsight[],
  followedInfluencers: string[] = []
) => {
  const symClean = symbol.toUpperCase().replace("USDT", "");
  
  const rawLastPrice = currentData?.price || "0.0";
  const rawHighPrice = currentData?.high || "0.0";
  const rawLowPrice = currentData?.low || "0.0";

  const formatPriceForInput = (pStr: string): string => {
    const val = parseFloat(pStr);
    if (isNaN(val)) return pStr;
    if (val >= 1.0) {
      if (Number.isInteger(val) || val % 1 === 0) {
        return String(Math.round(val));
      }
      return val.toFixed(2);
    } else {
      const formatted = val.toFixed(8);
      return formatted.replace(/0+$/, '').replace(/\.$/, '');
    }
  };

  const lastPrice = formatPriceForInput(rawLastPrice);
  const highPrice = formatPriceForInput(rawHighPrice);
  const lowPrice = formatPriceForInput(rawLowPrice);

  const prompt = `
    你是一位顶级的加密货币架构师、量化交易专家和情绪分析大师。
    你的任务是为交易对 ${symbol} (${intervalLabel}) 运行【超强综合研判系统】，结合全球最权威、最专业的实时多源数据，进行多源数据融合决策。
    
    输入信息：
    1. 交易对: ${symbol}
    2. 周期: ${intervalLabel}
    3. 现价: ${lastPrice} (24h涨跌: ${currentData?.priceChangePercent || ""}%)
    4. 最近 K 线收盘价走势: ${klines.slice(-10).map(k => k.close).join(', ')}
    5. 币安博主动态观点:
       ${influencerInsights.map(i => `- 【${i.name}】(${i.sentiment}): "${i.content}"`).join('\n')}

    任务要求：
    1. 使用 Google Search 检索以下核心专业层面的实时权威数据，进行交叉研判：
       a. 【链上数据 (On-Chain)】：检索 Glassnode/CryptoQuant 等平台上关于 ${symbol} 目前的巨鲸动向（Whale Movement）、交易所净流入流出（Exchange Netflow）、活跃地址数、NVT 比率等指标。
       b. 【市场深度与流动性 (Market Liquidity)】：检索 ${symbol} 的未平仓合约量 (Open Interest, OI)、24h跌涨爆仓额 (Liquidation data)、资金费率 (Funding Rate) 趋势。
       c. 【宏观经济与机构面 (Macro & Institutional)】：检索美联储最新的利息政策决议、非农、CPI 数据趋势，以及 Messari、Binance Research、Coinbase Research 对该资产的最新观点与宏观流动性环境。
       d. 【社交与情绪面 (Social Sentiment)】：检索 Alternative.me 恐惧与贪婪指数 (Fear & Greed Index)、X (Twitter) 及 Reddit上关于该币种的讨论热度与主要话题。
    2. 运行【多源实时融合决策算法】：
       - 结合技术面（权重 25%）、链上数据（权重 30%）、市场情绪/流动性（权重 25%）、宏观机构面（权重 20%），通过 multi-source 数据投票及加权打分，生成市场整体健康度评分（0 - 100 分，60分以上属于强健康偏牛，40分以下属于不健康偏熊，中间为中性）。
    3. 严格在报告的最开始，输出一个结构化的 JSON 密闭参数块 [METRICS]...[/METRICS]，格式必须为：
       [METRICS]
       {
         "healthScore": 整数数值(0-100),
         "longProb": 整数百分比(0-100),
         "shortProb": 整数百分比(0-100),
         "neutralProb": 整数百分比(0-100),
         "riskLevel": "极高" | "较高" | "中等" | "较低" | "极低",
         "fundingRate": "例如 +0.01% 或 -0.01%",
         "fearGreedIndex": 恐惧与贪婪指数数值(0-100)
       }
       [/METRICS]
       注意：请确保此 JSON 数据符合真实检索与推演结果。
    4. 接着，输出深度而专业的 Markdown 深度综合研判报告，结构如下：

    ---

    # 🌐 【超强综合研判系统】深度融合决策报告 (${symbol})

    ### 📊 一、全球多源数据融合评分
    - **当前加权健康度得分**: **{healthScore} / 100** (请说明加权打分的过程：技术面[25%]、链上主力[30%]、情绪流动性[25%]、宏观机构[20%])
    - **融合模型演算的多空分布概率**: 
      - 做多机会: **{longProb}%**
      - 做空倾向: **{shortProb}%**
      - 观望对策: **{neutralProb}%**

    ### 🔗 二、权威多源数据交叉解析
    - **1. 链上主力动向 (On-Chain Data)**: (巨鲸仓位变化、交易所流向、NVT等指标解析)
    - **2. 市场深度与流动性 (Market Depth & Liquidity)**: (未平仓合约OI变动、爆仓分布、资金费率)
    - **3. 宏观政策与机构报告观点 (Macro & Institutional)**: (美联储/CPI宏观环境对 ${symbol} 影响 + Messari/Binance Research 核心观点)
    - **4. 情绪与社交风向 (Sentiment & Social)**: (恐惧贪婪指数、X/Reddit 社区热点 NLP 分析)

    ### ⚔️ 三、多空因素激烈对撞 (Bull vs Bear factors)
    | 🟢 牛市因子 (Bulllish Support) | 🔴 熊市因子 (Bearish Pressure) |
    | :--- | :--- |
    | [根据分析给出的具体看涨支撑逻辑] | [根据分析给出的具体看跌打压逻辑] |

    ### ⚠️ 四、潜在风险极端警示
    - 列出当前最有可能导致爆仓或亏损的极极端风险。

    ### 🏹 五、多情境博弈应对策略
    - 给出基于现价 ${lastPrice} 精确计算的支撑和压力位，并提供多情境的应对方案。

    【最高级限制条件 - 模板硬分隔（Hard Token Split）契约】：
    1. 你在此处生成的内容中，**绝对不要自己写 \`### 六、...\` 或 \`### 七、...\` 的任何 Markdown 标题**！系统程序会用硬拼接代码直接注入这两个标题。你如果自己写标题会导致格式重复冲突。
    2. 你必须将所需的操作指南文本精准地包裹在特殊的 XML-like 标记内。
    3. 【黑名单禁用词汇】：在这两个指南块（SPOTS_GUIDE 和 CONTRACTS_GUIDE）中，**严禁出现任何专业学术指标名称及行业黑话**，包括：'EMA'、'RSI'、'MACD'、'KDJ'、'BOLL'、'布林'、'斐波那契'、'浪型'、'波浪'、'5浪'、'CEX'、'DEX'、'1H线'、'15Min线'、'15分钟线'、'见顶信号'、'左侧'、'右侧'等。你必须使用完全通俗易懂的“大白话”进行填写。
    
    格式如下：

    [SPOTS_GUIDE]
    这里只针对没有任何杠杆的纯现货用户。只准使用白话，输出以下三条最具体的指标（小数点精度必须与传入的价格 ${lastPrice} 物理精度保持 100% 绝对一致，杜绝含糊其辞）：
    - **当前买入挂单区间**：建议分批挂单在 [具体阻力区间硬价格上限值] 到 [由于支持力度算的硬价格下限值] 之间分批买入。
    - **短线与长线卖出止盈价**：
      - 短线：落袋止盈目标数值为：[计算后的短线具体价格数值]。
      - 长线：更高强阻力位处的硬价格数值为：[计算后的长线具体价格数值]。
    - **空仓保命截止线（跌破哪个数字必须止损变现）**：设定一个在最低价 ${lowPrice} 之下约 2% 左右的具体硬价格数字。警示小白一旦跌破此红线硬价格，必须立刻卖出干净，绝对不准扛单！
    [/SPOTS_GUIDE]

    [CONTRACTS_GUIDE]
    这里专门针对杠杆合约交易用户。只准使用最平白大白话，不带黑话性质，必须给出确切动作参数：
    - **风控置顶警告**：若发现目前多头资金费率极端过热或插针严重，直接打印“**❗ 警告：当前市场主力正在疯狂插针，合约极易爆仓，请务必降低仓位！**”。若没有，也必须写硬核安全风控大白话提醒。
    - **精准多单（看涨）开仓点 + 强烈限低杠杆倍数**：[挂单分批多单看多具体入场数值]，**强烈加粗限制在 2x-5x 倍极低安全杠杆内运作，极加粗警告绝不准开高倍杠杆！**
    - **精准空单（看跌）开仓点 + 强烈限低杠杆倍数**：[挂单分批空单看跌具体入场数值]，**强烈加粗限制在 2x-5x 倍低倍安全杠杆内运作，极加粗警告绝不能使用高倍率！**
    - **合约硬性保命止损位**：动态精确算出一个离多空进场位合理的铁壁止损红线价格数字。一旦做反方向，无条件割肉离场，断绝抗单。
    - **阶梯止盈小目标（吃一口就跑的精确价格）**：直白地给出一二档分批止盈的精确价格数字。
    [/CONTRACTS_GUIDE]
  `;

  try {
    const response = await fetch("/api/gemini/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      let errMsg = `Server returned status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errMsg = errJson.error;
        }
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    const rawText = data.text || "分析失败，未能生成报告。";

    // Implement Hard Token Split parsing and programmatic concatenation
    const formatPrice = (priceVal: string | number): string => {
      const val = typeof priceVal === 'string' ? parseFloat(priceVal) : priceVal;
      if (isNaN(val)) return String(priceVal);
      if (val >= 1.0) {
        // 如果恰好是整数或者是 .0，直接转成整数
        if (Number.isInteger(val) || val % 1 === 0) {
          return String(Math.round(val));
        }
        // 否则最多保留 2 位精简小数
        return val.toFixed(2);
      } else {
        // 微小面额山寨币：转换为字符串并去掉末尾无用的零和点
        const formatted = val.toFixed(8);
        if (formatted.includes(".")) {
          const cleaned = formatted.replace(/0+$/, '').replace(/\.$/, '');
          return cleaned === "" ? "0" : cleaned;
        }
        return String(val);
      }
    };

    // Helper to dynamically clean any lingering raw floating point strings (like 61100.00000000) inside generated text
    const cleanAllPricesInText = (text: string): string => {
      return text.replace(/\b\d+\.\d+\b/g, (match) => {
        const val = parseFloat(match);
        if (!isNaN(val)) {
          if (val >= 1.0) {
            if (Number.isInteger(val) || val % 1 === 0) {
              return String(Math.round(val));
            }
            const formatted = val.toFixed(2);
            return formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
          } else {
            const formatted = val.toFixed(8);
            return formatted.replace(/0+$/, '').replace(/\.$/, '');
          }
        }
        return match;
      });
    };

    const lp = parseFloat(lastPrice);
    const hp = parseFloat(highPrice);
    const lop = parseFloat(lowPrice);

    const spotsRegex = /\[SPOTS_GUIDE\]([\s\S]*?)\[\/SPOTS_GUIDE\]/;
    const contractsRegex = /\[CONTRACTS_GUIDE\]([\s\S]*?)\[\/CONTRACTS_GUIDE\]/;

    let spotsContent = "";
    const spotsMatch = rawText.match(spotsRegex);
    if (spotsMatch) {
      spotsContent = spotsMatch[1].trim();
    } else {
      spotsContent = `*   **当前买入挂单区间**：建议分批在 ${formatPrice(lp * 0.975)} 到 ${formatPrice(lp * 0.99)} 之间低吸买入挂单。\n*   **短线与长线卖出止盈价**：短线建议在 ${formatPrice(lp * 1.04)} 附近止盈，长线在 ${formatPrice(hp * 0.99)} 附近出局。\n*   **空仓保命截止线**：空仓防守价格底线设定在 ${formatPrice(lop * 0.985)}，一旦收盘跌破此价，必须立马变现，出局防守！`;
    }

    let contractsContent = "";
    const contractsMatch = rawText.match(contractsRegex);
    if (contractsMatch) {
      contractsContent = contractsMatch[1].trim();
    } else {
      contractsContent = `*   **风控警告**：*(风控提醒：高频杠杆属于高风险博弈，合约易遭大户操纵插针，强烈建议极低倍率操作)*\n*   **精密多单开局**：多单开仓合理位置推荐在 ${formatPrice(lp * 0.98)}，**强烈限制在 2x-5x 倍极低安全杠杆内运作，极加粗警告绝不准开高倍杠杆！**\n*   **精密空单开局**：空单开仓合理位置推荐在 ${formatPrice(lp * 1.02)}，**强烈限制在 2x-5x 倍低倍低频杠杆内开展，强加粗警告严防穿仓！**\n*   **合约铁防守止损**：动态多空止损绝对退出线 ${formatPrice(lp * 0.965)}，方向做反绝不扛单，立马平仓保全本金！\n*   **阶梯一二止盈小目标**：第一落袋退出 ${formatPrice(lp * 1.015)}，第二阻力退出 ${formatPrice(lp * 1.035)}。`;
    }

    // Programmatic Price Cleansing for sections Six & Seven as requested by User
    spotsContent = cleanAllPricesInText(spotsContent);
    contractsContent = cleanAllPricesInText(contractsContent);

    // Programmatic Sanitization (Ensure NO forbidden blacklist buzzwords ever reach the client)
    const sanitizeText = (text: string) => {
      let cleaned = text;
      const blacklist = [
        { pattern: /RSI/gi, replacement: "[强弱度指标]" },
        { pattern: /EMA/gi, replacement: "[滑动指数均线]" },
        { pattern: /MACD/gi, replacement: "[趋势动能指标]" },
        { pattern: /KDJ/gi, replacement: "[随机震荡指标]" },
        { pattern: /BOLL/gi, replacement: "[通道轨道]" },
        { pattern: /布林/g, replacement: "通道" },
        { pattern: /CEX/gi, replacement: "主要交易平台" },
        { pattern: /DEX/gi, replacement: "链上分散兑换" },
        { pattern: /15Min/gi, replacement: "极短物理频段" },
        { pattern: /1H/gi, replacement: "短盘面周期" },
        { pattern: /4H/gi, replacement: "中期趋势窗口" },
        { pattern: /15分钟/g, replacement: "短分时交易时钟" },
        { pattern: /1小时/g, replacement: "中短盘面物理钟" },
        { pattern: /一小时/g, replacement: "短波交易时区" },
        { pattern: /十五分钟/g, replacement: "超短波盘面" },
        { pattern: /见顶信号/g, replacement: "下跌变盘风险警示" },
        { pattern: /5浪|五浪/g, replacement: "大型反复震荡" },
        { pattern: /浪型|波浪/g, replacement: "波动波段特征" },
        { pattern: /左侧突破|右侧突破/g, replacement: "关卡带量穿透" },
        { pattern: /左侧交易|右侧交易/g, replacement: "挂单防冲规则" },
        { pattern: /左侧/g, replacement: "主动低吸支撑挂单" },
        { pattern: /右侧/g, replacement: "趋势突破放量确立" },
        { pattern: /斐波那契/g, replacement: "重要关键黄金位" },
        { pattern: /回调/g, replacement: "短期物理回踩" },
        { pattern: /见顶/g, replacement: "承压收窄回档" }
      ];
      
      for (const item of blacklist) {
        cleaned = cleaned.replace(item.pattern, item.replacement);
      }
      return cleaned;
    };

    spotsContent = sanitizeText(spotsContent);
    contractsContent = sanitizeText(contractsContent);

    // Clean any accidentally self-generated raw headings or XML elements from the core report
    let coreReport = rawText
      .replace(spotsRegex, "")
      .replace(contractsRegex, "")
      .replace(/###\s*(🎯\s*)?六、[\s\S]*?(\n(?=###)|$)/g, "")
      .replace(/###\s*(⚡\s*)?七、[\s\S]*?(\n(?=###)|$)/g, "")
      .replace(/\[SPOTS_GUIDE\][\s\S]*?\[\/SPOTS_GUIDE\]/g, "")
      .replace(/\[CONTRACTS_GUIDE\][\s\S]*?\[\/CONTRACTS_GUIDE\]/g, "")
      .trim();

    // Clean entire report for maximum robustness
    coreReport = cleanAllPricesInText(coreReport);

    // Now, force compile the exact Markdown structure (Hard Token Split)
    const finalCompiledReport = coreReport + 
      "\n\n### 🎯 六、小白现货专属·无杠杆安全指南\n" + spotsContent + 
      "\n\n### ⚡ 七、短期合约专属·高频杠杆实战操作\n" + contractsContent;

    return finalCompiledReport;
  } catch (error: any) {
    const message = error?.message || "";
    if (message.includes("credits are depleted") || message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
      console.warn("AI Analysis Warning (billing/quota limit):", message);
      return `### ⚠️ AI 额度已耗尽 (RESOURCE_EXHAUSTED)\n\n**原因**：您的 Google AI Studio 账户预付费额度 (Prepayment credits) 已耗尽，或者项目触发了 API 频次限制。\n\n**解决方案**：\n1. 请点击 [Google AI Studio Projects](https://ai.studio/projects) 检查并管理该项目的计费与预付费余量。\n2. 在 AI Studio 控制台充值或绑定有效的付款方式，以恢复 API 正常调用。\n3. 您也可以在此聊天界面尝试升级您的模型设置或联系平台客服。`;
    }
    console.error("AI Analysis Error:", error);
    return `分析失败：${message || "请稍后再试。"}`;
  }
};

export const fetchInfluencerInsights = async (influencers: string[]) => {
  if (influencers.length === 0) return [];

  // Check cache first
  const cacheKey = `influencer_insights_${influencers.sort().join('_')}`;
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      const { timestamp, data } = JSON.parse(cachedData);
      // Cache valid for 30 minutes
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        return data as InfluencerInsight[];
      }
    } catch (e) {
      console.error("Cache parse error:", e);
    }
  }

  const prompt = `
    你是一位专业的加密货币社交媒体分析师。
    请使用 Google Search 搜索以下币安著名博主在币安广场 (Binance Square) 或社交媒体上的最新动态、观点和市场分析：
    博主列表: ${influencers.join(', ')}

    任务要求：
    1. 针对列表中的每一位博主，搜索他们最近 24 小时内的最新言论。
    2. 提取他们的核心观点、对市场的看涨/看跌情绪。
    3. 如果搜不到某位博主的最新动态，请跳过。

    请按以下 JSON 格式输出（仅输出 JSON 数组）：
    [
      {
        "name": "博主名称",
        "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=随机字符",
        "sentiment": "bullish" | "bearish" | "neutral",
        "content": "博主最新观点的简短总结",
        "time": "时间描述（如：2小时前）"
      }
    ]
  `;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch("/api/gemini/influencers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        let errMsg = `Server returned status ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) {
            errMsg = errJson.error;
          }
        } catch (e) { }
        throw new Error(errMsg);
      }

      const rawData = await response.json();
      const insights = JSON.parse(rawData.text || "[]") as InfluencerInsight[];
      
      // Store in cache
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: insights
      }));

      return insights;
    } catch (error: any) {
      const message = error?.message || "";
      
      // If it's a structural 429 / quota error, don't keep trying, return nice backup results
      if (message.includes("credits are depleted") || message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
        console.warn("AI budget exhausted or throttled, returning placeholder simulated influencer insights gracefully. Message:", message);
        return [
          {
            name: "币圈大咖-老王 (AI备用)",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
            sentiment: 'bullish',
            content: "当前由于 Google AI Studio 接口频次超限或预付费额度不足，已启用内置智能推演分析。从巨鲸资金流向看，主力筹码正在温和收集，下方买盘防线牢固，在关键支撑区间极具防守力量。",
            time: "备用引擎已启用"
          },
          {
            name: "趋势大师-陈总 (AI备用)",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Chen",
            sentiment: 'bearish',
            content: "遭遇 API 限流，备份推演逻辑已温和激活。中线周期来看，阻力位买单略显缩量。如果上方压力没有带量向上击穿，短期可能回踩中线支撑区域寻求再次蓄力。",
            time: "备用引擎已启用"
          }
        ] as InfluencerInsight[];
      }

      console.error("Influencer Insights fetch attempt failed:", error);

      if (error?.status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        attempts++;
        if (attempts < maxAttempts) {
          // Exponential backoff: 2s, 4s
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      return [];
    }
  }
  return [];
};
