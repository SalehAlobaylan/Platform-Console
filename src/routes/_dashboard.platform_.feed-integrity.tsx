import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/feed-integrity/page';

export const Route = createFileRoute('/_dashboard/platform_/feed-integrity')({ component: Page });
