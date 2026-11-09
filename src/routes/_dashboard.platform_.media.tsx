import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/media/page';

export const Route = createFileRoute('/_dashboard/platform_/media')({ component: Page });
