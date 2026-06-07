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
  ChevronDown,
  ShieldCheck
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
import { AdminDashboard } from './components/AdminDashboard';
import { auth, db, signIn, logOut, getOrCreateProfile, UserProfile, UserRole, signInEmail, signUpEmail, handleFirestoreError, OperationType } from './firebase';
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

// Generate deterministic-yet-natural-looking trend lines of 12 points representing the past 1 hour of trading.
// This prevents high-frequency flickering while keeping each coin's visual movement custom and unique.
const generateSparklineData = (symbol: string, currentPrice: number, changePercent: number) => {
  const points = 12;
  const data = [];
  
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Derive starting price based on the current percent change
  const hourlyChangeFraction = changePercent / 24 / 100;
  const startPrice = currentPrice / (1 + hourlyChangeFraction);
  const totalDiff = currentPrice - startPrice;

  for (let i = 0; i < points; i++) {
    const fraction = i / (points - 1);
    
    // Linear transition
    let priceVal = startPrice + totalDiff * fraction;
    
    // Trigger multiple harmonic wave overlays using the unique coin string seed
    const wave1 = Math.sin(fraction * Math.PI * 2 + (hash % 10)) * 0.0025 * currentPrice;
    const wave2 = Math.cos(fraction * Math.PI * 4.5 + ((hash >> 3) % 10)) * 0.0012 * currentPrice;
    const wave3 = Math.sin(fraction * Math.PI * 7.2 + ((hash >> 6) % 10)) * 0.0006 * currentPrice;
    
    // Dampen endpoints to start at startPrice & align closely with currentPrice
    const dampening = Math.sin(fraction * Math.PI);
    priceVal += (wave1 + wave2 + wave3) * dampening;

    data.push({ value: priceVal });
  }
  return data;
};

export default function App() {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [interval, setIntervalState] = useState('1h');
  const [klines, setKlines] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  
  const parsedAnalysis = useMemo(() => {
    if (!analysisResult) return { metrics: null, markdown: "" };
    
    // Regular expression to find the [METRICS] JSON string and block
    const metricsRegex = /\[METRICS\]([\s\S]*?)\[\/METRICS\]/;
    const match = analysisResult.match(metricsRegex);
    
    if (match) {
      try {
        let jsonStr = match[1].trim();
        // Remove code block markers if the model wrapped it in ```json ... ```
        jsonStr = jsonStr.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
        const metrics = JSON.parse(jsonStr);
        const markdown = analysisResult.replace(metricsRegex, "").trim();
        return { metrics, markdown };
      } catch (e) {
        console.error("Failed to parse analysis metrics JSON:", e);
      }
    }
    
    return { metrics: null, markdown: analysisResult };
  }, [analysisResult]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'trading'>('analysis');
  const [sidebarTab, setSidebarTab] = useState<'all' | 'favorites'>('favorites');
  const [newInfluencer, setNewInfluencer] = useState('');
  const [realtimeInsights, setRealtimeInsights] = useState<InfluencerInsight[]>([]);
  const [fetchingInsights, setFetchingInsights] = useState(false);
  const [lastInsightUpdate, setLastInsightUpdate] = useState<number | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [mobileTab, setMobileTab] = useState<'market' | 'chart' | 'insights'>('chart');
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [adminLoginError, setAdminLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [usingFallbackMarket, setUsingFallbackMarket] = useState(false);
  
  // Custom Auth Modal States for Vercel/Popup resilience
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authFormTab, setAuthFormTab] = useState<'signin' | 'signup'>('signin');
  const [emailCredentials, setEmailCredentials] = useState({ email: '', password: '' });
  const [emailAuthError, setEmailAuthError] = useState('');
  const [isEmailAuthenticating, setIsEmailAuthenticating] = useState(false);
  
  // Custom Toast State
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };
  
  // Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Mock Influencer Data
  const handleTitleClick = () => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);
    if (newCount >= 10) {
      setShowAdminLogin(true);
      setTitleClickCount(0);
    }
    // Reset count after 3 seconds of inactivity
    setTimeout(() => setTitleClickCount(0), 3000);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError('');
    setIsLoggingIn(true);
    
    try {
      // The user requested aoba2026 / ylz@8826
      // We map this to aoba2026@admin.com in Firebase
      const email = `${adminCredentials.username}@admin.com`;
      
      try {
        await signInEmail(email, adminCredentials.password);
      } catch (err: any) {
        // If user doesn't exist, try to create it (first time setup)
        // Modern Firebase returns auth/invalid-credential for user-not-found as well
        const isCredentialError = err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential';
        const isSuperAdmin = adminCredentials.username === 'aoba2026' && adminCredentials.password === 'ylz@8826';
        
        if (isCredentialError && isSuperAdmin) {
          try {
            await signUpEmail(email, adminCredentials.password);
          } catch (signUpErr: any) {
            // If email already exists, it means the password was actually wrong
            if (signUpErr.code === 'auth/email-already-in-use') {
              throw err;
            }
            throw signUpErr;
          }
        } else {
          throw err;
        }
      }
      
      setShowAdminLogin(false);
      setAdminCredentials({ username: '', password: '' });
    } catch (err: any) {
      console.error('Admin login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setAdminLoginError('登录失败：Firebase 项目尚未开启“电子邮件/密码”登录。请进入 Firebase 开启。');
      } else {
        setAdminLoginError('登录失败：用户名或密码错误。');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setEmailAuthError('');
    try {
      await signIn();
      setShowAuthModal(false);
      showToast("登录成功！欢迎回来", "success");
    } catch (err: any) {
      console.error("Google sign in error:", err);
      // Catch unauthorized-domain
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setEmailAuthError(
          `登录失败：当前部署的 Vercel 域名 (v6-two-blue.vercel.app) 尚未在 Firebase 项目的“授权网域”(Authorized Domains) 列表中注册。\n\n【如何一键修复】：\n1. 登录 Firebase 网页控制台 (console.firebase.google.com)\n2. 进入 你的项目 -> Authentication -> Settings 选项卡 -> 找到 Authorized domains (已授权网域)\n3. 点击“添加网域”，填入并保存：v6-two-blue.vercel.app\n\n【💡 临时体验】：如果您暂时不想去控制台配置，可以尝试在下方使用“邮箱密码注册/登录”直接秒登体验所有功能！`
        );
      } else if (err.code === 'auth/popup-closed-by-user') {
        setEmailAuthError("登录窗口已被主动关闭。如果没有成功弹窗，请检查浏览器是否拦截了弹出式窗口，或者直接使用底部的邮箱和密码进行登录、注册。");
      } else {
        setEmailAuthError(`账户快捷登录发生问题: ${err.message || err}。建议尝试下方邮箱注册登录，完全免域名授权。`);
      }
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailAuthError('');
    setIsEmailAuthenticating(true);

    try {
      if (!emailCredentials.email || !emailCredentials.password) {
        throw new Error("请填写完整的用户名及登录密码");
      }
      if (emailCredentials.password.length < 6) {
        throw new Error("密码长度至少需为 6 位以上");
      }

      let emailVal = emailCredentials.email.trim();
      const passVal = emailCredentials.password;

      // Automatically append domain if it is a simple username rather than email
      if (!emailVal.includes('@')) {
        emailVal = `${emailVal}@admin.com`;
      }

      if (authFormTab === 'signup') {
        await signUpEmail(emailVal, passVal);
        showToast("账户注册并登录成功！", "success");
      } else {
        try {
          await signInEmail(emailVal, passVal);
          showToast("登录成功！欢迎回来", "success");
        } catch (err: any) {
          // If login fails with credentials format mismatch, see if it is our super administrator account
          const isSuperAdmin = (emailVal === 'aoba2026@admin.com') && passVal === 'ylz@8826';
          const isCredentialError = err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential';
          
          if (isCredentialError && isSuperAdmin) {
            try {
              // Automatically provision the super administrator account
              await signUpEmail(emailVal, passVal);
              showToast("系统管理员账户已自动创建并登录成功！", "success");
            } catch (signUpErr: any) {
              if (signUpErr.code === 'auth/email-already-in-use') {
                throw err; // Password was incorrect for already registered admin email
              }
              throw signUpErr;
            }
          } else {
            throw err;
          }
        }
      }
      setShowAuthModal(false);
      setEmailCredentials({ email: '', password: '' });
    } catch (err: any) {
      console.error("Email/username auth operation error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setEmailAuthError("当前 Firebase 项目未启用邮箱密码功能：请登录 Firebase 控制台 -> Authentication -> Sign-in method 启用“电子邮件/密码”登录。");
      } else if (err.code === 'auth/email-already-in-use') {
        setEmailAuthError("此登录账号已被注册，请点击上方“极速登录”按钮，直接输入密码登录。");
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setEmailAuthError("登录账号或密码不正确。如果您使用的是全新账号，请点击“创建新账户”进行注册。");
      } else if (err.code === 'auth/weak-password') {
        setEmailAuthError("密码强度不足，出于安全因素，Firebase 密码要求至少 6 位以上数字或字符。");
      } else {
        setEmailAuthError(err.message || "由于未知网络原因，登录/注册失败，请重新检查格式或稍后重试");
      }
    } finally {
      setIsEmailAuthenticating(false);
    }
  };

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

  // Helper to generate realistic mock market ticker data when Binance API is unavailable
  const getMockMarketData = () => {
    const coins = [
      { symbol: 'BTCUSDT', price: 67245.50, change: 1.45, high: 68200.00, low: 66500.00, volume: 28450 },
      { symbol: 'ETHUSDT', price: 3485.20, change: 2.10, high: 3550.00, low: 3420.00, volume: 184510 },
      { symbol: 'BNBUSDT', price: 585.30, change: -0.45, high: 595.00, low: 578.00, volume: 45210 },
      { symbol: 'SOLUSDT', price: 148.50, change: 3.85, high: 153.20, low: 145.10, volume: 894520 },
      { symbol: 'DOGEUSDT', price: 0.1425, change: -1.20, high: 0.1480, low: 0.1385, volume: 15204210 },
      { symbol: 'ADAUSDT', price: 0.4650, change: 0.85, high: 0.4850, low: 0.4520, volume: 2541020 }
    ];
    const mapped: Record<string, MarketData> = {};
    coins.forEach(c => {
      const existing = marketData[c.symbol];
      let price = c.price;
      let change = c.change;
      if (existing) {
        const floatPrice = parseFloat(existing.price);
        price = floatPrice + floatPrice * 0.0006 * (Math.random() - 0.49); // slight positive drift
        change = parseFloat(existing.priceChangePercent) + (Math.random() - 0.5) * 0.03;
      } else {
        price = c.price + c.price * 0.001 * (Math.random() - 0.5);
      }
      mapped[c.symbol] = {
        symbol: c.symbol,
        price: price.toFixed(c.symbol === 'DOGEUSDT' || c.symbol === 'ADAUSDT' ? 5 : 2),
        high: Math.max(c.high, price).toString(),
        low: Math.min(c.low, price).toString(),
        volume: c.volume.toString(),
        priceChangePercent: change.toFixed(2)
      };
    });
    return mapped;
  };

  // Helper to generate realistic candle data for trading charts when Binance API is CORS or rate-limit blocked
  const generateMockKlines = (symbol: string, currentInterval: string): KLineData[] => {
    const count = 100;
    const data: KLineData[] = [];
    let basePrice = 67245.50;
    if (symbol.includes('ETH')) basePrice = 3485.20;
    else if (symbol.includes('SOL')) basePrice = 148.50;
    else if (symbol.includes('BNB')) basePrice = 585.30;
    else if (symbol.includes('DOGE')) basePrice = 0.1425;
    else if (symbol.includes('ADA')) basePrice = 0.4650;
    
    const now = Math.floor(Date.now() / 1000);
    let intervalSec = 3600; // default 1h
    if (currentInterval === '1m') intervalSec = 60;
    else if (currentInterval === '3m') intervalSec = 180;
    else if (currentInterval === '5m') intervalSec = 300;
    else if (currentInterval === '15m') intervalSec = 900;
    else if (currentInterval === '30m') intervalSec = 1800;
    else if (currentInterval === '4h') intervalSec = 14400;
    else if (currentInterval === '1d') intervalSec = 86400;
    else if (currentInterval === '1w') intervalSec = 604800;

    let currentPrice = basePrice - 100 * basePrice * 0.001 * 0.1;
    for (let i = count - 1; i >= 0; i--) {
      const time = now - i * intervalSec;
      const volatility = 0.0035;
      const change = currentPrice * volatility * (Math.random() - 0.49);
      const open = currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) + currentPrice * volatility * 0.3 * Math.random();
      const low = Math.min(open, close) - currentPrice * volatility * 0.3 * Math.random();
      const volume = 800 + Math.random() * 4000;
      
      data.push({
        time,
        open,
        high,
        low,
        close,
        volume
      });
      currentPrice = close;
    }
    return data;
  };

  // Fetch 24h ticker data for all USDT pairs
  const fetchMarketData = async () => {
    try {
      const response = await fetch('/api/binance/api/v3/ticker/24hr');
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server did not return JSON");
      }
      const data = await response.json();
      
      if (data && data.error) {
        throw new Error(data.error);
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid format received from proxy");
      }

      // Filter for USDT pairs only
      const filtered = data.filter((item: any) => item.symbol && item.symbol.endsWith('USDT'));
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
      setUsingFallbackMarket(false);
    } catch (error) {
      console.warn('Real-time Binance market fetch unavailable, using built-in high frequency model simulations:', error);
      setMarketData(getMockMarketData());
      if (!usingFallbackMarket) {
        setUsingFallbackMarket(true);
        showToast('币安实时行情连接受限，已无缝切换至内置智能行情模拟器', 'info');
      }
    }
  };

  // Fetch K-line data for chart
  const fetchKlines = async (symbol: string, currentInterval: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/binance/api/v3/klines?symbol=${symbol}&interval=${currentInterval}&limit=100`);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server did not return JSON");
      }
      const data = await response.json();

      if (data && data.error) {
        throw new Error(data.error);
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid candles data format received");
      }

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
      console.warn(`Real-time chart failed for ${symbol}, rendering high fidelity simulation candles:`, error);
      setKlines(generateMockKlines(symbol, currentInterval));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (currentUser) {
        try {
          const userProfile = await getOrCreateProfile(currentUser);
          setProfile(userProfile);
          
          // Listen for real-time profile updates (e.g. role changes)
          profileUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
            if (doc.exists()) {
              setProfile(doc.data() as UserProfile);
            }
          }, (error) => {
            console.warn("Firestore profile subscription warning (safe to ignore if logging out):", error);
          });
        } catch (error) {
          console.error("Failed to load user profile on auth state change:", error);
          showToast("加载用户配置文件失败，请刷新或重新登录", "error");
        }
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
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
      showToast('请先登录并升级以使用 AI 分析功能', 'warning');
      return;
    }
    
    if (profile.role === 'free') {
      showToast('AI 智能决策属于收费(高级)会员专属功能，请升级后体验', 'error');
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
    
    // Increment analysis count for user tracking stats
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        aiAnalysisCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }

    setAnalysisResult(result);
    setAnalyzing(false);
  };

  const toggleFavorite = async (symbol: string) => {
    if (!profile) {
      showToast('请先登录以使用自选功能', 'warning');
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const addInfluencer = async () => {
    if (!profile) {
      showToast('请先登录以添加博主', 'warning');
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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

  if (isAdminView && profile?.role === 'admin') {
    return <AdminDashboard onBack={() => setIsAdminView(false)} currentUserProfile={profile} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] font-sans selection:bg-yellow-500/30">
      {/* Unified User Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e2329] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center text-black">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Binance AI 助手</h3>
                    <p className="text-[10px] text-gray-500">量化研报与多模态高频模拟交易</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowAuthModal(false);
                    setEmailAuthError('');
                  }}
                  className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Login Method Tab Switcher */}
              <div className="mb-5 flex border-b border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthFormTab('signin');
                    setEmailAuthError('');
                  }}
                  className={`flex-1 pb-2.5 text-xs font-bold relative transition-colors cursor-pointer ${authFormTab === 'signin' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"}`}
                >
                  账号安全登录
                  {authFormTab === 'signin' && <motion.div layoutId="authFormTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthFormTab('signup');
                    setEmailAuthError('');
                  }}
                  className={`flex-1 pb-2.5 text-xs font-bold relative transition-colors cursor-pointer ${authFormTab === 'signup' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"}`}
                >
                  注册新交易账户
                  {authFormTab === 'signup' && <motion.div layoutId="authFormTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
              </div>

              {/* Welcome Guidance Info */}
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-[11px] text-yellow-400 leading-relaxed text-left">
                💡 <b>温馨提示</b>：支持直接输入邮箱或自定义个性账号登录（如 <b>aoba2026</b>）。管理员账号与高维策略模型已为您匹配就绪。
              </div>

              {/* Error messages / Guidance */}
              {emailAuthError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 max-h-[170px] overflow-y-auto scrollbar-thin">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 leading-relaxed whitespace-pre-wrap shrink-1 text-left">{emailAuthError}</p>
                </div>
              )}

              <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">登录账号 / 用户名 / 邮箱</label>
                  <input 
                    type="text"
                    required
                    value={emailCredentials.email}
                    onChange={(e) => setEmailCredentials(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-[#0b0e11] border border-gray-700 rounded-xl px-4 py-2.5 text-xs focus:border-yellow-500 outline-none transition-all placeholder:text-gray-600 text-white"
                    placeholder="请输入用户名或邮箱，如 aoba2026"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">登录密码</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={emailCredentials.password}
                    onChange={(e) => setEmailCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#0b0e11] border border-gray-700 rounded-xl px-4 py-2.5 text-xs focus:border-yellow-500 outline-none transition-all placeholder:text-gray-600 text-white"
                    placeholder="输入不低于 6 位的密码"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isEmailAuthenticating}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs active:scale-98 cursor-pointer"
                >
                  {isEmailAuthenticating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>正在处理中...</span>
                    </>
                  ) : authFormTab === 'signup' ? (
                    <span>立即注册并登录</span>
                  ) : (
                    <span>安全登录</span>
                  )}
                </button>
              </form>

              {/* Developer / Admin fallback route helper */}
              <div className="mt-5 pt-4 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-500">
                <span>遇到浏览器弹窗拦截？</span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    setShowAdminLogin(true);
                  }}
                  className="text-yellow-500 hover:underline cursor-pointer"
                >
                  系统管理员登录 &rarr;
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e2329] border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Lock className="w-5 h-5 text-yellow-500" />
                  后台管理登录
                </h2>
                <button 
                  onClick={() => setShowAdminLogin(false)}
                  className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">用户名</label>
                  <input 
                    type="text"
                    required
                    value={adminCredentials.username}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-[#0b0e11] border border-gray-700 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-all"
                    placeholder="输入管理员用户名"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">密码</label>
                  <input 
                    type="password"
                    required
                    value={adminCredentials.password}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-[#0b0e11] border border-gray-700 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none transition-all"
                    placeholder="输入管理员密码"
                  />
                </div>

                {adminLoginError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-400 leading-relaxed">{adminLoginError}</p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      正在登录...
                    </>
                  ) : (
                    '立即登录'
                  )}
                </button>
              </form>
              
              <p className="mt-6 text-[10px] text-gray-500 text-center">
                提示：此入口为系统维护专用，非管理员请勿尝试。
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-gray-800 bg-[#181a20] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center gap-1.5 md:gap-2 cursor-pointer select-none active:scale-95 transition-transform"
              onClick={handleTitleClick}
            >
              <div className="w-7 h-7 md:w-8 md:h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Activity className="text-black w-4 h-4 md:w-5 md:h-5" />
              </div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">Binance AI <span className="text-yellow-500 hidden sm:inline">助手</span><span className="text-yellow-500 sm:hidden">助手</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {authLoading ? (
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 md:gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold">{profile?.displayName}</div>
                  <div className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                    profile?.role === 'admin' ? "bg-yellow-500/20 text-yellow-500" :
                    profile?.role === 'pro' ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"
                  )}>
                    {profile?.role === 'admin' ? '管理员' : profile?.role === 'pro' ? '收费会员' : '免费会员'}
                  </div>
                </div>
                {profile?.role === 'admin' && (
                  <button 
                    onClick={() => setIsAdminView(true)}
                    className="p-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded border border-yellow-500/30 transition-all"
                    title="进入后台管理"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}
                <button onClick={logOut} className="group relative">
                  <img src={profile?.photoURL} alt="avatar" className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gray-700 group-hover:border-yellow-500 transition-colors" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-[#181a20] rounded-full" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className="bg-yellow-500 text-black px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-xs md:text-sm font-bold hover:bg-yellow-400 transition-colors"
              >
                登录
              </button>
            )}
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="搜索币种..." 
                className="bg-[#2b2f36] border-none rounded-full py-1.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-yellow-500 outline-none w-48 xl:w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => { fetchMarketData(); fetchKlines(selectedSymbol, interval); }}
              className="p-1.5 md:p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4 md:w-5 md:h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 md:px-4 py-4 md:py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 pb-24 lg:pb-6">
        
        {/* Sidebar - Market List */}
        <div className={cn(
          "lg:col-span-3 space-y-4",
          mobileTab !== 'market' && mobileTab !== 'insights' && "hidden lg:block"
        )}>
          <div className={cn(
            "bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden shadow-xl",
            mobileTab !== 'market' && "hidden lg:block"
          )}>
            <div className="p-3 border-b border-gray-800 lg:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="搜索币种..." 
                  className="w-full bg-[#0b0e11] border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-yellow-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
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
            <div className="divide-y divide-gray-800 max-h-[calc(100vh-250px)] lg:max-h-[600px] overflow-y-auto custom-scrollbar">
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
                    onClick={() => { setSelectedSymbol(coin.symbol); if (window.innerWidth < 1024) setMobileTab('chart'); }}
                    className="flex-1 p-4 pl-0 flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="font-bold text-sm md:text-base">{coin.symbol.replace('USDT', '')}<span className="text-[10px] md:text-xs text-gray-500 ml-1">/USDT</span></div>
                      <div className="text-[9px] md:text-[10px] text-gray-500">Vol: {parseFloat(coin.volume).toFixed(0)}</div>
                    </div>

                    {/* Compact Sparkline Trend Preview */}
                    <div className="w-14 h-6 sm:w-16 sm:h-7 md:w-20 md:h-8 mx-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={generateSparklineData(coin.symbol, parseFloat(coin.price), parseFloat(coin.priceChangePercent))}
                          margin={{ top: 1, right: 1, left: 1, bottom: 1 }}
                        >
                          <defs>
                            <linearGradient id={`sparkline-grad-${coin.symbol}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={parseFloat(coin.priceChangePercent) >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.15}/>
                              <stop offset="95%" stopColor={parseFloat(coin.priceChangePercent) >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={parseFloat(coin.priceChangePercent) >= 0 ? "#10b981" : "#ef4444"} 
                            strokeWidth={1.2}
                            fillOpacity={1}
                            fill={`url(#sparkline-grad-${coin.symbol})`}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-medium text-xs md:text-sm">{formatPrice(coin.price)}</div>
                      <div className={cn(
                        "text-[9px] md:text-[10px] font-bold flex items-center justify-end gap-0.5",
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
          <div className={cn(
            "bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden shadow-xl",
            mobileTab !== 'insights' && "hidden lg:block"
          )}>
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

            <div className="p-2 space-y-2 max-h-[calc(100vh-350px)] lg:max-h-[400px] overflow-y-auto custom-scrollbar">
              {fetchingInsights && (
                <div className="p-4 text-center">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-[10px] text-gray-500">正在同步关注博主的最新动态...</p>
                </div>
              )}
              {allInfluencerInsights.length > 0 ? allInfluencerInsights.map((insight, idx) => (
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
              )) : !fetchingInsights && (
                <div className="p-12 text-center">
                  <Users className="w-8 h-8 text-gray-800 mx-auto mb-3" />
                  <p className="text-gray-500 text-xs">暂无博主动态</p>
                </div>
              )}
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
        <div className={cn(
          "lg:col-span-9 space-y-4 md:space-y-6",
          mobileTab !== 'chart' && "hidden lg:block"
        )}>
          
          {/* Price Header */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 md:gap-6 shadow-xl">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#2b2f36] rounded-full flex items-center justify-center text-lg md:text-xl font-bold text-yellow-500">
                {selectedSymbol.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl md:text-2xl font-bold">{selectedSymbol}</h2>
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">现货</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 md:mt-1">
                  <span className="text-2xl md:text-3xl font-mono font-bold text-yellow-500">{currentCoin ? formatPrice(currentCoin.price) : '---'}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs md:text-sm font-bold",
                    currentCoin && parseFloat(currentCoin.priceChangePercent) >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {currentCoin ? formatPercent(currentCoin.priceChangePercent) : '0.00%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-8 w-full md:w-auto pt-4 md:pt-0 border-t border-gray-800 md:border-none">
              <div>
                <div className="text-[10px] text-gray-500 mb-0.5">24h 最高</div>
                <div className="font-mono text-xs md:text-sm">{currentCoin ? formatPrice(currentCoin.high) : '---'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 mb-0.5">24h 最低</div>
                <div className="font-mono text-xs md:text-sm">{currentCoin ? formatPrice(currentCoin.low) : '---'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 mb-0.5">24h 成交额</div>
                <div className="font-mono text-xs md:text-sm">{(currentCoin ? parseFloat(currentCoin.volume) * parseFloat(currentCoin.price) / 1000000 : 0).toFixed(2)}M</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] text-gray-500 mb-0.5">更新时间</div>
                <div className="font-mono text-xs md:text-sm">{new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 p-4 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
                <TrendingUp className="w-4 h-4 text-yellow-500" />
                K线走势图
              </h3>
              <div className="flex overflow-x-auto gap-1.5 pb-2 sm:pb-0 custom-scrollbar">
                {INTERVALS.map(t => (
                  <button 
                    key={t.value} 
                    onClick={() => setIntervalState(t.value)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[10px] md:text-xs transition-colors whitespace-nowrap",
                      t.value === interval ? "bg-yellow-500 text-black font-bold" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="w-full h-[300px] md:h-[450px] overflow-hidden relative">
              <CandlestickChart data={klines} loading={loading} />
            </div>
          </div>

          {/* AI Analysis & Mock Trading Section */}
          <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden shadow-xl">
            <div className="border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between bg-[#1e2329]">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={cn(
                    "flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold transition-all relative flex items-center justify-center gap-2",
                    activeTab === 'analysis' ? "text-purple-400" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <BrainCircuit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  AI 智能分析
                  {activeTab === 'analysis' && <motion.div layoutId="mainTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
                </button>
                <button
                  onClick={() => setActiveTab('trading')}
                  className={cn(
                    "flex-1 sm:flex-none px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm font-bold transition-all relative flex items-center justify-center gap-2",
                    activeTab === 'trading' ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  模拟炒币
                  {activeTab === 'trading' && <motion.div layoutId="mainTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
                </button>
              </div>
              
              {activeTab === 'analysis' && (
                <div className="p-2 sm:p-0 sm:pr-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || loading}
                    className={cn(
                      "w-full sm:w-auto px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center justify-center gap-2",
                      analyzing 
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                        : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 active:scale-95"
                    )}
                  >
                    {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                    {analyzing ? "分析中..." : "开始 AI 分析"}
                  </button>
                </div>
              )}
            </div>
            
            <div className="min-h-[400px] md:min-h-[500px] relative">
              <AnimatePresence mode="wait">
                {activeTab === 'analysis' ? (
                  <motion.div 
                    key="analysis"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 md:p-6 relative min-h-[400px] md:min-h-[500px]"
                  >
                    {!profile ? (
                      <div className="absolute inset-0 bg-[#0b0e11]/90 backdrop-blur-[5px] z-40 flex flex-col items-center justify-center p-6 md:p-8 text-center rounded-b-xl">
                        <BrainCircuit className="w-12 h-12 md:w-16 md:h-16 text-purple-500 mb-4 animate-pulse animate-duration-1000" />
                        <h3 className="text-lg md:text-xl font-bold mb-2 text-purple-400">一键开启 AI 智能分析</h3>
                        <p className="text-gray-400 text-xs mb-6 max-w-sm">
                          全天候实时追踪链上动态、币安广场新闻与专业指标。请登录账户以启用收费会员专享的 AI 高维决策模型。
                        </p>
                        <button 
                          onClick={() => setShowAuthModal(true)}
                          className="bg-yellow-500 text-black px-6 py-2 md:px-8 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-900/20"
                        >
                          快捷登录 / 注册账户
                        </button>
                      </div>
                    ) : profile.role === 'free' ? (
                      <div className="absolute inset-0 bg-[#0b0e11]/90 backdrop-blur-[5px] z-40 flex flex-col items-center justify-center p-6 md:p-8 text-center rounded-b-xl">
                        <Lock className="w-12 h-12 md:w-16 md:h-16 text-purple-500 mb-4" />
                        <h3 className="text-lg md:text-xl font-bold mb-2 text-purple-400">AI 智能分析已锁定</h3>
                        <p className="text-gray-400 text-xs mb-6 max-w-sm">
                          AI 智能深度分析功能是收费会员的专属权益。升级后即可无限制使用高维量化模型分析、多源数据决策研判及实时策略建议。
                        </p>
                        <button 
                          onClick={() => showToast('升级功能正在对接支付网关，请联系客服手动升级', 'info')}
                          className="bg-purple-600 text-white px-6 py-2 md:px-8 md:py-2.5 rounded-xl font-bold text-xs md:text-sm hover:bg-purple-500 transition-all shadow-lg shadow-purple-900/40"
                        >
                          立即联系客服升级收费会员
                        </button>
                      </div>
                    ) : null}
                    {analyzing ? (
                      <div className="flex flex-col items-center justify-center py-16 md:py-24 gap-4">
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
                        <p className="text-[10px] md:text-sm text-gray-400 text-center">正在调取实时数据、币安广场动态及全网资讯...</p>
                      </div>
                    ) : analysisResult ? (
                      <div className="prose prose-invert max-w-none">
                        <div className="bg-[#1e2329] rounded-lg p-4 md:p-6 border border-gray-700 shadow-inner space-y-6">
                          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs md:text-sm">
                              <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
                              {analysisResult.includes("GEMINI_API_KEY") ? '配置中心 · API 密钥绑定向导' : `全球多源数据融合决策报告 - ${selectedSymbol}`}
                            </div>
                            <span className="text-[9px] md:text-xs font-mono py-0.5 px-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
                              {analysisResult.includes("GEMINI_API_KEY") ? '一分钟激活' : '超强综合研判 v4.0'}
                            </span>
                          </div>

                          {analysisResult.includes("GEMINI_API_KEY") ? (
                            <div className="space-y-4">
                              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-xs md:text-sm text-yellow-500 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-400" />
                                <div>
                                  <h4 className="font-bold text-yellow-400 text-sm mb-1">未检测到您的 GEMINI_API_KEY 环境变量</h4>
                                  <p className="text-gray-400 leading-relaxed text-xs">
                                    多源智能决策研判系统调用了 Google 官方的高维大语言模型作为决策引擎。当前由于部署在您的 Vercel 云空间（或其他独立托管平台），尚未绑定 API Key。只需进行简单的极速配置即可秒级激活！
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gray-950/60 p-4 border border-gray-800 rounded-xl">
                                  <h4 className="font-bold text-purple-400 text-xs md:text-sm mb-3 flex items-center gap-1.5 border-b border-gray-850 pb-2">
                                    <span className="w-4 h-4 bg-purple-500/10 text-purple-400 rounded flex items-center justify-center font-mono text-[10px]">A</span>
                                    Vercel 托管环境绑定（推荐）
                                  </h4>
                                  <ol className="text-gray-400 text-[11px] md:text-xs space-y-2 list-decimal pl-4 leading-relaxed">
                                    <li>登录您的 <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-purple-400 underline hover:text-purple-300">Vercel 仪表盘</a>，进入并选中近期部署的项目。</li>
                                    <li>切换到 <strong className="text-gray-200">Settings</strong> (设置) 页签，然后点击左侧栏的 <strong className="text-gray-200">Environment Variables</strong>。</li>
                                    <li>添加一条环境变量：
                                      <div className="my-1.5 p-2 bg-black/40 rounded border border-gray-800 font-mono text-[10px] space-y-1 select-all">
                                        <div className="flex justify-between"><span>Key (名称):</span> <span className="text-yellow-400 font-bold">GEMINI_API_KEY</span></div>
                                        <div className="flex justify-between"><span>Value (数值):</span> <span className="text-gray-400">填入您的 API Key 字符串</span></div>
                                      </div>
                                    </li>
                                    <li>保存后点击 <strong className="text-gray-200">Deployments</strong>，找到最近的一次部署点击右侧三点，点击 <strong className="text-purple-400">Redeploy (重新部署)</strong> 即可完美上线！</li>
                                  </ol>
                                </div>

                                <div className="bg-gray-950/60 p-4 border border-gray-800 rounded-xl">
                                  <h4 className="font-bold text-purple-400 text-xs md:text-sm mb-3 flex items-center gap-1.5 border-b border-gray-850 pb-2">
                                    <span className="w-4 h-4 bg-purple-500/10 text-purple-400 rounded flex items-center justify-center font-mono text-[10px]">B</span>
                                    100% 免费自助创建 Google API Key
                                  </h4>
                                  <div className="space-y-3 text-gray-400 text-[11px] md:text-xs leading-relaxed">
                                    <p>如果您还没有 Gemini Key，Google 官方提供了免费的测试额度：</p>
                                    <ol className="list-decimal pl-4 space-y-1">
                                      <li>电脑端访问 <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-cyan-400 underline hover:text-cyan-300 font-bold">Google AI Studio</a>。</li>
                                      <li>点击 <strong className="text-gray-200">Create API Key</strong> 创建新密钥。</li>
                                      <li>复制该密钥并在第一步中填入到 Vercel (通常以 <code className="bg-gray-850 px-1 py-0.5 rounded text-yellow-400">AIzaSy...</code> 开头)。</li>
                                    </ol>
                                    <div className="pt-2 flex flex-wrap gap-2">
                                      <a 
                                        href="https://aistudio.google.com/" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] md:text-xs px-3 py-1.5 rounded-lg transition-all"
                                      >
                                        免费申请 API Key →
                                      </a>
                                      <a 
                                        href="https://vercel.com" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-[10px] md:text-xs px-3 py-1.5 rounded-lg transition-all"
                                      >
                                        前往 Vercel 控制台 ↗
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Dynamic Visual Dashboard Block */}
                              {parsedAnalysis.metrics && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-950/40 p-4 border border-gray-800 rounded-lg shadow-inner">
                                  
                                  {/* 1. Market Health Gauge */}
                                  <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-gray-800/80 pb-4 md:pb-0 md:pr-4">
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 mb-2.5 flex items-center gap-1">
                                      <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> 市场整体健康度
                                    </span>
                                    <div className="relative flex items-center justify-center">
                                      {(() => {
                                        const radius = 32;
                                        const circ = 2 * Math.PI * radius;
                                        const score = Math.max(0, Math.min(100, Number(parsedAnalysis.metrics.healthScore) || 50));
                                        const offset = circ - (score / 100) * circ;
                                        const isBully = score >= 60;
                                        const isBeary = score <= 40;
                                        const ringColor = isBully ? "text-emerald-500" : isBeary ? "text-red-500" : "text-yellow-500";
                                        const ringBg = isBully ? "bg-emerald-500/5" : isBeary ? "bg-red-500/5" : "bg-yellow-500/5";
                                        return (
                                          <>
                                            <svg className="w-20 h-20 md:w-24 md:h-24 transform -rotate-90">
                                              <circle cx="48" cy="48" r={radius} className="text-gray-850" strokeWidth="5.5" stroke="currentColor" fill="transparent" />
                                              <circle cx="48" cy="48" r={radius} className={ringColor} strokeWidth="5.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                                            </svg>
                                            <div className="absolute flex flex-col items-center justify-center">
                                              <span className="text-lg md:text-xl font-mono font-black text-white">{score}</span>
                                              <span className={`text-[8px] md:text-[9px] font-bold ${ringColor}`}>
                                                {isBully ? "多头强劲" : isBeary ? "空头主导" : "震荡蓄势"}
                                              </span>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                    <span className="text-[9px] text-gray-500 mt-2 text-center leading-relaxed">
                                      加权指标权重：链上[30%] 消息[25%] 技术[25%] 宏观[20%]
                                    </span>
                                  </div>

                                  {/* 2. Probability Distribution Grid */}
                                  <div className="flex flex-col justify-center border-b md:border-b-0 md:border-r border-gray-800/80 py-4 md:py-0 md:px-4">
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 mb-3 flex items-center gap-1 self-center md:self-start">
                                      <Activity className="w-3.5 h-3.5 text-purple-400" /> 多情境多空概率分布
                                    </span>
                                    <div className="space-y-2 text-[10px] md:text-xs">
                                      {(() => {
                                        const long = Math.max(0, Math.min(100, Number(parsedAnalysis.metrics.longProb) || 0));
                                        const short = Math.max(0, Math.min(100, Number(parsedAnalysis.metrics.shortProb) || 0));
                                        const neutral = Math.max(0, Math.min(100, Number(parsedAnalysis.metrics.neutralProb) || 0));
                                        return (
                                          <>
                                            <div>
                                              <div className="flex justify-between text-gray-400 mb-0.5 font-bold">
                                                <span className="text-emerald-400 flex items-center gap-1">🟢 做多机会 (Long)</span>
                                                <span className="font-mono text-white">{long}%</span>
                                              </div>
                                              <div className="w-full bg-gray-850 rounded-full h-1.5 overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${long}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="bg-emerald-500 h-1.5 rounded-full" />
                                              </div>
                                            </div>
                                            <div>
                                              <div className="flex justify-between text-gray-400 mb-0.5 font-bold">
                                                <span className="text-red-400 flex items-center gap-1">🔴 做空倾向 (Short)</span>
                                                <span className="font-mono text-white">{short}%</span>
                                              </div>
                                              <div className="w-full bg-gray-850 rounded-full h-1.5 overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${short}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="bg-red-500 h-1.5 rounded-full" />
                                              </div>
                                            </div>
                                            <div>
                                              <div className="flex justify-between text-gray-400 mb-0.5 font-bold">
                                                <span className="text-gray-400 flex items-center gap-1">⚪ 观望策略 (Neutral)</span>
                                                <span className="font-mono text-white">{neutral}%</span>
                                              </div>
                                              <div className="w-full bg-gray-850 rounded-full h-1.5 overflow-hidden">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${neutral}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="bg-gray-500 h-1.5 rounded-full" />
                                              </div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* 3. Authoritative Core Metrics */}
                                  <div className="flex flex-col justify-center pt-4 md:pt-0 md:pl-4">
                                    <span className="text-[10px] md:text-xs font-bold text-gray-400 mb-2.5 flex items-center gap-1 self-center md:self-start">
                                      <Info className="w-3.5 h-3.5 text-purple-400" /> 多源权威研判基本指标
                                    </span>
                                    <div className="space-y-2 mt-1">
                                      <div className="flex justify-between items-center text-[10px] md:text-xs py-1 border-b border-gray-850">
                                        <span className="text-gray-500">恐惧与贪婪指数</span>
                                        <span className="font-mono text-white font-bold flex items-center gap-1">
                                          {parsedAnalysis.metrics.fearGreedIndex}
                                          {(() => {
                                            const val = Number(parsedAnalysis.metrics.fearGreedIndex) || 50;
                                            if (val >= 75) return <span className="text-emerald-400 text-[8px] bg-emerald-500/10 px-1 rounded font-bold">极度贪婪</span>;
                                            if (val >= 55) return <span className="text-green-400 text-[8px] bg-green-500/10 px-1 rounded font-bold">贪婪</span>;
                                            if (val >= 45) return <span className="text-yellow-400 text-[8px] bg-yellow-500/10 px-1 rounded font-bold">中立</span>;
                                            if (val >= 25) return <span className="text-orange-400 text-[8px] bg-orange-500/10 px-1 rounded font-bold">恐惧</span>;
                                            return <span className="text-red-400 text-[8px] bg-red-500/10 px-1 rounded font-bold">极度恐惧</span>;
                                          })()}
                                        </span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] md:text-xs py-1 border-b border-gray-850">
                                        <span className="text-gray-500">资金费率趋势</span>
                                        <span className="font-mono text-cyan-400 font-bold">{parsedAnalysis.metrics.fundingRate || "加载中"}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] md:text-xs py-1">
                                        <span className="text-gray-500">潜在爆仓/波动风险</span>
                                        <span className="font-mono font-bold">
                                          {(() => {
                                            const level = parsedAnalysis.metrics.riskLevel || "中等";
                                            const badgeColor = level === '极高' || level === '较高' ? 'text-red-400 bg-red-500/10 border-red-500/20' : level === '较低' || level === '极低' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                                            return <span className={`text-[9px] px-1.5 py-0.5 rounded border ${badgeColor} font-bold`}>{level}</span>;
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              )}

                              {/* Markdown report contents */}
                              <div className="markdown-body text-gray-300 leading-relaxed text-xs md:text-sm border-t border-gray-800 pt-4">
                                <Markdown>{parsedAnalysis.markdown}</Markdown>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 md:py-24 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
                        <BrainCircuit className="w-10 h-10 md:w-12 md:h-12 mb-4 opacity-20" />
                        <p className="text-xs md:text-sm text-center px-4">点击上方按钮，获取针对 {selectedSymbol} 的 AI 深度分析建议</p>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="trading"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="h-[500px] md:h-[600px] relative"
                  >
                    {profile?.role === 'free' && (
                      <div className="absolute inset-0 bg-[#0b0e11]/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 md:p-8 text-center">
                        <Lock className="w-12 h-12 md:w-16 md:h-16 text-yellow-500 mb-4" />
                        <h3 className="text-lg md:text-xl font-bold mb-2">模拟炒币功能已锁定</h3>
                        <p className="text-gray-400 text-[10px] md:text-sm mb-6 max-w-md">
                          模拟炒币实战板块仅对收费会员开放。升级后即可使用 10,000 USDT 模拟金进行现货与合约实战演练。
                        </p>
                        <button 
                          onClick={() => showToast('升级功能正在对接支付网关，请联系客服手动升级', 'info')}
                          className="bg-yellow-500 text-black px-6 py-2.5 md:px-8 md:py-3 rounded-xl font-bold text-sm md:text-base hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-900/20"
                        >
                          立即升级为收费会员
                        </button>
                      </div>
                    )}
                    <MockTrading 
                      key={user?.uid || 'guest'}
                      userId={user?.uid || 'guest'}
                      symbol={selectedSymbol} 
                      currentPrice={currentCoin ? parseFloat(currentCoin.price) : 0} 
                      showToast={showToast} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#181a20] border-t border-gray-800 px-6 py-3 flex items-center justify-between z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => setMobileTab('market')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            mobileTab === 'market' ? "text-yellow-500 scale-110" : "text-gray-500"
          )}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-bold">行情</span>
        </button>
        <button 
          onClick={() => setMobileTab('chart')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            mobileTab === 'chart' ? "text-yellow-500 scale-110" : "text-gray-500"
          )}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-bold">K线/实战</span>
        </button>
        <button 
          onClick={() => setMobileTab('insights')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            mobileTab === 'insights' ? "text-yellow-500 scale-110" : "text-gray-500"
          )}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold">博主动态</span>
        </button>
      </nav>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-800 mt-12 text-center text-gray-500 text-xs">
        <p>© 2026 Binance AI 炒币助手 | 数据来源于币安公开 API | 仅供学习交流使用</p>
      </footer>

      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] p-4 space-y-2 pointer-events-none w-full max-w-sm sm:max-w-md">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "p-4 rounded-xl shadow-xl flex items-start gap-3 border pointer-events-auto backdrop-blur-md",
                toast.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-400" :
                toast.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                toast.type === 'warning' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                "bg-blue-500/10 border-blue-500/20 text-blue-400"
              )}
            >
              <div className="flex-1 text-xs md:text-sm font-semibold leading-relaxed">{toast.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
