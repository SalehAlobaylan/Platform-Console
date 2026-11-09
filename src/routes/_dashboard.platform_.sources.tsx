import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/sources/page';

export const Route = createFileRoute('/_dashboard/platform_/sources')({ component: Page });
