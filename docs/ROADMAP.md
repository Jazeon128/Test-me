# Roadmap

Written 2026-09-27. Two inputs: more visual templates for the canvas, and the
learning mechanics demonstrated by Index Zero
(https://www.youtube.com/watch?v=YhavzsLUOS0).

## Where the app actually is

| Area | State |
|---|---|
| Sources | PDF, DOCX, PPTX, HTML, Markdown, YouTube. Organised into notebooks |
| Canvas | 12 templates, routed by Jev, every node cited back to a passage |
| Questions | Generated per document, or scoped to one canvas node |
| Spaced repetition | SM-2, working: easiness factor, interval, repetitions, due dates |
| Gamification | **Mostly a facade. See below** |

Two things look finished and are not:

**Points are computed and thrown away.** `POST /api/progress/submit` returns
`points_earned` and `streak_bonus` on every answer. No model stores them. The
number is rendered once and lost.

**"Current Streak" does not mean days.** It is the consecutive-correct count of
whichever single question you answered most recently
(`app/api/progress.py:344`). Answer one question wrong and the dashboard reads
zero, however many days in a row you have studied. A person reading "Current
Streak" on a study app expects days. This is the first thing to fix, because
every other mechanic below hangs off a real activity record.

## What Index Zero does, and what transfers

Index Zero is a free local desktop app: 422 curated DSA problems, 114 lessons
across 15 phases, a fox mascot called Zero, and a local LLM coach.

The important structural difference: **its power comes from curation.** A person
chose those 422 problems and ordered those 15 phases, which is exactly what
solves the "paradox of choice" the author describes. Test Me generates from
whatever you upload. We cannot copy a curated ladder, and pretending to would
produce a worse version of both products.

So mechanics split cleanly:

| Mechanic | Depends on | Transfers? |
|---|---|---|
| Activity heat map | Your own activity | Yes, directly |
| Mascot tied to streak | Your own activity | Yes |
| Awards on milestones | Your own activity | Yes |
| Coach mode, staged thinking | The material | Yes, reshaped |
| Second-order question after answering | The material | Yes, and it is the strongest idea |
| Weekly profile summary | Your own activity | Yes |
| "You have neglected this topic" | Your own activity | Yes, we have the data already |
| 15 phases, 114 lessons | Hand curation | No |
| 422 problem ladder | Hand curation | No |
| Brain games | Nothing in our domain | No, see Skip |
| Local model tiers | Local inference | No, we call a hosted API |

### The idea worth stealing outright

After you solve a problem, Index Zero asks for the **time and space
complexity** and grades that answer. It is a second question about your own
answer, not about the material.

That generalises past code. After answering a question, the app can ask one of:

- Why is the wrong option you nearly picked wrong?
- Which passage in the source supports this?
- Where would this answer stop being true?

This is the cheapest large win available. It roughly doubles the thinking per
question with no new content, it uses the citation data the canvas already
stores, and research on retrieval practice supports it. Nothing else on this
list changes learning outcomes as directly.

### The idea worth stealing second

**Coach mode.** Index Zero walks you through understand, intuition, brute
force, trade-offs, optimise. That ladder is specific to algorithms. The
equivalent for document study: explain it back in your own words, the app
checks your explanation against the passage, then asks what you left out.
Self-explanation is the mechanism, and the source passage is the grader.

## Phases

Ordered so each phase is usable on its own and unblocks the next. Estimates are
deliberately absent: what matters is the order and the dependencies.

### Phase 1: Make the activity record real

Nothing else works without this. **Recommended.**

- `StudyDay` table: date, questions answered, correct, canvases made, seconds
  spent. One row per day.
- `Award` table: what was earned, when, why.
- A real daily streak, computed from consecutive `StudyDay` rows, replacing the
  per-question number currently mislabelled on the dashboard.
- Persist the points that are already being calculated and discarded.
- Heat map on the Progress page, a year of days.

Everything here is our own data. No model calls, no cost.

### Phase 2: The second question

The strongest learning mechanic. **Recommended.**

- After an answer, one follow-up question about the answer itself, chosen by
  the question type.
- Grade the free-text response against the source passage the question came
  from. We already store that link.
- Wrong answers earn a follow-up more often than right ones.

Cost: one extra model call per follow-up. On Gemini 3.8 Flash free tier, zero.
On paid tier, roughly $0.0005 per follow-up.

### Phase 3: More canvas templates

Cheap, and asked for. **Recommended, but bounded.**

Each template is one dataclass in `app/services/viz/templates.py` plus a line
in the frontend `LAYOUTS` map. Most reuse existing node components and elk
algorithms. Jev's Choice primitive takes up to 255 options, so 12 is nowhere
near a structural limit.

| Template | Layout | Why |
|---|---|---|
| Decision tree | elk layered | "Which service when" is the most common shape in cloud and certification material, and today it flattens into a flowchart |
| Sequence diagram | custom columns | Who calls whom, in order. Actors as columns, time downward. Common in API and protocol material |
| Layer cake | elk box | Stacks: network models, abstraction layers |
| Matrix quadrant | custom | Two axes, four regions. Effort against impact, risk against likelihood |
| Entity relationship | elk layered | Entities and cardinality, for data modelling material |
| Venn | custom | What two or three things share. Needs real custom layout work |

**The constraint that matters:** more options is not automatically better
routing. Twelve descriptions already cost about 9,300 input tokens per call,
and two templates whose descriptions overlap split probability between them and
push confidence under the 0.6 floor, which shows the picker instead of a
diagram. Decision tree sits close to flowchart and is exactly this risk.

Add decision tree and sequence first. Then read `canvas_routing_log` for
confidence drops before adding more. The log exists for this.

### Phase 4: Coach mode

**Recommended after Phase 2**, because it shares the grading machinery.

- Explain a node or a passage in your own words.
- The app checks the explanation against the source and names what you missed.
- Reachable from a canvas node, which is where curiosity actually happens.

### Phase 5: Knowing you, and saying so

**Recommended.** All from data Phase 1 creates.

- Weekly summary: what you covered, what you neglected.
- "You have not touched Domain 3 in 12 days" from `UserProgress.last_attempt_date`.
- Suggested next source or node, from mastery gaps.

Jev fits here, not a generative model: ranking which topic to surface is a
Score over comparable items, which is what System One is for and costs
fractions of a cent.

### Phase 6: A mascot

**Deferred.** Honest about why: Zero the fox works because it has a character,
an illustrator, and an author whose audience already likes him. A generic mascot
bolted onto a personal study tool is decoration, and a sad cartoon shaming you
for missing a day is a manipulation pattern, not a feature.

The part that works without any of that is the **streak record itself**, which
Phase 1 delivers. Build the data, see whether you care, then decide.

## Not building

| Thing | Verdict | Why |
|---|---|---|
| Brain games | **Skip** | Pattern recognition and fast-maths games are a different product. Index Zero includes them as an anti-doom-scrolling break, which is a goal our app does not have |
| Curated phase ladder | **Skip** | Our content is whatever you upload. A generated "roadmap" over arbitrary documents would be fake structure |
| Leaderboards, social | **Skip** | Single user, local. Index Zero removed competition deliberately and was right to |
| Local model tiers | **Skip** | We call a hosted API. Local inference is a different architecture, not a setting |
| Interview simulator | **Deferred** | Real value for certification prep, but it is its own feature, not a variation on anything here |

## Order, and why

1. **Phase 1** first, without exception. Every other mechanic reads the activity
   record, and the dashboard is currently showing a number that does not mean
   what it says.
2. **Phase 2** next. Largest learning gain per unit of work, and it needs only
   the citation link we already store.
3. **Phase 3** any time. Independent of the rest, and bounded at two templates
   until the routing log says more is safe.
4. **Phases 4 and 5** after 1 and 2, since they reuse the grading and the
   activity data.
5. **Phase 6** only if the streak turns out to matter to you.

## Costs

| Item | Free tier | Paid, Gemini 3.8 Flash |
|---|---|---|
| Jev routing per canvas | n/a | $0.0004 |
| Canvas generation | $0 | about $0.04 |
| Question generation per document | $0 | $0.10 to $0.30 |
| Follow-up question (Phase 2) | $0 | about $0.0005 |
| Phases 1, 3, 6 | $0 | $0, no model calls |

The free tier has real rate limits. It ran out during testing after four
canvases and one document's questions.
