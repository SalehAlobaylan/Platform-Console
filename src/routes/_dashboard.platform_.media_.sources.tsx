import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/media/sources/page';

export const Route = createFileRoute('/_dashboard/platform_/media_/sources')({ component: Page });
