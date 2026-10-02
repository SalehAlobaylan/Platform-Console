'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  controlContentResetCampaign, getContentResetExecution, issueContentResetReauth,
  listContentResetSteps, type ContentResetCampaignDetail, type ContentResetControlAction,
  type ContentResetControlRequest,
} from '@/lib/api/cms/content-reset';

export default function ContentResetExecutionPanel({ detail }: { detail: ContentResetCampaignDetail }) {
  const client = useQueryClient();
  const id = detail.campaign.id;
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [action, setAction] = useState<ContentResetControlAction | null>(null);
  const [retryStepId, setRetryStepId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const requestKey = useRef<{ intent: string; key: string } | null>(null);
  const decisionVersion = useRef(0);
  useEffect(() => {
    setAction(null); setRetryStepId(null); setPassword(''); setReason(''); setConfirmation(''); setError('');
    setCursor(0); setHistory([]); requestKey.current = null;
  }, [id]);
  const status = useQuery({
    queryKey: ['content-reset', 'execution', id],
    queryFn: () => getContentResetExecution(id), refetchInterval: 10_000,
  });
  const steps = useQuery({
    queryKey: ['content-reset', 'steps', id, cursor],
    queryFn: () => listContentResetSteps(id, cursor),
    enabled: Boolean(status.data?.execution), refetchInterval: 10_000,
  });
  const run = status.data?.execution;
  const canApprove = status.data?.state === 'previewed' && status.data.blockers.length === 0;
  const terminal = status.data?.state === 'cancelled' || status.data?.state === 'complete' || status.data?.state === 'closed_partial';
  const resumeBlocked = status.data?.steps.some((step) => step.count > 0 && ['claimed', 'outcome_unknown', 'failed', 'blocked'].includes(step.state));
  const reauthAction = action === 'approve' || action === 'start' ? 'start'
    : action === 'publish' ? 'publish'
      : action === 'rollback' ? 'rollback'
        : action === 'authorize-cleanup' ? 'cleanup'
          : action === 'resume-intake' ? 'resume_intake'
            : 'control';
  const confirmationText = action === 'approve' || action === 'start'
    ? status.data?.confirmation
    : action === 'publish' ? status.data?.publication_confirmation
      : action === 'rollback' ? status.data?.rollback_confirmation
        : action === 'resume-intake' ? status.data?.resume_intake_confirmation : '';
  const milestones = status.data?.milestones ?? [];
  const activePublication = milestones.find((milestone) => milestone.kind === 'publication');
  const activeRollback = milestones.find((milestone) => milestone.kind === 'rollback');
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action || !detail.revision.manifest_hash) throw new Error('Select a current frozen preview.');
      if (action === 'retry' && (!retryStepId || steps.isError || !steps.data?.data.some((step) => step.id === retryStepId && step.state === 'failed' && step.retry_safe))) {
        throw new Error('Refresh the owner actions. This step has no current proof that retry is safe.');
      }
      const request: ContentResetControlRequest = {
        revision: detail.revision.revision, expected_version: decisionVersion.current,
        manifest_hash: detail.revision.manifest_hash, reason,
        ...(confirmationText ? { confirmation } : {}),
        ...(action === 'retry' && retryStepId ? { step_id: retryStepId } : {}),
      };
      const intent = JSON.stringify({ id, action, request });
      if (requestKey.current?.intent !== intent) requestKey.current = { intent, key: crypto.randomUUID() };
      const key = requestKey.current.key;
      if (action !== 'pause') {
        const proof = await issueContentResetReauth(password, id, request.manifest_hash, reauthAction);
        request.reauth_proof = proof.proof;
      }
      return controlContentResetCampaign(id, action, request, key);
    },
    onSuccess: async () => {
      requestKey.current = null; setAction(null); setRetryStepId(null); setPassword(''); setReason(''); setConfirmation(''); setError('');
      await client.invalidateQueries({ queryKey: ['content-reset'] });
    },
    onError: (cause) => {
      setPassword('');
      setError(cause instanceof Error ? cause.message : 'The decision was not confirmed. Refresh the run before retrying.');
    },
  });
  const controlsUnavailable = status.isError || status.isPending || mutation.isPending;
  const choose = (next: ContentResetControlAction, stepId: string | null = null) => {
    decisionVersion.current = run?.version ?? 0;
    setAction(next); setRetryStepId(stepId); setPassword(''); setReason(''); setConfirmation(''); setError('');
  };
  return <section className="space-y-3 rounded-md border p-4" aria-label="Reset execution">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium">Execution</h3>
      <Badge variant="outline">{run ? run.phase.replaceAll('_', ' ') : 'Not started'}</Badge>
    </div>
    {status.isError && <p role="alert" className="text-sm text-destructive">Execution status is unavailable. No action has been confirmed.</p>}
    {status.isPending && <p className="text-sm text-muted-foreground">Loading execution status…</p>}
    {status.data && !run && <p className="text-sm text-muted-foreground">
      Approval and start are separate decisions. A blocked preview cannot authorize content changes.
    </p>}
    {status.data?.blockers.length ? <details>
      <summary className="cursor-pointer text-sm">{status.data.blockers.length} execution requirements remain</summary>
      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
        {status.data.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>
          <span className="font-medium text-foreground">{blocker.owner}: </span>{blocker.reason}
        </li>)}
      </ul>
    </details> : null}
    {run && <div className="space-y-2 text-sm">
      <p>{run.pause_requested ? 'Pause requested: admitted actions may still finish; uncertain outcomes are reconciled.' : 'The CMS coordinator tracks this run independently of this browser.'}</p>
      {run.irreversible_at && <p className="text-destructive">Permanent retirement began at {new Date(run.irreversible_at).toLocaleString()}. Pointer rollback cannot restore deleted content.</p>}
      {run.cleanup_not_before && <p>Cleanup cannot begin before {new Date(run.cleanup_not_before).toLocaleString()}.</p>}
      {run.cleanup_authorized_until && <p>Delayed cleanup authority expires {new Date(run.cleanup_authorized_until).toLocaleString()}.</p>}
      {run.rolled_back_at && <p className="text-destructive">The replacement was rolled back at {new Date(run.rolled_back_at).toLocaleString()}. Residual staged-instance cleanup remains an operator obligation.</p>}
      {activePublication && <p>Publication approved by {activePublication.approved_by} at {new Date(activePublication.approved_at).toLocaleString()}; approval expires {new Date(activePublication.expires_at).toLocaleString()}.</p>}
      {activeRollback && <p>Rollback approved by {activeRollback.approved_by}; approval expires {new Date(activeRollback.expires_at).toLocaleString()}.</p>}
      <div className="flex flex-wrap gap-2">{status.data?.steps.map((step) => <Badge key={step.state} variant="outline">{step.count} {step.state.replaceAll('_', ' ')}</Badge>)}</div>
    </div>}
    <div className="flex flex-wrap gap-2">
      {canApprove && <Button size="sm" disabled={controlsUnavailable} onClick={() => choose('approve')}>Review approval</Button>}
      {status.data?.state === 'approved' && <>
        <Button size="sm" onClick={() => choose('start')} disabled={controlsUnavailable || Boolean(status.data.blockers.length)}>Start approved reset</Button>
        <Button size="sm" variant="outline" disabled={controlsUnavailable} onClick={() => choose('revoke-approval')}>Revoke approval</Button>
      </>}
      {status.data?.can_publish && <Button size="sm" onClick={() => choose('publish')} disabled={controlsUnavailable}>Review publication</Button>}
      {status.data?.can_rollback && <Button size="sm" variant="outline" onClick={() => choose('rollback')} disabled={controlsUnavailable}>Review rollback</Button>}
      {status.data?.can_authorize_cleanup && run?.phase === 'cleanup_authorization_expired' && <Button size="sm" variant="outline" onClick={() => choose('authorize-cleanup')} disabled={controlsUnavailable}>Renew cleanup authorization</Button>}
      {status.data?.can_resume_intake && <Button size="sm" variant="outline" onClick={() => choose('resume-intake')} disabled={controlsUnavailable}>Review intake resume</Button>}
      {run?.started_at && !terminal && <Button size="sm" variant="outline" disabled={controlsUnavailable || Boolean(run.pause_requested && resumeBlocked)} onClick={() => choose(run.pause_requested ? 'resume' : 'pause')}>
        {run.pause_requested ? 'Review resume' : 'Pause new actions'}
      </Button>}
      {run?.started_at && run.pause_requested && !terminal && <Button size="sm" variant="outline" disabled={controlsUnavailable || Boolean(status.data?.steps.some((step) => step.count > 0 && ['claimed', 'outcome_unknown', 'waiting', 'pending', 'deferred'].includes(step.state)))} onClick={() => choose('close-partial')}>Close as partial</Button>}
    </div>
    {action && <form className="space-y-3 rounded-md bg-muted/30 p-3" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <p className="text-sm font-medium">{action.replaceAll('-', ' ')} · {detail.campaign.lane} · {detail.campaign.tenant_id}</p>
      {action === 'retry' && <div className="space-y-1 text-sm text-muted-foreground"><p>Retry this failed owner action only after confirming its proof of no committed effect. The campaign stays paused until you review resume.</p><p className="break-all">Action: {steps.data?.data.find((step) => step.id === retryStepId)?.step_key}</p></div>}
      <div className="space-y-1"><Label htmlFor="reset-control-reason">Reason</Label><Input id="reset-control-reason" required minLength={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
      {confirmationText && <div className="space-y-1">
        <Label htmlFor="reset-control-confirmation">Type {confirmationText}</Label>
        <Input id="reset-control-confirmation" required autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
      </div>}
      {action !== 'pause' && <div className="space-y-1"><Label htmlFor="reset-control-password">Confirm your password</Label><Input id="reset-control-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={controlsUnavailable || (action === 'retry' && (steps.isError || !steps.data?.data.some((step) => step.id === retryStepId && step.state === 'failed' && step.retry_safe)))}>{mutation.isPending ? 'Confirming…' : 'Confirm decision'}</Button>
        <Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => { setAction(null); setPassword(''); }}>Close</Button></div>
    </form>}
    {steps.isError && <p role="alert" className="text-sm text-destructive">Owner actions could not be loaded.</p>}
    {steps.data && <div className="space-y-2">
      <ul className="divide-y text-sm">{steps.data.data.map((step) => <li className="py-2" key={step.id}>
        <div className="flex justify-between gap-3"><span>{step.owner} · {step.effect.replaceAll('_', ' ')}</span><Badge variant="outline">{step.state.replaceAll('_', ' ')}</Badge></div>
        {step.reason_code && <p className="mt-1 text-muted-foreground">{step.reason_code.replaceAll('_', ' ')}</p>}
        {step.state === 'failed' && step.retry_safe && run?.pause_requested && status.data?.state === 'partial' && <Button type="button" size="sm" variant="outline" className="mt-2" disabled={controlsUnavailable || steps.isError || Boolean(status.data.blockers.length)} onClick={() => choose('retry', step.id)}>Review safe retry</Button>}
      </li>)}</ul>
      {!steps.data.data.length && <p className="text-sm text-muted-foreground">No owner actions admitted.</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!history.length} onClick={() => { setCursor(history.at(-1) ?? 0); setHistory((previous) => previous.slice(0, -1)); }}>Previous</Button>
        <Button size="sm" variant="outline" disabled={!steps.data.has_more} onClick={() => { setHistory((previous) => [...previous, cursor]); setCursor(steps.data.next_cursor); }}>Next</Button>
      </div>
    </div>}
  </section>;
}
