// XBoard 专用代理脚本 - 通过 jsDelivr CDN 加速
const CONFIG = {
  // 原始服务器配置
  TARGET_HOST: 'budingyun.com',
  TARGET_PORT: 443,
  USE_HTTPS: true,
  
  // 备用节点列表（智能负载均衡）
  BACKUP_HOSTS: [
    { host: 'backup1.budingyun.com', weight: 1, region: 'asia' },
    { host: 'backup2.budingyun.com', weight: 1, region: 'global' },
    { host: 'backup3.budingyun.com', weight: 0.8, region: 'europe' }
  ],
  
  // XBoard 特定 API 端点配置
  XBOARD_ENDPOINTS: {
    auth: ['/api/v1/passport/', '/api/v1/user/'],
    subscription: ['/api/v1/user/getSubscribe', '/api/v1/user/resetSecurity'],
    payment: ['/api/v1/order/', '/api/v1/payment/'],
    admin: ['/api/v1/admin/', '/api/v1/system/'],
    public: ['/api/v1/guest/', '/api/v1/stat/']
  },
  
  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    interval: 15000,    // 15秒检查间隔
    timeout: 3000,      // 3秒超时
    retryAttempts: 2,   // 重试次数
    endpoints: ['/api/v1/guest/comm/config', '/api/v1/stat/getOverride']
  },
  
  // 性能优化配置
  PERFORMANCE: {
    enableCache: true,
    cacheTimeout: 300000,  // 5分钟缓存
    enableCompression: true,
    maxConcurrentRequests: 10,
    requestTimeout: 8000   // 8秒请求超时
  },
  
  // 安全配置
  SECURITY: {
    enableCSRF: true,
    allowedOrigins: ['*.budingyun.com', 'localhost'],
    rateLimitPerMinute: 60
  }
};

// 全局状态管理
const ProxyState = {
  cache: new Map(),
  healthStatus: new Map(),
  requestCount: 0,
  lastHealthCheck: 0,
  activeRequests: 0,
  rateLimitCounter: 0,
  rateLimitResetTime: Date.now() + 60000
};

// 智能代理核心类
class XBoardProxy {
  constructor() {
    this.initHealthCheck();
    this.initRateLimit();
  }

  // 初始化健康检查
  initHealthCheck() {
    if (!CONFIG.HEALTH_CHECK.enabled) return;
    
    setInterval(() => {
      this.performHealthCheck();
    }, CONFIG.HEALTH_CHECK.interval);
  }

  // 初始化速率限制
  initRateLimit() {
    setInterval(() => {
      ProxyState.rateLimitCounter = 0;
      ProxyState.rateLimitResetTime = Date.now() + 60000;
    }, 60000);
  }

  // 主要代理方法
  async fetch(url, options = {}) {
    // 速率限制检查
    if (!this.checkRateLimit()) {
      throw new Error('请求频率过高，请稍后再试');
    }

    // 并发请求限制
    if (ProxyState.activeRequests >= CONFIG.PERFORMANCE.maxConcurrentRequests) {
      await this.waitForSlot();
    }

    ProxyState.activeRequests++;
    ProxyState.requestCount++;
    ProxyState.rateLimitCounter++;

    try {
      // 缓存检查
      const cacheKey = this.getCacheKey(url, options);
      if (CONFIG.PERFORMANCE.enableCache && this.isGETRequest(options)) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          console.log('🚀 缓存命中:', url);
          return cached;
        }
      }

      // 智能路由选择
      const targetUrl = this.buildTargetUrl(url);
      const enhancedOptions = this.enhanceRequestOptions(options);

      // 执行请求
      const response = await this.executeRequest(targetUrl, enhancedOptions);
      
      // 缓存响应
      if (CONFIG.PERFORMANCE.enableCache && this.isGETRequest(options) && response.ok) {
        this.setCache(cacheKey, response.clone());
      }

      return response;
    } catch (error) {
      console.warn('🔄 主节点失败，尝试备用路由:', error.message);
      return this.tryBackupStrategy(url, options);
    } finally {
      ProxyState.activeRequests--;
    }
  }

  // 构建目标 URL
  buildTargetUrl(url) {
    const baseUrl = `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${CONFIG.TARGET_HOST}${CONFIG.TARGET_PORT !== 443 ? ':' + CONFIG.TARGET_PORT : ''}`;
    
    if (url.startsWith('http')) {
      return url;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url.replace(window.location.origin, baseUrl);
  }

  // 增强请求选项
  enhanceRequestOptions(options) {
    const enhanced = {
      ...options,
      mode: 'cors',
      credentials: 'include',
      timeout: CONFIG.PERFORMANCE.requestTimeout
    };

    // 添加压缩支持
    if (CONFIG.PERFORMANCE.enableCompression) {
      enhanced.headers = {
        'Accept-Encoding': 'gzip, deflate, br',
        ...enhanced.headers
      };
    }

    // CSRF 保护
    if (CONFIG.SECURITY.enableCSRF && this.isModifyingRequest(options)) {
      enhanced.headers = {
        'X-Requested-With': 'XMLHttpRequest',
        ...enhanced.headers
      };
    }

    return enhanced;
  }

  // 执行请求（带超时）
  async executeRequest(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.PERFORMANCE.requestTimeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // 智能代理函数工厂
  createProxy() {
    return new Proxy(this, {
      get(target, prop) {
        if (prop === 'fetch') {
          return target.fetch.bind(target);
        }
        return target[prop];
      }
    });
  }
}

  // 备用策略处理
  async tryBackupStrategy(url, options) {
    const sortedHosts = this.getSortedBackupHosts();
    
    for (let i = 0; i < sortedHosts.length; i++) {
      const host = sortedHosts[i];
      try {
        console.log(`🔄 尝试备用节点 ${i + 1}/${sortedHosts.length}: ${host.host}`);
        
        const targetUrl = this.buildBackupUrl(url, host.host);
        const response = await this.executeRequest(targetUrl, options);
        
        if (response.ok) {
          console.log(`✅ 备用节点成功: ${host.host}`);
          // 更新健康状态
          ProxyState.healthStatus.set(host.host, { status: 'healthy', lastCheck: Date.now() });
          return response;
        }
      } catch (error) {
        console.warn(`❌ 备用节点 ${host.host} 失败:`, error.message);
        ProxyState.healthStatus.set(host.host, { status: 'unhealthy', lastCheck: Date.now(), error: error.message });
      }
    }
    
    throw new Error('🚨 所有节点均不可用，请检查网络连接');
  }

  // 构建备用 URL
  buildBackupUrl(url, backupHost) {
    const baseUrl = `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${backupHost}`;
    
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      return `${baseUrl}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
    }
    
    if (url.startsWith('/')) {
      return baseUrl + url;
    }
    
    return url.replace(window.location.origin, baseUrl);
  }

  // 获取排序后的备用主机（基于权重和健康状态）
  getSortedBackupHosts() {
    return CONFIG.BACKUP_HOSTS
      .map(host => ({
        ...host,
        healthScore: this.calculateHealthScore(host.host)
      }))
      .sort((a, b) => (b.weight * b.healthScore) - (a.weight * a.healthScore));
  }

  // 计算健康分数
  calculateHealthScore(host) {
    const health = ProxyState.healthStatus.get(host);
    if (!health) return 1; // 未知状态默认为健康
    
    if (health.status === 'healthy') return 1;
    if (health.status === 'unhealthy') {
      // 根据失败时间计算恢复分数
      const timeSinceFailure = Date.now() - health.lastCheck;
      return Math.min(timeSinceFailure / (5 * 60 * 1000), 0.1); // 5分钟后开始恢复
    }
    
    return 0.5; // 默认分数
  }

  // 执行健康检查
  async performHealthCheck() {
    const now = Date.now();
    if (now - ProxyState.lastHealthCheck < CONFIG.HEALTH_CHECK.interval) return;
    
    ProxyState.lastHealthCheck = now;
    console.log('🔍 执行健康检查...');
    
    // 检查主节点
    await this.checkHostHealth(CONFIG.TARGET_HOST);
    
    // 检查备用节点
    for (const host of CONFIG.BACKUP_HOSTS) {
      await this.checkHostHealth(host.host);
    }
  }

  // 检查单个主机健康状态
  async checkHostHealth(hostname) {
    try {
      const testUrl = `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${hostname}${CONFIG.HEALTH_CHECK.endpoints[0]}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.HEALTH_CHECK.timeout);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors'
      });
      
      clearTimeout(timeoutId);
      
      ProxyState.healthStatus.set(hostname, {
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: Date.now() - ProxyState.lastHealthCheck
      });
      
    } catch (error) {
      ProxyState.healthStatus.set(hostname, {
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: error.message
      });
    }
  }

  // 缓存管理方法
  getCacheKey(url, options) {
    const method = options.method || 'GET';
    const headers = JSON.stringify(options.headers || {});
    return `${method}:${url}:${headers}`;
  }

  getFromCache(key) {
    const cached = ProxyState.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CONFIG.PERFORMANCE.cacheTimeout) {
      ProxyState.cache.delete(key);
      return null;
    }
    
    return cached.response;
  }

  setCache(key, response) {
    ProxyState.cache.set(key, {
      response,
      timestamp: Date.now()
    });
    
    // 清理过期缓存
    if (ProxyState.cache.size > 100) {
      this.cleanupCache();
    }
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of ProxyState.cache.entries()) {
      if (now - value.timestamp > CONFIG.PERFORMANCE.cacheTimeout) {
        ProxyState.cache.delete(key);
      }
    }
  }

  // 工具方法
  isGETRequest(options) {
    return !options.method || options.method.toUpperCase() === 'GET';
  }

  isModifyingRequest(options) {
    const method = (options.method || 'GET').toUpperCase();
    return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  }

  checkRateLimit() {
    if (Date.now() > ProxyState.rateLimitResetTime) {
      ProxyState.rateLimitCounter = 0;
      ProxyState.rateLimitResetTime = Date.now() + 60000;
    }
    
    return ProxyState.rateLimitCounter < CONFIG.SECURITY.rateLimitPerMinute;
  }

  async waitForSlot() {
    return new Promise(resolve => {
      const checkSlot = () => {
        if (ProxyState.activeRequests < CONFIG.PERFORMANCE.maxConcurrentRequests) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  // 获取代理统计信息
  getStats() {
    return {
      totalRequests: ProxyState.requestCount,
      activeRequests: ProxyState.activeRequests,
      cacheSize: ProxyState.cache.size,
      healthStatus: Object.fromEntries(ProxyState.healthStatus),
      rateLimitStatus: {
        current: ProxyState.rateLimitCounter,
        limit: CONFIG.SECURITY.rateLimitPerMinute,
        resetTime: ProxyState.rateLimitResetTime
      }
    };
  }
}

// 添加缺失的配置项
CONFIG.PERFORMANCE.enableAutoProxy = CONFIG.PERFORMANCE.enableAutoProxy || false;
CONFIG.DEBUG = CONFIG.DEBUG || false;

// 全局代理实例
const proxy = new XBoardProxy();

// 导出代理函数
function createProxy() {
  return proxy.fetch.bind(proxy);
}

// 便捷函数
function xboardFetch(url, options) {
  return proxy.fetch(url, options);
}

function getProxyStats() {
  return proxy.getStats();
}

// 重写原生 fetch（可选）
if (CONFIG.PERFORMANCE.enableAutoProxy) {
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    // 只代理特定域名的请求
    if (typeof url === 'string' && (
      url.includes(CONFIG.TARGET_HOST) ||
      url.startsWith('/api/') ||
      url.startsWith('/admin/')
    )) {
      return proxy.fetch(url, options);
    }
    return originalFetch(url, options);
  };
}

// 重写 axios 拦截器（如果存在）
if (typeof window !== 'undefined' && typeof window.axios !== 'undefined') {
  window.axios.interceptors.request.use(
    config => {
      // 为 XBoard API 请求添加代理
      if (config.url && (
        config.url.includes('/api/') ||
        config.url.includes('/admin/') ||
        config.url.includes(CONFIG.TARGET_HOST)
      )) {
        config.useProxy = true;
      }
      return config;
    },
    error => Promise.reject(error)
  );
  
  window.axios.interceptors.response.use(
    response => response,
    async error => {
      // 如果请求失败且配置了代理，尝试使用代理重试
      if (error.config && error.config.useProxy && !error.config._retried) {
        error.config._retried = true;
        try {
          const response = await proxy.fetch(error.config.url, {
            method: error.config.method,
            headers: error.config.headers,
            body: error.config.data
          });
          return response;
        } catch (proxyError) {
          console.warn('代理重试失败:', proxyError);
        }
      }
      return Promise.reject(error);
    }
  );
}

// 导出代理对象
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createProxy, CONFIG, XBoardProxy, proxy };
} else if (typeof window !== 'undefined') {
  // 自动初始化和健康检查
  console.log('🚀 XBoard 智能代理系统已加载');
  console.log('📊 使用 window.getProxyStats() 查看统计信息');
  console.log('🔧 使用 window.xboardFetch(url, options) 进行代理请求');
  
  window.createProxy = createProxy;
  window.XBoardProxy = XBoardProxy;
  window.xboardFetch = xboardFetch;
  window.getProxyStats = getProxyStats;
  window.proxy = proxy;
  window.V2bXProxy = createProxy();
  
  // 兼容性函数
  window.tryBackupHosts = proxy.tryBackupStrategy.bind(proxy);
  
  // 启动健康检查
  setTimeout(() => {
    proxy.performHealthCheck();
  }, 2000);
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    console.log('🔄 清理代理资源...');
    proxy.cleanupCache();
  });
}

// 调试模式
if (CONFIG.DEBUG) {
  window.proxyDebug = {
    config: CONFIG,
    state: ProxyState,
    proxy: proxy,
    testConnection: async (host = CONFIG.TARGET_HOST) => {
      try {
        const result = await proxy.checkHostHealth(host);
        console.log(`连接测试结果 (${host}):`, result);
        return result;
      } catch (error) {
        console.error(`连接测试失败 (${host}):`, error);
        return false;
      }
    },
    clearCache: () => {
      ProxyState.cache.clear();
      console.log('✅ 缓存已清理');
    },
    resetStats: () => {
      ProxyState.requestCount = 0;
      ProxyState.rateLimitCounter = 0;
      ProxyState.healthStatus.clear();
      console.log('✅ 统计信息已重置');
    }
  };
  
  console.log('🐛 调试模式已启用，使用 window.proxyDebug 访问调试工具');
}
