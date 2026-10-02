# User guide

Use a notebook to keep a topic's sources, chat and study material together. Start the app with the [README setup steps](../README.md#quick-start).

## Create and open a notebook

Open Notebooks in the navigation. Create a notebook with a name. A description and an emoji icon are optional. Open its card to enter the workspace.

| Area | Use |
| --- | --- |
| Sources | Add material and tick what you want to use |
| Centre | Chat with your sources, practise a deck or edit a deck |
| Studio | Generate study material, watch jobs and open artifacts |

An artifact is a saved quiz, flashcards deck or canvas. Older material without a notebook appears in Unsorted.

## Add sources

1. Open Sources and choose Add source.
2. Select one or more files or enter a YouTube uniform resource locator (URL).
3. Choose Add sources.
4. Wait for each source to become Ready.

| Material | Accepted file names or requirement |
| --- | --- |
| Portable Document Format (PDF) | `.pdf` with readable text |
| HyperText Markup Language (HTML) | `.html` or `.htm` |
| Markdown | `.md` |
| Word document | `.docx` |
| PowerPoint presentation | `.pptx` |
| YouTube | Video URL with an available transcript |

The default file limit is 10,485,760 bytes. Adding sources reads and stores their text. It does not generate a deck. Source names use file names or titles. YouTube titles appear when available.

| Status or note | Meaning | Next action |
| --- | --- | --- |
| Reading... | The app is reading the source | Wait. You cannot tick it yet |
| Ready | The source can be used | Tick it for chat or generation |
| Failed | The app could not read it | Read the error, correct the problem and re-add it to retry |
| Already in this notebook | The same material is already stored | Use the existing source |

## Tick the material you want to use

Tick a Ready source to include it. Untick it to exclude it. Select all ticks every ready source. Clear unticks all sources. Newly ready sources are ticked automatically, so check the selection before sending a question or generating.

The selection controls your next chat question and your next generation request. It does not change an existing deck. Choose only relevant sources when you want a focused answer.

## Chat with your sources

Choose your sources, then type a question in the centre. Press Enter to send. Press Shift+Enter for a new line. You can ask for a summary, a comparison or an explanation of a specific term.

Open a numbered citation such as `[1]` to see its source name, location and excerpt. Compare the answer with that excerpt. Close the citation with Escape to return focus.

| Chat result | Meaning | What to do |
| --- | --- | --- |
| I could not find that in the selected sources | The app found too little matching evidence and did not call the answer model | Tick a relevant source or ask a more specific question |
| Not in your sources | The answer model could not support the answer from the retrieved excerpts | Add the missing material or revise the question |
| Answer without citations | The answer has no valid source citations | Treat it as unsupported and inspect the source yourself |
| Removed source | A citation belongs to a source that was deleted | The old excerpt is no longer available. Ask again using current sources |
| Sources are still processing | A selected source is not ready | Wait and resend. Your draft is retained |
| Request error | The provider or connection failed | Read the error and use Retry |

Load earlier shows older messages. Clear chat asks for confirmation before deleting the notebook's chat history. Opening and closing a deck preserves the chat history and draft.

Chat uses selected source text as evidence. Instructions written inside a source should not control the answer. Citations point to excerpts, but they do not prove that every claim is correct.

## Generate a quiz or flashcards

1. Tick at least one ready source.
2. Choose Quiz or Flashcards in Studio.
3. Set Number of questions from 1 to 100.
4. Choose easy, medium, hard or mixed difficulty.
5. Optionally enter a deck name.
6. Choose Generate.

The number is the total for the deck. The app divides it across the selected sources. It does not request that number from every source.

If a source is still reading, wait before generating.

## Read the progress card

Studio shows running jobs. The progress card names the current step, reports section counts, shows elapsed time and explains provider retries. Keep the backend running while a job is active.

Read the final counts and warnings. The app can save fewer questions than requested when sections fail or quality checks hold questions back. A completed job does not promise that every requested question was saved. Continue dismisses completed warnings and held-back notices after you have read them.

OpenRouter waits at most 180 seconds per generation or canvas attempt and 90 seconds per chat attempt. It retries a deadline once. Other provider errors can also cause retries. Credit or quota exhaustion can stop generation.

## Practise and review due questions

In Studio, choose Practise on a deck. The centre opens practice while Sources and Studio stay available. Close the deck to return to chat.

| Answer mode | How it works |
| --- | --- |
| Multiple choice | Choose an answer within 30 seconds. Timing stops when you choose. Read the explanation before continuing |
| Written answer | Untimed. Type an answer. A wrong first answer gives a hint and one more try. Requires TypeSafe |
| Explain it | Explain the idea in your own words. The first check flags unclear or wrong sentences. Requires TypeSafe |

If grading is unavailable, the app records no attempt. Written grading reports a score from 0 to 5. A correct second try is capped at 3.

Home shows Review due when at least 1 question is due. Open it to review due questions across notebooks at `/review`. When 0 questions are due, the card is hidden. Review scheduling uses SuperMemo 2 (SM-2) to choose when questions return.

Home's Progress section shows learning statistics. Studio shows notebook answered, correct and due counts. Each deck artifact shows its question count, due count and held-back count.

## Edit a deck and review held-back questions

Choose Open on a deck in Studio. The centre becomes the deck editor. Edit questions and answer options, save changes, add questions or manage tags. Close the editor to return to chat.

Quality checks keep suspicious questions out of practice. Held-back questions retain the reason for the check. Read each question, its answer and its source before deciding.

| Action | Result |
| --- | --- |
| Restore | Add the held-back question to the deck for practice |
| Discard | Reject the held-back question |

A deck with held-back questions can remain available even when it has no accepted questions. Review the held-back questions before assuming generation saved nothing.

## Make and use a canvas

Tick the source you want, then choose Canvas in Studio. Canvas currently uses the first ticked source, so tick only one source for this task. Describe the diagram you want on the canvas screen.

The app can choose a diagram template with the optional TypeSafe check. When it cannot choose, it asks you to select a template. Read the job status while the diagram is generated. Saved canvases appear under Artifacts in Studio.

Open a saved canvas to explore it. Select a node to inspect its source information and related questions. Drag nodes to adjust the layout. A diagram is a study aid. Check its source before relying on its claims.

## Configure Settings

Choose Settings in the navigation.

| Setting | Task |
| --- | --- |
| Question generation | Choose the provider and model used to generate questions |
| Chat | Choose the provider and model used to answer chat questions |
| Provider keys | Save and test a key for each provider you use |
| OpenRouter catalog | Search available models and compare input and output prices |
| OpenRouter credit | Check remaining credit when a limit exists. Without a limit, the app shows usage |
| TypeSafe | Configure quality checks and written grading |

Supported providers are Anthropic, OpenAI, Gemini and OpenRouter. Recommended: start with OpenRouter or Gemini. Check free allowances first. Catalog prices and remaining credit do not guarantee that a model request will succeed.

Keys entered here go to the operating system (OS) credential store. On Windows, this is Windows Credential Manager. The app reports whether a key exists and where it is stored. It never displays saved key characters.

If the credential store is unavailable, use a private `backend/.env` as described in the README. Never commit it. Real keys must never go into `.env.example`, shared screenshots or bug reports.

The app tries the credential store first, then environment configuration, then old database values read only. Removing a credential-store key can reveal a lower-priority key. Check the reported storage source if a key still appears configured.

For an older installation, follow the README's key migration instructions. Database backups can contain old keys. Keep them private even after migration.

| Component | Monthly fixed service cost | Usage |
| --- | ---: | --- |
| Local workspace and credential store | $0 | Existing device and electricity |
| Multiple-choice practice | $0 | No model calls |
| Generation, chat and optional checks | $0 app subscription | Provider charges depend on your account and model |

Selected source text is sent to external providers for model calls. Store only material you are allowed to send to those providers.

## Use a phone or a narrow window

Below 1,024 pixels, Sources and Studio open as drawers from the top bar. Only one drawer opens at a time. Close it using Escape, its close button or the backdrop. The centre stays available for chat or the open deck.

At 1,024 pixels and above, both side columns can collapse. Expand them when you need to change sources or open an artifact. Keyboard focus moves into opened decks and returns when they close.

The responsive layout does not provide public hosting. Use the local app setup. Live public hosting remains deferred. See the [roadmap](ROADMAP.md).
