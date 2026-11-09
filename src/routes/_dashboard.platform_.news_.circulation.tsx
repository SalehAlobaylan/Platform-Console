import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/news/circulation/page';

export const Route = createFileRoute('/_dashboard/platform_/news_/circulation')({ component: Page });
