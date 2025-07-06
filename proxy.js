// XBoard 智能代理系统 - 基于开源最佳实践
// 参考 freecdn、trojan-go 等优秀开源项目设计

// 配置验证函数
function validateConfig(config) {
  const errors = [];
  
  // 验证主服务器配置
  if (!config.PRIMARY || !config.PRIMARY.host) {
    errors.push('PRIMARY.host is required');
  }
  
  // 验证备用服务器配置
  if (!Array.isArray(config.FALLBACK_HOSTS)) {
    errors.push('FALLBACK_HOSTS must be an array');
  }
  
  // 验证健康检查配置
  if (!config.HEALTH_CHECK || !Array.isArray(config.HEALTH_CHECK.endpoints)) {
    errors.push('HEALTH_CHECK.endpoints must be an array');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

// 日志系统
class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }
  
  log(level, message, ...args) {
    if (this.levels[level] <= this.levels[this.level]) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }
  }
  
  error(message, ...args) { this.log('error', message, ...args); }
  warn(message, ...args) { this.log('warn', message, ...args); }
  info(message, ...args) { this.log('info', message, ...args); }
  debug(message, ...args) { this.log('debug', message, ...args); }
}

/**
 * 配置管理模块
 */
const CONFIG = {
  // 主服务器配置
  PRIMARY: {
    host: 'budingyun.com',
    port: 443,
    protocol: 'https'
  },
  
  // 备用服务器配置（智能负载均衡）
  FALLBACK_HOSTS: [
    { host: 'backup1.budingyun.com', weight: 1.0, region: 'asia', priority: 1 },
    { host: 'backup2.budingyun.com', weight: 0.8, region: 'global', priority: 2 },
    { host: 'backup3.budingyun.com', weight: 0.6, region: 'europe', priority: 3 }
  ],
  
  // XBoard API 路由配置
  API_ROUTES: {
    auth: ['/api/v1/passport/', '/api/v1/user/'],
    subscription: ['/api/v1/user/getSubscribe', '/api/v1/user/resetSecurity'],
    payment: ['/api/v1/order/', '/api/v1/payment/'],
    admin: ['/api/v1/admin/', '/api/v1/system/'],
    public: ['/api/v1/guest/', '/api/v1/stat/']
  },
  
  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    interval: 30000,     // 30秒检查间隔
    timeout: 5000,       // 5秒超时
    retryCount: 3,       // 重试次数
    endpoints: ['/api/v1/guest/comm/config', '/health']
  },
  
  // 缓存配置
  CACHE: {
    enabled: true,
    ttl: 300000,         // 5分钟TTL
    maxSize: 100,        // 最大缓存条目数
    compressionEnabled: true
  },
  
  // 性能配置
  PERFORMANCE: {
    maxConcurrentRequests: 20,
    requestTimeout: 10000,    // 10秒请求超时
    retryDelay: 1000,         // 重试延迟
    circuitBreakerThreshold: 5 // 熔断器阈值
  },
  
  // 安全配置
  SECURITY: {
    enableCSRF: true,
    allowedOrigins: ['*.budingyun.com', 'localhost', '127.0.0.1'],
    rateLimitPerMinute: 100,
    enableSRI: true           // 子资源完整性检查
  }
};

/**
 * 状态管理模块
 */
class ProxyState {
  constructor() {
    this.cache = new Map();
    this.healthStatus = new Map();
    this.requestStats = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0
    };
    this.circuitBreaker = new Map();
    this.lastHealthCheck = 0;
  }
  
  // 获取缓存
  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  // 设置缓存
  setCache(key, data, ttl = CONFIG.CACHE.ttl) {
    if (!CONFIG.CACHE.enabled) return;
    
    // 清理过期缓存
    if (this.cache.size >= CONFIG.CACHE.maxSize) {
      this.cleanExpiredCache();
    }
    
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      created: Date.now()
    });
  }
  
  // 清理过期缓存
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
  
  // 更新健康状态
  updateHealthStatus(host, isHealthy, responseTime = 0) {
    this.healthStatus.set(host, {
      healthy: isHealthy,
      lastCheck: Date.now(),
      responseTime,
      consecutiveFailures: isHealthy ? 0 : (this.healthStatus.get(host)?.consecutiveFailures || 0) + 1
    });
  }
  
  // 获取健康的主机
  getHealthyHosts() {
    const healthyHosts = [];
    
    // 检查主服务器
    const primaryStatus = this.healthStatus.get(CONFIG.PRIMARY.host);
    if (!primaryStatus || primaryStatus.healthy) {
      healthyHosts.push({
        ...CONFIG.PRIMARY,
        weight: 1.0,
        priority: 0
      });
    }
    
    // 检查备用服务器
    CONFIG.FALLBACK_HOSTS.forEach(host => {
      const status = this.healthStatus.get(host.host);
      if (!status || status.healthy) {
        healthyHosts.push(host);
      }
    });
    
    return healthyHosts.sort((a, b) => a.priority - b.priority);
  }
  
  // 更新统计信息
  updateStats(type) {
    this.requestStats[type]++;
    this.requestStats.total++;
  }
  
  // 熔断器相关方法
  isCircuitOpen(host) {
    const breaker = this.circuitBreaker.get(host);
    if (!breaker) return false;
    
    // 如果失败次数超过阈值且在冷却期内
    if (breaker.failures >= 5 && Date.now() - breaker.lastFailure < 30000) {
      return true;
    }
    
    // 冷却期过后重置
    if (Date.now() - breaker.lastFailure >= 30000) {
      this.resetCircuitBreaker(host);
    }
    
    return false;
  }
  
  incrementCircuitBreaker(host) {
    if (!this.circuitBreaker.has(host)) {
      this.circuitBreaker.set(host, { failures: 0, lastFailure: 0 });
    }
    const breaker = this.circuitBreaker.get(host);
    breaker.failures++;
    breaker.lastFailure = Date.now();
  }
  
  resetCircuitBreaker(host) {
    if (this.circuitBreaker.has(host)) {
      this.circuitBreaker.set(host, { failures: 0, lastFailure: 0 });
    }
  }
}

/**
 * 网络请求模块
 */
class NetworkManager {
  constructor(state, logger) {
    this.state = state;
    this.logger = logger || new Logger();
    this.activeRequests = new Set();
  }
  
  // 智能路由选择
  selectBestHost() {
    const healthyHosts = this.state.getHealthyHosts();
    
    if (healthyHosts.length === 0) {
      throw new Error('No healthy hosts available');
    }
    
    // 使用加权随机算法选择主机
    const totalWeight = healthyHosts.reduce((sum, host) => sum + (host.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const host of healthyHosts) {
      random -= (host.weight || 1);
      if (random <= 0) {
        return host;
      }
    }
    
    return healthyHosts[0]; // fallback
  }
  
  // 构建请求URL
  buildRequestUrl(host, path) {
    const protocol = host.protocol || (host.port === 443 ? 'https' : 'http');
    const port = (protocol === 'https' && host.port === 443) || (protocol === 'http' && host.port === 80) 
      ? '' : `:${host.port}`;
    return `${protocol}://${host.host}${port}${path}`;
  }
  
  // 执行HTTP请求
  async makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.PERFORMANCE.requestTimeout);
    
    try {
      this.activeRequests.add(controller);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'XBoard-Proxy/1.0',
          'Accept': 'application/json, text/plain, */*',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    } finally {
      this.activeRequests.delete(controller);
    }
  }
  
  // 带重试的请求
  async requestWithRetry(path, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const host = this.selectBestHost();
        
        // 检查熔断器状态
        if (this.state.isCircuitOpen(host.host)) {
          throw new Error(`Circuit breaker open for ${host.host}`);
        }
        
        const url = this.buildRequestUrl(host, path);
        
        const startTime = Date.now();
        const response = await this.makeRequest(url, options);
        const responseTime = Date.now() - startTime;
        
        // 更新健康状态
        this.state.updateHealthStatus(host.host, response.ok, responseTime);
        
        if (response.ok) {
          this.state.resetCircuitBreaker(host.host);
          this.state.updateStats('success');
          return response;
        } else {
          this.state.incrementCircuitBreaker(host.host);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        lastError = error;
        
        // 分类错误类型
        const errorType = this.classifyError(error);
        this.logger.warn(`Request attempt ${attempt + 1} failed (${errorType}):`, error.message);
        
        if (attempt < maxRetries && errorType !== 'fatal') {
          const delay = CONFIG.PERFORMANCE.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
    
    this.state.updateStats('failed');
    throw lastError;
  }
  
  // 错误分类
  classifyError(error) {
    if (error.name === 'AbortError') return 'timeout';
    if (error.message.includes('Failed to fetch')) return 'network';
    if (error.message.includes('HTTP 5')) return 'server';
    if (error.message.includes('HTTP 4')) return 'client';
    if (error.message.includes('Circuit breaker')) return 'circuit';
    return 'unknown';
  }
}

/**
 * 健康检查模块
 */
class HealthChecker {
  constructor(state, networkManager, logger) {
    this.state = state;
    this.networkManager = networkManager;
    this.logger = logger || new Logger();
    this.isRunning = false;
  }
  
  // 启动健康检查
  start() {
    if (this.isRunning || !CONFIG.HEALTH_CHECK.enabled) return;
    
    this.logger.info('Starting health checker...');
    this.isRunning = true;
    this.scheduleNextCheck();
  }
  
  // 停止健康检查
  stop() {
    this.logger.info('Stopping health checker...');
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }
  
  // 调度下次检查
  scheduleNextCheck() {
    if (!this.isRunning) return;
    
    this.timeoutId = setTimeout(() => {
      this.performHealthCheck().finally(() => {
        this.scheduleNextCheck();
      });
    }, CONFIG.HEALTH_CHECK.interval);
  }
  
  // 执行健康检查
  async performHealthCheck() {
    const allHosts = [CONFIG.PRIMARY, ...CONFIG.FALLBACK_HOSTS];
    
    const checkPromises = allHosts.map(async (host) => {
      try {
        const endpoint = CONFIG.HEALTH_CHECK.endpoints[0];
        const url = this.networkManager.buildRequestUrl(host, endpoint);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.HEALTH_CHECK.timeout);
        
        const startTime = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'XBoard-Proxy/1.0',
            'Accept': 'application/json'
          }
        });
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        this.state.updateHealthStatus(host.host, response.ok, responseTime);
        
      } catch (error) {
        this.state.updateHealthStatus(host.host, false);
      }
    });
    
    await Promise.allSettled(checkPromises);
    this.state.lastHealthCheck = Date.now();
  }
}

/**
 * 主代理类
 */
class XBoardProxy {
  constructor(logLevel = 'info') {
    // 验证配置
    validateConfig(CONFIG);
    
    this.logger = new Logger(logLevel);
    this.state = new ProxyState();
    this.networkManager = new NetworkManager(this.state, this.logger);
    this.healthChecker = new HealthChecker(this.state, this.networkManager, this.logger);
    this.initialized = false;
  }
  
  // 初始化代理
  async initialize() {
    if (this.initialized) return;
    
    try {
      // 启动健康检查
      this.healthChecker.start();
      
      // 执行初始健康检查
      await this.healthChecker.performHealthCheck();
      
      this.initialized = true;
      this.logger.info('XBoard Proxy initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize XBoard Proxy:', error);
      throw error;
    }
  }
  
  // 代理请求
  async proxyRequest(path, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 检查缓存
    const cacheKey = `${options.method || 'GET'}:${path}`;
    const cachedResponse = this.state.getCache(cacheKey);
    
    if (cachedResponse && (options.method || 'GET') === 'GET') {
      this.state.updateStats('cached');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: new Headers(cachedResponse.headers)
      });
    }
    
    try {
      const response = await this.networkManager.requestWithRetry(path, options);
      
      // 缓存GET请求的响应
      if ((options.method || 'GET') === 'GET' && response.ok) {
        const responseClone = response.clone();
        const body = await responseClone.text();
        
        this.state.setCache(cacheKey, {
          body,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
      }
      
      return response;
      
    } catch (error) {
      this.logger.error('Proxy request failed:', error);
      throw error;
    }
  }
  
  // 获取代理状态
  getStatus() {
    return {
      initialized: this.initialized,
      stats: this.state.requestStats,
      healthStatus: Object.fromEntries(this.state.healthStatus),
      cacheSize: this.state.cache.size,
      lastHealthCheck: this.state.lastHealthCheck
    };
  }
  
  // 清理资源
  cleanup() {
    this.healthChecker.stop();
    this.state.cache.clear();
    this.networkManager.activeRequests.forEach(controller => controller.abort());
    this.initialized = false;
  }
}

// 全局代理实例
const globalProxy = new XBoardProxy();

// 导出API
if (typeof window !== 'undefined') {
  // 浏览器环境
  window.XBoardProxy = {
    request: (path, options) => globalProxy.proxyRequest(path, options),
    status: () => globalProxy.getStatus(),
    init: () => globalProxy.initialize(),
    cleanup: () => globalProxy.cleanup()
  };
  
  // 自动初始化
  document.addEventListener('DOMContentLoaded', () => {
    globalProxy.initialize().catch(console.error);
  });
  
  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    globalProxy.cleanup();
  });
  
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js环境
  module.exports = {
    XBoardProxy,
    CONFIG
  };
}

// 调试模式
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  window.proxyDebug = {
    state: globalProxy.state,
    networkManager: globalProxy.networkManager,
    healthChecker: globalProxy.healthChecker,
    testConnection: async (host) => {
      try {
        const url = `https://${host}/api/v1/guest/comm/config`;
        const response = await fetch(url);
        return { success: response.ok, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    clearCache: () => globalProxy.state.cache.clear(),
    getStats: () => globalProxy.getStatus()
  };
}

// 初始化日志
const initLogger = new Logger('info');
initLogger.info('XBoard Proxy loaded - Based on open source best practices');
