import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/storage/page';

export const Route = createFileRoute('/_dashboard/platform_/storage')({ component: Page });
