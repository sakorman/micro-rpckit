import { ServMessage } from '../../message/type';
import { ServSession, ServSessionOpenOptions, ServSessionPackage } from '../ServSession';

export interface IServSessionState {
    open(session: ServSession, options?: ServSessionOpenOptions): Promise<void>;
    close(session: ServSession): void;
    sendMessage(session: ServSession, msg: ServMessage): Promise<void>;
    recvPackage(session: ServSession, pkg: ServSessionPackage): void;
} 
