import { redirect } from 'next/navigation';

export default function FeedRecoveryRedirect() {
  redirect('/platform/recovery?view=feed-recovery');
}
