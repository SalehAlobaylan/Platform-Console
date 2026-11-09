interface RuntimeConfig {
    runtimeId: string;
    grafanaUrl: string;
}

let documentConfig: RuntimeConfig | undefined;

export function consoleRuntime(): RuntimeConfig {
    if (typeof document === 'undefined') return { runtimeId: '', grafanaUrl: '' };
    documentConfig ??= {
        runtimeId: document.querySelector<HTMLMetaElement>('meta[name="wahb-runtime-id"]')?.content ?? '',
        grafanaUrl: document.querySelector<HTMLMetaElement>('meta[name="wahb-grafana-url"]')?.content ?? '',
    };
    return documentConfig;
}
