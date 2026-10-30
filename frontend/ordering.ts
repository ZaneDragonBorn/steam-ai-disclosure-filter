import { FilterMode } from '../shared/settings';

export interface InsertionTarget {
    mode: FilterMode;
    side: 'before' | 'after';
}

/** Steam's CEF host may suppress HTML drag/drop. Pointer capture keeps reordering
 * local to the settings panel and avoids starting an OS/native drag operation. */
export class FilterOrderDrag {
    onDrop: (source: FilterMode, target: InsertionTarget) => void = () => {};
    onFeedback: (source: FilterMode | null, target: InsertionTarget | null) => void = () => {};
    private active?: {
        source: FilterMode;
        handle: HTMLElement;
        pointerId: number;
        startY: number;
        moved: boolean;
    };
    down(event: PointerEvent, handle: HTMLElement, source: FilterMode): void {
        if (source === 'off' || event.button !== 0) return;
        event.preventDefault();
        this.cancel();
        this.active = {
            source,
            handle,
            pointerId: event.pointerId,
            startY: event.clientY,
            moved: false,
        };
        handle.setPointerCapture?.(event.pointerId);
    }
    private target(event: PointerEvent): InsertionTarget | null {
        const active = this.active;
        if (!active) return null;
        const list = active.handle.closest('[data-aif-order-list]');
        const hit = active.handle.ownerDocument.elementFromPoint?.(event.clientX, event.clientY);
        if (!list || hit?.closest('[data-aif-order-list]') !== list) return null;
        if (hit.closest<HTMLElement>('[data-aif-order]')?.dataset.aifOrder === 'off') return null;
        const rows = [...list.querySelectorAll<HTMLElement>('[data-aif-order]')].filter(
            (row) => row.dataset.aifOrder !== 'off',
        );
        // Midpoints define insertion boundaries, including the gaps between cards.
        const row = rows.find((row) => {
            const box = row.getBoundingClientRect();
            return event.clientY < box.top + box.height / 2;
        });
        const anchor = row ?? rows[rows.length - 1];
        if (!anchor || anchor.dataset.aifOrder === active.source) return null;
        return {
            mode: anchor.dataset.aifOrder as FilterMode,
            side: row ? 'before' : 'after',
        };
    }
    move(event: PointerEvent): void {
        const active = this.active;
        if (!active || active.pointerId !== event.pointerId) return;
        if (Math.abs(event.clientY - active.startY) < 4 && !active.moved) return;
        active.moved = true;
        event.preventDefault();
        // Native settings panels can be narrow and independently scrollable.
        for (let node = active.handle.parentElement; node; node = node.parentElement) {
            if (node.scrollHeight <= node.clientHeight) continue;
            const style = node.ownerDocument.defaultView?.getComputedStyle(node);
            if (!style || !/(auto|scroll)/.test(style.overflowY)) continue;
            const box = node.getBoundingClientRect();
            if (event.clientY < box.top + 35) node.scrollTop -= 18;
            else if (event.clientY > box.bottom - 35) node.scrollTop += 18;
            break;
        }
        this.onFeedback(active.source, this.target(event));
    }
    up(event: PointerEvent): void {
        const active = this.active;
        if (!active || active.pointerId !== event.pointerId) return;
        const target = this.target(event);
        if (active.moved && target) this.onDrop(active.source, target);
        this.cancel();
    }
    cancel(): void {
        const active = this.active;
        this.active = undefined;
        if (active?.handle.hasPointerCapture?.(active.pointerId))
            active.handle.releasePointerCapture(active.pointerId);
        this.onFeedback(null, null);
    }
}
