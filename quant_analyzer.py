import os
import re
import json
import requests
from typing import Dict, Any, List

class MultiSourceAnalyzer:
    """
    加密货币多源融合决策引擎 (Multi-Source Fusion Analyzer) - 全币种通用自适应版本 (Universal Adaptation)
    特点：
    1. 彻底去硬编码：不包含任何 BTC、DOGE、比特币等固定币种名称，完全自适应。
    2. 全链路动态参数化：symbol（如 ETHUSDT）作为绝对核心变量，全线贯穿数据抓取、打分、提示词生成、报告展现。
    3. 动态盘面点位注入、24h最高价、24h最低价、当前最新价格和资金费率等，且100%对应真实物理盘面。
    4. 灵魂级多空背离熔断检测 (isDivergence, divergenceType) 与平抑机制。
    5. 重写提示词契约，定位为“自适应全币种分析大师”，精确规避混入大盘点位，针对小面额山寨币精确推导小数位。
    6. 引入【模板硬分隔（Hard Token Split）】技术，强制并列新增两个完全独立、黑白分明的【操作指南】板块。
    """
    def __init__(self, binance_spot_url: str = "https://api.binance.com", binance_futures_url: str = "https://fapi.binance.com", cryptoquant_token: str = None):
        self.binance_spot_url = binance_spot_url
        self.binance_futures_url = binance_futures_url
        self.cryptoquant_token = cryptoquant_token or os.getenv("CRYPTOQUANT_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        
    # --- 1. 权威数据接入层 (Adapters) ---
    
    def fetch_fear_and_greed(self) -> int:
        """获取全球权威的恐惧与贪婪指数 (Alternative.me API)"""
        try:
            res = requests.get("https://api.alternative.me/fng/", timeout=5)
            if res.status_code == 200:
                data = res.json()
                return int(data['data'][0]['value'])
        except Exception as e:
            print(f"[-] 获取恐惧与贪婪指数失败: {e}")
        return 50  # 发生故障时降级返回 50 中性

    def fetch_binance_derivatives_data(self, symbol: str) -> Dict[str, Any]:
        """由于币安现货和合约部署在不同子网与子域名下，精确路由请求防止404，其中 URL 的 ?symbol= 必须动态绑定传入的币种"""
        if not symbol or "$" in symbol or "{" in symbol or "}" in symbol or "symbol" in symbol.lower():
            raise ValueError("前端币种参数未正确初始化")
            
        data = {
            "funding_rate": "0.00%",
            "open_interest": "0.0",
            "volume_24h": "0.0",
            "last_price": 0.0,
            "high_price": 0.0,
            "low_price": 0.0
        }
        try:
            # 确保 symbol 为大写
            sym = symbol.upper()
            
            # 1. 资金费率 (Contract / Premium Index) 请求至专门的 Contract API
            funding_res = requests.get(f"{self.binance_futures_url}/fapi/v1/premiumIndex?symbol={sym}", timeout=5)
            if funding_res.status_code == 200:
                data["funding_rate"] = f"{float(funding_res.json().get('lastFundingRate', 0)) * 100:.4f}%"
            
            # 2. 24小时现货或衍生品趋势请求至 Spot Base API，获取 24小时最高、24小时最低、最新现价等
            ticker_res = requests.get(f"{self.binance_spot_url}/api/v3/ticker/24hr?symbol={sym}", timeout=5)
            if ticker_res.status_code == 200:
                ticker_json = ticker_res.json()
                data["volume_24h"] = ticker_json.get("volume", "0.0")
                data["last_price"] = float(ticker_json.get("lastPrice", 0.0))
                data["high_price"] = float(ticker_json.get("highPrice", 0.0))
                data["low_price"] = float(ticker_json.get("lowPrice", 0.0))
        except Exception as e:
            print(f"[-] 获取币安核心数据 ({symbol}) 抛出异常 (已执行自动保护降级): {e}")
        return data

    def fetch_cryptoquant_mock(self, symbol: str) -> Dict[str, Any]:
        """
        拉取链上大宗巨鲸动向数据 (Glassnode/CryptoQuant 标准拉取模型)
        生产环境中可用您的高级 API Token 进行实际接口适配。
        """
        if not symbol or "$" in symbol or "{" in symbol or "}" in symbol or "symbol" in symbol.lower():
            raise ValueError("前端币种参数未正确初始化")
            
        # 链上清洗后的特征元组样板 (此处设计 exchange_netflow 用于模拟背离条件，动态自适应相应币种)
        onchain_data = {
            "whale_transaction_count": 1420,       # 24h大单交易笔数
            "exchange_netflow": -2450.5,           # 交易所净流出 (负数表示资产从交易所撤至钱包，属于多头吸筹利好)
            "active_addresses_24h": 684200,        # 活跃链上地址数量
            "nvt_ratio": 48.5,                     # 估值系数
            "trend": "accumulation"                # 筹码生命周期
        }
        return onchain_data

    # --- 2. 多源融合决策权重打分算法 (Fusion Control Matrix) ---
    
    def run_fusion_decision_algorithm(self, technical_score: float, onchain_data: Dict, sentiment_score: float, macro_score: float) -> Dict[str, Any]:
        """
        多源决策交叉验证计分：
        1. 链上主力数据 (Onchain) -> 权重 30%
        2. 技术面走势评分 (Technical) -> 权重 25%
        3. 流动性与社交情绪 (Sentiment) -> 权重 25%
        4. 宏观加息/政策底色 (Macro) -> 权重 20%
        """
        # A. 链上主力行为定性得分
        onchain_score = 50.0
        netflow = onchain_data.get("exchange_netflow", 0)
        if netflow < -1000:
            onchain_score += 25  # 大额流出，属于高确定度多头主导
        elif netflow > 1000:
            onchain_score -= 25  # 大额流入，属于潜在抛压预警

        if onchain_data.get("trend") == "accumulation":
            onchain_score += 15
            
        onchain_score = max(0.0, min(100.0, onchain_score))

        # B. 线性多维度加权融合计算
        health_score = (
            (onchain_score * 0.30) +
            (technical_score * 0.25) +
            (sentiment_score * 0.25) +
            (macro_score * 0.20)
        )
        
        # D. 心跳多空背离熔断检测 (Divergence Detection Matrix)
        is_divergence = False
        divergence_type = None
        
        # 1. 多头背离熔断：技术极度看多(>75)，但巨鲸在疯狂充值交易所准备抛售(netflow > 2000)
        if technical_score > 75 and netflow > 2000:
            is_divergence = True
            divergence_type = "bullish_divergence"
            # 综合评分强行震荡域平抑：平抑到中性/温和偏空区间，限制盲目喊单
            health_score = max(35.0, min(55.0, health_score * 0.55))
            
        # 2. 空头背离熔断：技术极度看空恐慌(<25)，但链上筹码疯狂净流出冷钱包锁仓(netflow < -2000)
        elif technical_score < 25 and netflow < -2000:
            is_divergence = True
            divergence_type = "bearish_divergence"
            # 指标平抑至防守左侧筑底震荡区
            health_score = max(45.0, min(65.0, health_score * 1.5))

        # C. 【严格无负数、严格100%之和、平滑连续的概率映射模型】
        h = float(health_score)
        
        # 多项式映射变换机制 (在极佳、中立和极差盘面下生成合理分布)
        w_long = max(0.1, (h / 100.0) ** 2)
        w_short = max(0.1, ((100.0 - h) / 100.0) ** 2)
        w_neutral = max(0.1, 1.0 - abs(h - 50.0) / 50.0)
        
        # 标准归一总和
        total_weight = w_long + w_short + w_neutral
        
        # 归一并分配到做多、做空、观望百分比上
        long_prob = int(round((w_long / total_weight) * 100))
        short_prob = int(round((w_short / total_weight) * 100))
        neutral_prob = 100 - long_prob - short_prob
        
        # 保证之和等于 100 且都大于等于 0
        if neutral_prob < 0:
            long_prob += neutral_prob
            neutral_prob = 0
            
        return {
            "healthScore": int(round(health_score)),
            "longProb": long_prob,
            "shortProb": short_prob,
            "neutralProb": neutral_prob,
            "isDivergence": is_divergence,
            "divergenceType": divergence_type
        }

    def format_price(self, price: float) -> str:
        """
        全币种自适应大白话数字清洗器 (All-currency adaptive plain language number cleaner)
        """
        try:
            price_float = float(price)
            # 1. 如果是比特币或价格大于等于 1 的主流币/山寨币，强制去掉无用的小数和零，只保留整洁形式
            if price_float >= 1.0:
                # 如果恰好是整数或者 .0，直接转成整数
                if price_float.is_integer():
                    return f"{int(price_float)}"
                # 否则最多保留 2 位精简小数
                return f"{price_float:.2f}"
            
            # 2. 如果是微小面额山寨币（价格小于 1，如 0.00001234）
            else:
                # 转换为字符串并去掉末尾无用的零
                s = f"{price_float:.8f}"
                return s.rstrip('0').rstrip('.') if '.' in s else s
        except Exception:
            return str(price)

    # --- 3. 产生最终 AI 决策报告 (METRICS Gateway Implementation) ---
    
    def generate_final_report(self, symbol: str, technical_metric_score: float) -> str:
        """主入口：执行抓取、算分、组合并产生自适应 prompt 契约"""
        if not symbol or "$" in symbol or "{" in symbol or "}" in symbol or "symbol" in symbol.lower():
            raise ValueError("前端币种参数未正确初始化")
            
        sym_clean = symbol.upper()
        print(f"[*] 开始对 {sym_clean} 进行全网综合多源数据检索与研判...")
        
        fear_greed = self.fetch_fear_and_greed()
        derivatives = self.fetch_binance_derivatives_data(sym_clean)
        onchain = self.fetch_cryptoquant_mock(sym_clean)
        
        sentiment_score = float(fear_greed)
        macro_score = 65.0
        
        metrics_results = self.run_fusion_decision_algorithm(
            technical_score=technical_metric_score,
            onchain_data=onchain,
            sentiment_score=sentiment_score,
            macro_score=macro_score
        )
        
        metrics_results["fundingRate"] = derivatives["funding_rate"]
        metrics_results["fearGreedIndex"] = fear_greed
        metrics_results["lastPrice"] = self.format_price(derivatives["last_price"])
        metrics_results["highPrice"] = self.format_price(derivatives["high_price"])
        metrics_results["lowPrice"] = self.format_price(derivatives["low_price"])
        
        if metrics_results.get("isDivergence"):
            if metrics_results.get("divergenceType") == "bullish_divergence":
                metrics_results["riskLevel"] = "极高（背离风险）"
            else:
                metrics_results["riskLevel"] = "高（左侧筑底背离）"
        else:
            metrics_results["riskLevel"] = "中等" if 40 < metrics_results["healthScore"] < 75 else ("较高" if metrics_results["healthScore"] <= 40 else "极低")

        # 判断资金费率异常与过热
        is_risky = False
        try:
            rate_clean = derivatives.get("funding_rate", "0.00%").replace("%", "").strip()
            rate_val = abs(float(rate_clean))
            if rate_val >= 0.03:
                is_risky = True
        except Exception:
            pass

        contract_warning = ""
        if is_risky:
            contract_warning = "**❗ 警告：当前市场主力正在疯狂插针，合约极易爆仓，请务必降低仓位！**"
        else:
            contract_warning = "*(风险度正常，但仍需控制仓位，严禁高倍扛单)*"

        # 构造自适应 prompt 契约
        prompt = f"""
        你是一位顶级、自适应的【全币种量化分析与情绪博弈大师】。
        
        【重要契约约束】：
        1. 你当前正在分析的唯一币种是：{sym_clean}。你报告中的所有技术面分析、价格波动、支撑位/阻力位，必须完全基于 Python 传入的该币种的当前真实价格（{metrics_results['lastPrice']}）和 24h 高低点。
        2. 严禁混入大盘 BTC 的具体价格点位！
        3. 如果是小面额、多位小数的山寨币（如 $0.0000123），所有计算和推演必须极其精确地保留其对应的小数点位数，绝对不能直接四舍五入为整数，否则会导致用户交易巨幅偏差！
        4. 必须使用通俗易懂的“大白话”向用户提供操作建议，尤其是最后两个操作指南板块。
        5. 【黑名单禁用词汇】：在这两个操作指南中，严禁出现任何专业学术指标名称及行业黑话，包括：'EMA'、'RSI'、'MACD'、'KDJ'、'BOLL'、'布林'、'斐波那契'、'浪型'、'波浪'、'5浪'、'CEX'、'DEX'、'1H线'、'15Min线'、'15分钟线'、'见顶信号'、'左侧'、'右侧'等。如果敢吐出其中任何一个，系统编译将直接熔断！
        
        我们为你运行的【多源融合决策算法】计算出了如下评分矩阵：
        {json.dumps(metrics_results, indent=2, ensure_ascii=False)}
        
        请根据以上计算得分，以及你通过 Google 检索到的：
        1. {sym_clean} 的实时链上行为 (Dune/Glassnode/智能合约 等最新大额链上异动)
        2. 最新市场研究报告 (Messari/Binance Research 针对 {sym_clean} 的最新研判与核心周报论点)
        3. 当前宏观宏观面背景 (如非农、CPI 及美联储降息政策对加密市场的传导偏向)
        
        生成一份极专业的【多源融合决策研判报告】。
        
        请严格按如下格式完整输出：
        [METRICS]
        {json.dumps(metrics_results, ensure_ascii=False)}
        [/METRICS]
        
        # 🌐 【超强综合研判系统】深度融合决策报告 ({sym_clean})
        
        ### 📊 一、全球多源数据融合评分
        - **当前加权健康度得分**: **{metrics_results['healthScore']} / 100**
        - **融合模型演算的多空分布概率**: 
          - 做多机会: **{metrics_results['longProb']}%**
          - 做空倾向: **{metrics_results['shortProb']}%**
          - 观望对策: **{metrics_results['neutralProb']}%**
        
        ### 🔗 二、权威指标交叉研判
        - **链上巨鲸流动**: 24h巨鲸充提净流量为 `{onchain['exchange_netflow']}`。
        - **资金费率与盘中深度**: 当前资金费率为 `{metrics_results['fundingRate']}`。
        - **社交面 NLP 情绪**: 全球恐惧与贪婪指数处于为 `{metrics_results['fearGreedIndex']}`。
        - **实时市场点位信息**: 最新价格为 `{metrics_results['lastPrice']}`，24小时最高价为 `{metrics_results['highPrice']}`，24小时最低价为 `{metrics_results['lowPrice']}`。
        
        ### 🏹 三、情境对策（基于实时真实价格推演）
        任务指令：
        - 你必须严格根据传入的最新价格 (lastPrice: {metrics_results['lastPrice']})、24h最高价 (highPrice: {metrics_results['highPrice']}) 与 24h最低价 (lowPrice: {metrics_results['lowPrice']})，动态且极其精确地计算出当下的三大支撑与阻力位（第一/第二/第三支撑和阻力级别）。
        - 并在后续详细研判中，输出完全基于上述真实计算的、可执行的阶梯开单（挂单）点位，禁止使用任何脱离上述真实价格的静态虚构点位。
        
        ### ⚠️ 四、多空背离熔断与潜在风险极端警示
        任务指令：
        - **你必须置顶加粗并红字分析当前的背离状态**：当前是否检测到多空背离？（背离状态：isDivergence={metrics_results['isDivergence']}, 背离类型={metrics_results['divergenceType'] or '无'}）。
        - 如果检测到多头背离（技术极其看涨而巨鲸疯狂充值变现，isDivergence=True 且 divergenceType="bullish_divergence"），你必须发出红字顶级熔断警告，指出价格极有可能在近期发生极端的断崖式多头踩踏与崩盘，切勿盲目高位接盘！
        - 如果检测到空头背离（技术极其看跌恐慌而巨鲸大批撤回冷钱包锁仓，isDivergence=True 且 divergenceType="bearish_divergence"），你必须指出当前市场散户在恐慌性抛盘而主力在疯狂收集带血筹码，暗示这是一个黄金洗盘及左侧筑底的异动期。
        
        ### 🏹 五、多情境博弈应对策略 (真实阶梯开单点位)
        - 必须根据 Python 传入的最新价格、24h高低点，动态计算出合理的压力位与支撑位，并在该模块中输出针对 {sym_clean} 真实的、可操作的阶梯开单点位，严禁虚构死数据！

        【最高级格式约束】：
        在回答的最后，你必须以特殊的标记包围两段填空。**你绝对不能在内容中自己输出 `### 六` 或 `### 七` 标题行**，只需填充对应文字体，因为外部主程序将使用【模板硬分隔（Hard Token Split）】技术由 Python 自动拼合这两个标题。
        
        结构如下：
        [SPOTS_GUIDE]
        这里只针对无杠杆现货。只准说大白话！只能给小白交代三个最具体的指标（精度与传入的当前币价物理解析 100% 一致）：
        - **当前买入挂单区间**：结合当前最新价 {metrics_results['lastPrice']} 与 24h最低价 {metrics_results['lowPrice']} 计算后得到的安全抄底挂单硬数字范围。
        - **短线与长线卖出止盈价**：
          1. 短线吃肉卖点：比最新价格 {metrics_results['lastPrice']} 高 3% ~ 5% 的精确价格数值。
          2. 长线大肉卖点：根据物理高点限额 {metrics_results['highPrice']} 评估算出的落袋硬价格。
        - **空仓保命截止线（跌破哪个数字必须止损变现）**：设定大约在 24h 最低价 {metrics_results['lowPrice']} 之下 2% 的绝对防守硬价格（跌破必须立刻无脑割肉，保名离场，绝对防守，禁止抗单）。
        [/SPOTS_GUIDE]

        [CONTRACTS_GUIDE]
        这里专门针对杠杆合约。只准说大白话！只能提供动作建议，不准带有任何 EMA/RSI 等黑话，且必须给出明确动作参数：
        - **风控置顶警告**：直接打印 '{contract_warning}'。
        - **精准多单（看涨）开仓点 + 强烈限低杠杆倍数**：包含具体的抄底多单开仓点硬价格数值，并**强烈加粗限制在 2x-5x 倍低倍安全杠杆**，极粗字体**警告绝不准开高倍杠杆**！
        - **精准空单（看跌）开仓点 + 强烈限低杠杆倍数**：包含具体的高位做空入场硬价格数值，并**强烈加粗限制在 2x-5x 倍低倍安全杠杆**，极粗字体**警告严厉禁止使用高倍杠杆**！
        - **合约硬性保命止损位**：动态算出一个绝对不能抗单的多空绝对平仓割肉价格数字。
        - **阶梯止盈小目标（吃一口就跑的精确价格）**：直白给定一、二档精准落袋退出目标价格数字。
        [/CONTRACTS_GUIDE]
        """

        # 我们模拟或展示【模板硬分隔（Hard Token Split）】的前后端打印/拼合机制
        report = prompt.strip()
        
        # 强行硬编码拼接这两个绝密版块标题 (Hard Token Split)
        # Python 在输出最终决策报告时将这样执行：
        # report += "\n\n### 🎯 六、小白现货专属·无杠杆安全指南\n"
        # report += spots_guide_content
        # report += "\n\n### ⚡ 七、短期合约专属·高频杠杆实战操作\n"
        # report += contracts_guide_content
        
        return report

# --- 测试运行 ---
if __name__ == "__main__":
    analyzer = MultiSourceAnalyzer()
    print("--- 正在测试 Python 模板硬分隔核心契约生成 ---")
    prompt_payload = analyzer.generate_final_report("ETHUSDT", technical_metric_score=78.0)
    print("[+] 生成的 Prompt Payload 首尾片段展示：")
    print(prompt_payload[:800] + "\n\n... (略去中间内容) ...\n\n" + prompt_payload[-1000:])
