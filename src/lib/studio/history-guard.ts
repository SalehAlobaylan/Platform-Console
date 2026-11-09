interface StudioLocation {
    pathname: string;
    search: Record<string, unknown>;
}

function identity(location: StudioLocation, key: 'tab' | 'item') {
    const value = location.search[key];
    return Array.isArray(value) ? value[0] : value;
}

export function leavesStudioDraft(current: StudioLocation, next: StudioLocation): boolean {
    return current.pathname !== next.pathname ||
        identity(current, 'tab') !== identity(next, 'tab') ||
        identity(current, 'item') !== identity(next, 'item');
}
