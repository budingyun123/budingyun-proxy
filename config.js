// XBoard 智能代理配置文件
const CONFIG = {
  // 目标服务器配置
  TARGET_HOST: 'budingyun.com',
  TARGET_PORT: 443,
  USE_HTTPS: true,
  
  // 备用节点配置（智能负载均衡）
  BACKUP_HOSTS: [
    { host: 'cdn.jsdelivr.net', weight: 10, region: 'global' },
    { host: 'fastly.jsdelivr.net', weight: 8, region: 'global' },
    { host: 'gcore.jsdelivr.net', weight: 6, region: 'asia' },
    { host: 'testingcf.jsdelivr.net', weight: 5, region: 'global' },
    { host: 'quantil.jsdelivr.net', weight: 4, region: 'europe' }
  ],
  
  // XBoard 特定 API 端点
  API_ENDPOINTS: {
    auth: '/api/v1/passport/auth',
    login: '/api/v1/passport/auth/login',
    register: '/api/v1/passport/auth/register',
    user: '/api/v1/user',
    admin: '/api/v1/admin',
    order: '/api/v1/user/order',
    server: '/api/v1/user/server',
    stat: '/api/v1/stat',
    config: '/api/v1/user/getSubscribe',
    payment: '/api/v1/user/order/checkout',
    notice: '/api/v1/user/notice',
    ticket: '/api/v1/user/ticket',
    knowledge: '/api/v1/user/knowledge',
    coupon: '/api/v1/user/coupon'
  },
  
  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    interval: 300000, // 5分钟
    timeout: 10000,   // 10秒
    retryCount: 3,
    endpoints: ['/api/v1/guest/comm/config', '/ping', '/health', '/api/v1/stat']
  },
  
  // 性能优化配置
  PERFORMANCE: {
    enableCache: true,
    cacheTimeout: 300000, // 5分钟
    enableCompression: true,
    maxConcurrentRequests: 10,
    requestTimeout: 30000, // 30秒
    retryAttempts: 3,
    retryDelay: 1000,
    enableAutoProxy: false, // 是否自动代理所有请求
    enablePreload: true     // 是否预加载关键资源
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
    enableRequestSigning: false,
    blockSuspiciousRequests: true
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
