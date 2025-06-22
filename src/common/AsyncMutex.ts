import { Deferred, DeferredUtil } from './Deferred';
export type AsyncMutexUnlock = () => void;

export interface AsyncMutexLock {
    deferred: Deferred<AsyncMutexUnlock>;
    unlock: AsyncMutexUnlock;
}

export interface AsyncMutexOptions {
    max?: number;
}

export class AsyncMutex {
    protected lockQueue: AsyncMutexLock[];
    protected lockMax: number;

    constructor(options?: AsyncMutexOptions) {
        this.lockMax = Math.min((options && options.max) || 1, 1);
        this.lockQueue = [];
    }

    lock(): Promise<AsyncMutexUnlock> {
        const lock = {
            deferred: DeferredUtil.create<AsyncMutexUnlock>(),
            unlock: () => {
                const i = this.lockQueue.indexOf(lock);
                if (i >= 0) {
                    this.lockQueue.splice(i, 1);
                }
                this.tryLock();
            },
        };

        this.lockQueue.push(lock);

        this.tryLock();

        return lock.deferred;
    }

    lockGuard<T extends (...args: any[]) => any>(func: T) {
        const self = this;
        const newFunc = async function(...args: Parameters<T>) {
            const unlock = await self.lock();
            try {
                return await func.apply(this, args);
            } finally {
                unlock();
            }
        };

        return newFunc;
    }

    protected tryLock() {
        if (this.lockMax === 1) {
            const lock = this.lockQueue[0];
            if (lock && !lock.deferred.isFinished()) {
                lock.deferred.resolve(lock.unlock);
            }
        } else {
            for (let i = 0, iz = this.lockMax; i < iz; ++i) {
                const lock = this.lockQueue[i];
                if (lock && !lock.deferred.isFinished()) {
                    lock.deferred.resolve(lock.unlock);
                }
            }
        }
    }
}
