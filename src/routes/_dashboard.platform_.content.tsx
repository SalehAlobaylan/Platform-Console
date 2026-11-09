import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/content/page';

export const Route = createFileRoute('/_dashboard/platform_/content')({ component: Page });
