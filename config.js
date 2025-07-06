// V2bX 配置文件
window.V2bX_CONFIG = {
  // API 基础配置
  api: {
    baseURL: 'https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/proxy.js',
    timeout: 10000,
    retryTimes: 3
  },
  
  // CDN 配置
  cdn: {
    primary: 'https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/',
    backup: [
      'https://fastly.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/',
      'https://gcore.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/'
    ]
  },
  
  // 智能切换配置
  smartSwitch: {
    enabled: true,
    checkInterval: 60000, // 1分钟检查一次
    failureThreshold: 3   // 连续失败3次后切换
  }
};
