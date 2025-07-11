import { logACL, asyncThrow } from '../common/common';
import { ServServiceMessageCreator } from '../message/creator';
import {
    ServMessage,
    ServServiceAPIMessage,
    ServServiceMessage,
    ServServiceReturnMessage,
    ServServiceGetVersionReturnMessage,
    EServServiceMessage,
} from '../message/type';

import { ServTerminal } from '../terminal/ServTerminal';
import { ServService, ServAPICallContext } from './ServService';
import { ServServiceServerACLResolver } from './ServServiceServerACLResolver';
import {
    ServServiceConfig,
    ServServiceManager,
    ServServiceOnEmitListener,
    ServServiceOptions,
    ServServiceRefer,
    ServServiceReferPattern,
} from './ServServiceManager';

export interface ServServiceServerConfig {
    service?: ServServiceConfig;
    serviceRefer?: ServServiceReferPattern;
    ACLResolver?: ServServiceServerACLResolver;
}

/**
 * Service RPC 相关事件
 *
 * @export
 * @enum {number}
 */
export enum EServRPCEvent {
    /**
     * RPC处理事件；
     * 事件传递参数：API Return Promise，API Args，API Name，ServService，ServTerminal，Rpckit 
     */
    CALL = 'SERV_RPC_CALL',
}

export class ServServiceServer {
    terminal: ServTerminal;

    protected serviceManager: ServServiceManager;
    protected serviceRefer?: ServServiceRefer;
    protected ACLResolver?: ServServiceServerACLResolver;
    protected sessionUnlisten?: (() => void);

    constructor(terminal: ServTerminal) {
        this.terminal = terminal;
    }

    init(config?: ServServiceServerConfig) {
        config = config || {};

        this.serviceManager = new ServServiceManager();
        this.serviceManager.init(config.service);
        this.serviceManager.onEvnterEmit = this.onEventerEmit;
        this.ACLResolver = config.ACLResolver;

        if (config.serviceRefer) {
            this.serviceRefer = this.terminal.rpckit.service.referServices(config.serviceRefer);
            this.serviceRefer.onEvnterEmit = this.onEventerEmit;
        }

        this.sessionUnlisten = this.terminal.session.onRecvMessage(this.onRecvMessage);
    }

    release() {
        if (this.sessionUnlisten) {
            this.sessionUnlisten();
            this.sessionUnlisten = undefined;
        }

        if (this.serviceRefer) {
            this.serviceRefer.detach();
            this.serviceRefer = undefined;
        }
        this.serviceManager.release();

        delete this.ACLResolver;
    }

    getService<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: InstanceType<M[key]> | undefined };
    getService(decls?: any) {
        if (!decls) {
            return;
        }

        if (typeof decls === 'function') {
            return this._getService(decls);
        } else {
            const keys = Object.keys(decls);
            const services: { [key: string]: any } = {};
            for (let i = 0, iz = keys.length; i < iz; ++i) {
                services[keys[i]] = this._getService(decls[keys[i]]);
            }
            
            return services;
        }
    }

    getServiceUnsafe<T extends typeof ServService>(decl: T): InstanceType<T>;
    getServiceUnsafe<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: InstanceType<M[key]> };
    getServiceUnsafe(decls?: any) {
        const services = this.getService(decls);
        if (!services) {
            return asyncThrow('Get service failed');
        }
        return services;
    }

    service<T extends typeof ServService>(decl: T): Promise<InstanceType<T>>;
    service<M extends { [key: string]: typeof ServService }>(decls: M)
        : Promise<{ [key in keyof M]: InstanceType<M[key]> }>;
    service(decls?: any) {
        return Promise.resolve(this.getServiceUnsafe(decls));
    }

    serviceExec<
        T extends typeof ServService,
        R>(
        decl: T,
        exec: ((service: InstanceType<T>) => R));
    serviceExec<
        M extends { [key: string]: typeof ServService },
        R>(
        decls: M,
        exec: ((services: { [key in keyof M]: InstanceType<M[key]> }) => R));
    serviceExec(decls: any, exec: any) {
        const services = this.getService(decls);
        if (!services) {
            return null;
        }

        return exec(services);
    }

    serviceExecByID<T extends ServService, R>(id: string, exec: ((service: T) => R)): R | null {
        const service = this.getServiceByID<T>(id);
        if (!service) {
            return null;
        }

        return exec(service);
    }

    getServiceByID<T extends ServService>(id: string): T | undefined {
        let service = this.serviceManager.getServiceByID<T>(id);
        if (!service) {
            service = this.serviceRefer ? this.serviceRefer.getServiceByID(id) : undefined;
        }

        return service as T;
    }

    protected _getService<T extends typeof ServService>(decl: T): InstanceType<T> | undefined {
        const meta = decl.meta();
        if (!meta) {
            return;
        }

        return this.getServiceByID<InstanceType<T>>(meta.id);
    }

    addService<D extends typeof ServService, I extends D>(decl: D, impl: I, options?: ServServiceOptions): boolean {
        return this.serviceManager.addService(decl, impl, options);
    }

    addServices(
        items: Array<{ decl: typeof ServService, impl: typeof ServService, options?: ServServiceOptions }>,
        options?: ServServiceOptions,
    ): void {
        this.serviceManager.addServices(items, options);
    }

    protected onRecvMessage = (message: ServMessage): boolean => {
        // Only care about 'service message'
        if (!ServServiceMessageCreator.isServiceMessage(message)) {
            return false;
        }

        const servMessage = message as ServServiceMessage;
        if (ServServiceMessageCreator.isAPIMessage(servMessage)) {
            return this.handleAPIMessage(servMessage as ServServiceAPIMessage);
        } 

        if (ServServiceMessageCreator.isGetVersionMessage(servMessage)) {
            return this.handleGetVesionMessage(servMessage);
        }

        return false;
    };

    protected handleAPIMessage(message: ServServiceAPIMessage): boolean {
        const id = message.service;
        const service = this.getServiceByID<ServService>(id);

        let retnPromise: Promise<any>;
        
        if (!service) {
            retnPromise = Promise.reject(`Unknown service [${id}]`);
        } else {
            let args = message.args;
            const api = message.api;
            const meta = service.meta()!;
            const apiMeta = meta.apis.find((item) => item.name === api)!;
            if (typeof service[api] !== 'function') {
                retnPromise = Promise.reject(`Unknown api [${api}] in service ${id}`);
            } else {
                try {
                    if (this.ACLResolver) {
                        if (!this.ACLResolver.canAccessService(this, meta)) {
                            logACL(this, `API denied because of server ACL, [${id}][${api}]`);
                            // tslint:disable-next-line:no-string-throw
                            throw `Access service ${id} denied`;
                        } else if (!this.ACLResolver.canAccessAPI(this, meta, apiMeta)) {
                            logACL(this, `API denied because of api ACL, [${id}][${api}]`);
                            // tslint:disable-next-line:no-string-throw
                            throw `Access api ${api} denied in service ${id}`;
                        }
                    }
                    
                    if (apiMeta && apiMeta.options && apiMeta.options.onCallTransform) {
                        args = apiMeta.options.onCallTransform.recv(args);
                    }

                    const implMeta = service.implMeta();
                    let context: ServAPICallContext = undefined!;
                    if (implMeta && implMeta.needCallContext) {
                        context = {
                            terminal: this.terminal,
                            extData: this.terminal.getExtData(),
                        };
                    }
                    
                    retnPromise = Promise.resolve(service[api](args, context));
                    if (apiMeta && apiMeta.options && apiMeta.options.onRetnTransform) {
                        retnPromise = retnPromise.then((data) => {
                            data = apiMeta.options!.onRetnTransform!.send(data);
                            return data;
                        });
                    }
                } catch (e) {
                    retnPromise = Promise.reject(e);
                }
            }

            // Trigger rpckit rpc event
            if (!meta.noRPCCallEvent) {
                try {
                    this.terminal.rpckit.emit(
                        EServRPCEvent.CALL,
                        retnPromise,
                        args,
                        api,
                        service,
                        this.terminal,
                        this.terminal.rpckit);
                } catch (e) {
                    asyncThrow(e);
                }
            }

            if (apiMeta && apiMeta.options && apiMeta.options.dontRetn) {
                return true;
            }
        }

        this.sendReturnMessage(retnPromise, message, ServServiceMessageCreator.createAPIReturn);

        return true;
    }

    protected handleGetVesionMessage(message: ServServiceGetVersionReturnMessage): boolean {
        const id = message.service;
        const service = this.getServiceByID<ServService>(id);

        let retnPromise: Promise<any>;
        
        if (!service) {
            retnPromise = Promise.reject(`Unknown service [${id}]`);
        } else {
            const meta = service.meta()!;
            retnPromise = Promise.resolve(meta.version);
        }
            
        this.sendReturnMessage(retnPromise, message, (origin, data, error) => {
            return ServServiceMessageCreator.createReturn(origin, EServServiceMessage.GET_VERSION_RETURN, data, error);
        });

        return true;
    }

    protected sendReturnMessage(
        retnPromise: Promise<any>,
        origin: ServServiceMessage,
        retnCreator: (message: ServServiceMessage, data?: any, error?: any) => ServServiceReturnMessage,
    ): void {
        retnPromise.then((data) => {
            const retnMesage = retnCreator(origin, data);
            this.sendMessage(retnMesage);
        }, (error) => {
            const retnMesage = retnCreator(origin, undefined, error);
            this.sendMessage(retnMesage);
        });
    }

    protected sendMessage(message: ServMessage): Promise<void> {
        return this.terminal.session.sendMessage(message);
    }

    protected onEventerEmit: ServServiceOnEmitListener = (serviceId, event, args) => {
        if (this.ACLResolver) {
            const service = this.getServiceByID<ServService>(serviceId);
            if (!service) {
                logACL(this, `Event denied because of server ACL, [${serviceId}][${event}]`);
                return;
            }
            const meta = service.meta();
            if (!meta || !this.ACLResolver.canAccessService(this, meta)) {
                logACL(this, `Event denied because of server ACL, [${serviceId}][${event}]`);
                return;
            } else {
                const evtMeta = meta.evts.find((item) => item.name === event);
                if (!evtMeta || !this.ACLResolver.canAccessEventer(this, meta, evtMeta)) {
                    logACL(this, `Event denied because of event ACL, [${serviceId}][${event}]`);
                    return;
                }
            }
        }

        const message = ServServiceMessageCreator.createEvent(serviceId, event, args);
        return this.sendMessage(message).catch(() => undefined);
    };
}
