import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/topics/page';

export const Route = createFileRoute('/_dashboard/platform_/topics')({ component: Page });
