import { ServEventChannel } from './ServEventChannel';
import { ServChannelConfig, ServChannelPackage, ServChannelOpenOptions } from './ServChannel';
import { DeferredUtil } from '../../common/Deferred';
import { safeExec } from '../../common/common';

/**
 * 事件加载器接口，定义了动态加载资源的方法
 */
export interface ServEventLoader {
    /**
     * 执行加载操作，返回加载完成的Promise
     */
    load(): Promise<void>;
}

/**
 * 事件加载器渠道打开选项
 */
export interface ServEventLoaderChannelOpenOptions extends ServChannelOpenOptions {
    /**
     * 是否不等待 Slave 的 echo 响应，默认为 false
     */
    dontWaitSlaveEcho?: boolean;
}

/**
 * 事件加载器渠道配置
 */
export interface ServEventLoaderChannelConfig extends ServChannelConfig {
    /**
     * Master 端配置
     */
    master?: {
        /**
         * 是否不等待 echo 响应
         */
        dontWaitEcho?: boolean;
        
        /**
         * 创建加载器实例
         * @param channel 当前渠道实例
         * @returns 加载器实例
         */
        createLoader(channel: ServEventLoaderChannel): ServEventLoader;
        
        /**
         * 销毁加载器实例
         * @param loader 要销毁的加载器
         * @param channel 当前渠道实例
         */
        destroyLoader(loader: ServEventLoader, channel: ServEventLoaderChannel): void;
        
        /**
         * 加载器创建后的回调
         * @param loader 加载器实例
         * @param channel 当前渠道实例
         */
        onCreate?(loader: ServEventLoader, channel: ServEventLoaderChannel): void;
        
        /**
         * 渠道打开后的回调
         * @param loader 加载器实例
         * @param channel 当前渠道实例
         */
        onOpened?(loader: ServEventLoader, channel: ServEventLoaderChannel): void;
        
        /**
         * 打开错误时的回调
         * @param channel 当前渠道实例
         */
        onOpenError?(channel: ServEventLoaderChannel): void;
        
        /**
         * 加载器销毁时的回调
         * @param loader 加载器实例
         * @param channel 当前渠道实例
         */
        onDestroy?(loader: ServEventLoader, channel: ServEventLoaderChannel): void;
        
        /**
         * 渠道关闭时的回调
         * @param channel 当前渠道实例
         */
        onClosed?(channel: ServEventLoaderChannel): void;
        
        /**
         * 收到 Slave echo 时的回调
         * @param loader 加载器实例
         * @param channel 当前渠道实例
         */
        onEcho?(loader: ServEventLoader, channel: ServEventLoaderChannel): void;
    };
    
    /**
     * Slave 端配置（预留扩展）
     */
    slave?: {
        [key: string]: any;
    };
}

/**
 * ServEventLoaderChannel 是一个支持动态加载的事件渠道。
 * 它在 ServEventChannel 的基础上增加了资源加载和同步机制，
 * 主要用于主从架构下的动态资源加载场景。
 * 
 * 工作流程：
 * 1. Master 端：创建加载器 → 执行加载 → 等待 Slave echo → 开始通信
 * 2. Slave 端：直接发送 echo 信号 → 开始通信
 */
export class ServEventLoaderChannel extends ServEventChannel {
    /**
     * 加载器实例
     */
    protected loader: ServEventLoader;
    
    /**
     * 渠道配置，扩展了基础配置
     */
    protected config: ServEventLoaderChannelConfig;
    
    /**
     * 等待 Slave 清理工作的回调函数
     */
    protected doWaitSlaveCleanWork?: (() => void);
    
    /**
     * 尝试等待 Slave echo 的处理函数
     */
    protected tryWaitSlaveEcho?: (msg: ServChannelPackage) => void;
    
    /**
     * 打开渠道，支持动态加载和同步机制
     * @param options 打开选项
     * @returns Promise，在渠道完全打开后 resolve
     */
    async open(options?: ServEventLoaderChannelOpenOptions): Promise<void> {
        if (this.isOpened()) {
            return Promise.resolve();
        }

        // 先调用父类的 open 方法建立基础通信
        await super.open(options);

        options = options || {};
    
        // 初始状态下不可发送，等待加载完成
        this.sendable = false;
        
        if (this.session.isMaster()) {
            return this.openAsMaster(options);
        } else {
            return this.openAsSlave();
        }
    }

    /**
     * 作为 Master 端打开渠道
     * @param options 打开选项
     * @returns Promise
     */
    private async openAsMaster(options: ServEventLoaderChannelOpenOptions): Promise<void> {
        const master = this.config.master;
        if (!master) {
            throw new Error('Can\'t open channel without master config.');
        }

        // 等待 Slave echo 的 Promise
        const waitEcho = this.waitSlaveEcho(options);

        // 创建并初始化加载器
        const loader = master.createLoader(this);
        this.loader = loader;
        
        if (master.onCreate) {
            master.onCreate(loader, this);
        }

        try {
            // 执行加载操作
            await loader.load();
            
            // 等待 Slave echo
            await waitEcho;
            
            // 加载和同步都完成后，开启发送功能
            if (this.recvable) {
                this.sendable = true;
                
                if (master.onEcho) {
                    master.onEcho(loader, this);
                }

                if (master.onOpened) {
                    master.onOpened(loader, this);
                }
            }
        } catch (error) {
            // 处理加载或同步错误
            if (master.onOpenError) {
                safeExec(() => master.onOpenError!(this));
            }

            this.close();
            throw error;
        }
    }

    /**
     * 作为 Slave 端打开渠道
     * @returns Promise
     */
    private async openAsSlave(): Promise<void> {
        // Slave 端直接开启发送功能并发送 echo
        this.sendable = true;
        this.slaveEcho();
        return Promise.resolve();
    }

    /**
     * 关闭渠道，清理加载器和相关资源
     */
    close(): void {
        if (!this.session) {
            return;
        }

        const oldOpened = this.isOpened();

        // 调用父类的 close 方法
        super.close();

        // 清理加载器
        this.cleanupLoader();

        // 触发关闭回调
        if (oldOpened && this.session.isMaster() && this.config.master?.onClosed) {
            this.config.master.onClosed(this);
        }
    }

    /**
     * 接收渠道消息包，支持 echo 处理
     * @param msg 接收到的消息包
     */
    protected recvChannelPackage(msg: ServChannelPackage): void {
        // 如果正在等待 Slave echo，优先处理 echo
        if (this.tryWaitSlaveEcho) {
            this.tryWaitSlaveEcho(msg);
            return;
        }
        
        // 否则交给父类处理
        super.recvChannelPackage(msg);
    }

    /**
     * 清理加载器资源
     */
    private cleanupLoader(): void {
        if (this.loader && this.session.isMaster() && this.config.master) {
            if (this.config.master.onDestroy) {
                this.config.master.onDestroy(this.loader, this);
            }

            this.config.master.destroyLoader(this.loader, this);
            this.loader = undefined!;
        }
    }

    /**
     * 等待 Slave 的 echo 响应
     * @param options 打开选项
     * @returns Promise，在收到 echo 后 resolve
     */
    private waitSlaveEcho(options: ServEventLoaderChannelOpenOptions): Promise<void> {
        const master = this.config.master!;
        
        // 如果配置了不等待 echo，直接返回 resolved Promise
        if (master.dontWaitEcho || options.dontWaitSlaveEcho) {
            return Promise.resolve();
        }

        const wait = DeferredUtil.create<void>();
        const expectedEcho = `slaveecho$$${this.session.getID()}$$`;

        // 设置 echo 处理函数
        this.tryWaitSlaveEcho = (msg) => {
            if (msg !== expectedEcho) {
                return;
            }
            wait.resolve();
        };

        // 设置清理函数
        this.doWaitSlaveCleanWork = () => {
            this.tryWaitSlaveEcho = undefined;
        };

        // 返回带清理逻辑的 Promise
        return wait.finally(() => {
            if (this.doWaitSlaveCleanWork) {
                this.doWaitSlaveCleanWork();
                this.doWaitSlaveCleanWork = undefined;
            }
        });
    }

    /**
     * Slave 端发送 echo 信号
     */
    private slaveEcho(): void {
        const chnPkg = `slaveecho$$${this.session.getID()}$$`;
        this.sendChannelPackage(chnPkg);
    }
}
