import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Keep repeated keys and string-valued bookmarks compatible with the Console's
// existing URLSearchParams readers and writers.
function parseSearch(search: string) {
    const result: Record<string, string | string[]> = Object.create(null);
    for (const [name, value] of new URLSearchParams(search)) {
        const previous = result[name];
        result[name] = previous === undefined ? value : ([] as string[]).concat(previous, value);
    }
    return result;
}

function stringifySearch(search: Record<string, unknown>) {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(search)) {
        for (const part of Array.isArray(value) ? value : [value]) {
            if (part !== undefined) params.append(name, String(part));
        }
    }
    const query = params.toString();
    return query ? `?${query}` : '';
}

export function getRouter() {
    return createRouter({
        routeTree,
        defaultPreload: 'intent',
        defaultPendingMinMs: 0,
        parseSearch,
        stringifySearch,
    });
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}
