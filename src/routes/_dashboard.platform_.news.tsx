import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Page from '@/app/(dashboard)/platform/news/page';

// The screen interprets the first value and applies its existing defaults.
// Keep the full bookmark intact when the router validates the location.
const queryValue = z.union([z.string(), z.array(z.string())]).optional();
const search = z.object({
    view: queryValue,
    story: queryValue,
    status: queryValue,
    type: queryValue,
}).passthrough();

export const Route = createFileRoute('/_dashboard/platform_/news')({
    validateSearch: (input) => search.parse(input),
    component: Page,
});
