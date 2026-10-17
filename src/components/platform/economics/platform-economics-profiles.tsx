'use client';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from './economics-ui';
import {
  name,
  useEconomicsScope,
  field,
  Problem,
  Labeled,
  type Action,
} from './platform-economics-shared';
import { economicsAPI as api } from '@/lib/api/cms/platform-economics';
export function Profiles({
  onAction,
  busy,
}: {
  onAction: Action;
  busy: boolean;
}) {
  const scope = useEconomicsScope();
  const profiles = useQuery({
    queryKey: ['platform-economics', scope, 'profiles'],
    queryFn: api.profiles,
  });
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onAction(
      () =>
        api.saveProfile({
          resource: String(f.get('resource')),
          operation: String(f.get('operation')),
          weight: Number(f.get('weight')),
          effective_from: `${f.get('from')}T00:00:00Z`,
          evidence: String(f.get('evidence')),
        }),
      'Recorded prospective measured resource profile'
    );
  }
  return (
    <Panel
      title="Resource profiles"
      description="Only measured profiles can turn request mixes into shared infrastructure estimates. New versions apply prospectively."
    >
      {profiles.isError ? (
        <Problem error={profiles.error} />
      ) : (
        <div className="space-y-2">
          {profiles.data?.profiles.map((p) => (
            <div
              key={`${p.resource}:${p.operation}:${p.version}`}
              className="flex flex-wrap gap-3 rounded-md border p-3 text-xs"
            >
              <span>{name(p.resource)}</span>
              <span>{name(p.operation)}</span>
              <span>Relative weight {p.weight}</span>
              <span>
                v{p.version} from {p.effective_from.slice(0, 10)}
              </span>
              <details>
                <summary className="cursor-pointer">
                  Measurement evidence
                </summary>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  {p.evidence}
                </p>
              </details>
            </div>
          ))}
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm">
          Record a calibrated profile
        </summary>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Labeled label="Resource">
            <select name="resource" className={field}>
              {['database', 'app_compute', 'storage', 'delivery'].map((s) => (
                <option key={s} value={s}>
                  {name(s)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Operation">
            <select name="operation" className={field}>
              {[
                'pods_page',
                'news_page',
                'search',
                'content_read',
                'transcript_read',
                'interaction',
                'upload',
                'transcription_request',
                'auth',
                'unknown',
                'processing',
                'storage',
              ].map((s) => (
                <option key={s} value={s}>
                  {name(s)}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Relative work weight">
            <Input name="weight" type="number" min={0} max={1000000} required />
          </Labeled>
          <Labeled label="Effective UTC date">
            <Input
              name="from"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled label="Measured workload and deployment evidence">
              <textarea
                name="evidence"
                required
                minLength={10}
                maxLength={4000}
                className={field}
              />
            </Labeled>
          </div>
          <Button className="justify-self-start" disabled={busy}>
            Save prospective profile
          </Button>
        </form>
      </details>
    </Panel>
  );
}

export function ContentPreparationRules({
  onAction,
  busy,
}: {
  onAction: Action;
  busy: boolean;
}) {
  const scope = useEconomicsScope();
  const rules = useQuery({
    queryKey: ['platform-economics', scope, 'profiles'],
    queryFn: api.profiles,
  });
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onAction(
      () =>
        api.saveContentRule({
          kind: String(f.get('kind')),
          effective_from: `${f.get('from')}T00:00:00Z`,
          allocable_bps: Math.round(Number(f.get('portion')) * 100),
          observation: String(f.get('observation')),
          evidence: String(f.get('evidence')),
        }),
      'Recorded prospective preparation allocation rule'
    );
  }
  return (
    <Panel
      title="Shared content preparation"
      description="Allocate only a defensible covered portion. Missing public consumption or unsupported artifacts stay unallocated."
    >
      {rules.data?.content_rules?.map((r) => (
        <div
          key={`${r.kind}:${r.version}`}
          className="mb-3 rounded-md border p-3 text-xs"
        >
          <p>
            {name(r.kind)} · {r.allocable_bps / 100}% covered · {r.observation}{' '}
            · v{r.version} from {r.effective_from.slice(0, 10)}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">
              Qualification evidence
            </summary>
            <p className="mt-2 text-muted-foreground">{r.evidence}</p>
          </details>
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-sm">
          Record a qualified allocation method
        </summary>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Labeled label="Content kind">
            <select name="kind" className={field}>
              <option value="pods">Pods base preparation</option>
              <option value="news">News base preparation</option>
            </select>
          </Labeled>
          <Labeled label="Qualified observation source">
            <select name="observation" className={field}>
              <option value="mobile">Mobile existing business signals</option>
              <option value="web_completion">
                Web completion signals (Pods only)
              </option>
            </select>
          </Labeled>
          <Labeled label="Supported covered portion (%)">
            <Input
              name="portion"
              type="number"
              min={0}
              max={100}
              step={0.01}
              defaultValue={0}
              required
            />
          </Labeled>
          <Labeled label="Effective UTC date">
            <Input
              name="from"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </Labeled>
          <div className="sm:col-span-2">
            <Labeled label="Coverage / low-overhead qualification evidence">
              <textarea
                className={field}
                name="evidence"
                required
                minLength={10}
                maxLength={4000}
                placeholder="Explain covered clients, public/unobserved consumption, and tracking overhead. Unsupported portions stay unallocated."
              />
            </Labeled>
          </div>
          <Button className="justify-self-start" disabled={busy}>
            Save prospective rule
          </Button>
        </form>
      </details>
    </Panel>
  );
}
