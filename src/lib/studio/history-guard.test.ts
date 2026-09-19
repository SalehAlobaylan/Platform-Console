import { guardEditorHistory } from './history-guard';

describe('dirty editor history', () => {
    beforeEach(() => { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'guard-test' }); });
    it('preserves Next state and restores a cancelled Back without pushing', () => {
        history.replaceState({ __NA: true, tree: ['studio'] }, '', '/?tab=studio');
        const go = jest.spyOn(history, 'go').mockImplementation(() => undefined);
        const cleanup = guardEditorHistory(() => false);
        expect(history.state.__NA).toBe(true);
        const event = new PopStateEvent('popstate', { state: null });
        window.dispatchEvent(event);
        expect(go).toHaveBeenCalledWith(1);
        expect(history.state.tree).toEqual(['studio']);
        cleanup(); go.mockRestore();
    });
    it('allows confirmed Back and restores history methods on unmount', () => {
        const push = history.pushState;
        const go = jest.spyOn(history, 'go').mockImplementation(() => undefined);
        const cleanup = guardEditorHistory(() => true);
        window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        expect(go).not.toHaveBeenCalled();
        cleanup(); expect(history.pushState).toBe(push); go.mockRestore();
    });
});
