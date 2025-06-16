import { EServConstant, logSession } from '../../common/common';
import { ServMessage } from '../../message/type';
import { ServSession, ServSessionOpenOptions, ServSessionPackage } from '../ServSession';
import { ClosedState } from './ClosedState';
import { IServSessionState } from './IServSessionState';
import { OpenedState } from './OpenedState';
import { Deferred, DeferredUtil } from '../../common/Deferred';

interface PendingMessage {
    isSend?: boolean;
    sendDeferred?: Deferred<void>;
    message: ServMessage;
}

export class OpeningState implements IServSessionState {
    private openingPromise?: Promise<void>;
    private openingCancel?: () => void;
    private pendingQueue: PendingMessage[] = [];

    open(session: ServSession, options?: ServSessionOpenOptions): Promise<void> {
        if (this.openingPromise) {
            logSession(session, 'OPEN while OPENING');
            return this.openingPromise;
        }

        logSession(session, 'OPENING');

        let done = false;
        let timer: number | undefined;

        const doSafeWork = (work: () => void) => {
            if (done) { return; }
            done = true;
            this.openingCancel = undefined;
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            work();
        };

        const timeout = (options && options.timeout) || EServConstant.SERV_SESSION_OPEN_TIMEOUT;
        const pTimeout = timeout > 0 ? new Promise<void>((_, reject) => {
            const tout = setTimeout(() => {
                doSafeWork(() => {
                    logSession(session, 'OPENING TIMEOUT');
                    reject(new Error('timeout'));
                    session.setState(new ClosedState());
                    session.getChannel().close(); 
                });
            }, timeout);
            timer = tout as any;
        }) : undefined;

        let openPromise = session.getChannel().open({
            dontWaitSlaveEcho: !pTimeout,
        });

        if (options && options.waiting) {
            const waiting = options.waiting.catch(() => undefined);
            openPromise = Promise.all([openPromise, waiting]).then(() => undefined);
        }

        const p = openPromise.then(() => {
            doSafeWork(() => {
                logSession(session, 'OPENED');
                const openedState = new OpenedState();
                session.setState(openedState);
                this.flushPendingQueue(session);
            });
        }, (e: unknown) => {
            doSafeWork(() => {
                logSession(session, 'OPENING FAILED', e);
                session.setState(new ClosedState());
            });
            return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        });

        const pCancel = new Promise<void>((_, reject) => {
            this.openingCancel = () => {
                doSafeWork(() => {
                    logSession(session, 'OPENING CANCELLED');
                    reject(new Error('cancel'));
                    session.setState(new ClosedState());
                    session.getChannel().close();
                });
            };
        });

        const promises = [p, pCancel];
        if (pTimeout) { promises.push(pTimeout); }

        this.openingPromise = Promise.race(promises);

        const sessionChecker = pTimeout ? session.getSessionChecker() : undefined;
        if (sessionChecker) { 
            const checkOptions = session.getSessionCheckOptions();
            if (checkOptions) {
                sessionChecker.start(checkOptions);
            }
        }

        return this.openingPromise.then(() => {
            if (sessionChecker) { sessionChecker.startChecking(); }
        });
    }

    close(session: ServSession): void {
        logSession(session, 'CLOSE while OPENING');
        if (this.openingCancel) {
            this.openingCancel();
        } else {
            session.getChannel().close();
            session.setState(new ClosedState());
        }
        this.flushPendingQueue(session);
        this.openingPromise = undefined;

    }

    sendMessage(session: ServSession, msg: ServMessage): Promise<void> {
        const pending: PendingMessage = {
            isSend: true,
            message: msg,
            sendDeferred: DeferredUtil.create<void>(),
        };
        this.pendingQueue.push(pending);
        if (pending.sendDeferred) {
            return pending.sendDeferred;
        }
        return Promise.reject(new Error('Unknown error in pending message'));
    }

    recvPackage(session: ServSession, pkg: ServSessionPackage): void {
        const pending: PendingMessage = {
            message: pkg,
        };
        this.pendingQueue.push(pending);
    }

    private flushPendingQueue(session: ServSession) {
        const pendingQueue = this.pendingQueue;
        this.pendingQueue = [];

        if (session.getState() instanceof ClosedState) {
            pendingQueue.forEach((item) => {
                if (item.isSend && item.sendDeferred) {
                    item.sendDeferred.reject(new Error('Session not opened'));
                }
            });
        } else if (session.getState() instanceof OpenedState) {
            pendingQueue.forEach((item) => {
                if (item.isSend && item.sendDeferred) {
                    session.sendMessage(item.message).then((data) => {
                        item.sendDeferred?.resolve(data as undefined);
                    }, (error: unknown) => {
                        item.sendDeferred?.reject(error instanceof Error ? error : new Error(String(error)));
                    });
                } else {
                    session.recvPackage(item.message);
                }
            });
        }
    }
} 
