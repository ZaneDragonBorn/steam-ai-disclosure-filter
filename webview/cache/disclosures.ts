import { AIContentProvider, validAppId } from '../steam/provider';
interface Entry {
    value: boolean | null;
    expires: number;
    notes?: string;
}
/** Coalesces a render's IDs into batches; two batches may be in flight. */
export class DisclosureCache implements AIContentProvider {
    getNotes(id: number): string | undefined {
        return this.entries.get(id)?.notes ?? this.provider.getNotes?.(id);
    }
    getMetadata(id: number) {
        return this.provider.getMetadata?.(id);
    }
    private entries = new Map<number, Entry>();
    private pending = new Map<number, Promise<boolean | null>>();
    private queue: { id: number; resolve: (value: boolean | null) => void }[] = [];
    private active = 0;
    private stopped = false;
    private timer?: ReturnType<typeof setTimeout>;
    constructor(
        private readonly provider: AIContentProvider,
        private readonly enabled: () => boolean = () => true,
        private readonly now = Date.now,
        private readonly spacing = 25,
        private readonly capacity = 1000,
    ) {}
    hasAIDisclosure(id: number): Promise<boolean | null> {
        if (this.stopped || !validAppId(id)) return Promise.resolve(null);
        const entry = this.entries.get(id);
        if (entry && entry.expires > this.now()) return Promise.resolve(entry.value);
        const existing = this.pending.get(id);
        if (existing) return existing;
        const task = new Promise<boolean | null>((resolve) => this.queue.push({ id, resolve }));
        this.pending.set(id, task);
        this.schedule();
        return task;
    }
    private schedule(): void {
        if (this.stopped || this.timer || !this.queue.length || this.active >= 2) return;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.pump();
        }, this.spacing);
    }
    private pump(): void {
        while (this.active < 2 && this.queue.length) {
            const jobs = this.queue.splice(0, this.provider.hasAIDisclosures ? 40 : 1);
            const accepted = jobs.filter(() => !this.stopped && this.enabled());
            const ids = accepted.map((j) => j.id);
            this.active++;
            void (async () => {
                let values = new Map<number, boolean | null>();
                try {
                    if (ids.length)
                        values = this.provider.hasAIDisclosures
                            ? await this.provider.hasAIDisclosures(ids)
                            : new Map([[ids[0], await this.provider.hasAIDisclosure(ids[0])]]);
                } catch {
                    /* unavailable means visible */
                }
                for (const job of jobs) {
                    const value = this.stopped ? null : (values.get(job.id) ?? null);
                    if (!this.stopped) {
                        this.entries.delete(job.id);
                        this.entries.set(job.id, {
                            value,
                            notes: value === true ? this.provider.getNotes?.(job.id) : undefined,
                            expires:
                                this.now() +
                                (value === null ? 30_000 : value ? 86400_000 : 21600_000),
                        });
                    }
                    while (this.entries.size > this.capacity)
                        this.entries.delete(this.entries.keys().next().value!);
                    this.pending.delete(job.id);
                    job.resolve(value);
                }
            })().finally(() => {
                this.active--;
                this.schedule();
            });
        }
    }
    /** Settle queued callers immediately; an owner also cancels its provider. */
    stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
        this.timer = undefined;
        for (const job of this.queue.splice(0)) {
            this.pending.delete(job.id);
            job.resolve(null);
        }
        this.entries.clear();
    }
}
