import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users,
  MessageSquare,
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  BrainCircuit, 
  RefreshCw, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Activity,
  Info,
  AlertTriangle,
  Lock,
  Star,
  X,
  ChevronUp,
  ChevronDown
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
import { analyzeMarket, fetchInfluencerInsights, MarketData, KLineData, InfluencerInsight } from './services/geminiService';
import Markdown from 'react-markdown';
import { CandlestickChart } from './components/CandlestickChart';
import { MockTrading } from './components/MockTrading';
import { auth, db, signIn, logOut, getOrCreateProfile, UserProfile, UserRole } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';

// Remove hardcoded SYMBOLS
const INTERVALS = [
  { label: '1分', value: '1m' },
  { label: '3分', value: '3m' },
  { label: '5分', value: '5m' },
  { label: '15分', value: '15m' },
  { label: '30分', value: '30m' },
  { label: '1时', value: '1h' },
  { label: '4时', value: '4h' },
  { label: '日线', value: '1d' },
  { label: '周线', value: '1w' }
];

export default function App() {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [interval, setIntervalState] = useState('1h');
  const [klines, setKlines] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'trading'>('analysis');
  const [sidebarTab, setSidebarTab] = useState<'all' | 'favorites'>('favorites');
  const [newInfluencer, setNewInfluencer] = useState('');
  const [realtimeInsights, setRealtimeInsights] = useState<InfluencerInsight[]>([]);
  const [fetchingInsights, setFetchingInsights] = useState(false);
  const [lastInsightUpdate, setLastInsightUpdate] = useState<number | null>(null);
  
  // Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Mock Influencer Data
  const influencerInsights: InfluencerInsight[] = useMemo(() => [
    {
      name: "币圈大咖-老王",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
      sentiment: 'bullish',
      content: "BTC 在 67000 附近支撑极强，主力正在洗盘，建议分批建仓。",
      time: "10分钟前"
    },
    {
      name: "加密猎手-Sarah",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      sentiment: 'neutral',
      content: "目前处于缩量震荡，CPI 数据公布前不建议重仓，保持观望。",
      time: "25分钟前"
    },
    {
      name: "趋势大师-陈总",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Chen",
      sentiment: 'bearish',
      content: "4小时级别出现顶背离，短期有回踩 65000 的风险，注意止损。",
      time: "1小时前"
    }
  ], []);

  useEffect(() => {
    const fetchRealtimeInsights = async () => {
      if (profile?.followedInfluencers && profile.followedInfluencers.length > 0) {
        // Throttling: only update automatically if it's been more than 10 minutes
        if (lastInsightUpdate && Date.now() - lastInsightUpdate < 10 * 60 * 1000) {
          return;
        }

        setFetchingInsights(true);
        const insights = await fetchInfluencerInsights(profile.followedInfluencers);
        setRealtimeInsights(insights);
        setLastInsightUpdate(Date.now());
        setFetchingInsights(false);
      } else {
        setRealtimeInsights([]);
      }
    };

    fetchRealtimeInsights();
  }, [profile?.followedInfluencers]);

  const refreshInsights = async () => {
    if (profile?.followedInfluencers && profile.followedInfluencers.length > 0) {
      setFetchingInsights(true);
      // Clear cache for this specific set of influencers
      const cacheKey = `influencer_insights_${profile.followedInfluencers.sort().join('_')}`;
      localStorage.removeItem(cacheKey);
      
      const insights = await fetchInfluencerInsights(profile.followedInfluencers);
      setRealtimeInsights(insights);
      setLastInsightUpdate(Date.now());
      setFetchingInsights(false);
    }
  };

  // Combined Influencer Data
  const allInfluencerInsights = useMemo(() => {
    // Put realtime insights first, then mock data
    const all = [...realtimeInsights, ...influencerInsights];
    // Filter out hidden ones
    if (profile?.hiddenInfluencers) {
      return all.filter(i => !profile.hiddenInfluencers.includes(i.name));
    }
    return all;
  }, [realtimeInsights, influencerInsights, profile?.hiddenInfluencers]);

  // Fetch 24h ticker data for all USDT pairs
  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/binance/api/v3/ticker/24hr');
      const data = await response.json();
      // Filter for USDT pairs only
      const filtered = data.filter((item: any) => item.symbol.endsWith('USDT'));
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
  const fetchKlines = async (symbol: string, currentInterval: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/binance/api/v3/klines?symbol=${symbol}&interval=${currentInterval}&limit=100`);
      const data = await response.json();
      const mapped: KLineData[] = data.map((item: any) => ({
        time: item[0] / 1000, // lightweight-charts uses seconds
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userProfile = await getOrCreateProfile(currentUser);
        setProfile(userProfile);
        
        // Listen for real-time profile updates (e.g. role changes)
        const profileUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
        });
        return () => profileUnsub();
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchMarketData();
    setAnalysisResult(null); // Clear previous analysis when symbol changes
    fetchKlines(selectedSymbol, interval);
    const tickerInterval = setInterval(fetchMarketData, 10000);
    return () => clearInterval(tickerInterval);
  }, [selectedSymbol, interval]);

  const handleAnalyze = async () => {
    if (!marketData[selectedSymbol]) return;
    
    // Membership Check
    if (!profile) {
      alert('请先登录以使用 AI 分析功能');
      return;
    }
    
    if (profile.role === 'free' && profile.aiAnalysisCount >= 3) {
      alert('免费会员每日仅限 3 次 AI 分析，请升级为收费会员以解锁无限次数');
      return;
    }

    setAnalyzing(true);
    setAnalysisResult(null);
    const intervalLabel = INTERVALS.find(i => i.value === interval)?.label || interval;
    const result = await analyzeMarket(
      selectedSymbol, 
      klines, 
      marketData[selectedSymbol], 
      intervalLabel, 
      allInfluencerInsights,
      profile?.followedInfluencers || []
    );
    
    // Increment analysis count for free users
    if (profile.role === 'free') {
      await updateDoc(doc(db, 'users', profile.uid), {
        aiAnalysisCount: increment(1)
      });
    }

    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const toggleFavorite = async (symbol: string) => {
    if (!profile) {
      alert('请先登录以使用自选功能');
      return;
    }

    const isFavorite = profile.favorites?.includes(symbol);
    const newFavorites = isFavorite
      ? profile.favorites.filter(s => s !== symbol)
      : [...(profile.favorites || []), symbol];

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        favorites: newFavorites
      });
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  const moveFavorite = async (symbol: string, direction: 'up' | 'down') => {
    if (!profile || !profile.favorites) return;
    const index = profile.favorites.indexOf(symbol);
    if (index === -1) return;
    
    const newFavorites = [...profile.favorites];
    if (direction === 'up' && index > 0) {
      [newFavorites[index], newFavorites[index - 1]] = [newFavorites[index - 1], newFavorites[index]];
    } else if (direction === 'down' && index < newFavorites.length - 1) {
      [newFavorites[index], newFavorites[index + 1]] = [newFavorites[index + 1], newFavorites[index]];
    } else {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        favorites: newFavorites
      });
    } catch (error) {
      console.error('Error reordering favorites:', error);
    }
  };

  const addInfluencer = async () => {
    if (!profile) {
      alert('请先登录以添加博主');
      return;
    }
    if (!newInfluencer.trim()) return;

    const updated = [...(profile.followedInfluencers || []), newInfluencer.trim()];
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        followedInfluencers: updated
      });
      setNewInfluencer('');
    } catch (error) {
      console.error('Error adding influencer:', error);
    }
  };

  const removeInfluencer = async (name: string) => {
    if (!profile) return;
    const updated = profile.followedInfluencers.filter(n => n !== name);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        followedInfluencers: updated
      });
    } catch (error) {
      console.error('Error removing influencer:', error);
    }
  };

  const hideInfluencer = async (name: string) => {
    if (!profile) return;
    const updated = [...(profile.hiddenInfluencers || []), name];
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        hiddenInfluencers: updated
      });
    } catch (error) {
      console.error('Error hiding influencer:', error);
    }
  };

  const filteredSymbols = useMemo(() => {
    let all = Object.values(marketData);
    
    // Filter by Sidebar Tab
    if (sidebarTab === 'favorites' && profile) {
      // Sort by the order in profile.favorites
      const favs = profile.favorites || [];
      return favs
        .map(sym => marketData[sym])
        .filter(Boolean)
        .filter(m => !searchQuery || m.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (!searchQuery) {
      // If no search, show top volume coins or just a subset to avoid lag
      return all.sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume)).slice(0, 50);
    }
    return all.filter(m => 
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume)).slice(0, 50);
  }, [marketData, searchQuery, sidebarTab, profile?.favorites]);

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
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold">{profile?.displayName}</div>
                  <div className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                    profile?.role === 'pro' ? "bg-yellow-500/20 text-yellow-500" : "bg-gray-500/20 text-gray-400"
                  )}>
                    {profile?.role === 'pro' ? '收费会员' : '免费会员'}
                  </div>
                </div>
                <button onClick={logOut} className="group relative">
                  <img src={profile?.photoURL} alt="avatar" className="w-8 h-8 rounded-full border border-gray-700 group-hover:border-yellow-500 transition-colors" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-[#181a20] rounded-full" />
                </button>
              </div>
            ) : (
              <button 
                onClick={signIn}
                className="bg-yellow-500 text-black px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-yellow-400 transition-colors"
              >
                登录 / 注册
              </button>
            )}
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
              onClick={() => { fetchMarketData(); fetchKlines(selectedSymbol, interval); }}
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
            <div className="border-b border-gray-800">
              <div className="flex">
                <button 
                  onClick={() => setSidebarTab('all')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold transition-all relative",
                    sidebarTab === 'all' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  全部
                  {sidebarTab === 'all' && <motion.div layoutId="sidebarTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
                <button 
                  onClick={() => setSidebarTab('favorites')}
                  className={cn(
                    "flex-1 py-3 text-sm font-bold transition-all relative flex items-center justify-center gap-2",
                    sidebarTab === 'favorites' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Star className={cn("w-3.5 h-3.5", sidebarTab === 'favorites' && "fill-yellow-500")} />
                  自选
                  {sidebarTab === 'favorites' && <motion.div layoutId="sidebarTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
              </div>
            </div>
            <div className="p-3 border-b border-gray-800 bg-[#1e2329]/50">
              <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                <span>币种 / 成交量</span>
                <span>最新价 / 涨跌幅</span>
              </div>
            </div>
            <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredSymbols.length > 0 ? filteredSymbols.map((coin) => (
                <div
                  key={coin.symbol}
                  className={cn(
                    "w-full flex items-center hover:bg-[#2b2f36] transition-colors group",
                    selectedSymbol === coin.symbol && "bg-[#2b2f36]"
                  )}
                >
                  <button
                    onClick={() => toggleFavorite(coin.symbol)}
                    className="pl-4 pr-2 py-4 text-gray-600 hover:text-yellow-500 transition-colors"
                  >
                    <Star className={cn(
                      "w-4 h-4 transition-all",
                      profile?.favorites?.includes(coin.symbol) ? "fill-yellow-500 text-yellow-500 scale-110" : "group-hover:text-gray-400"
                    )} />
                  </button>
                  
                  {sidebarTab === 'favorites' && (
                    <div className="flex flex-col gap-1 pr-2">
                      <button 
                        onClick={() => moveFavorite(coin.symbol, 'up')}
                        className="text-gray-600 hover:text-gray-300 transition-colors"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => moveFavorite(coin.symbol, 'down')}
                        className="text-gray-600 hover:text-gray-300 transition-colors"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedSymbol(coin.symbol)}
                    className="flex-1 p-4 pl-0 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-bold">{coin.symbol.replace('USDT', '')}<span className="text-xs text-gray-500 ml-1">/USDT</span></div>
                      <div className="text-[10px] text-gray-500">Vol: {parseFloat(coin.volume).toFixed(0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium text-sm">{formatPrice(coin.price)}</div>
                      <div className={cn(
                        "text-[10px] font-bold flex items-center justify-end gap-0.5",
                        parseFloat(coin.priceChangePercent) >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {parseFloat(coin.priceChangePercent) >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {formatPercent(coin.priceChangePercent)}
                      </div>
                    </div>
                  </button>
                </div>
              )) : (
                <div className="p-12 text-center">
                  <Star className="w-8 h-8 text-gray-800 mx-auto mb-3" />
                  <p className="text-gray-500 text-xs">
                    {sidebarTab === 'favorites' ? '暂无自选币种' : '未找到相关币种'}
                  </p>
                  {sidebarTab === 'favorites' && (
                    <button 
                      onClick={() => setSidebarTab('all')}
                      className="mt-4 text-yellow-500 text-[10px] font-bold hover:underline"
                    >
                      去添加币种
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Influencer Insights Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-[#181a20] to-[#1e2329]">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                博主动态
              </h2>
              <div className="flex items-center gap-2">
                {lastInsightUpdate && (
                  <span className="text-[9px] text-gray-500">
                    {new Date(lastInsightUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button 
                  onClick={refreshInsights}
                  disabled={fetchingInsights}
                  className={cn(
                    "p-1 rounded hover:bg-gray-800 transition-colors",
                    fetchingInsights && "animate-spin text-blue-500"
                  )}
                  title="刷新动态"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">Live</span>
              </div>
            </div>
            
            {/* Followed Influencers Management */}
            <div className="p-3 bg-[#1e2329]/30 border-b border-gray-800">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newInfluencer}
                  onChange={(e) => setNewInfluencer(e.target.value)}
                  placeholder="添加币安著名博主..."
                  className="flex-1 bg-[#0b0e11] border border-gray-700 rounded px-2 py-1 text-[10px] focus:border-yellow-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && addInfluencer()}
                />
                <button
                  onClick={addInfluencer}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black px-2 py-1 rounded text-[10px] font-bold transition-all"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile?.followedInfluencers?.map((name) => (
                  <span 
                    key={name}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800 rounded text-[9px] text-gray-400 border border-gray-700"
                  >
                    {name}
                    <button 
                      onClick={() => removeInfluencer(name)}
                      className="text-gray-500 hover:text-red-500 transition-colors ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {fetchingInsights && (
                <div className="p-4 text-center">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-[10px] text-gray-500">正在同步关注博主的最新动态...</p>
                </div>
              )}
              {allInfluencerInsights.map((insight, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-[#2b2f36]/50 border border-gray-800 hover:border-gray-700 transition-colors relative group/card">
                  <button
                    onClick={() => hideInfluencer(insight.name)}
                    className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover/card:opacity-100 transition-all"
                    title="不再显示此博主"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2 mb-2">
                    <img src={insight.avatar} alt={insight.name} className="w-6 h-6 rounded-full bg-gray-700" referrerPolicy="no-referrer" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1">
                        {insight.name}
                        {realtimeInsights.some(r => r.name === insight.name) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="实时动态" />
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">{insight.time}</div>
                    </div>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                      insight.sentiment === 'bullish' ? "bg-green-500/10 text-green-500" :
                      insight.sentiment === 'bearish' ? "bg-red-500/10 text-red-500" :
                      "bg-gray-500/10 text-gray-400"
                    )}>
                      {insight.sentiment === 'bullish' ? "看多" : insight.sentiment === 'bearish' ? "看空" : "观望"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed italic">
                    <MessageSquare className="w-3 h-3 inline mr-1 opacity-50" />
                    {insight.content}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-3 bg-[#1e2329] border-t border-gray-800">
              <p className="text-[10px] text-gray-500 text-center leading-tight">
                AI 已实时订阅以上博主及你关注的博主动态并纳入综合分析
              </p>
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
                K线走势图
              </h3>
              <div className="flex flex-wrap gap-2 justify-end">
                {INTERVALS.map(t => (
                  <button 
                    key={t.value} 
                    onClick={() => setIntervalState(t.value)}
                    className={cn(
                      "px-3 py-1 rounded text-xs transition-colors whitespace-nowrap",
                      t.value === interval ? "bg-yellow-500 text-black font-bold" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="w-full">
              <CandlestickChart data={klines} loading={loading} />
            </div>
          </div>

          {/* AI Analysis & Mock Trading Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden">
            <div className="border-b border-gray-800 flex items-center justify-between bg-[#1e2329] px-6">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={cn(
                    "px-6 py-4 text-sm font-bold transition-all relative flex items-center gap-2",
                    activeTab === 'analysis' ? "text-purple-400" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <BrainCircuit className="w-4 h-4" />
                  AI 智能分析
                  {activeTab === 'analysis' && <motion.div layoutId="mainTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
                </button>
                <button
                  onClick={() => setActiveTab('trading')}
                  className={cn(
                    "px-6 py-4 text-sm font-bold transition-all relative flex items-center gap-2",
                    activeTab === 'trading' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  模拟炒币 (实战)
                  {activeTab === 'trading' && <motion.div layoutId="mainTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
              </div>
              
              {activeTab === 'analysis' && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || loading}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                    analyzing 
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 active:scale-95"
                  )}
                >
                  {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                  {analyzing ? "分析中..." : "开始 AI 分析"}
                </button>
              )}
            </div>
            
            <div className="min-h-[500px] relative">
              <AnimatePresence mode="wait">
                {activeTab === 'analysis' ? (
                  <motion.div 
                    key="analysis"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-6"
                  >
                    {analyzing ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
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
                        <p className="text-sm text-gray-400">正在调取实时数据、币安广场动态及全网资讯...</p>
                      </div>
                    ) : analysisResult ? (
                      <div className="prose prose-invert max-w-none">
                        <div className="bg-[#1e2329] rounded-lg p-6 border border-gray-700 shadow-inner">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2 text-purple-400 font-bold">
                              <Info className="w-4 h-4" />
                              分析报告 - {selectedSymbol}
                            </div>
                            <div className="flex gap-2">
                              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">Square 广场</span>
                              <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase">实时新闻</span>
                            </div>
                          </div>
                          <div className="markdown-body text-gray-300 leading-relaxed text-sm">
                            <Markdown>{analysisResult}</Markdown>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-24 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                        <BrainCircuit className="w-12 h-12 mb-4 opacity-20" />
                        <p>点击上方按钮，获取针对 {selectedSymbol} 的 AI 深度分析建议</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="trading"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-[600px] relative"
                  >
                    {profile?.role === 'free' && (
                      <div className="absolute inset-0 bg-[#0b0e11]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center">
                        <Lock className="w-16 h-16 text-yellow-500 mb-4" />
                        <h3 className="text-xl font-bold mb-2">模拟炒币功能已锁定</h3>
                        <p className="text-gray-400 text-sm mb-6 max-w-md">
                          模拟炒币实战板块仅对收费会员开放。升级后即可使用 10,000 USDT 模拟金进行现货与合约实战演练。
                        </p>
                        <button 
                          onClick={() => alert('升级功能正在对接支付网关，请联系客服手动升级')}
                          className="bg-yellow-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-900/20"
                        >
                          立即升级为收费会员
                        </button>
                      </div>
                    )}
                    <MockTrading symbol={selectedSymbol} currentPrice={currentCoin ? parseFloat(currentCoin.price) : 0} />
                  </motion.div>
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
