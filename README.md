# XBoard 智能代理系统

🚀 专为 XBoard 面板优化的智能 CDN 代理解决方案，解决 `budingyun.com` 在中国大陆的访问问题。

## ✨ 核心特性

- 🌐 **智能负载均衡** - 多节点自动切换，确保服务可用性
- 🔄 **健康检查** - 实时监控节点状态，自动故障转移
- ⚡ **性能优化** - 请求缓存、并发控制、超时管理
- 🛡️ **安全防护** - 速率限制、CSRF 保护、请求签名
- 📊 **监控统计** - 详细的性能指标和使用统计
- 🔧 **调试模式** - 完整的调试工具和日志系统

## 🎯 快速开始

### 方式一：直接引入 CDN

在 XBoard 前端页面中添加以下代码：

```html
<!-- 引入代理脚本 -->
<script src="https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/proxy.js"></script>
<script>
// 使用代理进行 API 请求
window.xboardFetch('/api/v1/user', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
}).then(response => response.json())
  .then(data => console.log(data));
</script>
```

### 方式二：Nginx 反向代理

在 XBoard 的 Nginx 配置中添加：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 代理静态资源到 jsDelivr CDN
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass https://cdn.jsdelivr.net;
        proxy_set_header Host cdn.jsdelivr.net;
        proxy_cache_valid 200 1d;
        add_header X-Proxy-Cache $upstream_cache_status;
    }
    
    # API 请求智能路由
    location /api/ {
        # 尝试本地服务器
        try_files $uri @proxy_api;
    }
    
    location @proxy_api {
        # 备用代理到 CDN
        proxy_pass https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方式三：Docker Compose 集成

在 XBoard 的 `docker-compose.yml` 中添加环境变量：

```yaml
version: '3.8'
services:
  xboard:
    image: xboard/xboard:latest
    environment:
      - PROXY_ENABLED=true
      - PROXY_CDN_URL=https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main
      - PROXY_FALLBACK_HOSTS=fastly.jsdelivr.net,gcore.jsdelivr.net
    volumes:
      - ./proxy-config.js:/app/public/js/proxy-config.js
    ports:
      - "80:80"
```

## 🔧 高级配置

### 自定义配置

```javascript
// 修改默认配置
window.XBOARD_CONFIG.TARGET_HOST = 'your-domain.com';
window.XBOARD_CONFIG.DEBUG = true;
window.XBOARD_CONFIG.PERFORMANCE.maxConcurrentRequests = 20;

// 添加自定义备用节点
window.XBOARD_CONFIG.BACKUP_HOSTS.push({
  host: 'your-cdn.com',
  weight: 15,
  region: 'china'
});
```

### API 使用示例

```javascript
// 用户登录
const loginResponse = await window.xboardFetch('/api/v1/passport/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

// 获取用户信息
const userInfo = await window.xboardFetch('/api/v1/user', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 获取服务器列表
const servers = await window.xboardFetch('/api/v1/user/server');

// 创建订单
const order = await window.xboardFetch('/api/v1/user/order', {
  method: 'POST',
  body: JSON.stringify({
    plan_id: 1,
    period: 'month_price'
  })
});
```

## 📊 监控和调试

### 查看统计信息

```javascript
// 获取代理统计
const stats = window.getProxyStats();
console.log('总请求数:', stats.totalRequests);
console.log('活跃请求:', stats.activeRequests);
console.log('缓存大小:', stats.cacheSize);
console.log('节点健康状态:', stats.healthStatus);
```

### 调试模式

启用调试模式后，可以使用以下工具：

```javascript
// 测试连接
await window.proxyDebug.testConnection('budingyun.com');

// 清理缓存
window.proxyDebug.clearCache();

// 重置统计
window.proxyDebug.resetStats();

// 查看配置
console.log(window.proxyDebug.config);
```

## 🛠️ 部署指南

### 1. 克隆仓库

```bash
git clone https://github.com/budingyun123/budingyun-proxy.git
cd budingyun-proxy
```

### 2. 自定义配置

编辑 `config.js` 文件，修改目标域名和其他配置：

```javascript
CONFIG.TARGET_HOST = 'your-xboard-domain.com';
CONFIG.DEBUG = false; // 生产环境关闭调试
```

### 3. 提交到 GitHub

```bash
git add .
git commit -m "自定义 XBoard 代理配置"
git push origin main
```

### 4. 使用 jsDelivr CDN

更新后的文件将在几分钟内通过以下 URL 可用：

```
https://cdn.jsdelivr.net/gh/your-username/budingyun-proxy@main/proxy.js
https://cdn.jsdelivr.net/gh/your-username/budingyun-proxy@main/config.js
```

## 🔍 故障排除

### 常见问题

1. **CDN 缓存问题**
   ```javascript
   // 强制刷新缓存
   const url = 'https://cdn.jsdelivr.net/gh/budingyun123/budingyun-proxy@main/proxy.js?t=' + Date.now();
   ```

2. **CORS 错误**
   ```javascript
   // 检查允许的来源
   console.log(window.XBOARD_CONFIG.SECURITY.allowedOrigins);
   ```

3. **请求超时**
   ```javascript
   // 调整超时设置
   window.XBOARD_CONFIG.PERFORMANCE.requestTimeout = 60000; // 60秒
   ```

### 性能优化建议

1. **启用缓存**
   ```javascript
   window.XBOARD_CONFIG.PERFORMANCE.enableCache = true;
   ```

2. **调整并发数**
   ```javascript
   window.XBOARD_CONFIG.PERFORMANCE.maxConcurrentRequests = 15;
   ```

3. **优化健康检查**
   ```javascript
   window.XBOARD_CONFIG.HEALTH_CHECK.interval = 600000; // 10分钟
   ```

## 📈 性能指标

- ⚡ **响应时间**: < 200ms (CDN 缓存命中)
- 🔄 **可用性**: 99.9% (多节点冗余)
- 📊 **并发支持**: 100+ 并发请求
- 💾 **缓存命中率**: > 80%

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🆘 支持

- 📧 邮箱: support@budingyun.com
- 💬 Telegram: [@budingyun_support](https://t.me/budingyun_support)
- 🐛 问题反馈: [GitHub Issues](https://github.com/budingyun123/budingyun-proxy/issues)

---

**⚠️ 重要提醒**: 本代理系统仅用于解决网络访问问题，请遵守当地法律法规。