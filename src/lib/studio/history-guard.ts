// Preserve Next's history state; only add a namespaced index while an editor is
// dirty. A cancelled Back/Forward traverses back to the original entry instead
// of pushing a replacement (which would destroy the forward history).
export function guardEditorHistory(confirmLeave: () => boolean): () => void {
    const history = window.history;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const owner = crypto.randomUUID();
    let index = 0;
    let restoring = false;
    const tagged = (state: unknown, position: number) => ({ ...(typeof state === 'object' && state ? state : {}), __wahbStudio: { owner, index: position } });
    originalReplace.call(history, tagged(history.state, index), '', window.location.href);
    const push: History['pushState'] = function(state, title, url) { originalPush.call(history, tagged(state, ++index), title, url); };
    const replace: History['replaceState'] = function(state, title, url) { originalReplace.call(history, tagged(state, index), title, url); };
    history.pushState = push;
    history.replaceState = replace;
    const pop = (event: PopStateEvent) => {
        if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
        const marker = event.state?.__wahbStudio;
        const target = marker?.owner === owner ? marker.index as number : index - 1;
        if (confirmLeave()) { index = target; return; }
        event.stopImmediatePropagation();
        restoring = true;
        history.go(index - target || 1);
    };
    window.addEventListener('popstate', pop, true);
    return () => {
        window.removeEventListener('popstate', pop, true);
        if (history.pushState === push) history.pushState = originalPush;
        if (history.replaceState === replace) history.replaceState = originalReplace;
    };
}
