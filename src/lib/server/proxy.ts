import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const HOP_BY_HOP_RESPONSE_HEADERS = [
    'content-encoding',
    'content-length',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'upgrade',
];

const ACCESS_COOKIE = 'console_access_token';
const PODS_RESET_REQUEST_TIMEOUT_MS = 15 * 60_000;

interface ProxyHandlers {
    GET: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
    POST: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
    PUT: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
    PATCH: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
    DELETE: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
    OPTIONS: (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => Promise<NextResponse>;
}

export function createProxyHandlers(envVarName: string): ProxyHandlers {
    async function proxy(
        request: NextRequest,
        context: { params: Promise<{ path: string[] }> }
    ): Promise<NextResponse> {
        const baseUrl = process.env[envVarName];
        if (!baseUrl) {
            return NextResponse.json(
                { message: `${envVarName} is not configured` },
                { status: 500 }
            );
        }

        let resetRequest = false;
        try {
            const { path } = await context.params;
            const incomingUrl = new URL(request.url);
            const targetPath = path.join('/');
            const targetUrl = `${baseUrl.replace(/\/$/, '')}/${targetPath}${incomingUrl.search}`;
            resetRequest = envVarName === 'CMS_BASE_URL' && request.method === 'POST' &&
                /^admin\/pods-reset\/plans(?:\/[0-9a-f-]{36}\/execute)?$/i.test(targetPath);

            const headers = new Headers(request.headers);
            headers.delete('host');
            headers.delete('cookie');
            headers.delete('content-length');

            if (!headers.has('authorization')) {
                const cookieStore = await cookies();
                const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
                if (accessToken) {
                    headers.set('Authorization', `Bearer ${accessToken}`);
                }
            }

            const body =
                request.method === 'GET' || request.method === 'HEAD'
                    ? undefined
                    : await request.arrayBuffer();

            // Node fetch stops waiting for response headers after five minutes.
            // Large exact reset previews/batches can outlast that deadline.
            // Use the existing HTTP client only for these two helper requests.
            const upstream = resetRequest
                ? await axios.request<ArrayBuffer>({
                    url: targetUrl,
                    method: request.method,
                    headers: Object.fromEntries(headers.entries()),
                    data: body ? Buffer.from(body) : undefined,
                    responseType: 'arraybuffer',
                    timeout: PODS_RESET_REQUEST_TIMEOUT_MS,
                    signal: request.signal,
                    maxRedirects: 0,
                    validateStatus: () => true,
                }).then((response) => {
                    const responseHeaders = new Headers();
                    for (const [name, value] of Object.entries(response.headers)) {
                        if (value !== undefined && value !== null) {
                            responseHeaders.set(name, Array.isArray(value) ? value.join(', ') : String(value));
                        }
                    }
                    return new Response([204, 205, 304].includes(response.status) ? null : new Uint8Array(response.data).buffer, {
                        status: response.status, headers: responseHeaders,
                    });
                })
                : await fetch(targetUrl, {
                    method: request.method,
                    headers,
                    body,
                    cache: 'no-store',
                });

            const responseHeaders = new Headers(upstream.headers);
            for (const h of HOP_BY_HOP_RESPONSE_HEADERS) {
                responseHeaders.delete(h);
            }

            // Fetch exposes a zero-length ArrayBuffer even when an upstream
            // correctly returns 204. Passing that buffer to NextResponse still
            // counts as a response body, which is invalid for 204/205/304 and
            // turns successful DELETEs into a proxy 502.
            if ([204, 205, 304].includes(upstream.status)) {
                return new NextResponse(null, {
                    status: upstream.status,
                    headers: responseHeaders,
                });
            }

            const responseBody = await upstream.arrayBuffer();

            return new NextResponse(responseBody, {
                status: upstream.status,
                headers: responseHeaders,
            });
        } catch (error) {
            if (resetRequest) {
                const timedOut = axios.isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '');
                return NextResponse.json({
                    message: timedOut
                        ? 'CMS did not finish the reset request within 15 minutes. Check Run history and continue the saved run if present.'
                        : 'The Console lost its CMS connection during the reset request. Check Run history before retrying.',
                    code: timedOut ? 'pods_reset_proxy_timeout' : 'pods_reset_proxy_unavailable',
                }, { status: timedOut ? 504 : 502 });
            }
            return NextResponse.json(
                {
                    message: 'Proxy request failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
                { status: 502 }
            );
        }
    }

    return {
        GET: proxy,
        POST: proxy,
        PUT: proxy,
        PATCH: proxy,
        DELETE: proxy,
        OPTIONS: proxy,
    };
}
