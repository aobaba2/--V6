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
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatPrice } from '../lib/utils';

interface MockTradingProps {
  symbol: string;
  currentPrice: number;
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

export const MockTrading: React.FC<MockTradingProps> = ({ symbol, currentPrice }) => {
  const [mode, setMode] = useState<TradeMode>('spot');
  const [balance, setBalance] = useState(10000); // Initial 10k USDT
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Form states
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [futuresSide, setFuturesSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [price, setPrice] = useState(currentPrice.toString());
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(20);
  const [marginType, setMarginType] = useState<'cross' | 'isolated'>('cross');

  // Update price when market changes if in market mode
  useEffect(() => {
    if (orderType === 'market') {
      setPrice(currentPrice.toString());
    }
  }, [currentPrice, orderType]);

  const handleSpotTrade = () => {
    const numAmount = parseFloat(amount);
    const numPrice = parseFloat(price);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const totalCost = numAmount * numPrice;

    if (side === 'buy') {
      if (totalCost > balance) {
        alert('余额不足');
        return;
      }
      setBalance(prev => prev - totalCost);
      setHoldings(prev => ({
        ...prev,
        [symbol]: (prev[symbol] || 0) + numAmount
      }));
    } else {
      const currentHolding = holdings[symbol] || 0;
      if (numAmount > currentHolding) {
        alert('持仓不足');
        return;
      }
      setBalance(prev => prev + totalCost);
      setHoldings(prev => ({
        ...prev,
        [symbol]: currentHolding - numAmount
      }));
    }

    setOrders(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side,
      type: orderType,
      price: numPrice,
      amount: numAmount,
      time: new Date().toLocaleTimeString(),
      status: 'filled'
    }, ...prev]);
    setAmount('');
  };

  const handleFuturesTrade = () => {
    const numAmount = parseFloat(amount);
    const numPrice = parseFloat(price);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const marginRequired = (numAmount * numPrice) / leverage;
    if (marginRequired > balance) {
      alert('保证金不足');
      return;
    }

    const newPosition: Position = {
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side: futuresSide,
      entryPrice: numPrice,
      leverage,
      amount: numAmount,
      margin: marginRequired,
      unrealizedPnl: 0,
      pnlPercent: 0
    };

    setBalance(prev => prev - marginRequired);
    setPositions(prev => [newPosition, ...prev]);
    setOrders(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      symbol,
      side: futuresSide === 'long' ? 'long' : 'short',
      type: orderType,
      price: numPrice,
      amount: numAmount,
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Trading Form */}
        <div className="w-full lg:w-80 border-r border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
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
                  <label className="text-[10px] text-gray-500 block mb-1">数量 ({symbol.replace('USDT', '')})</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#2b2f36] border-none rounded p-2 text-xs outline-none focus:ring-1 focus:ring-yellow-500 font-mono"
                  />
                </div>

                <div className="flex justify-between text-[10px] text-gray-500 px-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>

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
                <button className="flex-1 py-1 rounded text-[10px] border border-gray-700 text-gray-300 bg-[#2b2f36]">{leverage}x</button>
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
                  <label className="text-[10px] text-gray-500 block mb-1">数量 ({symbol.replace('USDT', '')})</label>
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
                    <span className="text-gray-300">{((parseFloat(amount) || 0) * (parseFloat(price) || 0) / leverage).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">最大可开</span>
                    <span className="text-gray-300">{(balance * leverage / currentPrice).toFixed(3)} {symbol.replace('USDT', '')}</span>
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
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <LayoutGrid className="w-12 h-12 text-gray-700" />
              <div>
                <h4 className="text-sm font-bold text-gray-300">网格交易策略</h4>
                <p className="text-xs text-gray-500 mt-1 px-4">自动在特定价格区间内低买高卖，适合震荡行情。</p>
              </div>
              <button className="px-6 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold">创建机器人</button>
            </div>
          )}

          {mode === 'copy' && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Users className="w-12 h-12 text-gray-700" />
              <div>
                <h4 className="text-sm font-bold text-gray-300">一键跟单</h4>
                <p className="text-xs text-gray-500 mt-1 px-4">跟随顶级交易员的步伐，同步他们的交易操作。</p>
              </div>
              <button className="px-6 py-2 bg-yellow-500 text-black rounded-lg text-xs font-bold">查看交易员列表</button>
            </div>
          )}
        </div>

        {/* Right: Positions & History */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
                    Object.entries(holdings).filter(([_, amt]) => amt > 0).map(([sym, amt]) => (
                      <div key={sym} className="bg-[#2b2f36] rounded-lg p-4 border border-gray-700 flex items-center justify-between">
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
                    ))
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
    </div>
  );
};
