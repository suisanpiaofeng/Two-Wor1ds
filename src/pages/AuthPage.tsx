import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register, quickStart, sendCode, isAuthenticated } = useApp();

  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setInterval(() => {
        setCodeCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [codeCountdown]);

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setLoading(true);
    try {
      await sendCode(email);
      setCodeSent(true);
      setCodeCountdown(300);
      setError('');
    } catch (err) {
      setError('发送验证码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('邮箱或密码错误');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !code || !nickname) {
      setError('请填写完整信息');
      return;
    }
    if (!email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    setLoading(true);
    try {
      await register(email, code, password, nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async () => {
    setLoading(true);
    try {
      await quickStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : '游客进入失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-bold">T</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">TwoWor1ds</h1>
            <p className="text-gray-500 mt-1">连接两个世界的桥梁</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
                setCodeSent(false);
                setCode('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'register'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              注册
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="请输入邮箱地址"
              />
            </div>

            {mode === 'register' && !codeSent && (
              <button
                onClick={handleSendCode}
                disabled={loading || !email}
                className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            )}

            {mode === 'register' && codeSent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError('');
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="请输入验证码"
                    maxLength={6}
                  />
                  <button
                    onClick={handleSendCode}
                    disabled={loading || codeCountdown > 0}
                    className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {codeCountdown > 0 ? `${codeCountdown}s` : '重新发送'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="请输入昵称"
                  maxLength={20}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder={mode === 'login' ? '请输入密码' : '请设置密码（至少6位）'}
              />
            </div>

            {mode === 'login' && (
              <button
                onClick={handleLogin}
                disabled={loading || !email || !password}
                className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            )}

            {mode === 'register' && codeSent && (
              <button
                onClick={handleRegister}
                disabled={loading || !email || !password || !code || !nickname}
                className="w-full py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '注册中...' : '注册'}
              </button>
            )}
          </div>

          {mode === 'login' && (
            <>
              <button
                onClick={handleQuickStart}
                disabled={loading}
                className="w-full mt-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '进入中...' : '游客进入'}
              </button>
              <p className="mt-6 text-center text-sm text-gray-500">
                还没有账号？{' '}
                <button
                  onClick={() => setMode('register')}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  立即注册
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
