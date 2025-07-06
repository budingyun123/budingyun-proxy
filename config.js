// XBoard 智能代理配置文件
const CONFIG = {
  // 主服务器配置
  PRIMARY: {
    host: 'budingyun.com',
    port: 443,
    protocol: 'https',
    weight: 10,
    region: 'origin'
  },
  
  // 备用服务器配置（智能负载均衡）
  FALLBACK_HOSTS: [
    { host: 'cdn.jsdelivr.net', port: 443, protocol: 'https', weight: 9, region: 'global' },
    { host: 'fastly.jsdelivr.net', port: 443, protocol: 'https', weight: 8, region: 'global' },
    { host: 'gcore.jsdelivr.net', port: 443, protocol: 'https', weight: 7, region: 'asia' },
    { host: 'testingcf.jsdelivr.net', port: 443, protocol: 'https', weight: 6, region: 'global' },
    { host: 'quantil.jsdelivr.net', port: 443, protocol: 'https', weight: 5, region: 'europe' }
  ],
  
  // XBoard API 路由配置
  API_ROUTES: {
    // 认证相关
    auth: { path: '/api/v1/passport/auth', cacheable: false, priority: 'high' },
    login: { path: '/api/v1/passport/auth/login', cacheable: false, priority: 'high' },
    register: { path: '/api/v1/passport/auth/register', cacheable: false, priority: 'high' },
    
    // 用户相关
    user: { path: '/api/v1/user', cacheable: true, priority: 'high', ttl: 300 },
    userOrder: { path: '/api/v1/user/order', cacheable: false, priority: 'medium' },
    userServer: { path: '/api/v1/user/server', cacheable: true, priority: 'high', ttl: 600 },
    userSubscribe: { path: '/api/v1/user/getSubscribe', cacheable: true, priority: 'high', ttl: 300 },
    
    // 系统相关
    guestConfig: { path: '/api/v1/guest/comm/config', cacheable: true, priority: 'medium', ttl: 1800 },
    stat: { path: '/api/v1/stat', cacheable: true, priority: 'low', ttl: 300 },
    
    // 其他功能
    payment: { path: '/api/v1/user/order/checkout', cacheable: false, priority: 'high' },
    notice: { path: '/api/v1/user/notice', cacheable: true, priority: 'low', ttl: 600 },
    ticket: { path: '/api/v1/user/ticket', cacheable: false, priority: 'medium' },
    knowledge: { path: '/api/v1/user/knowledge', cacheable: true, priority: 'low', ttl: 3600 },
    coupon: { path: '/api/v1/user/coupon', cacheable: true, priority: 'medium', ttl: 300 }
  },
  
  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    interval: 300000, // 5分钟
    timeout: 10000,   // 10秒
    retryCount: 3,
    endpoints: ['/api/v1/guest/comm/config', '/ping', '/health']
  },
  
  // 缓存配置
  CACHE: {
    enabled: true,
    defaultTTL: 300000, // 5分钟
    maxSize: 1000,      // 最大缓存条目数
    cleanupInterval: 600000, // 10分钟清理一次
    compressionEnabled: true
  },
  
  // 性能配置
  PERFORMANCE: {
    maxConcurrentRequests: 10,
    requestTimeout: 30000, // 30秒
    retryDelay: 1000,      // 重试延迟
    connectionPoolSize: 20,
    keepAliveTimeout: 60000
  },
  
  // 安全配置
  SECURITY: {
    enableCSRF: true,
    allowedOrigins: [
      'https://budingyun.com',
      'http://localhost',
      'http://127.0.0.1',
      'https://localhost'
    ],
    rateLimitPerMinute: 100,
    enableSRI: true // 子资源完整性检查
  },
  
  // 调试配置
  DEBUG: false,
  
  // CDN 配置
  CDN: {
    enabled: true,
    baseUrl: 'https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main',
    fallbackUrls: [
      'https://fastly.jsdelivr.net/gh/budingyun123/budingyun-proxy@main',
      'https://gcore.jsdelivr.net/gh/budingyun123/budingyun-proxy@main'
    ]
  },
  
  // 监控配置
  MONITORING: {
    enabled: true,
    reportInterval: 600000, // 10分钟
    maxLogEntries: 1000,
    enablePerformanceMetrics: true
  }
};

// 环境检测和配置调整
if (typeof window !== 'undefined') {
  // 浏览器环境
  const hostname = window.location.hostname;
  
  // 开发环境检测
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('dev')) {
    CONFIG.DEBUG = true;
    CONFIG.PERFORMANCE.enableCache = false;
    CONFIG.MONITORING.reportInterval = 60000; // 1分钟
    console.log('🔧 检测到开发环境，已启用调试模式');
  }
  
  // 移动设备优化
  if (/Mobi|Android/i.test(navigator.userAgent)) {
    CONFIG.PERFORMANCE.maxConcurrentRequests = 5;
    CONFIG.PERFORMANCE.requestTimeout = 20000;
    console.log('📱 检测到移动设备，已优化性能配置');
  }
}

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.XBOARD_CONFIG = CONFIG;
}
