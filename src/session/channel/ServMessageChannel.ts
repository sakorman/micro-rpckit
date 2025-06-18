import { ServChannel, ServChannelConfig, ServChannelPackage, ServChannelOpenOptions } from './ServChannel';

/**
 * 消息渠道配置接口
 * 用于同窗口内的模块间通信
 */
export interface ServMessageChannelConfig extends ServChannelConfig {
    /**
     * 自定义事件名前缀，默认为空
     */
    eventPrefix?: string;
    
    /**
     * 是否启用调试模式
     */
    debug?: boolean;
}

/**
 * ServMessageChannel 是一个简化的消息通信渠道。
 * 它主要用于同一个窗口内不同模块之间的通信，而不是跨窗口通信。
 * 
 * 特点：
 * 1. 无需复杂的窗口管理
 * 2. 直接基于当前窗口的 postMessage
 * 3. 简化的同步机制
 * 4. 适合测试和调试场景
 * 
 * 使用场景：
 * - 同窗口内的模块间通信
 * - 测试环境的简化通信
 * - 不需要跨窗口的特殊应用场景
 */
export class ServMessageChannel extends ServChannel {
    /**
     * 消息渠道配置
     */
    protected config: ServMessageChannelConfig;
    
    /**
     * 用于移除消息监听器的函数
     */
    private detachMessageChannel?: () => void;

    /**
     * 打开消息渠道
     * @param _options 打开选项（未使用，保持接口一致性）
     * @returns Promise，立即 resolve
     */
    async open(_options?: ServChannelOpenOptions): Promise<void> {
        if (!this.session) {
            throw new Error('Session is required to open channel');
        }

        if (this.isOpened()) {
            return Promise.resolve();
        }

        // 建立消息监听
        this.attachMessageChannel();
        
        // 立即启用收发功能
        this.sendable = true;

        return Promise.resolve();
    }

    /**
     * 关闭消息渠道
     */
    close(): void {
        if (!this.session) {
            return;
        }

        // 移除消息监听器
        this.detachMessageChannel?.();
        
        // 禁用收发功能
        this.sendable = false;
        this.recvable = false;
    }

    /**
     * 发送渠道消息包
     * @param msg 要发送的消息包
     * @returns 是否发送成功
     */
    protected sendChannelPackage(msg: ServChannelPackage): boolean {
        try {
            // 使用当前窗口的 postMessage 发送消息给自己
            // 这样可以利用消息队列的异步特性
            window.postMessage(msg, '*');
            return true;
        } catch (e) {
            if (this.config.debug) {
                console.error('[ServMessageChannel] Send failed:', e);
            }
            return false;
        }
    }

    /**
     * 建立消息监听
     */
    private attachMessageChannel(): void {
        // 添加消息监听器
        window.addEventListener('message', this.onWindowMessage, false);
        this.recvable = true;

        // 设置移除监听器的函数
        this.detachMessageChannel = () => {
            this.recvable = false;
            window.removeEventListener('message', this.onWindowMessage);
        };
    }

    /**
     * 窗口消息事件处理函数
     * @param event 消息事件
     */
    private onWindowMessage = (event: MessageEvent): void => {
        // 只处理来自当前窗口的消息
        if (event.source !== window || !event.data) {
            return;
        }
        
        // 将消息数据作为渠道包处理
        this.recvChannelPackage(event.data as ServChannelPackage);
    };
}
