import { EServConstant, asyncThrow, asyncThrowMessage } from '../common/common';
import { ServServiceMessageCreator } from '../message/creator';
import { ServMessageContextManager } from '../message/ServMessageContextManager';
import { ServMessage, ServServiceEventMessage, ServServiceMessage, ServServiceReturnMessage, EServServiceMessage } from '../message/type';
import { ServTerminal } from '../terminal/ServTerminal';
import { ServEventerManager } from './event/ServEventerManager';
import { ServAPI, ServAPIMeta, ServServiceMeta, ServEventerMeta, ServService, ServAPICallOptions } from './ServService';

export interface ServServiceClientConfig {
    [key: string]: any;
}

export type IServClientService<T extends typeof ServService = any> = Omit<InstanceType<T>, keyof ServService>;

export class ServServiceClient {
    protected messageContextManager: ServMessageContextManager;
    protected eventerManager: ServEventerManager;
    protected services: { [key: string]: ServService };
    protected terminal: ServTerminal;
    protected sessionUnlisten?: (() => void);

    constructor(terminal: ServTerminal) {
        this.terminal = terminal;
    }

    init(config?: ServServiceClientConfig) {
        this.services = {};

        this.messageContextManager = new ServMessageContextManager();
        this.messageContextManager.init();

        this.eventerManager = new ServEventerManager();
        this.eventerManager.init();

        this.sessionUnlisten = this.terminal.session.onRecvMessage(this.onRecvMessage);
    }

    release() {
        if (this.sessionUnlisten) {
            this.sessionUnlisten();
            this.sessionUnlisten = undefined;
        }

        this.eventerManager.release();
        this.messageContextManager.release();
        this.services = {};
    }

    private _getService<T extends typeof ServService>(decl: T): InstanceType<T> | undefined {
        const metas = decl.meta();
        if (!metas) {
            return;
        }

        const id = metas.id;
        let service: ServService | undefined = this.services[id];
        if (service) {
            return service as InstanceType<T>;
        }

        service = this.generateService(decl);
        if (service) {
            this.services[id] = service;
        }

        if (!metas.noVersionCheck) {
            this.checkServiceVersion(metas);
        }
        
        return service as InstanceType<T>;
    }

    getService<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: IServClientService<M[key]> | undefined };
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

    getServiceUnsafe<T extends typeof ServService>(decl: T): IServClientService<T>;
    getServiceUnsafe<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: IServClientService<M[key]> };
    getServiceUnsafe(decls?: any) {
        const services = this.getService(decls);
        if (!services) {
            return asyncThrowMessage('Get service failed');
        }
        return services;
    }

    service<T extends typeof ServService>(decl: T): Promise<IServClientService<T>>;
    service<M extends { [key: string]: typeof ServService }>(decls: M)
        : Promise<{ [key in keyof M]: IServClientService<M[key]> }>;
    service(decls?: any) {
        return Promise.resolve(this.getServiceUnsafe(decls));
    }

    serviceExec<
        T extends typeof ServService,
        R>(
            decl: T,
            exec: ((service: IServClientService<T>) => R)
        );
    serviceExec<
        M extends { [key: string]: typeof ServService },
        R>(
            decls: M,
            exec: ((services: { [key in keyof M]: IServClientService<M[key]> }) => R)
        );
    serviceExec(decls: any, exec: any) {
        const services = this.getService(decls);
        if (!services) {
            return null;
        }

        return exec(services);
    }

    protected checkServiceVersion(service: ServServiceMeta) {
        this.sendCommonMessageForReturn(
            ServServiceMessageCreator.create(EServServiceMessage.GET_VERSION, service.id),
            -1)
            .then((curVersion) => {
                const version = service.version;
                if (curVersion !== version) {
                    asyncThrowMessage(`${service.id} curren version is ${curVersion}, but ${version} is used in your projet now, Please update your service npm package.`);
                }
            }, (error) => {
                asyncThrow(error);
            });
    }

    private generateService<T extends typeof ServService>(decl: T): InstanceType<T> | undefined {
        const metas = decl.meta();
        if (!metas) {
            return;
        }

        const obj = new decl();
        const id = metas.id;

        metas.apis.forEach((item) => {
            obj[item.name] = this.generateServiceAPI(id, item);
        });

        metas.evts.forEach((item) => {
            obj[item.name] = this.generateServiceEvent(id, item);
        });

        return obj as any;
    }

    private generateServiceAPI(service: string, meta: ServAPIMeta) {
        const self = this;
        const ret: ServAPI<any> = function(args, options?: ServAPICallOptions) {
            if (meta.options && meta.options.onCallTransform) {
                args = meta.options.onCallTransform.send(args);
            }

            let timeout: number = undefined!;
            if (options && options.timeout !== undefined) {
                timeout = options.timeout;
            } else if (meta.options && meta.options.timeout !== undefined) {
                timeout = meta.options.timeout;
            } else {
                timeout = EServConstant.SERV_API_TIMEOUT;
            }

            const message = ServServiceMessageCreator.createAPI(service, meta.name, args);
            if (meta.options && meta.options.dontRetn) {
                return self.sendMessage(message);
            }

            const addOptions = {
                timeout,
                prewait: self.sendMessage(message),
                ctxData: meta,
            };

            let promise = self.messageContextManager.add(message, addOptions);
            if (!promise) {
                promise = self.messageContextManager.getPromise(message.$id);
            }

            if (!promise) {
                promise = Promise.reject(new Error('unknown'));
            }

            return promise;
        };

        return ret;
    }

    private generateServiceEvent(service: string, meta: ServEventerMeta) {
        return this.eventerManager.spawn(service, meta.name, meta.options.transform);
    }

    private sendMessage(message: ServMessage): Promise<void> {
        return this.terminal.session.sendMessage(message);
    }

    protected onRecvMessage = (message: ServMessage): boolean => {
        // handle return message
        if (!ServServiceMessageCreator.isServiceMessage(message)) {
            return false;
        }

        const origin = this.messageContextManager.get(message.$id);
        if (origin) {
            if (ServServiceMessageCreator.isAPIReturnMessage(
                message as ServServiceReturnMessage,
                origin as ServServiceMessage)) {
                return this.handleAPIReturnMessage(
                    message as ServServiceReturnMessage,
                    origin as ServServiceMessage,
                );
            } else if (ServServiceMessageCreator.isGetVersionReturnMessage(
                message as ServServiceReturnMessage,
                origin as ServServiceMessage)) {
                return this.handleCommonMessageReturn(
                    message as ServServiceReturnMessage,
                    origin as ServServiceMessage,
                );
            }
        }

        if (ServServiceMessageCreator.isEventMessage(message as ServServiceMessage)) {
            return this.handleEventMessage(message as ServServiceEventMessage);
        }

        return false;
    };

    protected handleAPIReturnMessage(message: ServServiceReturnMessage, origin: ServServiceMessage): boolean {
        if (message.error) {
            return this.messageContextManager.failed(message.$id, message.error);
        } else {
            let data = message.data;
            const meta = this.messageContextManager.getCtxData<ServAPIMeta>(message.$id);
            if (meta && meta.options && meta.options.onRetnTransform) {
                data = meta.options.onRetnTransform.recv(data);
            }
            return this.messageContextManager.succeed(message.$id, data);
        }
    }

    protected sendCommonMessageForReturn(
        message: ServServiceMessage,
        timeout: number = EServConstant.SERV_COMMON_RETURN_TIMEOUT,
    ) {
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

    protected handleCommonMessageReturn(message: ServServiceReturnMessage, origin: ServServiceMessage): boolean {
        if (message.error) {
            return this.messageContextManager.failed(message.$id, message.error);
        } else {
            return this.messageContextManager.succeed(message.$id, message.data);
        }
    }

    protected handleEventMessage(message: ServServiceEventMessage): boolean {
        this.eventerManager.rawEmit(message.service, message.event, message.args);
        return true;
    }
}
