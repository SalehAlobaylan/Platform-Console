import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/sources/new/page';

export const Route = createFileRoute('/_dashboard/platform_/sources_/new')({ component: Page });
