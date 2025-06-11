import { EServTerminal, ServTerminal, ServTerminalConfig } from '../terminal/ServTerminal';
import { ServGlobalServiceConfig, ServGlobalServiceManager } from './ServGlobalServiceManager';
import { EventEmitter } from 'eventemitter3';

/**
 * Rpckit配置
 *
 * @export
 * @interface RpckitConfig
 */
export interface RpckitConfig {
    /**
     * 全局服务，也可在rpckit初始化后，手动添加
     *
     * @type {ServGlobalServiceConfig}
     * @memberof RpckitConfig
     */
    service?: ServGlobalServiceConfig;
}

export class Rpckit extends EventEmitter {
    private static instance: Rpckit | null = null;
    
    namespace: string;
    service: ServGlobalServiceManager;
    protected terminals: ServTerminal[];

    private constructor(namespace?: string) {
        super();
        this.namespace = namespace || '';
    }

    /**
     * 获取Rpckit单例实例
     */
    public static getInstance(namespace?: string): Rpckit {
        if (!Rpckit.instance) {
            Rpckit.instance = new Rpckit(namespace);
            Rpckit.instance.init();
        }
        return Rpckit.instance;
    }

    /**
     * 初始化
     * @param config 初始化配置 
     */
    init(config?: RpckitConfig) {
        config = config || {};
        
        this.terminals = [];
        
        this.service = new ServGlobalServiceManager();
        this.service.init(config && config.service);
    }

    /**
     * 释放资源
     */
    release() {
        const terminals = this.terminals;
        this.terminals = [];

        terminals.forEach((item) => {
            item.release();
        });

        this.service.release();
        Rpckit.instance = null;
    }

    /**
     * 创建终端
     * @param config 
     * @returns 
     */
    createTerminal(config: ServTerminalConfig) {
        if (!config || !config.id || !config.type) {
            throw new Error('[RPCKIT] Invalid terminal configuration: id and type are required.');
        }

        if (this.terminals.some((item) => {
            return item.id === config.id && item.type === config.type;
        })) {
            throw new Error(`[RPCKIT] Terminal [${config.id}:${config.type}] already exists.`);
        }

        const terminal = new ServTerminal(this);
        terminal.init(config);
        this.terminals.push(terminal);
        return terminal;
    }

    destroyTerminal(terminal: ServTerminal) {
        if (!terminal) {
            throw new Error('[RPCKIT] Cannot destroy undefined terminal.');
        }
        terminal.release();
    }

    onTerminalRelease(terminal: ServTerminal) {
        if (!terminal) {
            throw new Error('[RPCKIT] Cannot release undefined terminal.');
        }
        const i = this.terminals.indexOf(terminal);
        if (i >= 0) {
            this.terminals.splice(i, 1);
        }
    }

    /**
     * 获取所有终端
     */
    getTerminals(): ServTerminal[] {
        return [...this.terminals];
    }

    /**
     * 检查终端是否存在
     */
    hasTerminal(id: string, type: EServTerminal): boolean {
        return this.terminals.some(terminal => terminal.id === id && terminal.type === type);
    }

    /**
     * 获取指定终端
     */
    getTerminal(id: string, type: EServTerminal): ServTerminal | undefined {
        return this.terminals.find(terminal => terminal.id === id && terminal.type === type);
    }
}

// 导出单例实例
export const rpckit = Rpckit.getInstance();
