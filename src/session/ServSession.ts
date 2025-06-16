/**
 * ServSession.ts
 * 会话管理模块 - 负责处理RPC通信的核心会话管理
 * 提供会话的创建、维护、消息收发等功能
 */

import { asyncThrow, EServConstant, logSession } from '../common/common';
import { ServSessionCallMessageCreator } from '../message/creator';
import { ServMessageContextManager } from '../message/ServMessageContextManager';
import { EServMessage, ServMessage, ServSessionCallMessage, ServSessionCallReturnMessage } from '../message/type';
import { ServTerminal } from '../terminal/ServTerminal';
import { EServChannel, ServChannel, ServChannelConfig } from './channel/ServChannel';
import { ServEventChannel, ServEventChannelConfig } from './channel/ServEventChannel';
import { ServMessageChannel, ServMessageChannelConfig } from './channel/ServMessageChannel';
import { ServWindowChannel, ServWindowChannelConfig } from './channel/ServWindowChannel';
import { ServSessionChecker, ServSessionCheckerStartOptions } from './ServSessionChecker';
import { ServEventLoaderChannel } from './channel/ServEventLoaderChannel';
import { IServSessionState } from './state/IServSessionState';
import { ClosedState } from './state/ClosedState';
import { OpenedState } from './state/OpenedState';

/**
 * 会话状态枚举
 * 用于标识会话的当前状态
 */
export enum EServSessionStatus {
    CLOSED = 0,    // 会话已关闭
    OPENING,      // 会话正在打开中
    OPENED,        // 会话已打开并可用
}

/**
 * 会话调用选项接口
 * 用于配置远程方法调用的参数
 */
export interface ServSessionCallOptions {
    timeout?: number;  // 调用超时时间（毫秒）
}

/**
 * 会话配置接口
 * 用于初始化会话时的配置参数
 */
export interface ServSessionConfig {
    checkSession?: boolean;  // 是否启用会话状态检查
    checkOptions?: ServSessionCheckerStartOptions;  // 会话检查的配置选项
    channel: {
        type: EServChannel | (new () => ServChannel);  // 通信通道类型
        config?: ServChannelConfig 
                | ServWindowChannelConfig 
                | ServMessageChannelConfig 
                | ServEventChannelConfig;  // 通道配置
    };
}

/**
 * 会话打开选项接口
 * 用于配置会话打开时的参数
 */
export interface ServSessionOpenOptions {
    timeout?: number;  // 打开超时时间（毫秒）
    waiting?: Promise<void>;  // 等待Promise，用于同步等待其他操作完成
}

/**
 * 会话消息包类型
 * 用于在会话间传递的消息格式
 */
export type ServSessionPackage = ServMessage;

/**
 * 会话消息接收监听器类型
 * 用于处理接收到的消息的回调函数
 */
export type ServSessionOnRecvMessageListener = (
    message: ServMessage,  // 接收到的消息
    session: ServSession,  // 当前会话实例
    terminal: ServTerminal,  // 终端实例
) => boolean;

/**
 * 会话调用消息接收监听器类型
 * 用于处理远程方法调用的回调函数
 */
export type ServSessionOnRecvCallMessageListener = (
    type: string,  // 调用类型
    args: any,  // 调用参数
    doReturn: ((data?: any, error?: any) => void),  // 返回结果的回调函数
    session: ServSession,  // 当前会话实例
    terminal: ServTerminal,  // 终端实例
) => boolean;

/**
 * 会话管理类
 * 负责管理RPC通信会话的核心类
 */
export class ServSession {
    protected terminal: ServTerminal;  // 终端实例
    protected state: IServSessionState;
    protected channel: ServChannel;  // 通信通道实例
    protected onRecvListeners: ServSessionOnRecvMessageListener[];  // 消息接收监听器列表
    protected onRecvCallListeners: ServSessionOnRecvCallMessageListener[];  // 调用消息接收监听器列表
    protected messageContextManager: ServMessageContextManager;  // 消息上下文管理器
    protected sessionChecker?: ServSessionChecker;  // 会话检查器
    protected sessionCheckOptions?: ServSessionCheckerStartOptions;  // 会话检查配置

    /**
     * 构造函数
     * @param terminal 终端实例
     */
    constructor(terminal: ServTerminal) {
        this.terminal = terminal;
        this.state = new ClosedState();
    }

    /**
     * 初始化会话
     * @param config 会话配置
     */
    init(config: ServSessionConfig) {
        this.onRecvListeners = [];
        this.onRecvCallListeners = [];
        this.initChannel(config.channel);
        this.messageContextManager = new ServMessageContextManager();
        this.messageContextManager.init();

        // 如果配置了会话检查，则初始化会话检查器
        if (config.checkSession) {
            const options = config.checkOptions || {};
            this.sessionCheckOptions = options;
            this.sessionChecker = new ServSessionChecker(this);

            // 设置默认的会话断开处理函数
            if (!options.onBroken) {
                options.onBroken = (session) => {
                    session.close();
                };
            }
        }
    }

    /**
     * 释放资源
     * 清理会话相关的所有资源
     */
    release() {
        this.close();
        this.messageContextManager.release();
        this.releaseChannel();
        this.onRecvListeners = [];
        this.onRecvCallListeners = [];
    }

    /**
     * 初始化通信通道
     * @param config 通道配置
     */
    protected initChannel(config: ServSessionConfig['channel']) {
        // 通道类型映射表
        const type2cls = {
            [EServChannel.WINDOW]: ServWindowChannel,
            [EServChannel.EVENT]: ServEventChannel,
            [EServChannel.MESSAGE]: ServMessageChannel,
            [EServChannel.EVENT_LOADER]: ServEventLoaderChannel,
        };
        // 根据配置的通道类型获取对应的通道类
        // 支持直接传入通道类或使用预定义的通道类型枚举
        const channelClass = typeof config.type === 'function' ? config.type : type2cls[config.type] ;

        this.channel = new channelClass();
        this.channel.init(this, config.config);
    }

    /**
     * 释放通信通道
     */
    protected releaseChannel() {
        this.channel.release();
    }

    /**
     * 判断是否是主终端
     * @returns 是否是主终端
     */
    isMaster() {
        return this.terminal.isMaster();
    }

    /**
     * 获取会话ID
     * @returns 会话ID
     */
    getID() {
        return this.terminal.rpckit.namespace
            ? this.terminal.rpckit.namespace + '-' + this.terminal.id
            : this.terminal.id;
    }

    /**
     * 判断会话是否已打开
     * @returns 是否已打开
     */
    isOpened() {
        return this.state instanceof OpenedState;
    }

    /**
     * 打开会话
     * @param options 打开选项
     * @returns Promise<void>
     */
    open(options?: ServSessionOpenOptions): Promise<void> {
        return this.state.open(this, options);
    }

    /**
     * 关闭会话
     */
    close() {
        this.state.close(this);
    }

    /**
     * 发送消息
     * @param msg 要发送的消息
     * @returns Promise<void>
     */
    sendMessage(msg: ServMessage): Promise<void> {
        return this.state.sendMessage(this, msg);
    }

    /**
     * 调用远程方法
     * @param type 调用类型
     * @param args 调用参数
     * @param options 调用选项
     * @returns Promise<T>
     */
    callMessage<T = any>(type: string, args?: any, options?: ServSessionCallOptions): Promise<T> {
        const message = ServSessionCallMessageCreator.create(type, args);
        let timeout: number = 0;
        if (options && options.timeout !== undefined) {
            timeout = options.timeout;
        } else {
            timeout = EServConstant.SERV_SESSION_CALL_MESSAGE_TIMEOUT;
        }
        const addOptions = {
            timeout,
            prewait: this.sendMessage(message),
        };

        let promise = this.messageContextManager.add(message, addOptions);
        if (!promise) {
            promise = this.messageContextManager.getPromise(message.$id);
        }

        if (!promise) {
            promise = Promise.reject(new Error('unknown'));
        }

        return promise;
    }

    /**
     * 处理返回消息
     * @param message 返回消息
     * @returns boolean
     */
    protected handleReturnMessage(message: ServSessionCallReturnMessage): boolean {
        if (message.error) {
            return this.messageContextManager.failed(message.$id, message.error);
        } else {
            return this.messageContextManager.succeed(message.$id, message.data);
        }
    }

    /**
     * 接收消息包
     * @param pkg 消息包
     */
    recvPackage(pkg: ServSessionPackage): void {
        this.state.recvPackage(this, pkg);
    }

    /**
     * 分发消息
     * @param msg 消息
     */
    dispatchMessage(msg: ServMessage): void {
        // 处理心跳消息
        if (this.sessionChecker && msg.$type === EServMessage.SESSION_HEARTBREAK) {
            this.sessionChecker.handleEchoMessage(msg);
            return;
        }

        logSession(this, 'Recv', msg);
        
        // 处理返回消息
        if (ServSessionCallMessageCreator.isCallReturnMessage(msg)) {
            this.handleReturnMessage(msg);
            return;
        }

        // 处理调用消息
        if (ServSessionCallMessageCreator.isCallMessage(msg)) {
            const callMsg = msg as ServSessionCallMessage;
            const doReturn = (data: any, error: any) => {
                void this.sendMessage(ServSessionCallMessageCreator.createReturn(callMsg, data, error));
            };
            if (this.onRecvCallListeners.length !== 0) {
                const callListeners = this.onRecvCallListeners;
                for (let i = 0, iz = callListeners.length; i < iz; ++i) {
                    try {
                        if (callListeners[i](callMsg.type, callMsg.args, doReturn, this, this.terminal)) {
                            return;
                        }
                    } catch (e) {
                        asyncThrow(e);
                    }
                }
            } 
            
            doReturn(undefined, `Unknow call type [${callMsg.type}]`);
            return;
        }

        // 处理普通消息
        if (this.onRecvListeners.length !== 0) {
            const listeners = this.onRecvListeners;
            for (let i = 0, iz = listeners.length; i < iz; ++i) {
                try {
                    listeners[i](msg, this, this.terminal);
                } catch (e) {
                    asyncThrow(e);
                }
            }
        }
    }

    /**
     * 注册消息接收监听器
     * @param listener 监听器函数
     * @returns 取消监听的函数
     */
    onRecvMessage(listener: ServSessionOnRecvMessageListener): () => void {
        const ret = () => {
            const i = this.onRecvListeners.indexOf(listener);
            if (i >= 0) {
                this.onRecvListeners.splice(i, 1);
            }
        };
        if (this.onRecvListeners.indexOf(listener) < 0) {
            this.onRecvListeners.push(listener);
        }

        return ret;
    }

    /**
     * 注册调用消息接收监听器
     * @param listener 监听器函数
     * @returns 取消监听的函数
     */
    onRecvCallMessage(listener: ServSessionOnRecvCallMessageListener): () => void {
        const ret = () => {
            const i = this.onRecvCallListeners.indexOf(listener);
            if (i >= 0) {
                this.onRecvCallListeners.splice(i, 1);
            }
        };
        if (this.onRecvCallListeners.indexOf(listener) < 0) {
            this.onRecvCallListeners.push(listener);
        }

        return ret;
    }

    setState(state: IServSessionState) {
        this.state = state;
    }

    getState() {
        return this.state;
    }

    getChannel() {
        return this.channel;
    }

    getSessionChecker() {
        return this.sessionChecker;
    }

    getSessionCheckOptions() {
        return this.sessionCheckOptions;
    }
}
