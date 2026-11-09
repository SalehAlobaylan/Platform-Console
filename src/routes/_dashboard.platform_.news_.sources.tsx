import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/news/sources/page';

export const Route = createFileRoute('/_dashboard/platform_/news_/sources')({ component: Page });
