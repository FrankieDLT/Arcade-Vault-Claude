---
name: full-game-impl
description: Full pipeline for a new real game. Implements an approved game spec with the /spec-impl flow, then runs the mobile-porter agent, then the skin-designer agent (phase A, user approval, phase B), then the game-perf-booster agent (measure, fix only if off target).
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /full-game-impl — Spec to playable, touch-ready, skinned game

Runs four stages in strict order: `/spec-impl`, then the `mobile-porter` agent, then the `skin-designer` agent, then the `game-perf-booster` agent. Never run the stages in parallel. Never commit unless the user asks.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

The received argument is: `$ARGUMENTS`

---

## Stage 1 — /spec-impl

`spec-impl` cannot be invoked through the Skill tool (it has `disable-model-invocation: true`). Instead:

1. Read `C:\Users\USER\.claude\skills\spec-impl\SKILL.md`. If that path fails, read `C:\Users\USER\.agents\skills\spec-impl\SKILL.md`.
2. Follow its four phases exactly, with `$ARGUMENTS` as the spec name and the session context above in place of its `!` lines. Keep every pause it defines: dirty working tree, branch resume point, start confirmation, and the diff review after each step.
3. If `spec-impl` stops (spec not found, state not Approved, user declines or halts), stop the whole pipeline. Do not launch any agent.

Do not go to Stage 2 until every step of the plan is implemented.

## Gate before the agents

1. Run `npm run lint` and `npm run build`. If either fails, fix the failure (within the spec's scope) and re-run.
2. Find the game id the spec added (the `gameId` key of the new entry in `components/game-registry.tsx`; confirm with Grep). If the spec did not add a real game, say so and stop: the agents only work on real games.
3. Use AskUserQuestion: "Spec implemented. Continue with mobile-porter, skin-designer and game-perf-booster for `<game-id>`?" Options: continue / stop here. Stop if the user chooses stop.

## Stage 2 — mobile-porter

Launch the Agent tool with `subagent_type: "mobile-porter"`. Prompt: the game id and the spec path, for example `Port touch controls and haptics for game id "<game-id>" (spec: specs/NN-slug.md).` If the game already has a `touch` entry the agent skips it; that is fine.

Wait for it to finish. Relay its reply: style chosen, pad layout, haptics, lint/build result, walkthrough results, known gaps and the manual real-device follow-up. If it reports that shared code needs a change or that it needs `/frontend-design` work, stop and ask the user before Stage 3.

## Stage 3 — skin-designer

Start only after Stage 2 has finished.

1. **Phase A:** launch the Agent tool with `subagent_type: "skin-designer"`. Prompt: `Game id: <game-id>.` It adds the missing mandatory skins and proposes 2 fresh skins.
2. Show the user the fresh-skin proposals (id, label, mood, palette, legibility note). Use AskUserQuestion with `multiSelect: true` so the user picks which fresh ids to approve. The user can also answer "none" or ask for changes via Other.
3. **Phase B:** continue the same agent with SendMessage (`approved: <ids>`; with none approved, say all proposals are rejected). If the agent cannot be continued, launch a new `skin-designer` with `Game id: <game-id>. approved: <ids>`. If the user asked for changes, pass them and repeat step 2 when it re-proposes.
4. Relay the final reply: skins added, contrast ratios, files changed, lint/build result.

## Stage 4 — game-perf-booster

Start only after Stage 3 has finished (all skins built), so the agent measures every final skin and the touch pad.

1. Launch the Agent tool with `subagent_type: "game-perf-booster"`. Prompt: `Game id: <game-id>. New real game from spec specs/NN-slug.md; all skins and touch controls are in place. Measure and fix only if the numbers miss the SPEC 12 target.`
2. Wait for it to finish. Relay: verdict (within target / fixed / shared cause reported), before and after numbers, fixes kept and rejected, files changed, lint/build result, skin and game-speed checks, and the section added to `references/perf/perf-log.md`.
3. If it reports a shared cause (CSS layers, `GamePlayer` re-renders), do not fix it in this pipeline. Show the user the numbers and list it as a follow-up.

## Final report

Give: the spec and branch, one short summary per stage, `git status --short`, the last lint / build result, and the manual follow-ups (real-device touch check, frame time on real hardware since the software-render proxy is not the user's machine). Remind the user to verify the spec's acceptance criteria, set the spec state to "Implemented", and commit; committing is their decision.

## Rules

- Stages run one after the other, never in parallel.
- Never commit, stash or push on the user's behalf.
- Do not change a stage's scope: each agent edits only what its own definition allows.
- All UI text is English.
