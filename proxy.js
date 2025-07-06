// V2bX 代理脚本 - 通过 jsDelivr CDN 加速
const CONFIG = {
  // 原始 V2bX 服务器地址
  TARGET_HOST: 'budingyun.com',
  TARGET_PORT: 443,
  USE_HTTPS: true,
  
  // 备用节点列表
  BACKUP_HOSTS: [
    'backup1.budingyun.com',
    'backup2.budingyun.com'
  ],
  
  // 健康检查配置
  HEALTH_CHECK: {
    enabled: true,
    interval: 30000, // 30秒
    timeout: 5000    // 5秒超时
  }
};

// 智能代理函数
function createProxy() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'fetch') {
        return async (url, options = {}) => {
          const targetUrl = url.replace(
            window.location.origin,
            `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${CONFIG.TARGET_HOST}${CONFIG.TARGET_PORT !== 443 ? ':' + CONFIG.TARGET_PORT : ''}`
          );
          
          try {
            const response = await fetch(targetUrl, {
              ...options,
              mode: 'cors',
              credentials: 'include'
            });
            return response;
          } catch (error) {
            console.warn('主节点连接失败，尝试备用节点:', error);
            return tryBackupHosts(url, options);
          }
        };
      }
      return target[prop];
    }
  });
}

// 备用节点尝试
async function tryBackupHosts(url, options) {
  for (const host of CONFIG.BACKUP_HOSTS) {
    try {
      const targetUrl = url.replace(
        window.location.origin,
        `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${host}`
      );
      const response = await fetch(targetUrl, options);
      if (response.ok) return response;
    } catch (error) {
      console.warn(`备用节点 ${host} 连接失败:`, error);
    }
  }
  throw new Error('所有节点均不可用');
}

// 导出代理对象
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createProxy, CONFIG };
} else {
  window.V2bXProxy = createProxy();
}
