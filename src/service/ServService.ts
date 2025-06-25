import { asyncThrowMessage, asyncThrow } from '../common/common';
import { ServTerminal } from '../terminal/ServTerminal';

export type ServACL = any;
export type ServEXT = any;

/**
 * Service声明注解参数；anno.decl
 *
 * @export
 * @interface ServDeclOptions
 */
export interface ServDeclOptions {
    /**
     * Service id, 服务的唯一标识，必需
     *
     * @type {string}
     * @memberof ServDeclOptions
     */
    id: string;

    /**
     * Service version, 服务版本号，必需
     *
     * @type {string}
     * @memberof ServDeclOptions
     */
    version: string;

    /**
     * Service粒度的访问权限控制列表(Access Control List)
     *
     * @type {ServACL}
     * @memberof ServDeclOptions
     */
    ACL?: ServACL;

    /**
     * Service的扩展数据，可用于附加自定义元数据
     *
     * @type {ServEXT}
     * @memberof ServDeclOptions
     */
    EXT?: ServEXT;

    /**
     * 是否需要Service版本校对，默认为true。如果设为true，客户端和服务端版本不匹配时可能导致调用失败。
     *
     * @type {boolean}
     * @memberof ServDeclOptions
     */
    noVersionCheck?: boolean;
    /**
     * 是否禁用RPC调用事件，默认为false。
     *
     * @type {boolean}
     * @memberof ServDeclOptions
     */
    noRPCCallEvent?: boolean;
}

/**
 * Service实现注解参数；anno.impl
 *
 * @export
 * @interface ServImplOptions
 */
export interface ServImplOptions {
    /**
     * 指定Service api中是否需要注入ServAPICallContext；默认为false。
     * 如果为true，在服务端实现API方法时，最后一个参数会是ServAPICallContext，包含调用方信息。
     *
     * @type {boolean}
     * @memberof ServImplOptions
     */
    needCallContext?: boolean;
}

/**
 * API 调用时，数据传输过程当中的序列化与反序列化处理器。
 * 用于在数据离开或到达当前终端时进行转换。
 */
export interface ServApiTransformOptions<T = any, R = any> {
    /**
     * 发送数据时，进行序列化操作。
     * @param args 原始数据
     * @returns 序列化后的数据
     */
    send: (args: T) => R;
    /**
     * 接收到数据时，进行反序列化操作。
     * @param rawArgs 接收到的原始数据
     * @returns 反序列化后的数据
     */
    recv: (rawArgs: R) => T;
}

/**
 * Service API 注解参数；anno.decl.api
 *
 * @export
 * @interface ServAPIOptions
 */
export interface ServAPIOptions {
    /**
     * API调用timeout设置，如果为小于等于0，则无timeout机制；
     * 默认为30s
     *
     * @type {number}
     * @memberof ServAPIOptions
     */
    timeout?: number;

    /**
     * API是否有返回值，默认为true。如果为true，则为"即发即忘"模式。
     *
     * @type {boolean}
     * @memberof ServAPIOptions
     */
    dontRetn?: boolean;

    /**
     * 对API的参数和结果提供的序列化能力；
     * API调用阶段的数据转换回调，这是Client方的回调处理；
     * 回调调用时序为 Client.onCallTransform.send -> send message to Server
     *              -> Server.onRetnTransform.recv
     *              -> impl process
     *              -> Server.onRetnTransform.send -> send message to Client
     *              -> Client.onCallTransform.recv
     *
     * @memberof ServAPIOptions
     *
     * send  API调用时发送阶段的转换回调，args为原始参数，返回值为最终发送给Server的数据
     *
     * recv  Client API接收阶段的转换回调，args为接收的原始数据，返回值为最终API返回的数据
     *
     */
    onCallTransform?: ServApiTransformOptions;

    /**
     * 对API的参数和结果提供的序列化能力；
     * API返回阶段的数据转换回调，这是Server方的回调处理
     *
     * @memberof ServAPIOptions
     *
     * send Server API处理后在发送阶段的转换回调，args为处理返回的原始数据，返回值为最终发送给Client的数据
     * recv Server API接收阶段的转换回调，args为Client发送的原始数据，返回值为最终处理函数的参数
     *
     */
    onRetnTransform?: ServApiTransformOptions;

    /**
     * API 粒度的访问权限
     *
     * @type {ServACL}
     * @memberof ServAPIOptions
     */
    ACL?: ServACL;

    /**
     * API 的扩展数据
     *
     * @type {ServEXT}
     * @memberof ServAPIOptions
     */
    EXT?: ServEXT;
}

/**
 * notify 形式的注解参数；anno.decl.notify；参加ServAPIOptions
 *
 * @export
 * @interface ServNotifyOptions
 */
export interface ServNotifyOptions {
    onCallTransform?: {
        send: (args: any) => any;
        recv: (rawArgs: any) => any;
    };
    ACL?: ServACL;
    EXT?: ServEXT;
}

/**
 * event 的注解参数；anno.event
 *
 * @export
 * @interface ServEventerOptions
 */
export interface ServEventerOptions {
    /**
     * event 的访问权限
     *
     * @type {ServACL}
     * @memberof ServEventerOptions
     */
    ACL?: ServACL;

    /**
     * event 的扩展数据
     *
     * @type {ServEXT}
     * @memberof ServEventerOptions
     */
    EXT?: ServEXT;
    /**
     * 对API的参数和结果提供的序列化能力；
     * API调用阶段的数据转换回调，这是Client方的回调处理；
     * 回调调用时序为 Client.onCallTransform.send -> send message to Server
     *              -> Server.onRetnTransform.recv
     *              -> impl process
     *              -> Server.onRetnTransform.send -> send message to Client
     *              -> Client.onCallTransform.recv
     *
     * @memberof ServAPIOptions
     */
    transform?: ServApiTransformOptions;
}

const DEFAULT_SERV_API_OPTIONS: ServAPIOptions = {};
const DEFAULT_NOTIFY_API_OPTIONS: ServAPIOptions = { dontRetn: true };
const DEFAULT_SERV_EVENTER_OPTIONS: ServEventerOptions = {};

/**
 * API 调用options参数，只有在Service Client端调用有效
 *
 * @export
 * @interface ServAPICallOptions
 */
export interface ServAPICallOptions {
    /**
     * API 调用的timeout，如果小于等于0，则无timeout机制
     *
     * @type {number}
     * @memberof ServAPICallOptions
     */
    timeout?: number;
}

/**
 * Service API执行期间的context，在needCallContext为true的Service中有效；只有在Service Server端调用有效
 *
 * @export
 * @interface ServAPICallContext
 */
export interface ServAPICallContext {
    /**
     * 发起调用的远端终端信息
     * @type {ServTerminal}
     */
    terminal: ServTerminal;
    /**
     * 附加数据，可用于在调用链路中传递额外信息
     * @type {*}
     */
    extData: any;
}

/**
 * Service API 签名
 *
 * @export
 * @interface ServAPI
 * @argument args API调用参数
 * @argument optionsOrContext 在Service Client端为options，在Service Server端为context；
 *  context只在RPC调用场景有效，如果直接通过service进行调用则无context信息
 * @template A 参数类型
 * @template R 结果类型
 */
export interface ServAPI<A, R = void> {
    (args: A, optionsOrContext?: ServAPICallOptions | ServAPICallContext): Promise<R>;
}

export type ServAPIArgs<A = void> = A;
export type ServAPIRetn<R = void> = Promise<R>;
export const API_UNSUPPORT = () => Promise.reject(new Error('unsupport'));
export const API_ERROR = (error?: any) => Promise.reject(error || new Error('unknown'));

export function API_SUCCEED(): Promise<any>;
export function API_SUCCEED<T>(data: Promise<T>): Promise<T>;
export function API_SUCCEED<T>(data: T): Promise<T>;
export function API_SUCCEED(data?: any) {
    return Promise.resolve(data);
}

export type ServEventListener<A = any> = (args: A) => void;
export type ServEventUnListener = () => void;

/**
 * Service event 类型，eventer用于在Service上做远程事件通知
 *
 * @export
 * @interface ServEventer
 * @template A
 */
export interface ServEventer<A = void> {
    on(listener: ServEventListener<A>): ServEventUnListener;
    once(listener: ServEventListener<A>): ServEventUnListener;
    emit(args: A): void;
}

export interface ServAPIMeta {
    name: string;
    options: ServAPIOptions;
}

export interface ServEventerMeta {
    name: string;
    options: ServEventerOptions;
}

export interface ServServiceMeta {
    id: string;
    version: string;
    ACL?: ServACL;
    EXT?: ServEXT;
    apis: ServAPIMeta[];
    evts: ServEventerMeta[];
    noVersionCheck?: boolean;
    noRPCCallEvent?: boolean;
}

/**
 * Service基类
 *
 * @export
 * @class ServService
 */
export class ServService {
    /**
     * 获取当前Service实例的元数据(meta)
     *
     * @returns {ServServiceMeta | undefined}
     * @memberof ServService
     */
    meta() {
        return meta(this);
    }

    /**
     * 获取当前Service实例的实现相关的元数据(impl meta)
     *
     * @returns {(ServServiceImplMeta | undefined)}
     * @memberof ServService
     */
    implMeta() {
        return implMeta(this);
    }

    /**
     * 根据ID获取Service，只能获取Service所在Manager中的服务。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @param {string} id
     * @returns {(T | undefined)}
     * @memberof ServService
     */
    getServiceByID<T extends ServService>(id: string): T | undefined {
        asyncThrowMessage('getServiceByID not injected or only server service valid');
        return undefined;
    }

    /**
     * 根据类型获取Service，只能获取Service所在Manager中的服务。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @param {T} decl
     * @returns {(InstanceType<T> | undefined)}
     * @memberof ServService
     */
    getService<T extends typeof ServService>(decl: T): InstanceType<T> | undefined;
    getService<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: InstanceType<M[key]> | undefined };
    getService() {
        asyncThrowMessage('getService not injected or only server service valid');
        return undefined as any;
    }

    /**
     * 根据类型获取Service（非空断言版），获取不到会抛出异常。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @param {T} decl
     * @returns {InstanceType<T>}
     * @memberof ServService
     */
    getServiceUnsafe<T extends typeof ServService>(decl: T): InstanceType<T>;
    getServiceUnsafe<M extends { [key: string]: typeof ServService }>(decls: M)
        : { [key in keyof M]: InstanceType<M[key]> };
    getServiceUnsafe() {
        asyncThrowMessage('getService not injected or only server service valid');
        return undefined as any;
    }

    /**
     * 根据类型获取Service，异步版本。当服务需要异步加载时使用。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @param {T} decl
     * @returns {Promise<InstanceType<T>>}
     * @memberof ServService
     */
    service<T extends typeof ServService>(decl: T): Promise<InstanceType<T>>;
    service<M extends { [key: string]: typeof ServService }>(decls: M)
        : Promise<{ [key in keyof M]: InstanceType<M[key]> }>;
    service() {
        asyncThrowMessage('service not injected or only server service valid');
        return API_UNSUPPORT();
    }

    /**
     * 根据类型获取Service，并执行回调。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @template R
     * @param {T} decl
     * @param {((service: InstanceType<T>) => R)} exec
     * @returns {(R | null)}
     * @memberof ServService
     */
    serviceExec<
        T extends typeof ServService,
        R>(
        decl: T,
        exec: ((service: InstanceType<T>) => R)): R | null;
    serviceExec<
        M extends { [key: string]: typeof ServService },
        R>(
        decls: M,
        exec: ((services: { [key in keyof M]: InstanceType<M[key]> }) => R)): R | null;
    serviceExec() {
        asyncThrowMessage('serviceExec not injected or only server service valid');
        return null;
    }

    /**
     * 根据ID获取Service，并执行回调。
     * 注意：这是一个桩函数(stub)，实际功能由ServiceManager在运行时注入。
     *
     * @template T
     * @template R
     * @param {string} id
     * @param {((service: T) => R)} exec
     * @returns {(R | null)}
     * @memberof ServService
     */
    serviceExecByID<T extends ServService, R>(id: string, exec: ((service: T) => R)): R | null {
        asyncThrowMessage('serviceExecByID not injected or only server service valid');
        return null;
    }

    /**
     * 获取Service类的元数据
     *
     * @static
     * @returns {(ServServiceMeta | undefined)}
     * @memberof ServService
     */
    static meta() {
        return meta(this);
    }

    /**
     * 获取Service类的实现相关的元数据
     *
     * @static
     * @returns {(ServServiceImplMeta | undefined)}
     * @memberof ServService
     */
    static implMeta() {
        return implMeta(this);
    }
}

(ServService as any).IS_SERV_SERVICE = true;
(ServService.prototype as any).IS_SERV_SERVICE = true;

const META = '__serv_service_meta';

/**
 * Service decl相关注解的集合类型
 *
 * @export
 * @interface ServAnnoDecl
 */
export interface ServAnnoDecl {
    (options: ServDeclOptions): ((cls: typeof ServService) => void);
    api: typeof api;
    notify: typeof notify;
    event: typeof event;
}

/**
 * Service impl相关注解的集合类型
 *
 * @export
 * @interface ServAnnoImpl
 */
export interface ServAnnoImpl {
    (options?: ServImplOptions): ((cls: typeof ServService) => void);
}

/**
 * @anno.decl
 * 服务声明装饰器，用于注解一个服务接口定义类（通常是抽象类）。
 * 它将 id, version 等元数据附加到类的原型上，用于框架识别和管理服务。
 *
 * @param {ServDeclOptions} options 服务声明的配置选项
 */
const decl: ServAnnoDecl = ((options: ServDeclOptions) => {
    return function(cls: typeof ServService) {
        try {
            if (!(cls as any).IS_SERV_SERVICE) {
                asyncThrowMessage(`The Service should extends from ServService.`);
                return;
            }
            const metas = meta(cls, true);
            if (!metas) {
                asyncThrowMessage(`Invalid Service class.`);
                return;
            }

            if (!options.id) {
                throw new Error('[RPCKIT] id is empty in service declaration');
            }

            if (!options.version) {
                throw new Error(`[RPCKIT] version is empty in ${options.id} service declaration`);
            }

            metas.id = options.id;
            metas.version = options.version;
            metas.ACL = options.ACL;
            metas.EXT = options.EXT;
            if (options.noVersionCheck) {
                metas.noVersionCheck = true;
            }
            if (options.noRPCCallEvent) {
                metas.noRPCCallEvent = true;
            }
        } catch (e) {
            asyncThrow(e);
        }
    };
}) as any;

/**
 * @anno.impl
 * 服务实现装饰器，用于注解一个服务的具体实现类。
 * 它会校验该类是否完整实现了接口声明的所有API，并可配置实现相关的选项。
 *
 * @param {ServImplOptions} [options] 服务实现的配置选项
 */
const impl: ServAnnoImpl = ((options?: ServImplOptions) => {
    return function(cls: any) {
        try {
            if (!(cls as any).IS_SERV_SERVICE) {
                asyncThrowMessage(`The Service should extends from ServService.`);
                return;
            }

            const metas = meta(cls);
            if (!metas) {
                asyncThrowMessage(`Invalid Service class.`);
                return;
            }
            const proto = cls.prototype;
            metas.apis.forEach((item) => {
                if (!proto.hasOwnProperty(item.name)) {
                    asyncThrowMessage(`The service impl forget to implement api [${item.name}].`);
                }
            });

            if (options) {
                const iplMeta = implMeta(cls, true);
                if (!iplMeta) {
                    asyncThrowMessage(`Invalid Service impl class.`);
                    return;
                }

                if (options.needCallContext) {
                    iplMeta.needCallContext = true;
                }
            }
        } catch (e) {
            asyncThrow(e);
        }
    };
}) as any;

/**
 * @anno.decl.api
 * Service api 注解，用于在服务声明类中标记一个方法为RPC接口。
 *
 * @param {ServAPIOptions} [options] API相关的配置选项，如超时时间、返回值等
 * @returns
 */
function api(options?: ServAPIOptions) {
    return function(proto: any, propKey: string) {
        try {
            const metas = meta(proto, true);
            if (!metas) {
                asyncThrowMessage(`Can't get meta in api [${propKey}].`);
                return;
            }

            const apis = metas.apis;

            let item = apis.find((evt) => evt.name === propKey);
            if (!item) {
                item = {
                    name: propKey,
                    options: DEFAULT_SERV_API_OPTIONS,
                };
                apis.push(item);
            }

            item.options = options ?? DEFAULT_SERV_API_OPTIONS;
        } catch (e) {
            asyncThrow(e);
        }
    };
}

/**
 * @anno.decl.notify
 * Service notify 注解, 是api({ dontRetn: true }) 的一种简写形式。
 * 用于声明一个"即发即忘"的通知型API，客户端调用后不会等待返回。
 *
 * @param {ServNotifyOptions} [options]
 * @returns
 */
function notify(options?: ServNotifyOptions) {
    let option = DEFAULT_NOTIFY_API_OPTIONS;
    if (options) {
        option = options;
        option.dontRetn = true;
    }
    return api(option);
}

/**
 * @anno.decl.event
 * Service event 注解, 用于在服务声明类中标记一个属性为事件发射器。
 *
 * @param {ServEventerOptions} [options] 事件相关的配置选项
 * @returns
 */
function event(options?: ServEventerOptions) {
    return function(proto: any, propKey: string) {
        try {
            const metas = meta(proto, true);
            if (!metas) {
                asyncThrowMessage(`Can't get meta in event [${propKey}].`);
                return;
            }

            const events = metas.evts;

            let item = events.find((evt) => evt.name === propKey);
            if (!item) {
                item = {
                    name: propKey,
                    options: DEFAULT_SERV_EVENTER_OPTIONS,
                };
                events.push(item);
            }

            item.options = options ?? DEFAULT_SERV_EVENTER_OPTIONS;

        } catch (e) {
            asyncThrow(e);
        }
    };
}

/**
 * 获取Service元数据；可通过Service对象、Service类或其原型进行获取。
 * 元数据存储在对象的 `__serv_service_meta` 属性中。
 *
 * @param {(typeof ServService | ServService)} obj
 * @param {boolean} [create] 如果为true且元数据不存在，则会创建一个新的元数据对象
 * @returns {(ServServiceMeta | undefined)}
 */
function meta(obj: typeof ServService | ServService, create?: boolean): ServServiceMeta | undefined {
    try {
        let objProto: object | undefined;
        if (typeof obj === 'object') {
            if ((obj as any).IS_SERV_SERVICE) {
                objProto = obj;
            }
        } else {
            objProto = obj.prototype;
        }

        if (!objProto) {
            asyncThrowMessage('Get meta from an invalid serv target!');
            return ;
        }
        let ret = (objProto as any)[META] as ServServiceMeta;
        if (create && !objProto.hasOwnProperty(META)) {
            let apis: ServAPIMeta[];
            let evts: ServEventerMeta[];
            if (ret) {
                apis = ret.apis.slice();
                evts = ret.evts.slice();
            } else {
                apis = [];
                evts = [];
            }
            ret = {
                id: '',
                version: '',
                apis,
                evts,
            };
            (objProto as any)[META] = ret;
        }

        return ret;
    } catch (e) {
        asyncThrow(e);
    }
}

const IMPL = '__serv_service_impl_meta';

/**
 * 获取Service impl相关meta数据。
 * 元数据存储在对象的 `__serv_service_impl_meta` 属性中。
 *
 * @param {(typeof ServService | ServService)} obj
 * @param {boolean} [create] 如果为true且元数据不存在，则会创建一个新的元数据对象
 * @returns {(ServServiceImplMeta | undefined)}
 */
function implMeta(obj: typeof ServService | ServService, create?: boolean): ServServiceImplMeta | undefined {
    try {
        let objProto: object | undefined;
        if (typeof obj === 'object') {
            if ((obj as any).IS_SERV_SERVICE) {
                objProto = obj;
            }
        } else {
            objProto = obj.prototype;
        }

        if (!objProto) {
            asyncThrowMessage('Get impl meta from an invalid serv target!');
            return ;
        }

        let ret = (objProto as any)[IMPL] as ServServiceImplMeta;
        if (create && !objProto.hasOwnProperty(IMPL)) {
            if (ret) {
                ret = {
                    ...ret,
                };
            } else {
                ret = {};
            }
            (objProto as any)[IMPL] = ret;
        }

        return ret;
    } catch (e) {
        asyncThrow(e);
    }
}

/**
 * Service impl相关meta数据
 *
 * @export
 * @interface ServServiceImplMeta
 */
export interface ServServiceImplMeta {
    /**
     * 指定Service api中是否需要ServAPICallContext；默认为false
     *
     * @type {boolean}
     * @memberof ServServiceImplMeta
     */
    needCallContext?: boolean;
}

decl.api = api;
decl.event = event;
decl.notify = notify;

/**
 * Service 相关注解
 */
export const anno = {
    decl,
    impl,
};
