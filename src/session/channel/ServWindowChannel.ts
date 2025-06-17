import { asyncThrow } from '../../common/common';
import { ServChannel, ServChannelConfig, ServChannelPackage, ServChannelOpenOptions } from './ServChannel';

/**
 * 窗口信息接口，描述通信目标窗口的完整信息
 */
export interface ServChannelWindow {
    /**
     * 目标窗口，用于发送消息
     */
    target: Window | null;
    /**
     * 当前窗口，用于接收消息
     */
    window: Window | null;
    /**
     * 目标域名，用于 postMessage 的 targetOrigin 参数
     */
    origin: string;
    /**
     * 如果是 iframe，这里保存对应的 iframe 元素
     */
    element?: HTMLIFrameElement;
}

/**
 * 创建窗口时返回的数据接口
 */
export interface ServChanleWindowData {
    /**
     * 目标窗口
     */
    target: Window | null;
    /**
     * 当前窗口
     */
    window?: Window;
    /**
     * 目标域名
     */
    origin?: string;
    /**
     * iframe 元素（如果适用）
     */
    element?: HTMLIFrameElement;
}

/**
 * 窗口渠道打开选项
 */
export interface ServWindowChannelOpenOptions extends ServChannelOpenOptions {
    /**
     * 是否不等待 Slave 的 echo 响应
     */
    dontWaitSlaveEcho?: boolean;
}

/**
 * 窗口渠道配置接口
 */
export interface ServWindowChannelConfig extends ServChannelConfig {
    /**
     * Master 端配置
     */
    master?: {
        /**
         * 是否不等待 echo 响应
         */
        dontWaitEcho?: boolean;
        
        /**
         * 创建目标窗口
         * @param channel 当前渠道实例
         * @returns 窗口数据
         */
        createWindow(channel: ServWindowChannel): ServChanleWindowData;
        
        /**
         * 销毁目标窗口
         * @param windowInfo 窗口信息
         * @param channel 当前渠道实例
         */
        destroyWindow(windowInfo: ServChannelWindow, channel: ServWindowChannel): void;
        
        /**
         * 窗口创建后的回调
         * @param windowInfo 窗口信息
         * @param channel 当前渠道实例
         */
        onCreate?(windowInfo: ServChannelWindow, channel: ServWindowChannel): void;
        
        /**
         * 渠道打开后的回调
         * @param windowInfo 窗口信息
         * @param channel 当前渠道实例
         */
        onOpened?(windowInfo: ServChannelWindow, channel: ServWindowChannel): void;
        
        /**
         * 打开错误时的回调
         * @param channel 当前渠道实例
         */
        onOpenError?(channel: ServWindowChannel): void;
        
        /**
         * 窗口销毁时的回调
         * @param windowInfo 窗口信息
         * @param channel 当前渠道实例
         */
        onDestroy?(windowInfo: ServChannelWindow, channel: ServWindowChannel): void;
        
        /**
         * 渠道关闭时的回调
         * @param channel 当前渠道实例
         */
        onClosed?(channel: ServWindowChannel): void;
        
        /**
         * 收到 Slave echo 时的回调
         * @param info 窗口信息
         * @param channel 当前渠道实例
         */
        onEcho?(info: ServChannelWindow, channel: ServWindowChannel): void;
    };
    
    /**
     * Slave 端配置
     */
    slave?: {
        /**
         * 获取窗口信息
         * @param channel 当前渠道实例
         * @returns 窗口数据
         */
        getWindow(channel: ServWindowChannel): ServChanleWindowData;
    };
}

/**
 * ServWindowChannel 是基于 Window.postMessage API 的通信渠道。
 * 它主要用于以下场景：
 * 1. 主窗口与 iframe 之间的通信
 * 2. 主窗口与弹出窗口之间的通信
 * 3. 跨域窗口之间的通信
 * 
 * 工作原理：
 * - Master 端：创建目标窗口 → 等待 Slave echo → 开始通信
 * - Slave 端：获取目标窗口 → 发送 echo → 开始通信
 */
export class ServWindowChannel extends ServChannel {
    /**
     * 窗口渠道配置
     */
    protected config: ServWindowChannelConfig;
    
    /**
     * 窗口信息，包含目标窗口、当前窗口等
     */
    protected windowInfo: ServChannelWindow;
    
    /**
     * 等待 Slave 清理工作的回调函数
     */
    protected doWaitSlaveCleanWork?: (() => void);
    
    /**
     * 用于移除消息监听器的函数
     */
    protected detachMessageChannel?: () => void;

    /**
     * 打开窗口渠道
     * @param options 打开选项
     * @returns Promise，在渠道完全打开后 resolve
     */
    async open(options?: ServWindowChannelOpenOptions): Promise<void> {
        if (!this.session) {
            throw new Error('Session is required to open channel');
        }

        if (this.isOpened()) {
            return Promise.resolve();
        }

        // 初始化窗口信息
        this.windowInfo = {
            target: null,
            window: null,
            origin: '*',
        };

        options = options || {};

        if (this.session.isMaster()) {
            return this.openAsMaster(options);
        } else {
            return this.openAsSlave(options);
        }
    }

    /**
     * 作为 Master 端打开渠道
     * @param options 打开选项
     * @returns Promise
     */
    private async openAsMaster(options: ServWindowChannelOpenOptions): Promise<void> {
        const master = this.config.master;
        if (!master) {
            throw new Error('Can\'t open channel without master config.');
        }

        try {
            // 等待 Slave echo
            const waitEcho = this.waitSlaveEcho(options);

            // 创建窗口
            const windowInfo = master.createWindow(this);
            this.windowInfo.target = windowInfo.target;
            this.windowInfo.window = windowInfo.window || window;
            this.windowInfo.origin = windowInfo.origin || '*';
            this.windowInfo.element = windowInfo.element;

            // 建立消息监听
            this.attachMessageChannel();
            
            // 触发创建回调
            if (master.onCreate) {
                master.onCreate(this.windowInfo, this);
            }

            // 等待 Slave 响应
            await waitEcho;
            
            // 启用发送功能
            if (this.recvable) {
                this.sendable = true;
                
                if (master.onEcho) {
                    master.onEcho(this.windowInfo, this);
                }

                if (master.onOpened) {
                    master.onOpened(this.windowInfo, this);
                }
            }
        } catch (error) {
            this.close();

            if (master.onOpenError) {
                master.onOpenError(this);
            }
            throw error;
        }
    }

    /**
     * 作为 Slave 端打开渠道
     * @param _options 打开选项（未使用）
     * @returns Promise
     */
    private async openAsSlave(_options: ServWindowChannelOpenOptions): Promise<void> {
        const slave = this.config.slave;
        const windowInfo = slave ? slave.getWindow(this) : undefined;
        
        // 设置窗口信息
        this.windowInfo.target = (windowInfo && windowInfo.target) || window.parent || window;
        this.windowInfo.window = (windowInfo && windowInfo.window) || window;
        this.windowInfo.origin = (windowInfo && windowInfo.origin) || '*';
        this.windowInfo.element = (windowInfo && windowInfo.element);

        // 建立消息监听
        this.attachMessageChannel();
        
        // 启用发送功能并发送 echo
        this.sendable = true;
        this.slaveEcho();
        
        return Promise.resolve();
    }

    /**
     * 关闭窗口渠道，清理所有资源
     */
    close(): void {
        if (!this.session) {
            return;
        }

        const oldOpened = this.isOpened();

        // 移除消息监听器
        this.detachMessageChannel?.();
        this.sendable = false;

        // 清理等待 echo 的资源
        this.cleanupWaitEcho();

        // 清理窗口资源
        this.cleanupWindow();

        // 触发关闭回调
        if (oldOpened && this.session.isMaster() && this.config.master?.onClosed) {
            this.config.master.onClosed(this);
        }
    }

    /**
     * 清理等待 echo 的资源
     */
    private cleanupWaitEcho(): void {
        if (this.doWaitSlaveCleanWork) {
            this.doWaitSlaveCleanWork();
            this.doWaitSlaveCleanWork = undefined;
        }
    }

    /**
     * 清理窗口资源
     */
    private cleanupWindow(): void {
        if (this.windowInfo.target || this.windowInfo.window) {
            if (this.session.isMaster() && this.config.master) {
                if (this.config.master.onDestroy) {
                    this.config.master.onDestroy(this.windowInfo, this);
                }
                this.config.master.destroyWindow(this.windowInfo, this);
            }

            this.windowInfo.target = null;
            this.windowInfo.window = null;
            this.windowInfo.origin = '';
            this.windowInfo.element = undefined;
        }
    }

    /**
     * 等待 Slave 的 echo 响应
     * @param options 打开选项
     * @returns Promise，在收到 echo 后 resolve
     */
    private waitSlaveEcho(options: ServWindowChannelOpenOptions): Promise<void> {
        const master = this.config.master!;
        
        // 如果配置了不等待 echo，直接返回 resolved Promise
        if (master.dontWaitEcho || options.dontWaitSlaveEcho) {
            return Promise.resolve();
        }

        let resolveEcho: () => void;
        const echoPromise = new Promise<void>((resolve) => {
            resolveEcho = resolve;
        });

        const expectedEcho = `slaveecho$$${this.session.getID()}$$`;

        // echo 消息处理函数
        const onSlaveEcho = (event: MessageEvent) => {
            // 忽略来自自己窗口的消息或空数据
            if ((event.source && event.source === this.windowInfo.window) || !event.data) {
                return;
            }

            const chnPkg = event.data as string;

            // 检查是否是期望的 echo 消息
            if (chnPkg !== expectedEcho) {
                return;
            }

            resolveEcho();
        };

        // 添加消息监听器
        window.addEventListener('message', onSlaveEcho, false);

        // 设置清理函数
        this.doWaitSlaveCleanWork = () => {
            window.removeEventListener('message', onSlaveEcho);
        };

        // 返回带自动清理的 Promise
        return echoPromise.finally(() => {
            this.cleanupWaitEcho();
        });
    }

    /**
     * Slave 端发送 echo 信号
     */
    private slaveEcho(): void {
        const chnPkg = `slaveecho$$${this.session.getID()}$$`;
        this.sendChannelPackage(chnPkg);
    }

    /**
     * 建立消息监听渠道
     */
    private attachMessageChannel(): void {
        const chnWindow = this.windowInfo.window;
        if (!chnWindow) {
            asyncThrow(new Error('[RPCKIT] No window, attachMessageChannel failed.'));
            return;
        }

        // 添加消息监听器
        chnWindow.addEventListener('message', this.onWindowMessage, false);
        this.recvable = true;

        // 设置移除监听器的函数
        this.detachMessageChannel = () => {
            this.recvable = false;
            chnWindow.removeEventListener('message', this.onWindowMessage);
        };
    }

    /**
     * 窗口消息事件处理函数
     * @param event 消息事件
     */
    private onWindowMessage = (event: MessageEvent): void => {
        // 忽略来自自己窗口的消息或空数据
        if ((event.source && event.source === this.windowInfo.window) || !event.data) {
            return;
        }
        
        // 将消息数据作为渠道包处理
        this.recvChannelPackage(event.data as ServChannelPackage);
    };

    /**
     * 发送渠道消息包
     * @param msg 要发送的消息包
     * @returns 是否发送成功
     */
    protected sendChannelPackage(msg: ServChannelPackage): boolean {
        const targetWindow = this.windowInfo.target;
        if (!targetWindow) {
            asyncThrow(new Error('[RPCKIT] No target window, package send failed.'));
            return false;
        }

        const targetOrigin = this.windowInfo.origin;

        try {
            // 使用 postMessage 发送消息
            targetWindow.postMessage(msg, targetOrigin);
            return true;
        } catch (e) {
            asyncThrow(e);
        }

        return false;
    }
}
