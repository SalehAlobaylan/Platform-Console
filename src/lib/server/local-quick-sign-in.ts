export function localQuickSignInCredentials(request: Request) {
    if (process.env.NODE_ENV !== 'development' || process.env.WAHB_MANAGED_ENV !== '1' || !process.env.WAHB_RUNTIME_ID) {
        return undefined;
    }

    const { hostname, protocol } = new URL(request.url);
    if (protocol !== 'http:' || (hostname !== 'localhost' && hostname !== '127.0.0.1')) {
        return undefined;
    }

    const email = process.env.LOCAL_QUICK_SIGN_IN_EMAIL;
    const password = process.env.LOCAL_QUICK_SIGN_IN_PASSWORD;
    return email && password ? { email, password } : undefined;
}
