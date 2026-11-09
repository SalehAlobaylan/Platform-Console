import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/moderation/page';

export const Route = createFileRoute('/_dashboard/platform_/moderation')({ component: Page });
