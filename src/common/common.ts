import { ServSession } from '../session/ServSession';
import { ServServiceServer } from '../service/ServServiceServer';

export const Env = {
    DEV: false,
    JEST: false,
    SAPPSDK_MOCK: false,
};

try {
    if ((window as any).__$$rpckit) {
        // tslint:disable-next-line:no-console
        console.warn('\n\nRPCKIT WARNING!\n\nYOU HAVE MULTIPLE VERSIONS OF RPCKIT INSTALLED IN YOUR PROJECT!\n');
    }
    const LOCAL_ENV = '__$$rpckit';
    const __$$rpckit = {
        getLocalEnv: (key?: string) => {
            try {
                const jsonData = window.localStorage.getItem(LOCAL_ENV);
                const data = jsonData ? JSON.parse(jsonData) : {};
                return key ? data[key] : data;
            } catch (e) {
                //
            }
        },
        setLocalEnv: (key: string, val: any = true) => {
            try {
                const data = __$$rpckit.getLocalEnv();
                data[key] = val;
                window.localStorage.setItem(LOCAL_ENV, JSON.stringify(data));
                return data;
            } catch (e) {
                //
            }
        },
        enableDev: () => {
            __$$rpckit.setLocalEnv('DEV');
        },
        disableDev: () => {
            __$$rpckit.setLocalEnv('DEV', false);
        },
        enableSappSDKMock: () => {
            __$$rpckit.setLocalEnv('SAPPSDK_MOCK');
        },
        disableSappSDKMock: () => {
            __$$rpckit.setLocalEnv('SAPPSDK_MOCK', false);
        },
        Env,
    };
    const localEnv = __$$rpckit.getLocalEnv();
    Object.assign(Env, localEnv);

    (window as any).__$$rpckit = __$$rpckit;
} catch (e) {
    //
}

export const EServConstant = {
    SERV_SAPP_ON_START_TIMEOUT: 30000,
    SERV_COMMON_RETURN_TIMEOUT: 30000,
    SERV_API_TIMEOUT: 30000,
    SERV_SESSION_OPEN_TIMEOUT: 30000,
    SERV_SESSION_CALL_MESSAGE_TIMEOUT: 30000,
    SAPP_HIDE_MAX_TIME: 600000,
    SAPP_LIFECYCLE_TIMEOUT: 120000,
    SHOST_APP_ID: 'SHOST_APP_ID',
    SHOST_CREATE_TIMEOUT: 30000,
};

export function setServConstant(constans: Partial<typeof EServConstant>) {
    Object.assign(EServConstant, constans);
}

function logSessionImpl(session: ServSession, ...args: any[]) {
    const tag = `[RPCKIT][${session.getID()}][${session.isMaster() ? 'M' : 'S'}] `;
    let arg0 = args[0];
    if (typeof arg0 === 'string') {
        arg0 = tag + arg0;
        args[0] = arg0;
    } else {
        args.unshift(tag);
    }
    // tslint:disable-next-line:no-console
    console.log(...args);
}

function logServerACLImpl(server: ServServiceServer, ...args: any[]) {
    const tag = `[RPCKIT][${server.terminal.id}][${server.terminal.isMaster() ? 'M' : 'S'}] `;
    let arg0 = args[0];
    if (typeof arg0 === 'string') {
        arg0 = tag + arg0;
        args[0] = arg0;
    } else {
        args.unshift(tag);
    }
    // tslint:disable-next-line:no-console
    console.log(...args);
}

export let logSession = Env.DEV ? logSessionImpl : noop;
export let logACL = Env.DEV ? logServerACLImpl : noop;

export const setEnv = (env: Partial<typeof Env>) => {
    Object.assign(Env, env);

    logSession = Env.DEV ? logSessionImpl : noop;
    logACL = Env.DEV ? logServerACLImpl : noop;
};

export function noop() {
    //
}

export function asyncThrow(error: any) {
    try {
        if (!(error instanceof Error)) {
            error = new Error(error && error.toString ? error.toString() : 'unknown');
        }
        if (!Env.JEST) {
            setTimeout(() => {
                throw error;
            });
        } else {
            // tslint:disable-next-line:no-console
            console.log(error);
        }
    } catch (e) {
        //
    }
}

export function asyncThrowMessage(msg: string) {
    msg = `[RPCKIT] ${msg}`;
    asyncThrow(new Error(msg));
}

let nextId = 0;
const startTimestamp = Date.now();
export function nextUUID() {
    ++nextId;
    return `${startTimestamp}-${Date.now()}-${nextId}`;
}

export function safeExec<T extends (...args: any) => any>(func: T): ReturnType<T> {
    try {
        return func();
    } catch (e) {
        asyncThrow(e);
    }

    return undefined as any;
}

export function doWithTimeout<T = any>(
    timeout: number, 
    work: (pTimeout: Promise<void> | undefined) => Promise<T>,
): Promise<T> {
    let timer = 0;
    const pTimeout = timeout > 0 ? new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => {
            timer = 0;
            reject(new Error('timeout'));
        }, timeout) as any;
    }) : undefined;

    const pWork = work(pTimeout);
    let pDone = pWork;
    if (pTimeout) {
        pDone = Promise.race([pWork, pTimeout]).then(() => {
            if (timer) {
                clearTimeout(timer);
                timer = 0;
            }
        }, (error) => {
            if (timer) {
                clearTimeout(timer);
                timer = 0;
            }
            throw error;
        }) as any as Promise<T>;
    }

    return pDone;
}
