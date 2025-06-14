import { ServServiceClient, ServServiceClientConfig } from '../service/ServServiceClient';
import { ServServiceServer, ServServiceServerConfig } from '../service/ServServiceServer';
import { Rpckit } from '../rpckit/Rpckit';
import { ServSession, ServSessionConfig, ServSessionOpenOptions } from '../session/ServSession';

export enum EServTerminal {
    NULL = 0,
    MASTER,
    SLAVE,
}
export interface ServTerminalConfig {
    id: string;
    type: EServTerminal;

    client?: ServServiceClientConfig;
    server?: ServServiceServerConfig;
    session: ServSessionConfig;
}

export class ServTerminal {
    id: string;
    type: EServTerminal;

    rpckit: Rpckit;

    client: ServServiceClient;
    server: ServServiceServer;
    session: ServSession;

    protected extData: any;

    constructor(rpckit: Rpckit) {
        this.rpckit = rpckit;
    }

    init(config: ServTerminalConfig) {
        this.id = config.id;
        this.type = config.type;

        this.session = new ServSession(this);
        this.server = new ServServiceServer(this);
        this.client = new ServServiceClient(this);

        this.session.init(config.session);
        this.server.init(config.server);
        this.client.init(config.client);
    }

    isMaster() {
        return this.type === EServTerminal.MASTER;
    }

    release() {
        this.client.release();
        this.server.release();
        this.session.release();

        delete this.extData;
    }

    setExtData<T>(data: T) {
        this.extData = data;
    }

    getExtData<T>(): T {
        return this.extData as T;
    }

    openSession(options?: ServSessionOpenOptions) {
        return this.session.open(options);
    }

    closeSession() {
        return this.session.close();
    }
}
