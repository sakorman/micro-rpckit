import { logSession } from '../../common/common';
import { EServMessage, ServMessage } from '../../message/type';
import { ServSession, ServSessionPackage } from '../ServSession';
import { ClosedState } from './ClosedState';
import { IServSessionState } from './IServSessionState';

export class OpenedState implements IServSessionState {
    open(): Promise<void> {
        return Promise.reject(new Error('Session already opened'));
    }

    close(session: ServSession): void {
        session.getChannel().close();
        logSession(session, 'CLOSED');
        session.setState(new ClosedState());

        const sessionChecker = session.getSessionChecker();
        if (sessionChecker) {
            sessionChecker.stop();
        }
    }

    sendMessage(session: ServSession, msg: ServMessage): Promise<void> {
        try {
            if (msg.$type !== EServMessage.SESSION_HEARTBREAK) {
                logSession(session, 'Send', msg);
            }
            const ret = session.getChannel().send(msg);

            if (!ret) {
                return Promise.reject(new Error('Send failed'));
            }
            return Promise.resolve();
        } catch (e) {
            logSession(session, 'Send(ERROR)', e);
            return Promise.reject(e instanceof Error ? e : new Error(String(e)));
        }
    }

    recvPackage(session: ServSession, pkg: ServSessionPackage): void {
        if (typeof pkg !== 'object' || !pkg) {
            logSession(session, 'Recv(INVALID)', pkg);
            return;
        }
        try {
            session.dispatchMessage(pkg);
        } catch (e) {
            logSession(session, 'Recv(ERROR)', e);
        }
    }
} 
