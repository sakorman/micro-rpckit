# micro-rpckit

一个基于主从架构的微前端 RPC 通信框架，专注于提供标准化的跨应用通信解决方案。

## 特性

### 1. 主从架构
* 清晰的主从应用分离
* 标准化的 RPC 通信
* 支持 iframe/同域运行环境

### 2. 服务管理
* 声明式服务 API 定义
* 类型安全的接口调用
* 事件驱动通信

### 3. 权限控制
* 应用/服务/API 多级权限
* 灵活的权限策略
* 安全通信机制

## 系统架构

### 核心组件

```
+------------------+     +------------------+     +------------------+
|     Rpckit       |     |   ServTerminal   |     |   ServSession    |
|  (RPC 核心管理)   |---->|  (终端实现)      |---->|  (会话管理)      |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
| ServServiceManager|     |  ServService     |     |  ServEventer     |
|  (服务管理器)      |     |  (服务定义)      |     |  (事件管理)      |
+------------------+     +------------------+     +------------------+
```

### 组件说明

1. **Rpckit**
   * 框架核心类
   * 管理终端实例
   * 提供全局服务
   * 处理生命周期

2. **ServTerminal**
   * 终端实现
   * 管理通信通道
   * 处理消息路由
   * 维护会话状态

3. **ServSession**
   * 会话管理
   * 连接状态维护
   * 消息队列处理
   * 超时控制

4. **ServServiceManager**
   * 服务注册与发现
   * 服务版本管理
   * 服务健康检查
   * 服务降级处理

5. **ServService**
   * 服务定义
   * API 实现
   * 类型声明
   * 权限控制

6. **ServEventer**
   * 事件管理
   * 消息订阅
   * 事件分发
   * 状态同步

### 通信流程

```
主应用                    从应用
+--------+              +--------+
|  Rpckit|              |  Rpckit|
+--------+              +--------+
    |                       |
    v                       v
+--------+              +--------+
|Terminal|              |Terminal|
+--------+              +--------+
    |                       |
    v                       v
+--------+              +--------+
|Session |<------------>|Session |
+--------+              +--------+
    |                       |
    v                       v
+--------+              +--------+
|Service |<------------>|Service |
+--------+              +--------+
```

1. **初始化流程**
   * 创建 Rpckit 实例
   * 初始化终端配置
   * 建立会话连接
   * 注册服务定义

2. **通信流程**
   * 服务调用请求
   * 消息序列化
   * 会话传输
   * 响应处理

3. **事件流程**
   * 事件触发
   * 消息广播
   * 订阅处理
   * 状态更新

### 扩展机制

1. **插件系统**
   * 中间件支持
   * 生命周期钩子
   * 自定义扩展
   * 能力增强

2. **适配器**
   * 运行环境适配
   * 通信协议适配
   * 数据格式适配
   * 安全策略适配

## 使用场景

### 1. 微前端应用
```typescript
// 主应用
const host = new SappSDK({
    id: 'host-app',
    type: 'master'
});

// 注册服务
@ServService()
class UserService {
    @ServAPI()
    async getUserInfo() {
        return { name: 'John' };
    }
}

// 从应用
const slave = new SappSDK({
    id: 'slave-app',
    type: 'slave'
});

// 调用主应用服务
const userService = await slave.getService('UserService');
const userInfo = await userService.getUserInfo();
```

### 2. iframe 通信
```typescript
// 主应用
const host = new SappSDK({
    id: 'host-app',
    type: 'master'
});

// 打开 iframe
const iframe = await host.openIframe({
    url: 'https://slave-app.com',
    id: 'slave-1'
});

// 从应用
const slave = new SappSDK({
    id: 'slave-app',
    type: 'slave'
});

// 监听主应用消息
slave.on('message', async (message) => {
    const hostService = await slave.getService('HostService');
    return await hostService.handleMessage(message);
});
```

### 3. 小程序开发
```typescript
// 平台应用
const platform = new SappSDK({
    id: 'platform-app',
    type: 'master'
});

// 注册平台能力
@ServService()
class PlatformService {
    @ServAPI()
    async getLocation() {
        return { lat: 0, lng: 0 };
    }
}

// 小程序
const miniApp = new SappSDK({
    id: 'mini-app',
    type: 'slave'
});

// 使用平台能力
const platformService = await miniApp.getService('PlatformService');
const location = await platformService.getLocation();
```

## 快速开始

### 安装
```bash
npm install micro-rpckit
# 或
yarn add micro-rpckit
```

### 基础示例
```typescript
import { SappSDK, ServService, ServAPI } from 'micro-rpckit';

// 创建应用实例
const app = new SappSDK({
    id: 'my-app',
    type: 'master'
});

// 定义服务
@ServService()
class MyService {
    @ServAPI()
    async hello(name: string) {
        return `Hello, ${name}!`;
    }
}

// 初始化并启动
await app.init();
await app.start();
```

## 开发背景

* **GUI 应用 H5 化**
  * 传统原生应用向 H5 技术迁移
  * 需要处理更复杂的软件工程问题
  * 提供更好的开发体验和生产效率

* **云端化趋势**
  * 终端应用向云端迁移
  * 需要处理大规模工程问题
  * 提供更好的系统架构支持

* **开放能力需求**
  * 支持 SAAS 服务开放
  * 提供标准化的接入方案
  * 支持生态建设

## 贡献指南

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT


