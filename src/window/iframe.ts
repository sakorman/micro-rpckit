import { ServChannelWindow, ServWindowChannelConfig } from '../session/channel/ServWindowChannel';

/**
 * iframe 显示策略枚举
 */
export enum EServIFrameShowPolicy {
    /** 不设置显示策略 */
    NULL = 0,        // 不设置显示策略
    /** 隐藏 iframe */
    HIDE,           // 隐藏 iframe
    /** 显示 iframe */
    SHOW,           // 显示 iframe
    /** 在收到回显时显示 iframe */
    SHOW_ON_ECHO,   // 在收到回显时显示 iframe
}

/**
 * iframe 窗口信息接口
 */
export interface ServIFrameWindowInfo {
    /** iframe 的容器元素 */
    container: HTMLElement;      // iframe 的容器元素
    /** iframe 元素本身 */
    element: HTMLIFrameElement;  // iframe 元素本身
    /** iframe 的窗口对象 */
    target: Window;             // iframe 的窗口对象
    /** 通信源 */
    origin: string;             // 通信源
}

/**
 * iframe 创建器配置接口
 */
export interface ServIFrameCreatorConfig {
    /** iframe 的 URL 地址或返回 URL 的函数 */
    url: string | (() => string);    // iframe 的 URL 地址或返回 URL 的函数
    /** iframe 的 ID */
    id?: string;                     // iframe 的 ID
    /** iframe 的显示策略 */
    showPolicy?: EServIFrameShowPolicy;  // iframe 的显示策略
    /** 通信源 */
    postOrigin?: string;             // 通信源
    /** iframe 的容器元素 */
    container?: HTMLElement;         // iframe 的容器元素
    /** iframe 的类名 */
    className?: string;              // iframe 的类名
    /** iframe 的样式 */
    style?: Partial<HTMLElement['style']>;  // iframe 的样式
    /** 显示 iframe 的回调函数 */
    show?: (element: HTMLIFrameElement, container?: HTMLElement) => void;  // 显示 iframe 的回调函数
    /** 隐藏 iframe 的回调函数 */
    hide?: (element: HTMLIFrameElement, container?: HTMLElement) => void;  // 隐藏 iframe 的回调函数
    /** iframe 创建时的回调函数 */
    onCreateWindow?(info: ServIFrameWindowInfo): void;    // iframe 创建时的回调函数
    /** iframe 销毁时的回调函数 */
    onDestroyWindow?(info: ServChannelWindow): void;      // iframe 销毁时的回调函数
    /** 创建时的回调函数 */
    onCreate?(info: ServChannelWindow): void;             // 创建时的回调函数
    /** 回显时的回调函数 */
    onEcho?(info: ServChannelWindow): void;               // 回显时的回调函数
    /** 打开时的回调函数 */
    onOpened?(info: ServChannelWindow): void;             // 打开时的回调函数
    /** 销毁时的回调函数 */
    onDestroy?(info: ServChannelWindow): void;            // 销毁时的回调函数
    /** 打开错误时的回调函数 */
    onOpenError?(): void;                                 // 打开错误时的回调函数
    /** 关闭时的回调函数 */
    onClosed?(): void;                                    // 关闭时的回调函数
    /** 超时时间（毫秒） */
    timeout?: number;                                     // 超时时间（毫秒）
    /** 重试次数 */
    retryCount?: number;                                  // 重试次数
    /** 重试延迟（毫秒） */
    retryDelay?: number;                                  // 重试延迟（毫秒）
    /** iframe 沙箱属性 */
    sandbox?: string;                                     // iframe 沙箱属性
    /** iframe 权限设置 */
    allow?: string;                                       // iframe 权限设置
    /** iframe 加载策略 */
    loading?: 'lazy' | 'eager';                           // iframe 加载策略
}

/**
 * iframe 工具类
 * 提供 iframe 的创建、管理和工具方法
 */
export class IFrameUtil {
    /** 默认超时时间（30秒） */
    private static readonly DEFAULT_TIMEOUT = 30000;
    /** 默认重试次数（3次） */
    private static readonly DEFAULT_RETRY_COUNT = 3;
    /** 默认重试延迟（1秒） */
    private static readonly DEFAULT_RETRY_DELAY = 1000;

    /**
     * 生成 iframe 创建器
     * @param config - iframe 创建器配置
     * @returns 返回 iframe 创建器配置
     */
    static generateCreator(config: ServIFrameCreatorConfig): ServWindowChannelConfig['master'] {
        // 设置默认的显示和隐藏函数
        const show = config.show ?? ((element: HTMLIFrameElement) => element.style.display = 'block');
        const hide = config.hide ?? ((element: HTMLIFrameElement) => element.style.display = 'none');
        const showPolicy = config.showPolicy ?? EServIFrameShowPolicy.SHOW;
        const container = config.container ?? document.body;

        return {
            /**
             * 创建 iframe 窗口
             * @returns 返回 iframe 窗口信息
             */
            createWindow: (): ServIFrameWindowInfo => {
                try {
                    const element: HTMLIFrameElement = document.createElement('iframe');
                    
                    // 设置基本属性
                    element.src = typeof config.url === 'function' ? config.url() : config.url;
                    if (config.id) {element.id = config.id;}
                    if (config.className) {element.className = config.className;}
                    
                    // 设置安全属性
                    if (config.sandbox) {element.sandbox = config.sandbox;}
                    if (config.allow) {element.allow = config.allow;}
                    if (config.loading) {element.loading = config.loading;}

                    // 应用样式
                    if (config.style) {
                        Object.assign(element.style, config.style);
                    }

                    // 设置显示策略
                    if (showPolicy !== EServIFrameShowPolicy.SHOW) {
                        hide(element, container);
                    } else {
                        show(element, container);
                    }

                    // 添加到容器
                    container.appendChild(element);

                    const ret: ServIFrameWindowInfo = {
                        container,
                        element,
                        target: element.contentWindow as Window,
                        origin: config.postOrigin || '*',
                    };

                    // 触发创建回调
                    config.onCreateWindow?.(ret);

                    return ret;
                } catch (error) {
                    console.error('Failed to create iframe:', error);
                    throw new Error(`Failed to create iframe: ${error.message}`);
                }
            },

            /**
             * 销毁 iframe 窗口
             * @param windowInfo - iframe 窗口信息
             */
            destroyWindow: (windowInfo: ServChannelWindow) => {
                try {
                    config.onDestroyWindow?.(windowInfo);

                    if (windowInfo.element) {
                        container.removeChild(windowInfo.element);
                    }
                } catch (error) {
                    console.error('Failed to destroy iframe:', error);
                    throw new Error(`Failed to destroy iframe: ${error.message}`);
                }
            },

            onCreate: config.onCreate,

            /**
             * 处理回显事件
             * @param info - iframe 窗口信息
             */
            onEcho: (info) => {
                if (showPolicy === EServIFrameShowPolicy.SHOW_ON_ECHO) {
                    show(info.element as HTMLIFrameElement, container);
                }
                config.onEcho?.(info);
            },

            onOpened: config.onOpened,
            onOpenError: config.onOpenError,
            onDestroy: config.onDestroy,
            onClosed: config.onClosed,
        };
    }

    /**
     * 等待 iframe 加载完成
     * @param element - iframe 元素
     * @param timeout - 超时时间（毫秒）
     * @returns Promise 对象
     */
    static async waitForIframeLoad(element: HTMLIFrameElement, timeout: number = this.DEFAULT_TIMEOUT): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Iframe load timeout'));
            }, timeout);

            element.onload = () => {
                clearTimeout(timer);
                resolve();
            };

            element.onerror = (error) => {
                clearTimeout(timer);
                reject(error);
            };
        });
    }

    /**
     * 重试操作
     * @param operation - 要重试的操作函数
     * @param retryCount - 重试次数
     * @param retryDelay - 重试延迟（毫秒）
     * @returns Promise 对象
     */
    static async retryOperation<T>(
        operation: () => Promise<T>,
        retryCount: number = this.DEFAULT_RETRY_COUNT,
        retryDelay: number = this.DEFAULT_RETRY_DELAY
    ): Promise<T> {
        let lastError: Error | undefined = undefined;
        
        for (let i = 0; i < retryCount; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (i < retryCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }
        
        throw lastError;
    }
}
