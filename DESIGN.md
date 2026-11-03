# Platform Console Design System

Platform Console is an operational administration product. Its visual source of
truth is the existing dashboard—not the public Wahb client. New Console work
must feel native beside these three reference surfaces:

- **Content** — monitoring hierarchy, KPI density, responsive analytical grids,
  refresh/error behavior, and domain drill-down cards.
- **Media Library** — management hierarchy, configuration cards, filter bars,
  gallery/table views, selection, pagination, and confirmation dialogs.
- **Media Circulation** — operational cockpit hierarchy, scoped domain accent,
  decision queue, selected-item inspector, URL-backed state, and responsive
  sheets.

When this document and a generic design convention disagree, follow these
reference pages and the shared primitives they use. For new or revised system
controls, follow [Section 7](#7-system-controls-and-automation): existing pages
are visual references, not exceptions to the control vocabulary and behavior.

## 1. Product character

- Calm, compact, operational, and information-forward.
- Built from familiar dashboard patterns rather than consumer-app, editorial,
  cinematic, or chat-product styling.
- Strong hierarchy without excessive decoration: page header, summary, controls,
  cards, rows, inspector, and supporting details.
- Dense information remains readable through grouping, labels, whitespace,
  tabular numbers, muted text, and progressive disclosure.
- Color communicates domain or state; it does not repaint the whole application.

## 2. Foundations

Use the tokens in `src/app/globals.css` and primitives in `src/components/ui/`.
Do not duplicate them as page-local hex values.

| Role | Required Console pattern |
| --- | --- |
| Canvas | `bg-background text-foreground` from `DashboardShell` |
| Primary surface | `Card`, `bg-card`, `border-border`, `rounded-lg` or `rounded-xl` |
| Quiet surface | `bg-muted`, `bg-muted/40`, `bg-background` inside a card |
| Primary action | Default `Button`; use a scoped domain accent only when the reference domain already does |
| Secondary action | `Button variant="outline"` |
| Tertiary action | `Button variant="ghost"` or a `DropdownMenu` item |
| Destructive action | `Button variant="destructive"` inside an explicit confirmation flow |
| Status | `Badge` with semantic variant plus readable text |
| Focus | Existing `ring-ring` behavior from shared controls |
| Typography | Inter and the existing dashboard type utilities |
| Numeric data | `tabular-nums`; `font-mono` only for IDs, hashes, and code-like values |

### Domain accents

The dashboard has restrained, scoped accent use:

- `gold` identifies Pods/Media Library controls and small highlights.
- `news` identifies Media Circulation decisions and News surfaces.
- `info`, `success`, `warning`, and `destructive` communicate operational state.

An accent may appear in an overline, icon, 2px rail, active tab underline,
selected row tint, compact chart, or primary domain action. It must not replace
the standard background, text, card, border, input, or focus tokens.

Media Circulation's dark cockpit hero is an intentional exception for the
top-level operational summary. It remains one contained `rounded-xl` surface;
the queue, inspector, forms, and sheets return to standard Console cards.

Never import the public client’s Newsprint & Red identity, consumer typography,
full-page paper treatment, red evidence spines, or consumer navigation patterns
into Platform Console.

## 3. Dashboard shell and page frame

- Preserve `DashboardShell`: desktop sidebar, 56px header, scrollable page,
  `p-4 sm:p-6 lg:p-8`, and `max-w-7xl` content frame.
- Do not use negative margins, fixed full-viewport canvases, or a second app
  shell inside a page.
- Use `space-y-6` for monitoring and management pages. A dense cockpit may use
  `space-y-4`, as Media Circulation does.
- Typical page headers use:
  - `flex items-start justify-between gap-4`;
  - `text-3xl font-bold tracking-tight` for broad monitoring pages;
  - `text-2xl font-semibold` for focused management pages;
  - one short `text-sm` or `text-muted-foreground` description;
  - page actions aligned to the end and allowed to wrap on narrow screens.
- Avoid a large marketing hero. A cockpit hero is allowed only when it contains
  live status, metrics, controls, and filtering—not decorative copy.

## 4. Reference archetypes

### A. Content monitoring pattern

Use this pattern when the page answers “What is happening across the system?”

1. Header with title, concise scope, last-updated state, and an icon refresh
   button.
2. Responsive KPI band:
   `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`, `gap-3`.
3. KPI cards use `CardContent p-4`, a `text-2xl font-semibold tabular-nums`
   value, `text-xs text-muted-foreground` label, and a 16px semantic icon.
4. Primary analysis uses `lg:grid-cols-[2fr_1fr]` with `gap-5`.
5. Parallel domains use `xl:grid-cols-2`; each card may have a 2px scoped
   accent rail, overline, small sparkline, and `Manage` outline button.
6. Internal card sections use `border-t pt-4`, `space-y-2.5`, and an uppercase
   `text-xs` muted section label.
7. Initial loading uses geometry-matched `Skeleton` blocks. A failed top-level
   read becomes a centered card with a semantic icon, plain explanation, and
   `Retry` outline button.

Do not turn monitoring data into chat bubbles, oversized banners, or a long
unstructured column.

### B. Media Library management pattern

Use this pattern when administrators browse, filter, select, and mutate records.

1. Focused header with optional domain overline, `text-2xl font-semibold` title,
   one-sentence `text-sm text-muted-foreground` description, and an outline link
   to an adjacent workflow.
2. Configuration is a normal `Card`: `CardHeader` for title/description/status,
   `CardContent` for fields, checkboxes, metrics, and a single save action.
3. Use compact mode toggles before the collection. Active domain modes may use
   the domain accent; inactive modes use outline buttons.
4. Filter toolbar:
   - `flex flex-wrap items-center gap-2`;
   - search is `min-w-[200px] flex-1` with a 16px leading icon;
   - selects use explicit stable widths around 140–180px;
   - view/group controls are compact and keep accessible labels;
   - active filters remain visible and removable.
5. Gallery uses `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`, `gap-3`. Table view
   uses shared table primitives and stable column widths.
6. Selection produces a bounded bulk-action bar. Row and card overflow actions
   live in `DropdownMenu`; destructive actions are not permanently prominent.
7. Empty collections explain what the current filters produced. Loading holds
   the collection geometry. Pagination sits at the end with Previous, page
   status, and Next.
8. Mutations with cost, replacement, or deletion consequences use `Dialog` with
   a specific title, consequence description, Cancel, and the accurately named
   action. Destructive confirmation uses the destructive variant.

### C. Media Circulation cockpit pattern

Use this pattern when the page combines health, recommendation triage, and a
detailed proof inspector.

1. A contained cockpit hero may summarize identity, health badge, generated
   time, primary operational control, action menu, four compact vitals, and a
   small interactive visualization. Keep padding at `p-5 md:p-6` and internal
   gaps at 3–6.
2. Supporting proof/status panels are standard Console surfaces and follow the
   hero in priority order.
3. Main work area uses
   `xl:grid-cols-[minmax(0,1fr)_360px]`, `items-start`, and `gap-4`.
4. The primary queue is one `rounded-xl border bg-card`:
   - horizontally scrollable tab rail;
   - counts in compact badges;
   - active tab shown by text emphasis and a 2px domain underline;
   - search and contextual filters in a bordered `p-3` toolbar;
   - rows separated by `divide-y divide-border`;
   - selected row uses a light domain tint and a narrow lane rule;
   - row title is `text-sm font-medium`, proof is `text-xs muted`, and numeric
     priority is tabular.
5. Desktop inspector is `hidden xl:block`, sticky at `top-6`, and exactly 360px
   through the parent grid. It uses a standard bordered card and groups proof,
   score factors, evidence, and actions into sections.
6. Narrow screens open proof in a bottom `Sheet` with `max-h-[86vh]` and
   scrolling. Configuration opens in a right `Sheet`, full width on mobile and
   `sm:max-w-xl` on larger screens.
7. Selection, tab, query, filter, inspector, policy, and trace state should be
   URL-backed when users need refresh-safe or shareable operational context.
8. Skeletons match the hero and work-area geometry: a large rounded hero plus
   queue and desktop inspector blocks.

## 5. Shared component and sizing rules

- Use shared `Card`, `Button`, `Badge`, `Input`, `Select`, `Tabs`, `Sheet`,
  `Dialog`, `DropdownMenu`, `Skeleton`, `Checkbox`, `Switch`, and table
  primitives before creating custom equivalents.
- Standard control heights:
  - small buttons and dense rows: `h-8` or shared `size="sm"` (`h-9`);
  - normal inputs/buttons/selects: `h-10`;
  - large buttons: `h-11` only when genuinely prominent;
  - icon buttons: shared icon size, normally 40px; compact cockpit rows may use
    an explicit 32px control.
- Standard icon sizes:
  - 12–14px in badges, overlines, or dense row actions;
  - 16px in buttons, filters, and KPI cards;
  - 20–28px only in an empty/error state or page identity.
- Cards normally use shared `rounded-lg` and `shadow-sm`. Cockpit and large
  operational panels may use `rounded-xl`. Avoid larger radii.
- Card padding follows the primitives (`p-6`) unless density requires the
  established compact forms: `p-3`, `p-4`, or `p-5`.
- Use `gap-2` for related controls, `gap-3` for compact cards/rows, `gap-4` for
  primary layout, `gap-5` for analytic panels, and `space-y-6` for page sections.
- Titles and values truncate before they break layout. Long explanatory text
  wraps. IDs, hashes, URLs, and timestamps use `bdi`, `dir="ltr"`, and
  `font-mono` where appropriate.

## 6. State and action hierarchy

- A region has one visually primary action. Put less-common actions in an
  overflow menu or use outline/ghost treatment.
- Color always has a text or icon label. Use semantic badge variants for
  success, warning, failure, info, and neutral states.
- Use a small pulse/spinner only for the live action being refreshed. Preserve
  previously loaded data during background refresh and label it as refreshing.
- Disabled controls explain the governing state nearby; they do not disappear
  when discovery is valuable.
- Empty states use a muted icon, `text-base font-semibold` title, short muted
  explanation, and at most one recovery action.
- Error states identify the failed read or action and provide Retry when safe.
- Confirmation copy names the exact object count and consequence. Never label a
  destructive or costly action merely “Confirm.”

## 7. System controls and automation

This is the required UX/UI standard for controlling systems throughout Console.
Adopt it when building or revising a system page; existing controls are not all
compliant yet. A shared presentation must describe each backend owner's actual
capabilities. UI changes alone cannot create pause, cancellation, publication,
or manual-execution guarantees.

### A. Classify the control before designing it

Keep these concerns distinct:

| Concern | User question | Appropriate control |
| --- | --- | --- |
| Feature availability | Is this capability available? | Enable / disable the named feature |
| Source participation | Should this source be collected? | Stable-labelled source switch or bulk source action |
| Scheduled automation | Should future runs start automatically? | Enable, pause, resume, or turn off the named automation |
| Pipeline admission | May new processing start, including manual work? | Pause / resume the named pipeline |
| Action authority | May this system only observe, or also act? | Explicit mode choices in Settings |
| Individual work | What should happen to this particular run? | Run once, retry when safe, or cancel this run |
| Infrastructure | Should a service process be restarted? | Explicit maintenance action in System Health |

Do not use one toggle to stand for several of these concerns. A selected source
may remain enabled while its pipeline is paused; show the governing pause
instead of turning every source switch off. A healthy service can have disabled
automation, and enabled automation can be idle or blocked.

### B. Use precise action vocabulary

| Label | Required meaning |
| --- | --- |
| **Enable automation** | Permit future scheduled runs under the saved policy. State whether the first run starts now or at the next scheduled time. |
| **Turn off automatic runs** | Disable recurring starts. Explain whether manual runs remain available and what happens to already-admitted work. |
| **Pause automation** | Hold the named automatic starts while preserving configuration. State the exact scope and any manual-work restriction. |
| **Resume automation** | Remove the reviewed pause and restore saved behavior; do not silently enable sources or reset policy. |
| **Pause pipeline / Resume pipeline** | Hold or release new pipeline work, including manual execution where applicable. Name the pipeline. |
| **Run once** | Request one bounded run without enabling recurring automation or changing its mode. Name the operation, such as **Run discovery once**. |
| **Cancel run** | Request owner-supported cancellation of the selected run at a defined stopping point. State what may finish or remain. |
| **Enable / disable source** | Change future collection participation. Explain continuing work; preserve existing published content unless separately reviewed. |
| **Refresh status** | Read existing state. Do not trigger a new evaluation, repair, or run. |
| **Check now** | Perform the named diagnostic evaluation. Explain any recorded evidence; do not imply that a check executes repairs. |

Avoid bare **Start**, **Stop**, **Run**, **Enabled**, and **Automatic** when the
object or effect is ambiguous. Reserve **Stop** for an owner-supported action
that actually stops the named work; an admission pause is not termination.
Cancellation requested is not cancellation confirmed.

For the current Pods control, use pipeline language when describing its scope:
it holds source runs, new processing, publication, and manual processing. News
collection pause and Studio review-automation pause have different scopes and
must say so. A Studio Autopilot toggle must not imply that the Pods pipeline is
disabled. Changing an existing label must not change its backend behavior.

### C. Give each control a predictable home

- Use **Operations** as the cross-system overview. Group concise system rows
  under News, Pods, and Platform; show state, activity, and the supported action
  or link to the owning workspace. Extend the existing registry rather than
  creating a competing control-center page.
- Put the owning system's compact control strip directly below its page title,
  above workspace tabs and analytical summaries. Keep scope, current state,
  primary action, and continuing-work consequences visible without expansion.
- Related workspaces show the same owner-backed status and a link to the
  canonical controls. Do not add another independent setting or a redundant
  management banner when existing section navigation already supplies the route.
- Keep source switches beside source rows and run-specific actions beside the
  selected episode/run. A tenant-wide control must not look episode-specific
  when an episode is selected. Show environment and tenant scope explicitly.
- Keep service restart and other infrastructure maintenance in System Health;
  do not make routine automation controls behave like service power switches.

Use a quiet, divided strip rather than a large hero or a stack of configuration
cards. Reuse shared buttons, status text/badges, menus, dialogs, and typography.
One scoped accent rail is sufficient. Preserve the Console theme in both modes.

Illustrative layout; counts are example data, not live evidence:

```text
Pods pipeline                                      Local
Paused                                  [Resume pipeline]
No new source runs, processing, or publication.

1 step still running · 56 processing steps queued
View activity                              Settings
```

The strip must also explain whether manual work is held. Put policy details,
source exceptions, schedule details, and last-change attribution below a
disclosure. Essential action consequences must not depend on hover or expansion.

### D. Separate control state, activity, and health

Treat saved configuration, effective permission to start work, actual execution,
health/readiness, and evidence freshness as separate facts. Do not compress them
into a single green **Running** badge.

| Example status | Meaning |
| --- | --- |
| **Enabled · Idle** | Automatic starts are permitted; no current execution is proven. Show the next check when known. |
| **Enabled · Processing 1 episode** | Current execution is confirmed. |
| **Paused · 1 step still running** | New work is held; previously admitted work has not settled. |
| **Paused · No active processing** | The pause and absence of active processing are both confirmed. |
| **Enabled · Blocked by missing credentials** | Saved intent is enabled, but a named prerequisite prevents execution. |
| **Paused by System Health** | Another owner currently holds the operation. Link to that hold. |
| **Status unavailable · Last confirmed …** | Current evidence is missing or stale; retained data is historical context. |

- Never turn a missing/error response into `false`, zero, **Off**, or healthy.
  State freshness and expose a safe refresh/recovery action.
- After a pause is acknowledged, report the confirmed hold and any continuing
  activity. Use **Pausing…** only while application of the command is pending.
  Do not call work “finishing” when the owner only proves it is still running.
- An intentional operator pause is not itself a health incident. Pair semantic
  color with text; red means a confirmed failure or destructive consequence.
- Show the reason and owner of an effective hold. An operator resume cannot
  bypass independent health, budget, lifecycle, or permission restrictions.
- Preserve state while an action is pending, prevent duplicate submission, and
  show the backend-confirmed result. Request acceptance is not completed work.

Choose the main action from confirmed state:

| Situation | Main action |
| --- | --- |
| Not enabled or never configured | **Enable automation**, or **Review setup** when prerequisites are missing |
| Enabled, idle or executing | **Pause automation**, or **Pause pipeline** for that broader scope |
| Paused by a resumable operator action | **Resume automation / Resume pipeline** |
| Blocked by an independent owner | **Review issue** with the specific reason and owner link |
| Current control state is unavailable | **Refresh status** |

Keep a permitted narrowing action, such as pausing, discoverable when the backend
can safely apply it. Health alone must not manufacture action eligibility.

### E. Keep modes, defaults, and exceptions understandable

- Put ongoing runtime actions in the strip. Put configuration edits in Settings
  with explicit **Save changes / Discard changes**; preserve drafts on refresh,
  tab changes, and revision conflicts. Simple source participation switches may
  apply directly and report the confirmed result inline.
- Use stable-labelled switches only for simple binary settings. Use labelled
  radio/segmented choices for modes, such as **Monitor only / Allow automatic
  actions**. Avoid inverted labels such as “Safe Auto: off means Observe.”
- Translate a backend mode only when its behavior matches the user-facing term.
  State which automatic actions that mode permits; a “safe” name is not proof
  that every action is authorized or qualified.
- For media, distinguish **Source checks**, **Episode processing**, and
  **Chapter publication**. Where supported, offer Scheduled/By request,
  Automatic/By request, and Automatic when eligible/Review required respectively.
- Distinguish defaults from guarantees. Show **Processing default: By request ·
  2 source exceptions** when exceptions exist. A requirement such as **Review
  every publication** must be enforced across overrides before using that label.
- A pause preserves source selections and saved policies. A broader pipeline
  pause takes precedence over automatic source settings. Resuming must not
  overwrite unrelated configuration or release another owner's hold.
- Keep advanced thresholds and capacity tuning secondary. Follow the project's
  config discipline: runtime operator policy belongs behind owner APIs, not new
  environment variables or browser-only flags.

### F. Match review and feedback to consequences

| Action | Interaction |
| --- | --- |
| Narrow, reversible pause | Apply directly when the owner contract permits it; show confirmed scope and continuing work. |
| Enable/resume with backlog, cost, publication, or broader authority | Review current scope, queued work, relevant policy, and consequences before applying. |
| Cancel or destructive action | Explain the stopping point, retained/lost work, and recovery limitations. Require the owner's confirmation. |
| Bulk or cross-system action | Review exact targets, exclusions, continuing work, and duration; report each target's result. |
| Configuration edit | Save the reviewed changes explicitly; saving must not silently execute a run. |

Dialog titles and submit labels name the actual action. Keep one main action and
a secondary **Cancel**. Preserve focus on dismissal and avoid repeated generic
“Are you sure?” prompts. Use destructive styling only for destructive actions.

Reviews must use fresh owner evidence and remain bound to their reviewed scope
and version. A changed scope/control requires a fresh review. Retain an existing
operation identity when reconciling an uncertain submission; do not replay work
blindly after a lost acknowledgement. A dismissible toast supplements persistent
state and error feedback; it is not the only evidence of the outcome.

State **Until resumed** only when that duration is supported. Timed pauses show
their expiry and expected automatic resumption explicitly, including in reviews
and history. Do not imply that a pause expired merely because its read failed.

Operations' fleet pause must name its actual coverage. Show systems that continue
and unsupported targets before submission, then distinguish applied, excluded,
failed, and uncertain results. **Pause all supported automations** must never
imply that all processing or infrastructure has stopped. Restore only the pause
values still owned by the reviewed source command.

### G. Make unexpected activity explainable

Every run/episode inspection should answer **Why did this run?** and, separately,
**Why was this published?** Use recorded provenance, for example:

```text
Started automatically · Hourly source schedule
Published automatically · High-confidence chapter policy
```

Show human attribution for a human request and the actual trigger for scheduled,
recovery, or system work. Include time, affected scope, relevant policy/reason,
outcome, and links to the run or owner evidence. Do not infer a human requester
from a shared account or turn missing history into an automatic/system claim;
use **Origin not recorded** when provenance is absent.

Show who changed a control, when, why when recorded, its duration, and whether
that change still governs current behavior. Keep historical actions separate
from present state. Put raw IDs, fingerprints, receipts, and tool keys in details.

#### Activity sidebars

Use an **activity rail** for tools operators open alongside their work. Reserve
a narrow column at the workspace edge on wide screens. Keep the rail visible
while the page scrolls and mark the active tool. Open its panel inward with a
clear border, a fixed header, and an independently scrolling body. Preserve
the main workspace width as the panel opens and closes. Give icon buttons
accessible names and use the same button or Escape to close the panel. On
narrow screens, use a labelled button that opens the shared full-width sheet.
Add rail tools when the workflow needs them.

Use an activity sidebar when operators need to check recent changes while
keeping their place in the current workflow. Use the shared `Sheet` when the
panel needs modal behavior. Keep the title, scope, and close action visible while the
event list scrolls. Use a comfortable reading width on desktop and a full-width
sheet on narrow screens.

- Name the panel for the system and the events it includes. **News change
  history** covers source participation and pause/resume events. Put the
  environment and tenant in one short scope line beneath the title.
- Group events by date, newest first. Use compact rows with subtle separators,
  an outcome as the headline, and the time and recorded operator together on
  a secondary line. Use stable ordering and expose precise times in details
  when consecutive events display the same time.
- Write the actual outcome. Use **44 sources enabled** for confirmed enables,
  **Already paused** for a pause that changed nothing, and **2 skipped ·
  connection setup required** when the recorded evidence supports that reason.
  Distinguish repaired scheduling from newly enabled sources when recorded.
- Expand a row for affected sources, skip reasons, and other evidence. Keep
  the list focused on changes, with current state visible in the system
  controls. Label any live state shown in the sidebar **Current state**.
- State the history limit when the list is bounded. Give loading, unavailable,
  and empty history distinct states. Offer a dedicated Activity view when
  operators need to search, filter, or compare many events.

### H. Require an owner contract and verify the result

Before adding or migrating a control, record the following in the existing
system documentation or implementation plan:

| Required fact | What to establish |
| --- | --- |
| Owner and scope | Authoritative API, environment, tenant, lane, system, or exact entity |
| Effect | What changes, which admission/dispatch/publication boundaries enforce it, and what is preserved |
| Continuing work | Behavior of queued, claimed, executing, verifying, and uncertain work; manual-work availability |
| Lifetime and precedence | Persistence, expiry, governing holds, defaults, and source/episode exceptions |
| Eligibility | Required permission, readiness, current state/version, and supported actions |
| Outcome proof | Accepted versus applied versus verified, freshness, attribution, and safe retry/reconciliation |

Console uses the existing BFF and domain APIs. Reuse shared presentation and
typed adapters; do not create a second control store, scheduler, generic mutation
endpoint, or UI business-rule engine. Missing backend capability is a delivery
gap, not permission to display a stronger guarantee. Register missing Operations
coverage with its real owner behavior before exposing cross-system commands.

Adopt the pattern in this order: inventory current control semantics; establish
the shared presentation; qualify News collection and the Pods pipeline; register
their accurate Operations coverage; extend to discovery and other systems.
Reference implementations are complete only after their owner effects have been
verified, not just their button states.

## 8. Operator application

Operator must combine the three reference archetypes rather than create a new
visual language:

- Use the **Media Library header and toolbar pattern** for case search, case
  filters, locale, and New case.
- Use the **Media Circulation queue + 360px inspector pattern** for conversation
  history, active tasks, evidence, governance, and plan proof.
- Use the **Content KPI/status pattern** for compact task totals, lifecycle
  health, spend state, and control availability when summary metrics add value.
- Render questions and answers as compact `Card` sections or divided rows. Do
  not use oversized consumer chat bubbles, editorial typography, colored page
  backgrounds, or a separate full-screen shell.
- The active investigation is a standard lifecycle card with status badge,
  progress/events, cancellation when eligible, and a clear terminal outcome.
- CMS-derived eligible actions are queue/card rows with localized label, risk
  badge, target summary, and `Review plan` button. The raw tool key belongs in
  advanced details only.
- Plan review follows the Media Circulation inspector/sheet pattern and shows
  target, evidence freshness, expected effects, rollback, contingency,
  confirmation, execution state, and verified effects.
- Evidence citations open or focus the inspector. Technical evidence metadata
  is grouped like the Media Circulation evidence definition list.
- Desktop uses `xl:grid-cols-[minmax(0,1fr)_360px]`; below `xl`, the inspector is
  a standard bottom sheet. Case navigation may be a compact card/column on wide
  screens and a standard sheet on narrow screens.
- Governance remains discoverable in inspector tabs and must never be covered
  by a floating launcher.

## 9. Responsive, RTL, and accessibility requirements

- Begin with one column. Add analytical columns only at the same breakpoints as
  the references (`md`, `lg`, `xl`).
- At 320px, toolbars wrap and selects may become full width; no horizontal page
  overflow is allowed. Only tab rails and tables may scroll intentionally.
- Use shared `Sheet`/`Dialog` focus trapping and close behavior. Sheets close by
  Escape, close control, or backdrop.
- Every icon-only control has an accessible name. Hover-only row actions must
  also be reachable through keyboard focus or an overflow menu.
- Preserve visible shared focus rings and respect reduced motion.
- Announce action results and important status changes with the appropriate
  live region without moving focus. Use accessible names and descriptions for
  scope, switch state, pending work, and disabled-action reasons.
- On touch screens, provide non-overlapping effective targets of at least
  44px where practical, including compact source switches and overflow actions.
- Keep the current state and pause/resume action available on mobile; wrap
  supporting copy and move secondary details below rather than shrinking text.
- English and Arabic use identical information hierarchy and capabilities.
  Prefer logical properties and `text-left` only where a shared primitive
  requires it.
- Apply `dir="auto"` to user/model/evidence prose. Isolate IDs, hashes, URLs,
  metrics, and timestamps with `bdi` or explicit LTR direction.

## 10. Definition of done

A Platform Console screen is complete only when:

- it visually belongs beside Content, Media Library, and Media Circulation;
- it stays inside `DashboardShell` and uses the shared primitive library;
- domain accents are scoped and semantic rather than page-wide decoration;
- its loading, refreshing, empty, error, disabled, success, and stale states are
  designed—not incidental;
- primary, secondary, overflow, confirmation, and destructive actions have a
  clear hierarchy;
- desktop, tablet, mobile, keyboard, reduced-motion, English, and Arabic states
  preserve the same operational capability;
- it has no unintended horizontal overflow at 320px, 768px, 1024px, or 1440px.

For a system-control change, also verify:

- the operator can identify scope, current state, and the next action without
  opening Settings;
- every label matches its owner effect, including manual work and publication;
- enabled, idle, active, paused-with-active-work, blocked, loading, stale,
  unavailable, read-only, and failed/uncertain-action states are deliberate;
- a successful narrowing action is observable at the owner boundary, while
  unaffected lanes and existing published output remain available as promised;
- resume preserves selections and unrelated policy, respects independent holds,
  and reconciles eligible queued work without replaying completed effects;
- first enable, timed expiry, source exceptions, concurrent edits, expired
  reviews, duplicate clicks, and lost acknowledgements have explicit behavior;
- bulk partial results and unsupported targets are visible rather than reported
  as unconditional success;
- activity provenance explains automatic versus human-triggered work, or states
  that its origin is not recorded;
- owner-backed state agrees across Operations, the owning page, and linked
  workspaces, with obsolete controls removed or redirected;
- meaningful interaction tests and owner-effect checks pass, and desktop/mobile,
  keyboard, light/dark, and English/Arabic layouts have been reviewed. Use
  disposable targets for effectful qualification; never activate real recurring
  or publishing work just to obtain a screenshot.

## References

- [Console features and service contracts](../docs/platform-console.md)
- [Architecture and helper-system ownership](../docs/index.md)
- [W3C switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [GOV.UK button and confirmation guidance](https://design-system.service.gov.uk/components/button/)
