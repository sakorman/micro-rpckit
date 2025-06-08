import { asyncThrow } from '../common/common';
import { ServTerminal, ServTerminalConfig } from '../terminal/ServTerminal';
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
    namespace: string;

    service: ServGlobalServiceManager;

    protected terminals: ServTerminal[];

    constructor(namespace?: string) {
        super();

        this.namespace = namespace || '';
    }

    init(config?: RpckitConfig) {
        config = config || {};
        
        this.terminals = [];
        
        this.service = new ServGlobalServiceManager();
        this.service.init(config && config.service);
    }

    release() {
        const terminals = this.terminals;
        this.terminals = [];

        terminals.forEach((item) => {
            item.release();
        });

        this.service.release();
    }

    createTerminal(config: ServTerminalConfig) {
        if (this.terminals.some((item) => {
            return item.id === config.id && item.type === config.type;
        })) {
            throw new Error(`[SERVKIT] Terminal [${config.id}:${config.type}] conflicts.`);
        }

        const terminal = new ServTerminal(this);
        terminal.init(config);

        return terminal;
    }

    destroyTerminal(terminal: ServTerminal) {
        terminal.release();
    }

    onTerminalInit(terminal: ServTerminal) {
        this.terminals.push(terminal);
    }

    onTerminalRelease(terminal: ServTerminal) {
        const i = this.terminals.indexOf(terminal);
        if (i >= 0) {
            this.terminals.splice(i, 1);
        }
    }
}

let sInstance: Rpckit = undefined!;
try {
    sInstance = new Rpckit();
    sInstance.init();
} catch (e) {
    asyncThrow(e);
}

export const rpckit = sInstance;
