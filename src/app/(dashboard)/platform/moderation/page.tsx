'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { getModerationCase, getNextModerationCase } from '@/lib/api/cms/moderation';
import { isRecordId } from '@/lib/operator-destinations';
import { useWorkspaceSession } from '@/lib/stores/workspace-session';
import { Input } from '@/components/ui/input';
import Link from '@/lib/console-link';
import {
  Flag,
  Loader2,
  ShieldAlert,
  UserX,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useModerationQueue,
  useCommentPolicyReviews,
  useRemoveModerationComment,
  useResolveCommentPolicyReview,
  useResolveModerationReport,
  useSuspendModerationAuthor,
} from '@/hooks/use-moderation';
import type { ModerationStatus } from '@/types/platform/moderation';

const statuses: Array<ModerationStatus | 'all'> = [
  'open',
  'resolved',
  'dismissed',
  'all',
];

export default function ModerationPage() {
  const params = useSearchParams();
  const router = useRouter();
  const status = statuses.find(value => value === params.get('status')) ?? 'open';
  const rawPage = Number(params.get('page') ?? '1');
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage < 100000 ? rawPage : 1;
  const caseId = params.get('case') ?? '';
  const navigate = (nextStatus: ModerationStatus | 'all', nextPage: number, nextCase = '') => {
    const search = new URLSearchParams({ status: nextStatus, page: String(nextPage) });
    if (nextCase) search.set('case', nextCase);
    router.push('/platform/moderation?' + search.toString());
  };
  const owner = useWorkspaceSession(state => state.owner);
  const queue = useModerationQueue(status, page);
  const detail = useQuery({
    queryKey: ['moderation', 'case', caseId],
    queryFn: ({ signal }) => getModerationCase(caseId, signal),
    enabled: isRecordId(caseId),
    retry: false,
  });
  const [review, setReview] = useState({ id: '', reason: '' });
  const reason = review.id === caseId ? review.reason : '';
  const policyReviews = useCommentPolicyReviews();
  const resolve = useResolveModerationReport();
  const resolvePolicyReview = useResolveCommentPolicyReview();
  const removeComment = useRemoveModerationComment();
  const suspendAuthor = useSuspendModerationAuthor();
  const reports = queue.data?.data ?? [];
  const decision = resolve.data?.data.id === caseId ? resolve.data.data.status : undefined;
  const returnPage = Math.min(page, Math.max(1, queue.data?.total_pages ?? page));
  const openCount = status === 'open' && !queue.isError ? queue.data?.total : undefined;

  return (
    <main className="space-y-6 p-6">
      <header className="border-b-2 border-foreground pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="border-2 border-red-600 bg-red-600 p-2 text-white">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">
                Consumer safety desk
              </p>
              <h1 className="font-serif text-3xl font-semibold tracking-tight">
                Moderation queue
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Review user reports. Resolve only after a human decision;
                removing a comment is permanent and is recorded in the CMS audit
                log.
              </p>
            </div>
          </div>
          {openCount !== undefined ? (
            <Badge variant="destructive" className="rounded-none px-3 py-1.5">
              {openCount} open
            </Badge>
          ) : null}
        </div>
      </header>
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {statuses.map((entry) => (
          <Button
            key={entry}
            size="sm"
            variant={status === entry ? 'default' : 'outline'}
            className="rounded-none capitalize"
            onClick={() => navigate(entry, 1)}
          >
            {entry}
          </Button>
        ))}
      </div>
      {caseId && <Card>
        <CardHeader><CardTitle>Report case</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {detail.isPending && isRecordId(caseId) ? <p>Loading case…</p> : detail.isError || !detail.data ? (
            <p role="alert">Case unavailable. <button type="button" className="underline" onClick={() => void detail.refetch()}>Retry</button></p>
          ) : <>
            <p>Report status: {decision ?? detail.data.report.status}</p>
            {decision && <p role="status" className="text-sm font-medium">Decision saved.</p>}
            <p>{detail.data.report.reason.replaceAll('_', ' ')}</p>
            {detail.data.report.detail && <p className="whitespace-pre-wrap">{detail.data.report.detail}</p>}
            {detail.data.target_available ? <>
              {detail.data.comment_text && <blockquote dir="auto" className="rounded-md border p-3">{detail.data.comment_text}</blockquote>}
              {detail.data.parent_id && <Link className="underline" href={'/platform/content/' + encodeURIComponent(detail.data.parent_id)}>{detail.data.parent_title || 'Open parent content'}</Link>}
            </> : <p>The reported target is no longer available.</p>}
            {detail.data.report.status === 'open' && !decision && <>
              <Input aria-label="Decision reason" value={reason} maxLength={1000} onChange={event => setReview({ id: caseId, reason: event.target.value })} placeholder="Reason for this decision" />
              <div className="flex flex-wrap gap-2">
                {(['resolved', 'dismissed'] as const).map(next => <Button key={next} variant={next === 'resolved' ? 'default' : 'outline'} disabled={!reason.trim() || resolve.isPending} onClick={() => resolve.mutate({ id: caseId, status: next, reason: reason.trim() }, { onError: () => void detail.refetch() })}>{next === 'resolved' ? 'Resolve report' : 'Dismiss report'}</Button>)}
                {detail.data.target_available && detail.data.report.target_type === 'comment' && <Button variant="destructive" disabled={removeComment.isPending} onClick={() => {
                    if (window.confirm('Permanently remove this reported comment?')) removeComment.mutate(detail.data.report.target_id);
                }}>Remove comment</Button>}
              </div>
            </>}
          </>}
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="outline" onClick={() => navigate(status, returnPage)}>Close case</Button>
            {status === 'open' && detail.data && !detail.isError && <NextCase
              key={owner + ':' + caseId} id={caseId} disabled={resolve.isPending}
              onNext={id => navigate(status, page, id)} onReturn={() => navigate(status, returnPage)}
            />}
          </div>
        </CardContent>
      </Card>}
      <Card className="rounded-none border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-600" />
            Reports
          </CardTitle>
          <CardDescription>
            Reports do not reveal reporter identities. Suspending an author
            revokes their refresh sessions and immediately invalidates their
            existing CMS access tokens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : queue.isError ? (
            <p role="alert">Reports unavailable. <button className="underline" onClick={() => void queue.refetch()}>Retry</button></p>
          ) : reports.length === 0 ? (
            <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">
              No {status === 'all' ? '' : status} reports.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reported</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="link" onClick={() => navigate(status, page, report.id)}>{report.target_type}</Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-none">
                        {report.reason.replaceAll('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-pre-wrap text-sm">
                      {report.detail || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          report.status === 'open' ? 'destructive' : 'secondary'
                        }
                        className="rounded-none"
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(status, page, report.id)}>Review case</Button>
                        {report.target_type === 'comment' ? (
                          <>
                            {report.author_id ? (
                              <Button
                                size="icon"
                                variant="outline"
                                className="rounded-none border-red-600 text-red-700 hover:bg-red-50 hover:text-red-800"
                                disabled={suspendAuthor.isPending}
                                onClick={() => {
                                  const nextSuspended =
                                    !report.author_suspended;
                                  if (
                                    window.confirm(
                                      nextSuspended
                                        ? 'Suspend this account? Their refresh sessions will be revoked and active CMS access will stop immediately.'
                                        : 'Restore this account? They will be able to sign in again, but revoked sessions will remain signed out.'
                                    )
                                  ) {
                                    suspendAuthor.mutate({
                                      authorID: report.author_id!,
                                      suspended: nextSuspended,
                                    });
                                  }
                                }}
                                aria-label={
                                  report.author_suspended
                                    ? 'Restore comment author'
                                    : 'Suspend comment author'
                                }
                                title={
                                  report.author_suspended
                                    ? 'Restore account'
                                    : 'Suspend account'
                                }
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            ) : null}

                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {queue.data && !queue.isError && <div className="flex items-center gap-2 pt-3">
            <Button variant="outline" disabled={page <= 1} onClick={() => navigate(status, page - 1)}>Previous</Button>
            <span>Page {page} of {Math.max(1, queue.data.total_pages)}</span>
            <Button variant="outline" disabled={page >= queue.data.total_pages} onClick={() => navigate(status, page + 1)}>Next</Button>
          </div>}
        </CardContent>
      </Card>
      <Card className="rounded-none border-2">
        <CardHeader>
          <CardTitle>Comment policy review</CardTitle>
          <CardDescription>
            Deterministic safety rules held these comments for a human decision.
            Reporter identity is never shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policyReviews.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : policyReviews.isError ? (
            <p role="alert">Policy reviews unavailable. <button className="underline" onClick={() => void policyReviews.refetch()}>Retry</button></p>
          ) : (policyReviews.data?.data.length ?? 0) === 0 ? (
            <div className="border border-dashed p-8 text-center text-sm text-muted-foreground">
              No comments require policy review.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policyReviews.data?.data.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-none">
                        {comment.reason.replaceAll('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xl whitespace-pre-wrap text-sm">
                      {comment.text}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="rounded-none"
                          disabled={resolvePolicyReview.isPending}
                          onClick={() =>
                            resolvePolicyReview.mutate({
                              id: comment.id,
                              status: 'allow',
                            })
                          }
                        >
                          Allow
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-none"
                          disabled={resolvePolicyReview.isPending}
                          onClick={() =>
                            resolvePolicyReview.mutate({
                              id: comment.id,
                              status: 'removed',
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function NextCase({ id, disabled, onNext, onReturn }: {
  id: string;
  disabled: boolean;
  onNext: (id: string) => void;
  onReturn: () => void;
}) {
  const request = useRef<AbortController | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'end' | 'error'>('idle');
  useEffect(() => () => request.current?.abort(), []);

  const advance = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setState('loading');
    try {
      const next = await getNextModerationCase(id, controller.signal);
      if (controller.signal.aborted) return;
      if (next && isRecordId(next) && next !== id) {
        onNext(next);
      } else {
        setState(next ? 'error' : 'end');
      }
    } catch {
      if (!controller.signal.aborted) setState('error');
    } finally {
      request.current = null;
    }
  };

  return <div className="space-y-2">
    {state === 'end' ? <Button variant="outline" onClick={onReturn}>Back to Open reports</Button> :
      <Button variant="outline" disabled={disabled || state === 'loading'} onClick={() => void advance()}>
        {state === 'loading' ? 'Checking queue…' : state === 'error' ? 'Retry next case' : 'Next case'}
      </Button>}
    {state === 'end' && <p role="status" className="text-sm">End of this queue.</p>}
    {state === 'error' && <p role="alert" className="text-sm">Could not check the next case.</p>}
  </div>;
}
