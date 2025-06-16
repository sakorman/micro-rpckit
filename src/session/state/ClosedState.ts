import { logSession } from '../../common/common';
import { ServMessage } from '../../message/type';
import { ServSession, ServSessionOpenOptions, ServSessionPackage } from '../ServSession';
import { IServSessionState } from './IServSessionState';
import { OpeningState } from './OpeningState';

export class ClosedState implements IServSessionState {
    open(session: ServSession, options?: ServSessionOpenOptions): Promise<void> {
        logSession(session, 'OPEN from CLOSED state');
        const openingState = new OpeningState();
        session.setState(openingState);
        return openingState.open(session, options);
    }

    close(session: ServSession): void {
        logSession(session, 'CLOSE while in CLOSED state');
        // Already closed, do nothing
    }

    sendMessage(session: ServSession, msg: ServMessage): Promise<void> {
        logSession(session, 'Send(NOOPEN)', msg);
        return Promise.reject(new Error('Session not opened'));
    }

    recvPackage(session: ServSession, pkg: ServSessionPackage): void {
        logSession(session, 'Recv(NOOPEN)', pkg);
        // Do nothing
    }
} 
