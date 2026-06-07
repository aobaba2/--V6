import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, 
  ArrowRightLeft, 
  History, 
  LayoutGrid, 
  Users, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Info,
  ChevronDown,
  Lock,
  Unlock,
  Plus,
  Minus,
  X,
  Bell
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatPrice } from '../lib/utils';

interface MockTradingProps {
  symbol: string;
  currentPrice: number;
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  userId?: string;
}

type TradeMode = 'spot' | 'futures' | 'grid' | 'copy';
type OrderType = 'limit' | 'market';

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  leverage: number;
  amount: number;
  margin: number;
  unrealizedPnl: number;
  pnlPercent: number;
  tpPrice?: number;
  slPrice?: number;
}

interface SpotTrigger {
  id: string;
  symbol: string;
  amount: number;
  tpPrice?: number;
  slPrice?: number;
}

interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  type: OrderType;
  price: number;
  amount: number;
  time: string;
  status: 'filled' | 'pending';
}

export const MockTrading: React.FC<MockTradingProps> = ({ symbol, currentPrice, showToast, userId = 'guest' }) => {
  const getStorageKey = (keyName: string) => `mock_trading_${userId}_${keyName}`;

  const [mode, setMode] = useState<TradeMode>(() => {
    const saved = localStorage.getItem(getStorageKey('mode'));
    return (saved as TradeMode) || 'spot';
  });

  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem(getStorageKey('balance'));
    return saved !== null ? parseFloat(saved) : 10000;
  });

  const [holdings, setHoldings] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(getStorageKey('holdings'));
    return saved !== null ? JSON.parse(saved) : {};
  });

  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem(getStorageKey('positions'));
    return saved !== null ? JSON.parse(saved) : [];
  });

  const [spotTriggers, setSpotTriggers] = useState<SpotTrigger[]>(() => {
    const saved = localStorage.getItem(getStorageKey('spotTriggers'));
    return saved !== null ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(getStorageKey('orders'));
    return saved !== null ? JSON.parse(saved) : [];
  });

  // Notification Config State
  const [showNotifySettings, setShowNotifySettings] = useState(false);
  const [phoneNum, setPhoneNum] = useState(() => localStorage.getItem(getStorageKey('phoneNum')) || '');
  const [wechatWebhook, setWechatWebhook] = useState(() => localStorage.getItem(getStorageKey('wechatWebhook')) || '');
  const [qqGroup, setQqGroup] = useState(() => localStorage.getItem(getStorageKey('qqGroup')) || '');
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(() => localStorage.getItem(getStorageKey('isNotifyEnabled')) === 'true');

  // Persist states to localStorage when they change
  useEffect(() => {
    localStorage.setItem(getStorageKey('mode'), mode);
  }, [mode, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('balance'), balance.toString());
  }, [balance, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('holdings'), JSON.stringify(holdings));
  }, [holdings, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('positions'), JSON.stringify(positions));
  }, [positions, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('spotTriggers'), JSON.stringify(spotTriggers));
  }, [spotTriggers, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('orders'), JSON.stringify(orders));
  }, [orders, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('phoneNum'), phoneNum);
  }, [phoneNum, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('wechatWebhook'), wechatWebhook);
  }, [wechatWebhook, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('qqGroup'), qqGroup);
  }, [qqGroup, userId]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('isNotifyEnabled'), isNotifyEnabled.toString());
  }, [isNotifyEnabled, userId]);
  
  // Form states
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [futuresSide, setFuturesSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [price, setPrice] = useState(currentPrice.toString());
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(20);
  const [spotLeverage, setSpotLeverage] = useState(1);
  const [marginType, setMarginType] = useState<'cross' | 'isolated'>('cross');

  // TP/SL Form values State
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpPriceInput, setTpPriceInput] = useState('');
  const [slPriceInput, setSlPriceInput] = useState('');
  const [tpPercentInput, setTpPercentInput] = useState('');
  const [slPercentInput, setSlPercentInput] = useState('');

  // Edit TP/SL for existing position states
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [editTpPrice, setEditTpPrice] = useState('');
  const [editSlPrice, setEditSlPrice] = useState('');

  // Reset inputs when mode, symbol, side changes
  useEffect(() => {
    setTpEnabled(false);
    setSlEnabled(false);
    setTpPriceInput('');
    setSlPriceInput('');
    setTpPercentInput('');
    setSlPercentInput('');
  }, [symbol, mode, side, futuresSide]);

  // Update price when market changes if in market mode
  useEffect(() => {
    if (orderType === 'market') {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType]);

  const sendNotification = (message: string) => {
    if (!isNotifyEnabled) return;
    
    let channels = [];
    if (phoneNum) channels.push(`短信(${phoneNum})`);
    if (wechatWebhook) channels.push(`微信(${wechatWebhook.substring(0, 12)}...)`);
    if (qqGroup) channels.push(`QQ群(${qqGroup})`);

    if (channels.length === 0) {
      channels.push('应用通知');
    }

    if (showToast) {
      showToast(`🔔 [推送中心] 已发送通知: ${message} (通过 ${channels.join(' & ')})`, 'info');
    }
  };

  const handleSpotTrade = () => {
    const usdtAmount = parseFloat(amount);
    const numPrice = parseFloat(price);
    if (isNaN(usdtAmount) || usdtAmount <= 0 || isNaN(numPrice) || numPrice <= 0) return;

    const marginRequired = usdtAmount / spotLeverage;
    const cryptoAmount = usdtAmount / numPrice;

    if (side === 'buy') {
      if (marginRequired > balance) {
        if (showToast) {
          showToast('购买失败：余额不足', 'error');
        } else {
          alert('余额不足');
        }
        return;
      }
      setBalance(prev => prev - marginRequired);
      setHoldings(prev => ({
        ...prev,
        [symbol]: (prev[symbol] || 0) + cryptoAmount
      }));

      // Set Spot TP/SL triggers
      if (tpEnabled || slEnabled) {
        const tp = tpEnabled && tpPriceInput ? parseFloat(tpPriceInput) : undefined;
        const sl = slEnabled && slPriceInput ? parseFloat(slPriceInput) : undefined;
        const newTrigger: SpotTrigger = {
          id: Math.random().toString(36).substr(2, 9),
          symbol,
          amount: cryptoAmount,
          tpPrice: tp,
          slPrice: sl
        };
        setSpotTriggers(prev => [newTrigger, ...prev]);
      }

      const msg = `现货买入成功: 以 ${numPrice.toFixed(2)} USDT 买入 ${cryptoAmount.toFixed(4)} ${symbol.replace('USDT', '')}`;
      if (showToast) showToast(msg, 'success');
      sendNotification(msg);
    } else {
      const currentHolding = holdings[symbol] || 0;
      if (cryptoAmount > currentHolding) {
        if (showToast) {
          showToast('卖出失败：持仓不足', 'error');
        } else {
          alert('持仓不足');
        }
        return;
      }
      setBalance(prev => prev + marginRequired);
      setHoldings(prev => ({
        ...prev,
        [symbol]: currentHolding - cryptoAmount
      }));

      // Deduct from triggers
      setSpotTriggers(prev => {
        let leftToDeduct = cryptoAmount;
        return prev.map(trig => {
          if (trig.symbol !== symbol || leftToDeduct <= 0) return trig;
          if (trig.amount <= leftToDeduct) {
            leftToDeduct -= trig.amount;
            return { ...trig, amount: 0 };
          } else {
            const updated = { ...trig, amount: trig.amount - leftToDeduct };
            leftToDeduct = 0;
            return updated;
          }
        }).filter(trig => trig.amount > 0);
      });

      const msg = `现货卖出成功: 以 ${numPrice.toFixed(2)} USDT 卖出 ${cryptoAmount.toFixed(4)} ${symbol.replace('USDT', '')}`;
      if (showToast) showToast(msg, 'success');
      sendNotification(msg);
    }

    setOrders(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side,
      type: orderType,
      price: numPrice,
      amount: cryptoAmount,
      time: new Date().toLocaleTimeString(),
      status: 'filled'
    }, ...prev]);
    setAmount('');
  };

  const handleFuturesTrade = () => {
    const usdtAmount = parseFloat(amount);
    const numPrice = parseFloat(price);
    if (isNaN(usdtAmount) || usdtAmount <= 0 || isNaN(numPrice) || numPrice <= 0) return;

    const marginRequired = usdtAmount / leverage;
    if (marginRequired > balance) {
      if (showToast) {
        showToast('开仓失败：保证金不足', 'error');
      } else {
        alert('保证金不足');
      }
      return;
    }

    const cryptoAmount = usdtAmount / numPrice;
    const tp = tpEnabled && tpPriceInput ? parseFloat(tpPriceInput) : undefined;
    const sl = slEnabled && slPriceInput ? parseFloat(slPriceInput) : undefined;

    const sideText = futuresSide === 'long' ? '开多(Long)' : '开空(Short)';
    const msg = `合约 ${sideText} 成功: 以 ${numPrice.toFixed(2)} USDT 仓位 ${symbol} (${leverage}x)`;
    if (showToast) showToast(msg, 'success');
    sendNotification(msg);

    const newPosition: Position = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side: futuresSide,
      entryPrice: numPrice,
      leverage,
      amount: cryptoAmount,
      margin: marginRequired,
      unrealizedPnl: 0,
      pnlPercent: 0,
      tpPrice: tp,
      slPrice: sl
    };

    setBalance(prev => prev - marginRequired);
    setPositions(prev => [newPosition, ...prev]);
    setOrders(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side: futuresSide === 'long' ? 'long' : 'short',
      type: orderType,
      price: numPrice,
      amount: cryptoAmount,
      time: new Date().toLocaleTimeString(),
      status: 'filled'
    }, ...prev]);
    setAmount('');
  };

  const closePosition = (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;

    // Calculate final PNL
    const pnl = pos.side === 'long' 
      ? (currentPrice - pos.entryPrice) * pos.amount
      : (pos.entryPrice - currentPrice) * pos.amount;
    
    setBalance(prev => prev + pos.margin + pnl);
    setPositions(prev => prev.filter(p => p.id !== posId));

    const msg = `合约平仓成功: ${pos.side === 'long' ? '多' : '空'}单 ${pos.symbol} 已在 ${currentPrice.toFixed(2)} USDT 平仓，实现盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`;
    if (showToast) showToast(msg, pnl >= 0 ? 'success' : 'warning');
    sendNotification(msg);
  };

  const updatePositionTpSl = (posId: string, tpPrice: number | undefined, slPrice: number | undefined) => {
    setPositions(prev => prev.map(pos => {
      if (pos.id === posId) {
        return {
          ...pos,
          tpPrice,
          slPrice
        };
      }
      return pos;
    }));

    const pos = positions.find(p => p.id === posId);
    if (pos) {
      const tpText = tpPrice ? `${tpPrice.toFixed(2)} USDT` : '已撤销';
      const slText = slPrice ? `${slPrice.toFixed(2)} USDT` : '已撤销';
      const msg = `合约策略修改: ${pos.symbol} (${pos.side === 'long' ? '多' : '空'}单) 的新策略已生效。止盈位: ${tpText}, 止损位: ${slText}`;
      if (showToast) showToast(msg, 'success');
      sendNotification(msg);
    }
  };

  // Calculate unrealized PNL for positions
  const updatedPositions = useMemo(() => {
    return positions.map(pos => {
      const pnl = pos.side === 'long' 
        ? (currentPrice - pos.entryPrice) * pos.amount
        : (pos.entryPrice - currentPrice) * pos.amount;
      const pnlPercent = (pnl / pos.margin) * 100;
      return { ...pos, unrealizedPnl: pnl, pnlPercent };
    });
  }, [positions, currentPrice]);

  const totalEquity = balance + updatedPositions.reduce((acc, p) => acc + p.margin + p.unrealizedPnl, 0) + 
    Object.entries(holdings).reduce((acc, [sym, amt]) => acc + amt * currentPrice, 0);

  // Check TP/SL Triggers for both Spot and Futures when active symbol's currentPrice changes
  useEffect(() => {
    if (!currentPrice || isNaN(currentPrice) || currentPrice <= 0) return;

    // 1. Check Futures TP/SL triggers
    let futuresModified = false;
    const remainingPositions: Position[] = [];
    const triggeredPositions: { pos: Position; reason: string; pnl: number }[] = [];

    positions.forEach(pos => {
      if (pos.symbol === symbol) {
        let triggered = false;
        let reason = '';

        if (pos.side === 'long') {
          if (pos.tpPrice && currentPrice >= pos.tpPrice) {
            triggered = true;
            reason = `[合约多单止盈已触发] 价格达到 ${currentPrice.toFixed(2)} USDT (目标: ${pos.tpPrice.toFixed(2)})`;
          } else if (pos.slPrice && currentPrice <= pos.slPrice) {
            triggered = true;
            reason = `[合约多单止损已触发] 价格跌破 ${currentPrice.toFixed(2)} USDT (止损: ${pos.slPrice.toFixed(2)})`;
          }
        } else { // short
          if (pos.tpPrice && currentPrice <= pos.tpPrice) {
            triggered = true;
            reason = `[合约空单止盈已触发] 价格跌到 ${currentPrice.toFixed(2)} USDT (目标: ${pos.tpPrice.toFixed(2)})`;
          } else if (pos.slPrice && currentPrice >= pos.slPrice) {
            triggered = true;
            reason = `[合约空单止损已触发] 价格升破 ${currentPrice.toFixed(2)} USDT (止损: ${pos.slPrice.toFixed(2)})`;
          }
        }

        if (triggered) {
          futuresModified = true;
          const pnl = pos.side === 'long'
            ? (currentPrice - pos.entryPrice) * pos.amount
            : (pos.entryPrice - currentPrice) * pos.amount;
          triggeredPositions.push({ pos, reason, pnl });
        } else {
          remainingPositions.push(pos);
        }
      } else {
        remainingPositions.push(pos);
      }
    });

    if (futuresModified) {
      triggeredPositions.forEach(({ pos, reason, pnl }) => {
        setBalance(prev => prev + pos.margin + pnl);
        setOrders(prev => [{
          id: Math.random().toString(36).substr(2, 9),
          symbol: pos.symbol,
          side: pos.side === 'long' ? 'short' : 'long', // close trade side
          type: 'market',
          price: currentPrice,
          amount: pos.amount,
          time: new Date().toLocaleTimeString(),
          status: 'filled'
        }, ...prev]);

        if (showToast) showToast(reason, pnl >= 0 ? 'success' : 'warning');
        sendNotification(`您的 ${pos.side === 'long' ? '多' : '空'}单仓位已平仓: ${reason}。本单实现盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
      });
      setPositions(remainingPositions);
    }

    // 2. Check Spot TP/SL triggers
    let spotModified = false;
    const remainingSpotTriggers: SpotTrigger[] = [];
    const triggeredSpotTriggers: SpotTrigger[] = [];

    spotTriggers.forEach(trig => {
      if (trig.symbol === symbol) {
        let triggered = false;

        if (trig.tpPrice && currentPrice >= trig.tpPrice) {
          triggered = true;
        } else if (trig.slPrice && currentPrice <= trig.slPrice) {
          triggered = true;
        }

        if (triggered) {
          spotModified = true;
          triggeredSpotTriggers.push(trig);
        } else {
          remainingSpotTriggers.push(trig);
        }
      } else {
        remainingSpotTriggers.push(trig);
      }
    });

    if (spotModified) {
      triggeredSpotTriggers.forEach(trig => {
        const holdingAmount = holdings[symbol] || 0;
        const amountToSell = Math.min(trig.amount, holdingAmount);

        if (amountToSell > 0) {
          const returnedUsdt = amountToSell * currentPrice;
          setBalance(prev => prev + returnedUsdt);
          setHoldings(prev => ({
            ...prev,
            [symbol]: Math.max(0, holdingAmount - amountToSell)
          }));

          setOrders(prev => [{
            id: Math.random().toString(36).substr(2, 9),
            symbol,
            side: 'sell',
            type: 'market',
            price: currentPrice,
            amount: amountToSell,
            time: new Date().toLocaleTimeString(),
            status: 'filled'
          }, ...prev]);

          let pnlMsg = '';
          if (trig.tpPrice && currentPrice >= trig.tpPrice) {
            pnlMsg = `已上涨触及设定的止盈线 (${trig.tpPrice.toFixed(2)} USDT)`;
          } else if (trig.slPrice && currentPrice <= trig.slPrice) {
            pnlMsg = `已下跌触及设定的止损线 (${trig.slPrice.toFixed(2)} USDT)`;
          }

          const toastMsg = `[现货止盈止损触发] ${symbol} 已按市价自动委售变现 ${amountToSell.toFixed(4)} 单位 (${pnlMsg})`;
          if (showToast) showToast(toastMsg, 'info');
          sendNotification(toastMsg);
        }
      });
      setSpotTriggers(remainingSpotTriggers);
    }

  }, [currentPrice, symbol, positions, spotTriggers, holdings, isNotifyEnabled, phoneNum, wechatWebhook, qqGroup]);

  return (
    <div className="bg-[#181a20] rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-[#1e2329]">
        {(['spot', 'futures', 'grid', 'copy'] as TradeMode[]).map((t) => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all relative",
              mode === t ? "text-yellow-500" : "text-gray-500 hover:text-gray-300"
            )}
          >
            {t === 'spot' && '现货'}
            {t === 'futures' && '合约'}
            {t === 'grid' && '策略/网格'}
            {t === 'copy' && '跟单'}
            {mode === t && <motion.div layoutId="tradeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left: Trading Form */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0">
          {/* Asset Info */}
          <div className="bg-[#2b2f36] rounded-lg p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Wallet className="w-3 h-3" /> 可用余额
              </div>
              <Plus className="w-3 h-3 text-yellow-500 cursor-pointer" />
            </div>
            <div className="text-lg font-mono font-bold text-white">{balance.toFixed(2)} <span className="text-xs text-gray-500">USDT</span></div>
            <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center">
              <span className="text-[10px] text-gray-500">总权益 (估算)</span>
              <span className="text-xs font-mono text-yellow-500">{totalEquity.toFixed(2)}</span>
            </div>
            <div 
              onClick={() => setShowNotifySettings(true)}
              className="mt-2 text-[10px] text-gray-400 hover:text-yellow-500 transition-colors flex items-center justify-center gap-1.5 bg-yellow-500/5 hover:bg-yellow-500/10 py-1.5 px-2 rounded border border-yellow-500/10 cursor-pointer text-center font-semibold"
            >
              <Bell className="w-3 h-3 text-yellow-500" />
              <span>{isNotifyEnabled ? '🔔 微信/QQ 推送提醒已启' : '🔕 绑定 QQ/微信 接收异动提醒'}</span>
            </div>
          </div>

          {mode === 'spot' && (
            <div className="space-y-4">
              <div className="flex bg-[#2b2f36] rounded-lg p-1">
                <button 
                  onClick={() => setSide('buy')}
                  className={cn("flex-1 py-1.5 rounded text-xs font-bold transition-all", side === 'buy' ? "bg-green-500 text-white" : "text-gray-500")}
                >买入</button>
                <button 
                  onClick={() => setSide('sell')}
                  className={cn("flex-1 py-1.5 rounded text-xs font-bold transition-all", side === 'sell' ? "bg-red-500 text-white" : "text-gray-500")}
                >卖出</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">订单类型</label>
                  <select 
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as OrderType)}
                    className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500"
                  >
                    <option value="market">市价单</option>
                    <option value="limit">限价单</option>
                  </select>
                </div>

                {orderType === 'limit' && (
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">价格 (USDT)</label>
                    <input 
                      type="number" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">金额 (USDT)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">杠杆倍数</label>
                  <div className="flex gap-1">
                    {[1, 3, 5, 10].map(l => (
                      <button
                        key={l}
                        onClick={() => setSpotLeverage(l)}
                        className={cn(
                          "flex-1 py-1 rounded text-[10px] border transition-all",
                          spotLeverage === l ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-gray-700 text-gray-500 hover:border-gray-600"
                        )}
                      >
                        {l}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#2b2f36] rounded p-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">占用保证金</span>
                    <span className="text-gray-300">{((parseFloat(amount) || 0) / spotLeverage).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">最大可买</span>
                    <span className="text-gray-300">{(balance * spotLeverage).toFixed(2)} USDT</span>
                  </div>
                </div>

                {/* Spot TP/SL Settings */}
                {side === 'buy' && (
                  <div className="border border-gray-800 rounded p-2.5 space-y-2 bg-[#2b2f36]/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">设置自动止盈/止损</span>
                      <span className="text-[9px] text-gray-500 font-mono">（现价: {currentPrice.toFixed(2)}）</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#2b2f36]/40 rounded p-1.5 border border-gray-800/60">
                        <label className="flex items-center gap-1 cursor-pointer mb-1 text-[9px] text-gray-400">
                          <input 
                            type="checkbox" 
                            checked={tpEnabled} 
                            onChange={(e) => {
                              setTpEnabled(e.target.checked);
                              if (e.target.checked) {
                                const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                setTpPercentInput("10");
                                setTpPriceInput((base * 1.10).toFixed(2));
                              }
                            }}
                            className="rounded border-gray-700 bg-gray-850 text-green-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                          />
                          <span className="text-green-500 font-bold">自动止盈 (TP)</span>
                        </label>
                        {tpEnabled && (
                          <div className="space-y-1.5 mt-1.5">
                            <div className="flex items-center bg-[#1e2329] rounded p-1 border border-gray-800 gap-0.5">
                              <span className="text-[8px] text-gray-500 font-bold px-0.5 shrink-0">比例:</span>
                              <input 
                                type="text" 
                                placeholder="如 10"
                                value={tpPercentInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTpPercentInput(val);
                                  const numPct = parseFloat(val);
                                  if (!isNaN(numPct)) {
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    setTpPriceInput((base * (1 + numPct / 100)).toFixed(2));
                                  }
                                }}
                                className="w-10 bg-transparent text-white text-[10px] outline-none font-mono text-center border-r border-gray-850"
                              />
                              <span className="text-[8px] text-gray-400 font-mono pr-1">%</span>
                              <input 
                                type="text" 
                                placeholder="触发价格"
                                value={tpPriceInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTpPriceInput(val);
                                  const numPrice = parseFloat(val);
                                  if (!isNaN(numPrice) && numPrice > 0) {
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    const ratio = (numPrice - base) / base;
                                    setTpPercentInput(Math.abs(ratio * 100).toFixed(1));
                                  }
                                }}
                                className="flex-1 bg-transparent text-white text-[10px] outline-none font-mono text-right"
                              />
                            </div>
                            
                            {/* Preset Buttons */}
                            <div className="flex gap-1">
                              {[2, 5, 10, 20].map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    setTpPercentInput(p.toString());
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    setTpPriceInput((base * (1 + p / 100)).toFixed(2));
                                  }}
                                  className="flex-1 text-[8px] py-0.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-all text-center font-mono"
                                >
                                  +{p}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-[#2b2f36]/40 rounded p-1.5 border border-gray-800/60">
                        <label className="flex items-center gap-1 cursor-pointer mb-1 text-[9px] text-gray-400">
                          <input 
                            type="checkbox" 
                            checked={slEnabled} 
                            onChange={(e) => {
                              setSlEnabled(e.target.checked);
                              if (e.target.checked) {
                                const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                setSlPercentInput("5");
                                setSlPriceInput((base * 0.95).toFixed(2));
                              }
                            }}
                            className="rounded border-gray-700 bg-gray-850 text-red-400 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                          />
                          <span className="text-red-400 font-bold">自动止损 (SL)</span>
                        </label>
                        {slEnabled && (
                          <div className="space-y-1.5 mt-1.5">
                            <div className="flex items-center bg-[#1e2329] rounded p-1 border border-gray-800 gap-0.5">
                              <span className="text-[8px] text-gray-500 font-bold px-0.5 shrink-0">比例:</span>
                              <input 
                                type="text" 
                                placeholder="如 5"
                                value={slPercentInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSlPercentInput(val);
                                  const numPct = parseFloat(val);
                                  if (!isNaN(numPct)) {
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    setSlPriceInput((base * (1 - numPct / 100)).toFixed(2));
                                  }
                                }}
                                className="w-10 bg-transparent text-white text-[10px] outline-none font-mono text-center border-r border-gray-850"
                              />
                              <span className="text-[8px] text-gray-400 font-mono pr-1">%</span>
                              <input 
                                type="text" 
                                placeholder="触发价格"
                                value={slPriceInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSlPriceInput(val);
                                  const numPrice = parseFloat(val);
                                  if (!isNaN(numPrice) && numPrice > 0) {
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    const ratio = (numPrice - base) / base;
                                    setSlPercentInput(Math.abs(ratio * 100).toFixed(1));
                                  }
                                }}
                                className="flex-1 bg-transparent text-white text-[10px] outline-none font-mono text-right"
                              />
                            </div>
                            
                            {/* Preset Buttons */}
                            <div className="flex gap-1">
                              {[1, 3, 5, 10].map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    setSlPercentInput(p.toString());
                                    const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                    setSlPriceInput((base * (1 - p / 100)).toFixed(2));
                                  }}
                                  className="flex-1 text-[8px] py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-all text-center font-mono"
                                >
                                  -{p}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleSpotTrade}
                  className={cn(
                    "w-full py-3 rounded-lg font-bold text-sm transition-all active:scale-95",
                    side === 'buy' ? "bg-green-500 hover:bg-green-400 text-white" : "bg-red-500 hover:bg-red-400 text-white"
                  )}
                >
                  {side === 'buy' ? `买入 ${symbol.replace('USDT', '')}` : `卖出 ${symbol.replace('USDT', '')}`}
                </button>
              </div>
            </div>
          )}

          {mode === 'futures' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button 
                  onClick={() => setMarginType('cross')}
                  className={cn("flex-1 py-1 rounded text-[10px] border", marginType === 'cross' ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-gray-700 text-gray-500")}
                >全仓</button>
                <button 
                  onClick={() => setMarginType('isolated')}
                  className={cn("flex-1 py-1 rounded text-[10px] border", marginType === 'isolated' ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-gray-700 text-gray-500")}
                >逐仓</button>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 block mb-1">杠杆倍数</label>
                <div className="grid grid-cols-5 gap-1">
                  {[10, 20, 50, 100, 125].map(l => (
                    <button
                      key={l}
                      onClick={() => setLeverage(l)}
                      className={cn(
                        "py-1 rounded text-[10px] border transition-all",
                        leverage === l ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" : "border-gray-700 text-gray-500 hover:border-gray-600"
                      )}
                    >
                      {l}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex bg-[#2b2f36] rounded-lg p-1">
                <button 
                  onClick={() => setFuturesSide('long')}
                  className={cn("flex-1 py-1.5 rounded text-xs font-bold transition-all", futuresSide === 'long' ? "bg-green-500 text-white" : "text-gray-500")}
                >开多</button>
                <button 
                  onClick={() => setFuturesSide('short')}
                  className={cn("flex-1 py-1.5 rounded text-xs font-bold transition-all", futuresSide === 'short' ? "bg-red-500 text-white" : "text-gray-500")}
                >开空</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">价格 (USDT)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={price}
                      disabled={orderType === 'market'}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                    />
                    {orderType === 'market' && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-yellow-500">市价</span>}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">金额 (USDT)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                  />
                </div>

                <div className="bg-[#2b2f36] rounded p-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">成本</span>
                    <span className="text-gray-300">{((parseFloat(amount) || 0) / leverage).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">最大可开</span>
                    <span className="text-gray-300">{(balance * leverage).toFixed(2)} USDT</span>
                  </div>
                </div>

                {/* Futures TP/SL Settings */}
                <div className="border border-gray-800 rounded p-2.5 space-y-2 bg-[#2b2f36]/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400">设置仓位止盈/止损</span>
                    <span className="text-[9px] text-gray-500 font-mono">（现价: {currentPrice.toFixed(2)}）</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#2b2f36]/40 rounded p-1.5 border border-gray-800/60">
                      <label className="flex items-center gap-1 cursor-pointer mb-1 text-[9px] text-gray-400">
                        <input 
                          type="checkbox" 
                          checked={tpEnabled} 
                          onChange={(e) => {
                            setTpEnabled(e.target.checked);
                            if (e.target.checked) {
                              const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                              const direction = futuresSide === 'short' ? -1 : 1;
                              setTpPercentInput("10");
                              setTpPriceInput((base * (1 + 0.1 * direction)).toFixed(2));
                            }
                          }}
                          className="rounded border-gray-700 bg-gray-850 text-green-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                        />
                        <span className="text-green-500 font-bold">止盈位 (TP)</span>
                      </label>
                      {tpEnabled && (
                        <div className="space-y-1.5 mt-1.5">
                          <div className="flex items-center bg-[#1e2329] rounded p-1 border border-gray-800 gap-0.5">
                            <span className="text-[8px] text-gray-500 font-bold px-0.5 shrink-0">比例:</span>
                            <input 
                              type="text" 
                              placeholder="如 10"
                              value={tpPercentInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTpPercentInput(val);
                                const numPct = parseFloat(val);
                                if (!isNaN(numPct)) {
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const direction = futuresSide === 'short' ? -1 : 1;
                                  setTpPriceInput((base * (1 + (numPct / 100) * direction)).toFixed(2));
                                }
                              }}
                              className="w-10 bg-transparent text-white text-[10px] outline-none font-mono text-center border-r border-gray-850"
                            />
                            <span className="text-[8px] text-gray-400 font-mono pr-1">%</span>
                            <input 
                              type="text" 
                              placeholder="目标价格"
                              value={tpPriceInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTpPriceInput(val);
                                const numPrice = parseFloat(val);
                                if (!isNaN(numPrice) && numPrice > 0) {
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const ratio = (numPrice - base) / base;
                                  setTpPercentInput(Math.abs(ratio * 100).toFixed(1));
                                }
                              }}
                              className="flex-1 bg-transparent text-white text-[10px] outline-none font-mono text-right"
                            />
                          </div>

                          {/* Presets */}
                          <div className="flex gap-1">
                            {[5, 10, 20, 50].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setTpPercentInput(p.toString());
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const direction = futuresSide === 'short' ? -1 : 1;
                                  setTpPriceInput((base * (1 + (p / 100) * direction)).toFixed(2));
                                }}
                                className="flex-1 text-[8px] py-0.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-all text-center font-mono"
                              >
                                {futuresSide === 'short' ? '-' : '+'}{p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#2b2f36]/40 rounded p-1.5 border border-gray-800/60">
                      <label className="flex items-center gap-1 cursor-pointer mb-1 text-[9px] text-gray-400">
                        <input 
                          type="checkbox" 
                          checked={slEnabled} 
                          onChange={(e) => {
                            setSlEnabled(e.target.checked);
                            if (e.target.checked) {
                              const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                              const direction = futuresSide === 'short' ? 1 : -1;
                              setSlPercentInput("5");
                              setSlPriceInput((base * (1 + 0.05 * direction)).toFixed(2));
                            }
                          }}
                          className="rounded border-gray-700 bg-gray-850 text-red-500 focus:ring-0 focus:ring-offset-0 w-3 h-3"
                        />
                        <span className="text-red-400 font-bold">止损位 (SL)</span>
                      </label>
                      {slEnabled && (
                        <div className="space-y-1.5 mt-1.5">
                          <div className="flex items-center bg-[#1e2329] rounded p-1 border border-gray-800 gap-0.5">
                            <span className="text-[8px] text-gray-500 font-bold px-0.5 shrink-0">比例:</span>
                            <input 
                              type="text" 
                              placeholder="如 5"
                              value={slPercentInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSlPercentInput(val);
                                const numPct = parseFloat(val);
                                if (!isNaN(numPct)) {
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const direction = futuresSide === 'short' ? 1 : -1;
                                  setSlPriceInput((base * (1 + (numPct / 100) * direction)).toFixed(2));
                                }
                              }}
                              className="w-10 bg-transparent text-white text-[10px] outline-none font-mono text-center border-r border-gray-850"
                            />
                            <span className="text-[8px] text-gray-400 font-mono pr-1">%</span>
                            <input 
                              type="text" 
                              placeholder="目标价格"
                              value={slPriceInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSlPriceInput(val);
                                const numPrice = parseFloat(val);
                                if (!isNaN(numPrice) && numPrice > 0) {
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const ratio = (numPrice - base) / base;
                                  setSlPercentInput(Math.abs(ratio * 105).toFixed(1)); // clean ratio trigger
                                }
                              }}
                              className="flex-1 bg-transparent text-white text-[10px] outline-none font-mono text-right"
                            />
                          </div>

                          {/* Presets */}
                          <div className="flex gap-1">
                            {[2, 5, 10, 25].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setSlPercentInput(p.toString());
                                  const base = orderType === 'limit' && price ? parseFloat(price) : currentPrice;
                                  const direction = futuresSide === 'short' ? 1 : -1;
                                  setSlPriceInput((base * (1 + (p / 100) * direction)).toFixed(2));
                                }}
                                className="flex-1 text-[8px] py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-all text-center font-mono"
                              >
                                {futuresSide === 'short' ? '+' : '-'}{p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleFuturesTrade}
                  className={cn(
                    "w-full py-3 rounded-lg font-bold text-sm transition-all active:scale-95",
                    futuresSide === 'long' ? "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/20" : "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-900/20"
                  )}
                >
                  {futuresSide === 'long' ? `买入开多 (Long)` : `卖出开空 (Short)`}
                </button>
              </div>
            </div>
          )}

          {mode === 'grid' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <LayoutGrid className="w-10 h-10 text-gray-700" />
              <div>
                <h4 className="text-sm font-bold text-gray-300">网格交易策略</h4>
                <p className="text-[10px] text-gray-500 mt-1 px-4">自动在特定价格区间内低买高卖，适合震荡行情。</p>
              </div>
              <button className="px-6 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold">创建机器人</button>
            </div>
          )}

          {mode === 'copy' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <Users className="w-10 h-10 text-gray-700" />
              <div>
                <h4 className="text-sm font-bold text-gray-300">一键跟单</h4>
                <p className="text-[10px] text-gray-500 mt-1 px-4">跟随顶级交易员的步伐，同步他们的交易操作。</p>
              </div>
              <button className="px-6 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold">查看交易员列表</button>
            </div>
          )}
        </div>

        {/* Right: Positions & History */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-[400px]">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Current Positions / Holdings */}
            <div className="p-4">
              <h4 className="text-xs font-bold text-gray-400 mb-4 flex items-center gap-2">
                {mode === 'spot' ? <ArrowRightLeft className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                {mode === 'spot' ? '当前持仓' : '当前仓位'}
              </h4>

              {mode === 'spot' ? (
                <div className="space-y-2">
                   {Object.entries(holdings).filter(([_, amt]) => amt > 0).length > 0 ? (
                    Object.entries(holdings).filter(([_, amt]) => amt > 0).map(([sym, amt]) => {
                      const activeTrigs = spotTriggers.filter(tr => tr.symbol === sym);
                      return (
                        <div key={sym} className="bg-[#2b2f36] rounded-lg p-4 border border-gray-700 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-yellow-500">{sym.charAt(0)}</div>
                              <div>
                                <div className="text-sm font-bold">{sym}</div>
                                <div className="text-[10px] text-gray-500">数量: {amt.toFixed(4)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-mono">{(amt * currentPrice).toFixed(2)} <span className="text-[10px] text-gray-500">USDT</span></div>
                              <div className="text-[10px] text-green-500">盈利: +0.00%</div>
                            </div>
                          </div>
                          
                          {activeTrigs.length > 0 && (
                            <div className="pt-2 border-t border-gray-800 space-y-1">
                              <div className="text-[9px] text-gray-500 font-bold mb-1">现货自动限时止盈止损:</div>
                              {activeTrigs.map((t, idx) => (
                                <div key={t.id || idx} className="flex justify-between items-center text-[10px] bg-[#1e2329]/50 px-2 py-1 rounded">
                                  <span className="text-gray-400">数量: {t.amount.toFixed(3)}</span>
                                  <div className="flex gap-2">
                                    {t.tpPrice && <span className="text-green-500 font-medium">止盈: {t.tpPrice.toFixed(2)}</span>}
                                    {t.slPrice && <span className="text-red-400 font-medium font-mono">止损: {t.slPrice.toFixed(2)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-gray-600 text-xs">暂无现货持仓</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {updatedPositions.length > 0 ? (
                    updatedPositions.map((pos) => (
                      <div key={pos.id} className="bg-[#2b2f36] rounded-lg p-4 border border-gray-700">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              pos.side === 'long' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                            )}>
                              {pos.side === 'long' ? '多' : '空'} {pos.leverage}x
                            </span>
                            <span className="text-sm font-bold">{pos.symbol}</span>
                            <span className="text-[10px] text-gray-500">全仓</span>
                          </div>
                          <button 
                            onClick={() => closePosition(pos.id)}
                            className="text-[10px] text-yellow-500 hover:text-yellow-400 font-bold"
                          >市价全平</button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">未实现盈亏 (USDT)</div>
                            <div className={cn("text-sm font-mono font-bold", pos.unrealizedPnl >= 0 ? "text-green-500" : "text-red-500")}>
                              {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl.toFixed(2)}
                              <span className="text-[10px] ml-1">({pos.pnlPercent.toFixed(2)}%)</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">持仓数量</div>
                            <div className="text-sm font-mono">{pos.amount.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">保证金</div>
                            <div className="text-sm font-mono">{pos.margin.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">开仓价格</div>
                            <div className="text-sm font-mono text-gray-400">{pos.entryPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">标记价格</div>
                            <div className="text-sm font-mono text-gray-400">{currentPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 mb-0.5">强平价格 (估算)</div>
                            <div className="text-sm font-mono text-orange-500">
                              {pos.side === 'long' 
                                ? (pos.entryPrice * (1 - 1/pos.leverage)).toFixed(2)
                                : (pos.entryPrice * (1 + 1/pos.leverage)).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Extra info for TP/SL values with Editing flow */}
                        {editingPosId === pos.id ? (
                          <div className="mt-3 pt-2 border-t border-gray-800/80 space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-gray-500">
                              <span className="font-bold text-yellow-500">修改止盈止损价格:</span>
                              <span className="font-mono">开仓价: {pos.entryPrice.toFixed(2)} USDT</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[9px] text-gray-500 block mb-0.5">止盈价格 (USDT)</label>
                                <input
                                  type="number"
                                  placeholder="无止盈"
                                  value={editTpPrice}
                                  onChange={(e) => setEditTpPrice(e.target.value)}
                                  className="w-full bg-[#1e2329] border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-green-500"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 block mb-0.5">止损价格 (USDT)</label>
                                <input
                                  type="number"
                                  placeholder="无止损"
                                  value={editSlPrice}
                                  onChange={(e) => setEditSlPrice(e.target.value)}
                                  className="w-full bg-[#1e2329] border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-red-500"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => setEditingPosId(null)}
                                className="px-2 py-0.5 bg-gray-800 hover:bg-gray-750 text-gray-400 text-[10px] font-bold rounded transition-colors"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => {
                                  const tp = editTpPrice.trim() ? parseFloat(editTpPrice) : undefined;
                                  const sl = editSlPrice.trim() ? parseFloat(editSlPrice) : undefined;
                                  if (tp !== undefined && (isNaN(tp) || tp <= 0)) {
                                    showToast?.('止盈价格无效，请检查', 'error');
                                    return;
                                  }
                                  if (sl !== undefined && (isNaN(sl) || sl <= 0)) {
                                    showToast?.('止损价格无效，请检查', 'error');
                                    return;
                                  }

                                  // Validate that prices are not already triggered
                                  if (pos.side === 'long') {
                                    if (tp !== undefined && currentPrice >= tp) {
                                      showToast?.(`保存失败：设定止盈价格 (${tp.toFixed(2)}) 必须大于当前现价 (${currentPrice.toFixed(2)})，否则开盘即触发平仓。`, 'error');
                                      return;
                                    }
                                    if (sl !== undefined && currentPrice <= sl) {
                                      showToast?.(`保存失败：设定止损价格 (${sl.toFixed(2)}) 必须小于当前现价 (${currentPrice.toFixed(2)})，否则开盘即触发止损。`, 'error');
                                      return;
                                    }
                                  } else { // short
                                    if (tp !== undefined && currentPrice <= tp) {
                                      showToast?.(`保存失败：设定止盈价格 (${tp.toFixed(2)}) 必须小于当前现价 (${currentPrice.toFixed(2)})，否则开盘即触发平仓。`, 'error');
                                      return;
                                    }
                                    if (sl !== undefined && currentPrice >= sl) {
                                      showToast?.(`保存失败：设定止损价格 (${sl.toFixed(2)}) 必须大于当前现价 (${currentPrice.toFixed(2)})，否则开盘即触发止损。`, 'error');
                                      return;
                                    }
                                  }

                                  updatePositionTpSl(pos.id, tp, sl);
                                  setEditingPosId(null);
                                }}
                                className="px-2 py-0.5 bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold rounded transition-colors"
                              >
                                保存修改
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">已设定策略:</span>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-3 text-[10px]">
                                <span className={cn("font-mono", pos.tpPrice ? "text-green-500" : "text-gray-600")}>
                                  止盈价: {pos.tpPrice ? `${pos.tpPrice.toFixed(2)} USDT` : '--'}
                                </span>
                                <span className={cn("font-mono", pos.slPrice ? "text-red-400" : "text-gray-600")}>
                                  止损价: {pos.slPrice ? `${pos.slPrice.toFixed(2)} USDT` : '--'}
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingPosId(pos.id);
                                  setEditTpPrice(pos.tpPrice ? pos.tpPrice.toString() : '');
                                  setEditSlPrice(pos.slPrice ? pos.slPrice.toString() : '');
                                }}
                                className="text-[10px] text-yellow-500 hover:text-yellow-400 font-bold hover:underline transition-all"
                              >
                                修改止盈/止损
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-gray-600 text-xs">暂无合约仓位</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom: History */}
          <div className="h-48 border-t border-gray-800 bg-[#1e2329] p-4 flex flex-col">
            <h4 className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
              <History className="w-3 h-3" />
              最近成交记录
            </h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-[10px]">
                <thead className="text-gray-500 border-b border-gray-800 sticky top-0 bg-[#1e2329]">
                  <tr>
                    <th className="text-left py-2 font-medium">时间</th>
                    <th className="text-left py-2 font-medium">交易对</th>
                    <th className="text-left py-2 font-medium">方向</th>
                    <th className="text-right py-2 font-medium">价格</th>
                    <th className="text-right py-2 font-medium">数量</th>
                    <th className="text-right py-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {orders.map((order) => (
                    <tr key={order.id} className="text-gray-300">
                      <td className="py-2">{order.time}</td>
                      <td className="py-2 font-bold">{order.symbol}</td>
                      <td className="py-2">
                        <span className={cn(
                          "px-1 rounded-[2px]",
                          (order.side === 'buy' || order.side === 'long') ? "text-green-500" : "text-red-500"
                        )}>
                          {order.side === 'buy' ? '买入' : order.side === 'sell' ? '卖出' : order.side === 'long' ? '开多' : '开空'}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">{order.price.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono">{order.amount.toFixed(4)}</td>
                      <td className="py-2 text-right text-green-500">已成交</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-600">暂无历史记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showNotifySettings && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e2329] border border-gray-800 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-bold text-white">推送通知提醒设置</h3>
              </div>
              <button 
                onClick={() => setShowNotifySettings(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-[#2b2f36]/40 p-3 rounded-lg border border-yellow-500/10 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-400 leading-normal">
                  您可以在此绑定短信、群自建机器人、或者微信/QQ接收渠道。当您的止损或止盈单由于实时行情变动而在系统触发时，交易引擎将自动下发通知到对应地址。
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-800/80">
                  <span className="text-xs font-bold text-gray-300">开启实时智能推送</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={isNotifyEnabled} 
                      onChange={(e) => setIsNotifyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-850 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 block">手机号码 (短信提醒)</label>
                  <input 
                    type="tel" 
                    placeholder="如: +86 18888888888"
                    value={phoneNum}
                    onChange={(e) => setPhoneNum(e.target.value)}
                    className="w-full bg-[#2b2f36] border border-gray-800 rounded p-2 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 block">微信群机器人 Webhook 地址</label>
                  <input 
                    type="url" 
                    placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                    value={wechatWebhook}
                    onChange={(e) => setWechatWebhook(e.target.value)}
                    className="w-full bg-[#2b2f36] border border-gray-800 rounded p-2 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500 font-mono text-[9px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 block">QQ 账号 / QQ群推送号</label>
                  <input 
                    type="text" 
                    placeholder="请输入绑定的 QQ 群号或 QQ 号"
                    value={qqGroup}
                    onChange={(e) => setQqGroup(e.target.value)}
                    className="w-full bg-[#2b2f36] border border-gray-800 rounded p-2 text-xs text-white outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#181a20] border-t border-gray-800/80 flex gap-2">
              <button 
                onClick={() => {
                  setIsNotifyEnabled(true);
                  if (showToast) showToast('通知参数配置成功，已发送一则模拟联通测试！', 'success');
                  sendNotification('🔔 绑定联通测试完毕！模拟交易行情及平仓看板推送正常。');
                  setShowNotifySettings(false);
                }}
                className="flex-1 py-2 bg-yellow-500 text-black font-bold text-xs rounded transition-all active:scale-95 hover:bg-yellow-400"
              >
                保存设置并测试连接
              </button>
              <button 
                onClick={() => setShowNotifySettings(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold text-xs rounded transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
