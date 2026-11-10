interface RuntimeConfig {
    runtimeId: string;
    environmentId: string;
    grafanaUrl: string;
}

let documentConfig: RuntimeConfig | undefined;

export function consoleRuntime(): RuntimeConfig {
    if (typeof document === 'undefined') return { runtimeId: '', environmentId: '', grafanaUrl: '' };
    documentConfig ??= {
        runtimeId: document.querySelector<HTMLMetaElement>('meta[name="wahb-runtime-id"]')?.content ?? '',
        environmentId: document.querySelector<HTMLMetaElement>('meta[name="wahb-environment-id"]')?.content ?? '',
        grafanaUrl: document.querySelector<HTMLMetaElement>('meta[name="wahb-grafana-url"]')?.content ?? '',
    };
    return documentConfig;
}
