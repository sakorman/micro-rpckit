import { asyncThrow } from '../../common/common';
import { ServSession } from '../ServSession';
import { ServChannel, ServChannelConfig, ServChannelPackage, ServChannelOpenOptions } from './ServChannel';

/**
 * ServEventChannel 使用浏览器的 CustomEvent 机制在同一窗口内进行通信。
 * 它非常适合在主应用和其动态加载的、共享同一个 window 对象的子应用之间进行通信。
 */
export class ServEventChannel extends ServChannel {
    /**
     * 用于异步派发事件的Promise，确保事件发送的顺序。
     */
    protected asyncDispatchPromise: Promise<void>;

    /**
     * 初始化事件渠道。
     * @param session 关联的服务会话。
     * @param config 渠道配置。此渠道会强制 `ignoreSenderType` 为 false。
     */
    init(session: ServSession, config: ServChannelConfig) {
        // EventChannel must use sender type
        if (config && config.ignoreSenderType) {
            config.ignoreSenderType = false;
        }
        
        super.init(session, config);

        this.asyncDispatchPromise = Promise.resolve();
    }

    /**
     * 打开渠道，开始监听事件。
     * @param _options 打开选项（未使用）。
     */
    open(_options?: ServChannelOpenOptions): Promise<void> {
        if (!this.session) {
            return Promise.reject(new Error('unknown'));
        }

        if (this.isOpened()) {
            return Promise.resolve();
        }

        this.attachMessageChannel();
        this.sendable = true;

        return Promise.resolve();
    }

    /**
     * 关闭渠道，移除事件监听。
     */
    close(): void {
        if (!this.session) {
            return;
        }

        this.detachMessageChannel();
        this.sendable = false;
    }

    /**
     * 附加事件监听器。
     */
    protected attachMessageChannel() {
        window.addEventListener(this.recvStringMark, this.onEventMessage, false);
        this.recvable = true;
    }

    /**
     * 移除事件监听器。
     */
    protected detachMessageChannel() {
        this.recvable = false;
        window.removeEventListener(this.recvStringMark, this.onEventMessage);
    }

    /**
     * CustomEvent 的事件处理函数。
     * @param event 接收到的自定义事件。
     */
    protected onEventMessage = (event: CustomEvent) => {
        const pkg = event.detail;
        if (!pkg) {
            return;
        }

        this.recvChannelPackage(pkg as ServChannelPackage);
    };

    /**
     * 通过派发 CustomEvent 来发送渠道消息包。
     * @param pkg 要发送的渠道消息包。
     * @returns 总是返回 true，表示消息已进入派发队列。
     */
    protected sendChannelPackage(pkg: ServChannelPackage): boolean {
        this.asyncDispatchPromise.then(() => {
            const event = new CustomEvent(this.sendStringMark, { detail: pkg });
            window.dispatchEvent(event);
        }).catch(asyncThrow);

        return true;
    }
}
