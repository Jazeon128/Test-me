const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' })
const click = name => async page => { await button(page, name).click() }
const visible = async locator => { await locator.waitFor({ state: 'visible' }) }
const workspace = async (page, ctx, query = '') => {
  await page.goto(`${ctx.baseUrl}/notebooks/${ctx.notebookId}${query}`)
  await visible(button(page, 'Add source'))
}
const deck = (key, view) => async (page, ctx) => {
  await workspace(page, ctx, `?deck=${ctx[key]}&view=${view}`)
  await visible(page.getByRole('heading', { name: new RegExp(`^${view === 'practice' ? 'Practising' : 'Editing'} `) }))
  if (view === 'edit') await visible(button(page, 'Edit item 1'))
  else await visible(button(page, /^Show answer$/i))
}
const canvas = async (page, ctx) => {
  if (!ctx.canvasId) throw new Error('The notebook has no saved canvas')
  await page.goto(`${ctx.baseUrl}/notebooks/${ctx.notebookId}`)
  await visible(page.locator('.workspace-chat h1'))
  if (await button(page, /^Studio /).isVisible()) await button(page, /^Studio /).click()
  await page.locator(`a[href="/notebooks/${ctx.notebookId}?view=canvas&canvas=${ctx.canvasId}"]`).click()
  await visible(page.getByRole('toolbar', { name: 'Canvas tools' }))
  await visible(page.locator('.react-flow__node').first())
}
const step = (id, title, action, run, viewport = 'desktop') => ({ id, title, action, viewport, run })
const flow = (id, title, steps) => ({ id, title, steps })

async function answerQuiz(page) {
  // AnimatePresence briefly retains the previous disabled question.
  await button(page, /^A\./).last().click()
  await button(page, 'Show Answer').last().click()
  await visible(button(page, /^Good/).last())
}

export const flows = [
  flow('home', 'Home', [
    step('notebooks', 'Notebooks', 'Open home', async (page, ctx) => {
      await page.goto(ctx.baseUrl)
      await visible(button(page, /AWS GenAI certification/))
    }),
    step('new-notebook', 'New notebook form', 'Click New notebook', click('New notebook')),
    step('settings', 'Settings', 'Cancel and open Settings', async (page, ctx) => {
      await button(page, 'Cancel').click()
      await page.goto(`${ctx.baseUrl}/settings`)
      await visible(page.getByRole('heading', { name: /Settings/, exact: true }))
    }),
    step('review', 'Review', 'Open Review', async (page, ctx) => {
      await page.goto(`${ctx.baseUrl}/review`)
      await visible(button(page, 'Exit review'))
      await page.getByLabel('Loading test session').waitFor({ state: 'hidden' })
    }),
  ]),
  flow('workspace', 'Notebook workspace', [
    step('loaded', 'Sources, chat and studio', 'Open AWS GenAI certification', workspace),
    step('ready-source', 'Ready source', 'Select the ready source', async (page, ctx) => {
      const source = ctx.sources.find(item => item.status === 'ready')
      if (!source) throw new Error('No ready source in the notebook')
      const checkbox = page.getByRole('checkbox', { name: source.display_name, exact: true })
      await checkbox.check()
      await checkbox.scrollIntoViewIfNeeded()
    }),
    step('failed-youtube', 'YouTube source failure', 'Look at the failed YouTube source', async (page, ctx) => {
      const source = ctx.sources.find(item => item.status === 'failed' && item.file_type === 'youtube')
      if (!source) throw new Error('No failed YouTube source in the notebook')
      const row = page.getByRole('listitem').filter({ has: page.getByRole('checkbox', { name: source.display_name, exact: true }) })
      await row.scrollIntoViewIfNeeded()
      await visible(row.getByText(source.error_message || 'Failed', { exact: true }).last())
    }),
    step('add-source', 'Add source form', 'Click Add source', click('Add source')),
  ]),
  flow('chat', 'Chat', [
    step('conversation', 'Existing conversation', 'Open the notebook chat', async (page, ctx) => {
      await workspace(page, ctx)
      await visible(page.getByRole('article', { name: 'Assistant message' }).last())
    }),
    step('citation', 'Citation passage', 'Click a citation', async page => {
      await button(page, /^Citation \d+:/).last().click()
      await visible(page.getByRole('dialog', { name: /^Citation/ }))
    }),
    step('draft', 'Chat draft', 'Close citation and type a question without sending', async page => {
      await button(page, 'Close citation').click()
      await page.getByRole('textbox', { name: 'Ask about your sources' }).fill('How do Amazon Bedrock Guardrails protect model inputs and outputs?')
    }),
  ]),
  flow('studio', 'Studio', [
    step('quiz-form', 'New quiz form', 'Click Quiz', async (page, ctx) => { await workspace(page, ctx); await button(page, 'Quiz').click() }),
    step('flashcards-form', 'New flashcards form', 'Close form and click Flashcards', async page => { await button(page, 'Close form').click(); await button(page, 'Flashcards').click() }),
    step('canvas-form', 'Canvas request form', 'Close form and click Canvas', async page => {
      await button(page, 'Close form').click()
      await button(page, 'Canvas').click()
      await visible(button(page, 'Draw it'))
    }),
  ]),
  flow('quiz', 'Quiz practice', [
    step('open', 'OpenRouter check practice', 'Open OpenRouter check in practice', deck('quizDeckId', 'practice')),
    step('question', 'Quiz question', 'Read the question', async page => { await visible(button(page, /^A\./)) }),
    step('feedback', 'Answer feedback', 'Choose A and click Show Answer', answerQuiz),
    step('summary', 'Session summary', 'Rate each answer Good until the summary', async page => {
      for (let index = 0; index < 50; index++) {
        const response = page.waitForResponse(res => res.url().includes('/api/progress/submit') && res.request().method() === 'POST')
        await button(page, /^Good/).last().click()
        const submitted = await response
        if (!submitted.ok()) throw new Error(`Rating failed: HTTP ${submitted.status()}`)
        await visible(button(page, /^(Show Answer|Finish)$/).last())
        if (await button(page, 'Finish').isVisible()) return
        await answerQuiz(page)
      }
      throw new Error('Quiz summary was not reached after 50 questions')
    }),
  ]),
  flow('flashcards', 'Flashcards', [
    step('open', 'Sample flashcards practice', 'Open Atlas sample flashcards in practice', deck('deckId', 'practice')),
    step('front', 'Flashcard front', 'Read the front', async page => { await visible(page.getByRole('region', { name: 'Flashcard', exact: true })) }),
    step('flipped', 'Flashcard back', 'Click Show answer', click('Show answer')),
    step('rated', 'Next flashcard', 'Rate the card Good', async page => {
      const response = page.waitForResponse(res => res.url().includes('/api/progress/submit'))
      await button(page, 'Good, key 3').click()
      if (!(await response).ok()) throw new Error('Flashcard rating failed')
      await visible(button(page, 'Show answer'))
    }),
  ]),
  flow('editor', 'Deck editor', [
    step('quiz', 'Quiz deck editor', 'Open OpenRouter check in edit view', deck('quizDeckId', 'edit')),
    step('item-form', 'Edit quiz item', 'Click Edit item 1', click('Edit item 1')),
    step('flashcards', 'Flashcards deck editor', 'Cancel and open sample flashcards in edit view', async (page, ctx) => { await button(page, 'Cancel').click(); await deck('deckId', 'edit')(page, ctx) }),
  ]),
  flow('bank', 'Question bank', [
    step('open', 'Question bank', 'Click Questions', async (page, ctx) => { await workspace(page, ctx); await button(page, /^Questions \(/).click(); await visible(page.getByRole('searchbox', { name: 'Search' })) }),
    step('search', 'Question search', 'Type Bedrock in Search', async page => { await page.getByRole('searchbox', { name: 'Search' }).fill('Bedrock'); await page.waitForURL(/q=Bedrock/); await visible(page.getByRole('checkbox', { name: /^Select What/ }).first()) }),
    step('selected', 'Two selected items', 'Clear search and select two items', async page => {
      await button(page, 'Clear filters').click()
      await page.waitForURL(url => !url.searchParams.has('q'))
      // Item checkboxes have stems. The page selector has a different name.
      const rows = page.getByRole('checkbox', { name: /^Select (?!this page)/ })
      await rows.nth(1).waitFor({ state: 'visible' })
      await rows.nth(0).check()
      await rows.nth(1).check()
      await visible(page.getByRole('region', { name: 'Selection actions' }))
    }),
    step('add-to-deck', 'Add to deck menu', 'Click Add to deck', async page => { await button(page, 'Add to deck').click(); await visible(button(page, 'New deck...')) }),
    step('delete-confirmation', 'Delete confirmation', 'Cancel the menu and click Delete', async page => { await button(page, 'Cancel').click(); await button(page, 'Delete').click(); await visible(page.getByText(/^Delete 2 items everywhere\?/)) }),
    step('practice-selection', 'Practising selection', 'Cancel deletion and click Practise', async page => {
      await button(page, 'Cancel').click()
      await page.getByRole('region', { name: 'Selection actions' }).getByRole('button', { name: 'Practise', exact: true }).click()
      await visible(page.getByRole('heading', { name: 'Practising selection' }))
      await visible(button(page, /^Show answer$/i))
    }),
    step('closed', 'Question bank after practice', 'Click Close', async page => { await button(page, 'Close').click(); await visible(page.getByRole('searchbox', { name: 'Search' })) }),
  ]),
  flow('canvas', 'Canvas', [
    step('open', 'Notebook canvas', 'Open the saved notebook canvas', canvas),
    step('selected', 'Selected node and toolbar', 'Click a node', async page => { await page.locator('.react-flow__node').filter({ has: button(page, /^Show the source passage/) }).first().click(); await visible(button(page, 'Edit')) }),
    step('text-edit', 'Node text editor', 'Click Edit', async page => { await button(page, 'Edit').click(); await visible(page.getByRole('textbox', { name: 'Label', exact: true })) }),
    step('source', 'Node source passage', 'Cancel editing and click the source chip', async page => { await button(page, 'Cancel').click(); await button(page, /^Show the source passage/).first().click(); await visible(page.getByRole('complementary', { name: 'Node source' })) }),
    step('shortcuts', 'Keyboard shortcuts', 'Close source panel and click Keyboard shortcuts', async page => { await button(page, 'Close source panel').click(); await button(page, 'Keyboard shortcuts').click(); await visible(page.getByRole('dialog', { name: 'Keyboard shortcuts' })) }),
    step('restore', 'Restore original confirmation', 'Close shortcuts, move a node and click Restore original', async page => {
      await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).getByRole('button', { name: 'Close', exact: true }).click()
      if (!(await button(page, 'Restore original').isVisible())) {
        const node = page.locator('.react-flow__node:not(.react-flow__node-MatrixHeader)').first()
        const box = await node.boundingBox()
        if (!box) throw new Error('Canvas node has no visible bounds')
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20, { steps: 10 })
        await page.mouse.up()
      }
      await button(page, 'Restore original').click()
      await visible(page.getByRole('dialog', { name: 'Restore original' }))
    }),
    step('close', 'Notebook after closing the canvas', 'Cancel and click Close', async page => { await button(page, 'Cancel').click(); await page.locator('.workspace-deck-header').getByRole('button', { name: 'Close', exact: true }).click(); await visible(button(page, 'Add source')) }),
  ]),
  flow('mobile', 'Mobile', [
    step('home', 'Mobile notebooks', 'Open home', async (page, ctx) => { await page.goto(ctx.baseUrl); await visible(button(page, /AWS GenAI certification/)) }, 'mobile'),
    step('workspace', 'Mobile notebook workspace', 'Open AWS GenAI certification', async (page, ctx) => { await page.goto(`${ctx.baseUrl}/notebooks/${ctx.notebookId}`); await visible(button(page, /^Studio /)) }, 'mobile'),
    step('studio', 'Studio drawer', 'Click Studio', click(/^Studio /), 'mobile'),
    step('bank', 'Mobile question bank', 'Close drawer and click Questions', async page => { await button(page, /Close Studio/i).click(); await button(page, /^Questions \(/).click(); await visible(page.getByRole('searchbox', { name: 'Search' })) }, 'mobile'),
    step('canvas', 'Mobile canvas', 'Open the saved notebook canvas', canvas, 'mobile'),
  ]),
]
