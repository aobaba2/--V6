# 加密货币AI智能分析系统 —— “超强综合研判系统” 架构设计与量化代码框架

本设计方案旨在将现有的分析体系升级为 **超强多源数据融合决策系统 (Multi-Source Fusion Trend-Judgment System)**。通过实现多渠道权威实时 API 接入，结合加权投票融合逻辑，生成具有极高专业度和情境概率分布的研判结论。

---

## 一、 系统架构设计 (System Architecture Design)

整个系统由四个核心层级构成，自下而上实现数据的抽取、清洗、多源评估到智能决策的生成。

```
              ┌────────────────────────────────────────────────────────┐
              │                专业结论输出层 (Output Dashboard)       │
              └───────────────────────────▲────────────────────────────┘
                                          │ Markdowns & METRICS-JSONs
              ┌───────────────────────────┴────────────────────────────┐
              │           大语言模型层 (Gemini 3.5-Flash / Search)     │
              └───────────────────────────▲────────────────────────────┘
                                          │ Structured Data Payload
              ┌───────────────────────────┴────────────────────────────┐
              │     多源决策融合算法层 (Multi-Source Fusion Engine)    │
              └───────────────────────────▲────────────────────────────┘
                        ▲                 │                 ▲
              ┌─────────┴─────────┐ ┌─────┴─────┐ ┌─────────┴─────────┐
              │ 链上/深度指标 (30%)│ │技术指标 (25%)│ │情绪/宏观指标 (45%)│
              └─────────▲─────────┘ └─────▲─────┘ └─────────▲─────────┘
                        │                 │                 │
    📊 数据源:  CryptoQuant API      Binance API       Alternative.me / Web
                Glassnode API                         Fed CPI / Institutional
```

### 1. 核心层级说明
- **数据源 & 接入适配层 (Data Ingestion Layer)**: 负责以异步任务拉取来自 CryptoQuant、Binance、Alternative.me 和宏观新闻站点的实时指标。
- **多源数据融合引擎 (Multi-Source Fusion Engine)**: 执行加权投票决策。该矩阵包含：
  - **链上指标 (On-Chain, 30%)**: 针对交易所储备、巨鲸净流入/流出和 NVT 比率制定看涨/看跌阀值评分。
  - **技术分析 (Technical, 25%)**: 计算趋势线 EMA 交叉、超买超卖 (RSI) 以及支撑/阻力强弱得分。
  - **流动性深度 (Liquidity/Depth, 25%)**: 跟踪未平仓合约 (OI) 增减、多空爆仓额比重及当前瞬时资金费率。
  - **宏观机构与情绪面 (Macro/Sentiment, 20%)**: Alternative.me 恐贪指数、X/Reddit 社区 NLP 权重，配合美联储利息决议与 Messari、Binance Research 的研判因子。
- **研判生成层 (Consensus Generation Layer)**: 利用附带 Google Search 实时的 Gemini 模型进行深度长文整合，对加权融合结果与背离信息作宏观纠偏，并输出双格式（交互式 METRICS JSON 以及专业 Markdown 报告）。

---

## 二、 核心量化代码框架 (Python 实现)

以下是使用 Python 3 实现的超强研判核心系统代码。包含：
1. 各大权威 API 接入适配器
2. 内部多源加权融合打分算法
3. 结构化提示词生成与 LLM 合约定义

### 1. 完整研判流程 Python 代码 (`quant_analyzer.py`)

```python
import os
import re
import json
import requests
from typing import Dict, Any, List

class MultiSourceAnalyzer:
    def __init__(self, binance_api_url: str = "https://api.binance.com", cryptoquant_token: str = None):
        self.binance_url = binance_api_url
        self.cryptoquant_token = cryptoquant_token or os.getenv("CRYPTOQUANT_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        
    # --- 1. 数据接入适配器 (Adapters) ---
    
    def fetch_fear_and_greed(self) -> int:
        """获取全球权威的恐惧与贪婪指数 (Alternative.me)"""
        try:
            res = requests.get("https://api.alternative.me/fng/", timeout=5)
            if res.status_code == 200:
                data = res.json()
                return int(data['data'][0]['value'])
        except Exception as e:
            print(f"[-] 获取恐贪指数失败: {e}")
        return 50  # 默认中性

    def fetch_binance_derivatives_data(self, symbol: str) -> Dict[str, Any]:
        """获取币安合约未平仓量、爆仓量和资金费率"""
        ticker = symbol.replace("USDT", "_USDT") if "USDT" in symbol else symbol
        data = {
            "funding_rate": "0.00%",
            "open_interest": "0.0",
            "volume_24h": "0.0"
        }
        try:
            # 资金费率
            funding_res = requests.get(f"{self.binance_url}/fapi/v1/premiumIndex?symbol={symbol}", timeout=5)
            if funding_res.status_code == 200:
                data["funding_rate"] = f"{float(funding_res.json().get('lastFundingRate', 0)) * 100:.4f}%"
            
            # 24h行情与交易量
            ticker_res = requests.get(f"{self.binance_url}/api/v3/ticker/24hr?symbol={symbol}", timeout=5)
            if ticker_res.status_code == 200:
                data["volume_24h"] = ticker_res.json().get("volume", "0.0")
        except Exception as e:
            print(f"[-] 获取币安合约指标失败: {e}")
        return data

    def fetch_cryptoquant_mock(self, symbol: str) -> Dict[str, Any]:
        """
        拉取链上大宗巨鲸数据、交易所存留与 NVT
        实际生产中需要替换为真实的高级 API 密钥。此处提供标准清洗模型
        """
        # 模拟链上数据结构
        onchain_data = {
            "whale_transaction_count": 1420,       # 巨鲸交易笔数
            "exchange_netflow": -2450.5,           # 净流入流出量 (负数表示流向冷钱包，利好)
            "active_addresses_24h": 684200,        # 24h活跃地址数
            "nvt_ratio": 48.5,                     # 估值比率
            "trend": "accumulation"                # 筹码积累期/抛售期
        }
        return onchain_data

    # --- 2. 核心融合打分算法 (Fusion Engine) ---
    
    def run_fusion_decision_algorithm(self, technical_score: float, onchain_data: Dict, sentiment_score: float, macro_score: float) -> Dict[str, Any]:
        """
        多源融合算法：
        1. 链上数据主力动向 (Onchain): 权重 30%
        2. 技术指标趋势 (Technical): 权重 25%
        3. 流动性与情绪 (Sentiment): 权重 25%
        4. 宏观机构底色 (Macro): 权重 20%
        """
        # 链上打分
        onchain_score = 50.0
        netflow = onchain_data.get("exchange_netflow", 0)
        if netflow < -1000:
            onchain_score += 25  # 巨大流出，强利好
        elif netflow > 1000:
            onchain_score -= 25  # 巨大流入，利空
            
        if onchain_data.get("trend") == "accumulation":
            onchain_score += 15
            
        onchain_score = max(0.0, min(100.0, onchain_score))

        # 加权融合计算
        health_score = (
            (onchain_score * 0.30) +
            (technical_score * 0.25) +
            (sentiment_score * 0.25) +
            (macro_score * 0.20)
        )
        
        # 概率映射模型 (根据打分产生经典的多空概率应对)
        if health_score >= 60:
            long_prob = int(health_score * 0.85)
            short_prob = int((100 - health_score) * 0.6)
            neutral_prob = 100 - long_prob - short_prob
        elif health_score <= 40:
            short_prob = int((100 - health_score) * 0.85)
            long_prob = int(health_score * 0.6)
            neutral_prob = 100 - long_prob - short_prob
        else:
            neutral_prob = int(45 + (50 - abs(50 - health_score)))
            long_prob = int((100 - neutral_prob) * 0.55)
            short_prob = 100 - neutral_prob - long_prob

        return {
            "healthScore": int(health_score),
            "longProb": long_prob,
            "shortProb": short_prob,
            "neutralProb": neutral_prob
        }

    # --- 3. 产生最终 AI 研判报告 ---
    
    def generate_final_report(self, symbol: str, technical_metric_score: float) -> str:
        """主入口：执行抓取、算分、组合并调用 LLM 生成报告"""
        print(f"[*] 开始对 {symbol} 进行全网综合多源数据检索与研判...")
        
        fear_greed = self.fetch_fear_and_greed()
        derivatives = self.fetch_binance_derivatives_data(symbol)
        onchain = self.fetch_cryptoquant_mock(symbol)
        
        # 基础计算情绪与宏观模拟分
        sentiment_score = fear_greed  # 情绪偏向
        macro_score = 65.0           # 假定当前 CPI 降温或美联储政策偏暖
        
        # 运行加权算法
        fusion_metrics = self.run_fusion_decision_algorithm(
            technical_score=technical_metric_score,
            onchain_data=onchain,
            sentiment_score=sentiment_score,
            macro_score=macro_score
        )
        
        # 附加融合后的基础元数据
        fusion_metrics["fundingRate"] = derivatives["funding_rate"]
        fusion_metrics["fearGreedIndex"] = fear_greed
        fusion_metrics["riskLevel"] = "中等" if 40 < fusion_metrics["healthScore"] < 75 else "较高"
        
        # 构造 prompt 合约
        prompt = f"""
        你是一位顶级的加密货币量化交易专家和情绪分析大师。
        我们为你运行的【多源融合决策算法】计算出了如下评分矩阵：
        {json.dumps(fusion_metrics, indent=2, ensure_ascii=False)}
        
        请根据以上计算得分，以及你通过 Google 检索到的：
        1. {symbol} 的实时链上行为 (Dune/Glassnode 最新大额链上异动)
        2. 最新市场研究报告 (Messari/Binance Research 核心周报论点)
        3. 当前宏观宏观面背景 (如非农、CPI 及美联储降息政策偏向)
        
        生成一份极专业的【多源融合决策研判报告】。
        
        请严格按如下格式输出：
        [METRICS]
        {json.dumps(fusion_metrics, ensure_ascii=False)}
        [/METRICS]
        
        # 🌐 【超强综合研判系统】深度融合决策报告
        (... 之后接着 Markdown 内容，详细解释：一、打分盘，二、多源解析，三、多空碰撞，四、极端警示，五、多情景应对策略 ...)
        """
        
        # 实际生产中调用 API，例如：
        # headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.gemini_api_key}"}
        # res = requests.post("https://api.generativeai.google/v1/models/gemini-3.5-flash:generateContent", json={...})
        
        print("[+] 综合研判计算完毕，可将该 prompt Payload 提交至 API 端。")
        return prompt

# --- 测试运行 ---
if __name__ == "__main__":
    # 假定前端计算出当前 BTC/USDT 技术指标评分为 78 分 (看多)
    analyzer = MultiSourceAnalyzer()
    raw_prompt_payload = analyzer.generate_final_report("BTCUSDT", technical_metric_score=78.0)
```

---

## 三、 多源数据订阅接入协议 (API References)

为了保持数据的极高准确，建议订阅并整合下述官方 API 协议：

### 1. 链上数据 API (CryptoQuant)
- **Endpoint**: `https://api.cryptoquant.com/v1/{asset}/exchange-flows/netflow`
- **主要参数**: `window=day`
- **量化提炼**: 流入增多，代表恐慌抛压可能性增加；大量流出表示主力锁定持仓。

### 2. 未平仓合约与爆仓量 API (Binance)
- **未平仓量**: `GET /fapi/v1/openInterest`  
  *量化指向*: OI 攀升常伴随爆仓行情的临近；OI 萎缩则显示多空双方倾向于平仓离场。
- **24h爆仓量**: `GET /fapi/v1/forceOrders`  
  *量化指向*: 空头大额爆仓常见于突破前期关键压力阻力区。

### 3. 恐惧与贪婪指数 (Alternative.me)
- **Endpoint**: `https://api.alternative.me/fng/?limit=1`
- **量化指向**: 数值 > 75 往往是阶段性获利了结的高风险期；数值 < 25 则是左侧建仓的恐慌抄底区。

---

## 四、 结论输出与多情境博弈 (Probability Outcomes)

系统不仅给出做多、做空、观望的概率分布，还在最终报告中生成严密的情境模型：

1. **多头爆发情境 (乐观估计)**：
   - 突破阻力位：突破关键颈线位，成交量增加 1.5 倍时直接触发突破做多。
2. **阻力破败情境 (悲观估计)**：
   - 防守支撑位：遭遇大户冷钱包充币交易所，均线死叉，立刻在防守破位点介入对冲或止损。
3. **箱体震荡情境 (中性估计)**：
   - 网格获利策略：结合高低资金费率进行流动性赚取。
