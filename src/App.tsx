import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  BrainCircuit, 
  RefreshCw, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Info,
  AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatPrice, formatPercent } from './lib/utils';
import { analyzeMarket, MarketData, KLineData } from './services/geminiService';
import Markdown from 'react-markdown';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'PEPEUSDT'];

export default function App() {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [klines, setKlines] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch 24h ticker data
  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/binance/api/v3/ticker/24hr');
      const data = await response.json();
      const filtered = data.filter((item: any) => SYMBOLS.includes(item.symbol));
      const mapped = filtered.reduce((acc: any, item: any) => {
        acc[item.symbol] = {
          symbol: item.symbol,
          price: item.lastPrice,
          high: item.highPrice,
          low: item.lowPrice,
          volume: item.volume,
          priceChangePercent: item.priceChangePercent
        };
        return acc;
      }, {});
      setMarketData(mapped);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  // Fetch K-line data for chart
  const fetchKlines = async (symbol: string) => {
    try {
      const response = await fetch(`/api/binance/api/v3/klines?symbol=${symbol}&interval=1h&limit=48`);
      const data = await response.json();
      const mapped: KLineData[] = data.map((item: any) => ({
        time: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));
      setKlines(mapped);
    } catch (error) {
      console.error('Error fetching klines:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    fetchKlines(selectedSymbol);
    const interval = setInterval(fetchMarketData, 10000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const handleAnalyze = async () => {
    if (!marketData[selectedSymbol]) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    const result = await analyzeMarket(selectedSymbol, klines, marketData[selectedSymbol]);
    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const filteredSymbols = useMemo(() => {
    return Object.values(marketData).filter(m => 
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [marketData, searchQuery]);

  const currentCoin = marketData[selectedSymbol];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] font-sans selection:bg-yellow-500/30">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#181a20] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Activity className="text-black w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Binance AI <span className="text-yellow-500">炒币助手</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="搜索币种..." 
                className="bg-[#2b2f36] border-none rounded-full py-1.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-yellow-500 outline-none w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { setLoading(true); fetchMarketData(); fetchKlines(selectedSymbol); }}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sidebar - Market List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-yellow-500" />
                市场行情
              </h2>
            </div>
            <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredSymbols.length > 0 ? filteredSymbols.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => setSelectedSymbol(coin.symbol)}
                  className={cn(
                    "w-full p-4 flex items-center justify-between hover:bg-[#2b2f36] transition-colors text-left",
                    selectedSymbol === coin.symbol && "bg-[#2b2f36] border-l-2 border-yellow-500"
                  )}
                >
                  <div>
                    <div className="font-bold">{coin.symbol.replace('USDT', '')}<span className="text-xs text-gray-500 ml-1">/USDT</span></div>
                    <div className="text-xs text-gray-400">Vol: {parseFloat(coin.volume).toFixed(0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium">{formatPrice(coin.price)}</div>
                    <div className={cn(
                      "text-xs font-medium flex items-center justify-end gap-1",
                      parseFloat(coin.priceChangePercent) >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {parseFloat(coin.priceChangePercent) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {formatPercent(coin.priceChangePercent)}
                    </div>
                  </div>
                </button>
              )) : (
                <div className="p-8 text-center text-gray-500 text-sm">未找到相关币种</div>
              )}
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              <p className="text-xs text-yellow-200/80 leading-relaxed">
                提示：本工具提供的分析仅供参考，不构成任何投资建议。加密货币投资具有高风险，请谨慎决策。
              </p>
            </div>
          </div>
        </div>

        {/* Main Content - Chart & Analysis */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Price Header */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 p-6 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2b2f36] rounded-full flex items-center justify-center text-xl font-bold text-yellow-500">
                {selectedSymbol.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{selectedSymbol}</h2>
                  <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">现货</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-3xl font-mono font-bold text-yellow-500">{currentCoin ? formatPrice(currentCoin.price) : '---'}</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-sm font-bold",
                    currentCoin && parseFloat(currentCoin.priceChangePercent) >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {currentCoin ? formatPercent(currentCoin.priceChangePercent) : '0.00%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div>
                <div className="text-xs text-gray-500 mb-1">24h 最高</div>
                <div className="font-mono text-sm">{currentCoin ? formatPrice(currentCoin.high) : '---'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">24h 最低</div>
                <div className="font-mono text-sm">{currentCoin ? formatPrice(currentCoin.low) : '---'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">24h 成交额(USDT)</div>
                <div className="font-mono text-sm">{(currentCoin ? parseFloat(currentCoin.volume) * parseFloat(currentCoin.price) / 1000000 : 0).toFixed(2)}M</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">更新时间</div>
                <div className="font-mono text-sm">{new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-yellow-500" />
                价格趋势 (1h)
              </h3>
              <div className="flex gap-2">
                {['1h', '4h', '1d'].map(t => (
                  <button key={t} className={cn(
                    "px-3 py-1 rounded text-xs transition-colors",
                    t === '1h' ? "bg-yellow-500 text-black font-bold" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-[400px] w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={klines}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f3ba2f" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f3ba2f" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2b2f36" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={(time) => new Date(time).getHours() + ':00'} 
                      stroke="#474d57"
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#474d57"
                      fontSize={12}
                      tickFormatter={(val) => val > 1000 ? (val/1000).toFixed(1) + 'k' : val}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e2329', border: '1px solid #474d57', borderRadius: '8px' }}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      formatter={(value: number) => [formatPrice(value), '价格']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="close" 
                      stroke="#f3ba2f" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-[#181a20] to-[#1e2329]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <BrainCircuit className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">AI 智能分析</h3>
                  <p className="text-xs text-gray-500">由 Gemini 3.1 Pro 提供深度市场洞察</p>
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || loading}
                className={cn(
                  "px-6 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2",
                  analyzing 
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 active:scale-95"
                )}
              >
                {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                {analyzing ? "正在分析..." : "开始 AI 分析"}
              </button>
            </div>
            
            <div className="p-6 min-h-[200px] relative">
              <AnimatePresence mode="wait">
                {analyzing ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 gap-4"
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                          className="w-2 h-2 bg-purple-500 rounded-full"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-400">正在调取实时数据并生成专业报告...</p>
                  </motion.div>
                ) : analysisResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-invert max-w-none"
                  >
                    <div className="bg-[#1e2329] rounded-lg p-6 border border-gray-700 shadow-inner">
                      <div className="flex items-center gap-2 mb-4 text-purple-400 font-bold">
                        <Info className="w-4 h-4" />
                        分析报告 - {selectedSymbol}
                      </div>
                      <div className="markdown-body text-gray-300 leading-relaxed text-sm">
                        <Markdown>{analysisResult}</Markdown>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                    <BrainCircuit className="w-12 h-12 mb-4 opacity-20" />
                    <p>点击上方按钮，获取针对 {selectedSymbol} 的 AI 深度分析建议</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-800 mt-12 text-center text-gray-500 text-xs">
        <p>© 2026 Binance AI 炒币助手 | 数据来源于币安公开 API | 仅供学习交流使用</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2b2f36;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #474d57;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
          color: #f3ba2f;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          font-weight: 700;
        }
        .markdown-body p {
          margin-bottom: 1rem;
        }
        .markdown-body ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .markdown-body li {
          margin-bottom: 0.5rem;
        }
        .markdown-body strong {
          color: #fff;
        }
      `}</style>
    </div>
  );
}
