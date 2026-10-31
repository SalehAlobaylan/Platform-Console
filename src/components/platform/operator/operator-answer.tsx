'use client';

import { ChevronRight, FileSearch } from 'lucide-react';
import { operatorCopy, type OperatorLocale } from './operator-copy';

type AnswerBlock = { kind: string; text: string; evidence_ids: string[] };

export function operatorResponseBlocks(content: unknown): AnswerBlock[] {
  if (
    !content ||
    typeof content !== 'object' ||
    !('blocks' in content) ||
    !Array.isArray(content.blocks)
  )
    return [];
  return content.blocks.flatMap((block: unknown) => {
    if (
      !block ||
      typeof block !== 'object' ||
      !('kind' in block) ||
      typeof block.kind !== 'string' ||
      !('text' in block) ||
      typeof block.text !== 'string'
    )
      return [];
    const ids =
      'evidence_ids' in block && Array.isArray(block.evidence_ids)
        ? block.evidence_ids.filter(
            (id: unknown): id is string => typeof id === 'string'
          )
        : [];
    return [{ kind: block.kind, text: block.text, evidence_ids: ids }];
  });
}

export function OperatorAnswer({
  content,
  locale,
  onEvidence,
  comfortable = false,
}: {
  comfortable?: boolean;
  content: unknown;
  locale: OperatorLocale;
  onEvidence?: (evidenceIDs: string[]) => void;
}) {
  const t = operatorCopy(locale);
  const blocks = operatorResponseBlocks(content);
  const conclusions = blocks.filter((block) => block.kind === 'conclusion');
  const facts = blocks.filter((block) => block.kind === 'fact');
  const interpretations = blocks.filter(
    (block) => block.kind === 'interpretation'
  );
  const analysisCount = facts.length + interpretations.length;

  function section(rows: AnswerBlock[], title?: string) {
    if (!rows.length) return null;
    const citations = new Set(rows.flatMap((block) => block.evidence_ids)).size;
    return (
      <section className="space-y-2" aria-label={title}>
        {title ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h4 className="text-sm font-semibold">{title}</h4>
            {citations && onEvidence ? (
              <button
                type="button"
                onClick={() =>
                  onEvidence([
                    ...new Set(rows.flatMap((block) => block.evidence_ids)),
                  ])
                }
                className="inline-flex min-h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FileSearch aria-hidden="true" className="size-3.5" />
                {t.evidence} ({citations})
              </button>
            ) : null}
          </div>
        ) : null}
        {rows.map((block, index) => (
          <p
            key={index}
            className="whitespace-pre-wrap break-words text-sm leading-6"
            dir="auto"
          >
            {block.text}
          </p>
        ))}
      </section>
    );
  }

  const analysis = (
    <>
      {section(facts, t.confirmedFacts)}
      {section(interpretations, t.interpretation)}
    </>
  );
  return (
    <div
      className={
        comfortable
          ? 'space-y-4 [&_p]:text-[15px] [&_p]:leading-7'
          : 'space-y-4'
      }
    >
      {section(blocks.filter((block) => block.kind === 'message'))}
      {conclusions.length ? (
        <div className="border-s-2 border-foreground/20 ps-4">
          {section(conclusions, t.conclusion)}
        </div>
      ) : null}
      {analysisCount ? (
        conclusions.length ? (
          <details className="group border-y py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90"
              />
              {t.supportingAnalysis}
              <span className="text-xs font-normal text-muted-foreground">
                ({analysisCount})
              </span>
            </summary>
            <div className="mt-4 space-y-4">{analysis}</div>
          </details>
        ) : (
          <div className="space-y-4">{analysis}</div>
        )
      ) : null}
      {section(
        blocks.filter(
          (block) => block.kind === 'unknown' || block.kind === 'degraded'
        ),
        t.answerCaveats
      )}
      {section(
        blocks.filter((block) => block.kind === 'recommendation'),
        t.nextStep
      )}
    </div>
  );
}
