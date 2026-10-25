/** A cached Back/Forward restore resumes the old document, not the preload.
 * Dispose page resources while away, then create one fresh session on restore. */
export function managePageLifecycle(win: Window, start: () => () => void): () => void {
    let disposeSession: (() => void) | undefined = start();
    let suspended = false,
        disposed = false;
    const release = () => {
        const cleanup = disposeSession;
        disposeSession = undefined;
        cleanup?.();
    };
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        suspended = false;
        win.removeEventListener('pagehide', hide);
        win.removeEventListener('pageshow', show);
        release();
    };
    const hide = (event: PageTransitionEvent) => {
        if (!event.persisted) {
            dispose();
            return;
        }
        suspended = true;
        release();
    };
    const show = (event: PageTransitionEvent) => {
        if (disposed || !suspended || !event.persisted) return;
        suspended = false;
        disposeSession = start();
    };
    win.addEventListener('pagehide', hide);
    win.addEventListener('pageshow', show);
    return dispose;
}
