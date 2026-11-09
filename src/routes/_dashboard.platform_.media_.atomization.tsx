import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import Page from '@/app/(dashboard)/platform/media/atomization/page';

// Keep repeated values so the workspace and draft guard read the same item.
const queryValue = z.union([z.string(), z.array(z.string())]).optional();
const search = z.object({
    tab: queryValue,
    item: queryValue,
    chapter: queryValue,
    view: queryValue,
}).passthrough();

export const Route = createFileRoute('/_dashboard/platform_/media_/atomization')({
    validateSearch: (input) => search.parse(input),
    component: Page,
});
