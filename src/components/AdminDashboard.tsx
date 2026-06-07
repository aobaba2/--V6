import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  ArrowLeft,
  TrendingUp,
  Activity,
  UserPlus,
  Trash2
} from 'lucide-react';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  orderBy, 
  limit,
  where
} from 'firebase/firestore';
import { db, UserProfile, UserRole, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface AdminDashboardProps {
  onBack: () => void;
  currentUserProfile: UserProfile;
}

export function AdminDashboard({ onBack, currentUserProfile }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Add Member Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('pro');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as UserProfile);
      });
      setUsers(fetchedUsers);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      alert('请输入会员账号名或邮箱地址');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalEmail = newEmail.trim();
      if (!finalEmail.includes('@')) {
        finalEmail = `${finalEmail}@admin.com`;
      }

      const emailLower = finalEmail.toLowerCase();
      const exists = users.some(u => u.email.toLowerCase() === emailLower);
      if (exists) {
        alert('该会员账号已经存在，请直接修改该用户的权限等级。');
        setIsSubmitting(false);
        return;
      }

      const placeholderUid = `pre-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      const newUserProfile: UserProfile = {
        uid: placeholderUid,
        email: finalEmail,
        displayName: finalEmail.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${placeholderUid.slice(0, 5)}`,
        role: newRole,
        createdAt: new Date().toISOString(),
        lastLogin: '待首次登录',
        aiAnalysisCount: 0,
        mockTradingEnabled: true,
        favorites: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        followedInfluencers: ['老王', 'Sarah', '陈总'],
        hiddenInfluencers: []
      };

      await setDoc(doc(db, 'users', placeholderUid), newUserProfile);
      setUsers(prev => [newUserProfile, ...prev]);
      
      setNewEmail('');
      setNewRole('pro');
      setShowAddForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (userId === currentUserProfile.uid) {
      alert('抱歉，不能删除您自己当前的登录账号！');
      return;
    }

    if (!window.confirm(`确定要永远删除该会员账号 [${email}] 吗？\n删除后该用户的数据库档案将被清除。该操作无法恢复。`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(prev => prev.filter(u => u.uid !== userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalUsers: users.length,
    proUsers: users.filter(u => u.role === 'pro').length,
    adminUsers: users.filter(u => u.role === 'admin').length,
    totalAnalyses: users.reduce((acc, u) => acc + (u.aiAnalysisCount || 0), 0)
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-gray-200 p-4 md:p-6 font-sans pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
              系统后台管理
            </h1>
          </div>
          <button 
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            刷新数据
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <div className="bg-[#1e2329] p-3 md:p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-[10px] md:text-sm">总用户数</span>
            </div>
            <div className="text-lg md:text-2xl font-bold text-white">{stats.totalUsers}</div>
          </div>
          <div className="bg-[#1e2329] p-3 md:p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] md:text-sm">专业版</span>
            </div>
            <div className="text-lg md:text-2xl font-bold text-white">{stats.proUsers}</div>
          </div>
          <div className="bg-[#1e2329] p-3 md:p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-yellow-500">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-[10px] md:text-sm">管理员</span>
            </div>
            <div className="text-lg md:text-2xl font-bold text-white">{stats.adminUsers}</div>
          </div>
          <div className="bg-[#1e2329] p-3 md:p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2 mb-1 text-green-400">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] md:text-sm">AI分析</span>
            </div>
            <div className="text-lg md:text-2xl font-bold text-white">{stats.totalAnalyses}</div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-[#1e2329] rounded-xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-sm md:text-base text-white">会员用户列表</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded transition-colors shadow"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showAddForm ? '收起表单' : '添加会员'}</span>
              </button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text"
                placeholder="搜索邮箱或UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-xs md:text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          {/* Expandable Add Member Form */}
          {showAddForm && (
            <div className="p-4 bg-gray-900/40 border-b border-gray-800 space-y-3">
              <h3 className="text-xs font-bold text-yellow-500 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" /> 注册 / 添加新会员
              </h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-semibold">会员登录账号 / 邮箱 (若未包含@，则自动追加@admin.com)</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: testuser 或 test@test.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-xs text-white focus:outline-none focus:border-yellow-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-semibold">初始会员使用权限等级</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded text-xs text-white focus:outline-none focus:border-yellow-500"
                  >
                    <option value="free">免费会员 (free - AI与模拟交易已锁定)</option>
                    <option value="pro">收费会员 (pro - 解锁AI分析与炒币权限)</option>
                    <option value="admin">系统管理员 (admin - 解锁全部后台权限)</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold text-xs rounded transition-colors shadow"
                  >
                    {isSubmitting ? '正在添加...' : '确认保存会员'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">用户信息</th>
                  <th className="px-6 py-4 font-medium">当前角色</th>
                  <th className="px-6 py-4 font-medium">分析次数</th>
                  <th className="px-6 py-4 font-medium">注册时间</th>
                  <th className="px-6 py-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{u.email}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{u.uid}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        u.role === 'admin' ? "bg-yellow-500/20 text-yellow-500" :
                        u.role === 'pro' ? "bg-blue-500/20 text-blue-400" :
                        "bg-gray-700 text-gray-400"
                      )}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-sm">{u.aiAnalysisCount || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '未知'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role !== 'free' && (
                          <button 
                            onClick={() => updateUserRole(u.uid, 'free')}
                            disabled={updatingUserId === u.uid}
                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-all text-xs"
                          >
                            降级
                          </button>
                        )}
                        {u.role !== 'pro' && (
                          <button 
                            onClick={() => updateUserRole(u.uid, 'pro')}
                            disabled={updatingUserId === u.uid}
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded text-blue-400 transition-all text-xs"
                          >
                            升级Pro
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <button 
                            onClick={() => updateUserRole(u.uid, 'admin')}
                            disabled={updatingUserId === u.uid}
                            className="p-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded text-yellow-500 transition-all text-xs"
                          >
                            设为管理
                          </button>
                        )}
                        {u.uid !== currentUserProfile.uid && (
                          <button 
                            onClick={() => handleDeleteUser(u.uid, u.email)}
                            disabled={updatingUserId === u.uid}
                            title="删除该会员档案"
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-red-500 transition-all text-xs flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>删除</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-gray-800">
            {filteredUsers.map((u) => (
              <div key={u.uid} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-white font-medium text-sm truncate max-w-[200px]">{u.email}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{u.uid}</span>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                    u.role === 'admin' ? "bg-yellow-500/20 text-yellow-500" :
                    u.role === 'pro' ? "bg-blue-500/20 text-blue-400" :
                    "bg-gray-700 text-gray-400"
                  )}>
                    {u.role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-gray-400">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span>{u.aiAnalysisCount || 0}</span>
                    </div>
                    <span className="text-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '未知'}</span>
                  </div>
                  <div className="flex gap-1">
                    {u.role !== 'free' && (
                      <button 
                        onClick={() => updateUserRole(u.uid, 'free')}
                        disabled={updatingUserId === u.uid}
                        className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-[10px]"
                      >
                        降级
                      </button>
                    )}
                    {u.role !== 'pro' && (
                      <button 
                        onClick={() => updateUserRole(u.uid, 'pro')}
                        disabled={updatingUserId === u.uid}
                        className="px-2 py-1 bg-blue-500/10 rounded text-blue-400 text-[10px]"
                      >
                        Pro
                      </button>
                    )}
                    {u.role !== 'admin' && (
                      <button 
                        onClick={() => updateUserRole(u.uid, 'admin')}
                        disabled={updatingUserId === u.uid}
                        className="px-2 py-1 bg-yellow-500/10 rounded text-yellow-500 text-[10px]"
                      >
                        管理
                      </button>
                    )}
                    {u.uid !== currentUserProfile.uid && (
                      <button 
                        onClick={() => handleDeleteUser(u.uid, u.email)}
                        disabled={updatingUserId === u.uid}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 rounded text-red-500 text-[10px]"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredUsers.length === 0 && !loading && (
            <div className="p-12 text-center text-gray-500 text-sm">
              未找到匹配的用户
            </div>
          )}
          
          {loading && (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-yellow-500 mb-4" />
              <p className="text-sm">正在加载用户数据...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
