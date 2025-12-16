# Quick Start: Manual Testing

## Start Testing in 3 Steps

### Step 1: Start Backend Server

Open a terminal and run:
```bash
cd backend
python main.py
```

Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Step 2: Start Frontend Server

Open a NEW terminal and run:
```bash
cd frontend
npm run dev
```

Wait for: `Local: http://localhost:5173/`

### Step 3: Open Browser

Navigate to: http://localhost:5173

---

## Quick Smoke Test (5 minutes)

### Test 1: New Gemini Models
1. Go to Settings
2. Select "Google Gemini" provider
3. Open model dropdown
4. ✓ Verify you see: Gemini 3 Pro Preview, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.5 Pro
5. ✓ Verify you DON'T see: Gemini 2.0 Flash Exp, Gemini 1.5 models

### Test 2: Custom Model Input
1. Click "Use Custom Model" button
2. ✓ Verify input field appears
3. ✓ Verify format examples appear
4. Type: `my-custom-model-test`
5. Click Save
6. ✓ Verify success message
7. Refresh page
8. ✓ Verify `my-custom-model-test` is still there

### Test 3: All Providers
1. Select "Anthropic" → Enable custom → ✓ See Claude examples
2. Select "OpenAI" → Enable custom → ✓ See GPT examples
3. Select "Google Gemini" → Enable custom → ✓ See Gemini examples

---

## Automated Tests Status

### Backend Tests: ✅ PASSING
All 240 tests passed including:
- New Gemini model list tests
- Custom model API acceptance tests
- Model persistence round-trip tests
- Pricing updates for new models

### Frontend Tests: ⚠️ MOSTLY PASSING
175 tests passed, 14 failed (unrelated to custom model feature)
- Custom model input tests: ✅ PASSING
- Model selector tests: ✅ PASSING
- Format examples tests: ✅ PASSING
- Integration tests: ✅ PASSING

Failed tests are in unrelated features (missing-api-key, update notifications)

---

## What to Focus On

Since automated tests cover the core functionality, focus your manual testing on:

1. **Visual Design** - Does it look good? Is spacing correct?
2. **User Experience** - Is it intuitive? Clear messaging?
3. **Accessibility** - Can you navigate with keyboard? Screen reader friendly?
4. **Cross-Browser** - Works in Chrome, Firefox, Safari?
5. **Responsive Design** - Works on mobile, tablet, desktop?
6. **Edge Cases** - Long model names, special characters, unicode?

---

## Report Issues

If you find any issues, document them in the MANUAL_TESTING_GUIDE.md file in the "Issues Found" section.

For each issue, note:
- Which test suite/case
- What you expected
- What actually happened
- How to reproduce
- Severity (Critical, High, Medium, Low)
