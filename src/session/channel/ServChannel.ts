import { asyncThrow } from '../../common/common';
import { ServSession, ServSessionPackage } from '../ServSession';
import { EServTerminal } from '../../terminal/ServTerminal';

/**
 * 通信渠道类型枚举
 */
export enum EServChannel {
    WINDOW = 1,
    MESSAGE,
    EVENT,
    EVENT_LOADER,
}

/**
 * 通信渠道配置
 */
export interface ServChannelConfig {
    /**
     * 是否忽略发送方类型。如果为true，将不会在消息中添加Master/Slave标记。
     */
    ignoreSenderType?: boolean;
}

/**
 * 通信渠道打开选项
 */
export interface ServChannelOpenOptions {
    [key: string]: any;
}

/**
 * 对象形式的渠道消息包
 */
export interface ServChannelObjectPackage {
    /**
     * 消息标记，用于识别消息来源和会话
     */
    __mark__: string;
    /**
     * 原始会话数据包
     */
    data: ServSessionPackage;
}

/**
 * 渠道消息包，可以是字符串或对象
 */
export type ServChannelPackage = string | ServChannelObjectPackage;

/**
 * ServChannel 是一个抽象基类，为所有通信渠道提供基础功能。
 * 它处理消息的序列化、反序列化、标记和路由。
 */
export abstract class ServChannel {
    /**
     * 关联的服务会话
     */
    protected session: ServSession;
    /**
     * 渠道配置
     */
    protected config: ServChannelConfig;
    /**
     * 发送标记，用于标识发送方是Master还是Slave
     */
    protected sendMark: string;
    /**
     * 接收标记，用于识别期望的接收方是Master还是Slave
     */
    protected recvMark: string;
    /**
     * 渠道是否可接收消息
     */
    protected recvable: boolean;
    /**
     * 渠道是否可发送消息
     */
    protected sendable: boolean;
    /**
     * 最终用于字符串消息的发送标记
     */
    protected sendStringMark: string;
    /**
     * 最终用于字符串消息的接收标记
     */
    protected recvStringMark: string;

    /**
     * 初始化渠道
     * @param session 关联的服务会话
     * @param config 渠道配置
     */
    init(session: ServSession, config?: ServChannelConfig) {
        this.session = session;
        this.config = config || {};
        const sessionMark = `$$${session.getID()}$$`;

        if (this.config.ignoreSenderType) {
            this.sendMark = '';
            this.recvMark = '';
        } else {
            if (session.isMaster()) {
                this.sendMark = `$$${EServTerminal.MASTER}$$`;
                this.recvMark = `$$${EServTerminal.SLAVE}$$`;
            } else {
                this.sendMark = `$$${EServTerminal.SLAVE}$$`;
                this.recvMark = `$$${EServTerminal.MASTER}$$`;
            }

        }

        this.sendStringMark = sessionMark + this.sendMark;
        this.recvStringMark = sessionMark + this.recvMark;

        this.recvable = false;
        this.sendable = false;
    }

    /**
     * 释放渠道资源
     */
    release() {
        this.close();

        this.session = undefined!;
        this.config = undefined!;
        this.recvable = false;
        this.sendable = false;
    }

    /**
     * 检查渠道是否可接收消息
     */
    isRecvable() {
        return this.recvable;
    }

    /**
     * 检查渠道是否可发送消息
     */
    isSendable() {
        return this.sendable;
    }

    /**
     * 检查渠道是否已打开（可发送和接收）
     */
    isOpened() {
        return this.recvable && this.sendable;
    }

    /**
     * 发送会话消息包。
     * 它会首先尝试以对象形式发送，如果失败，则回退到字符串形式。
     * @param msg 要发送的会话消息包
     * @returns 是否成功发送
     */
    send(msg: ServSessionPackage) {
        if (!this.sendable) {
            return false;
        }

        let chnMsg: ServChannelPackage = this.toObjectPackage(msg);
        if (!chnMsg) {
            return false;
        }

        try {
            // 尝试直接发送对象消息
            if (this.sendChannelPackage(chnMsg)) {
                return true;
            }
        } catch (e) {
            asyncThrow(e);
        }

        // 尝试发送字符串消息
        chnMsg = this.toStringPackage(msg);
        if (chnMsg) {
            try {
                if (this.sendChannelPackage(chnMsg)) {
                    return true;
                }
            } catch (e) {
                asyncThrow(e);
            }
        }
        return false;
    }

    /**
     * 打开渠道。子类必须实现此方法。
     * @param options 打开选项
     */
    abstract open(options?: ServChannelOpenOptions): Promise<void>;
    /**
     * 关闭渠道。子类必须实现此方法。
     */
    abstract close(): void;

    /**
     * 将会话包转换为对象形式的渠道包
     * @param data 会话数据包
     * @returns 渠道对象包
     */
    protected toObjectPackage(data: ServSessionPackage): ServChannelObjectPackage {
        return {
            __mark__: this.sendStringMark,
            data,
        };
    }

    /**
     * 将会话包转换为字符串形式的渠道包
     * @param data 会话数据包
     * @returns 渠道字符串包
     */
    protected toStringPackage(data: ServSessionPackage): string {
        try {
            const rawData = JSON.stringify(data);
            return this.sendStringMark + rawData;
        } catch (e) {
            asyncThrow(e);
            return '';
        }
    }

    /**
     * 从对象形式的渠道包中解析出原始会话包
     * @param data 渠道对象包
     * @returns 原始会话包
     */
    protected frObjectPackage(data: ServChannelObjectPackage): ServSessionPackage | undefined {
        if (data.__mark__ !== this.recvStringMark) {
            return;
        }

        return data.data;
    }

    /**
     * 从字符串形式的渠道包中解析出原始会话包
     * @param data 渠道字符串包
     * @returns 原始会话包
     */
    protected frStringPackage(data: string): ServSessionPackage | undefined {
        if (!data.startsWith(this.recvStringMark)) {
            return;
        }

        data = data.substr(this.recvStringMark.length);
        return data ? JSON.parse(data) as ServSessionPackage : undefined;
    }

    /**
     * 从渠道消息包中解析出原始会话包
     * @param rawData 渠道消息包
     * @returns 原始会话包
     */
    protected frChannelPackage(rawData: ServChannelPackage): ServSessionPackage | undefined {
        try {
            if (rawData === undefined || rawData === null) {
                return;
            }
            const type = typeof rawData;
            if (type === 'object') {
                return this.frObjectPackage(rawData as ServChannelObjectPackage);
            } else if (type === 'string') {
                return this.frStringPackage(rawData as string);
            }
        } catch (e) {
            asyncThrow(e);
        }
    }

    /**
     * 发送渠道消息包。子类必须实现此方法以处理实际的发送逻辑。
     * @param msg 要发送的渠道消息包
     * @returns 是否成功发送
     */
    protected abstract sendChannelPackage(msg: ServChannelPackage): boolean;

    /**
     * 判断是否可以接收某个渠道消息包。可由子类重写以实现自定义过滤逻辑。
     * @param _msg 渠道消息包
     * @returns 是否可以接收
     */
    protected canRecvChannelPackage(_msg: ServChannelPackage): boolean {
        return true;
    }

    /**
     * 接收并处理渠道消息包。
     * 此方法由子类的事件监听器调用。
     * @param msg 接收到的渠道消息包
     */
    protected recvChannelPackage(msg: ServChannelPackage): void {
        if (!this.recvable) {
            return;
        }

        if (!this.canRecvChannelPackage(msg)) {
            return;
        }

        const data = this.frChannelPackage(msg);
        if (data === undefined) {
            return;
        }

        this.session.recvPackage(data);
    }
}
