import { Rpckit, rpckit as defaultRpckit } from '../rpckit/Rpckit';
import { SappSDKAsyncLoadStartParams, SappSDKAsyncLoadDeclContext } from '../sapp/SappSDK';
//  Date.prototype.getTime 属于 JavaScript 原生对象的原型链
// 所有运行在同一页面的脚本（无论是否同仓库、同打包工具）都能访问到它
// 这里为什么不直接挂载到window呢？
// 1. 如果直接将共享内存挂载到 window 上（如 window.__servkit_shared），可能会与其他库的全局变量冲突
// 2. avaScript 中函数也是对象，允许为其附加自定义属性（不会影响函数本身的功能）。
const target = Date.prototype.getTime as any;

interface ShareParams {
    [key: string]: { [key: string]: any };
}

let sharedParams: ShareParams = target.__$rpckit_sharedParams;
if (!sharedParams) {
    sharedParams = {};
    target.__$rpckit_sharedParams = sharedParams;
}

const DEFAULT_RPCKIT_NAMESPACE = '__DEFAULT_RPCKIT__';

function getParamsPool(rpckit: Rpckit, create?: boolean) {
    const namesapce = rpckit.namespace || DEFAULT_RPCKIT_NAMESPACE;
    let pool = sharedParams[namesapce];
    if (!pool && create) {
        pool = {};
        sharedParams[namesapce] = pool;
    }

    return pool;
}

function delParamsPool(rpckit: Rpckit, create?: boolean) {
    const namesapce = rpckit.namespace || DEFAULT_RPCKIT_NAMESPACE;
    delete sharedParams[namesapce];
}

export function putSharedParams(rpckit: Rpckit, key: string, params: any) {
    const pool = getParamsPool(rpckit, true);
    pool[key] = params;
}

export function getSharedParams<T = any>(rpckit: Rpckit, key: string): T | undefined {
    const pool = getParamsPool(rpckit);
    return pool ? pool[key] : undefined;
}

export function delSharedParams(rpckit: Rpckit, key: string) {
    const pool = getParamsPool(rpckit);
    if (pool) {
        delete pool[key];
    }
}

export function popSharedParams<T = any>(rpckit: Rpckit, key: string): T | undefined  {
    const params = getSharedParams(rpckit, key);
    if (params !== undefined) {
        delSharedParams(rpckit, key);
    }

    return params;
}

function startParamsKey(id: string) {
    return `${id}-startParams`;
}

function declContextKey(id: string) {
    return `${id}-declContext`;
}

function globalKey(name: string, appId?: string) {
    return `${name}-${appId || ''}-global`;
}

export function putAsyncLoadStartParams(appId: string, params: SappSDKAsyncLoadStartParams) {
    return putSharedParams(defaultRpckit, startParamsKey(appId), params);
}

export function getAsyncLoadStartParams(appId: string) {
    return getSharedParams<SappSDKAsyncLoadStartParams>(defaultRpckit, startParamsKey(appId));
}

export function delAsyncLoadStartParams(appId: string) {
    return delSharedParams(defaultRpckit, startParamsKey(appId));
}

export function putAsyncLoadDeclContext(appId: string, context: SappSDKAsyncLoadDeclContext) {
    return putSharedParams(defaultRpckit, declContextKey(appId), context);
}

export function getAsyncLoadDeclContext(appId: string) {
    return getSharedParams<SappSDKAsyncLoadDeclContext>(defaultRpckit, declContextKey(appId));
}

export function delAsyncLoadDeclContext(appId: string) {
    return delSharedParams(defaultRpckit, declContextKey(appId));
}

/**
 * 注册全局对象，只在Async Load应用中可用
 *
 * @export
 * @param {*} val 全局对象
 * @param {string} name 全局对象名称
 * @param {string} [appId] 应用id
 * @returns
 */
export function putAsyncLoadGlobal(name: string, val: any, appId?: string) {
    return putSharedParams(defaultRpckit, globalKey(name, appId), val);
}

/**
 * 获取全局对象，只在Async Load应用中可用
 *
 * @export
 * @template T
 * @param {string} name
 * @param {string} [appId]
 * @returns
 */
export function getAsyncLoadGlobal<T = any>(name: string, appId?: string) {
    return getSharedParams<T>(defaultRpckit, globalKey(name, appId));
}

/**
 * 删除全局对象，只在Async Load应用中可用
 *
 * @export
 * @param {string} name
 * @param {string} [appId]
 * @returns
 */
export function delAsyncLoadGlobal(name: string, appId?: string) {
    return delSharedParams(defaultRpckit, globalKey(name, appId));
}
