import { FilterMode } from '../shared/settings';

/** Steam's CEF host may suppress HTML drag/drop. Pointer capture keeps reordering
 * local to the settings panel and avoids starting an OS/native drag operation. */
export class FilterOrderDrag {
    onDrop: (source: FilterMode, target: FilterMode) => void = () => {};
    onFeedback: (source: FilterMode | null, target: FilterMode | null) => void = () => {};
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
    private target(event: PointerEvent): FilterMode | null {
        const active = this.active;
        if (!active) return null;
        const row = active.handle.ownerDocument
            .elementFromPoint?.(event.clientX, event.clientY)
            ?.closest<HTMLElement>('[data-aif-order]');
        const mode = row?.dataset.aifOrder;
        return mode &&
            mode !== 'off' &&
            row?.closest('[data-aif-order-list]') === active.handle.closest('[data-aif-order-list]')
            ? (mode as FilterMode)
            : null;
    }
    move(event: PointerEvent): void {
        const active = this.active;
        if (!active || active.pointerId !== event.pointerId) return;
        if (Math.abs(event.clientY - active.startY) < 4 && !active.moved) return;
        active.moved = true;
        event.preventDefault();
        this.onFeedback(active.source, this.target(event));
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
    }
    up(event: PointerEvent): void {
        const active = this.active;
        if (!active || active.pointerId !== event.pointerId) return;
        const target = this.target(event);
        if (active.moved && target && target !== active.source) this.onDrop(active.source, target);
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
