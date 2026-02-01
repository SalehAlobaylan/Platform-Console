'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mx-auto flex max-w-[500px] flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-destructive/10 p-6">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>

        <p className="mt-4 text-muted-foreground">
          We&apos;re sorry, but an unexpected error has occurred. Our team has
          been notified and we&apos;re working to fix the issue.
        </p>

        {error.message && (
          <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <code className="break-all">{error.message}</code>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>

          <Link href="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
