# Manual Testing Guide: Custom Model Input Feature

## Overview
This guide provides comprehensive manual testing instructions for the custom model input feature. Complete each section and check off items as you verify them.

## Prerequisites
- Backend server running on http://localhost:8000
- Frontend development server running on http://localhost:5173
- Test database with clean state

## Test Environment Setup

### 1. Start Backend Server
```bash
cd backend
python main.py
```
Verify: Backend is accessible at http://localhost:8000/docs

### 2. Start Frontend Server
```bash
cd frontend
npm run dev
```
Verify: Frontend is accessible at http://localhost:5173

---

## Test Suite 1: Custom Model Input with All Three Providers

### Test 1.1: Anthropic Custom Model
**Requirement: 1.1, 1.2, 1.3**

1. Navigate to Settings page
2. Select "Anthropic" as provider
3. Click "Use Custom Model" toggle/button
4. Verify:
   - [ ] Custom input field appears
   - [ ] Predefined dropdown is hidden
   - [ ] Format examples are displayed
   - [ ] Examples show: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`
   - [ ] Documentation link is present and points to Anthropic docs
5. Enter custom model: `claude-4-opus-preview`
6. Click Save
7. Verify:
   - [ ] Success message appears
   - [ ] No validation errors
8. Reload page
9. Verify:
   - [ ] Custom model `claude-4-opus-preview` is displayed
   - [ ] Custom mode is active

### Test 1.2: OpenAI Custom Model
**Requirement: 1.1, 1.2, 1.3**

1. Navigate to Settings page
2. Select "OpenAI" as provider
3. Click "Use Custom Model" toggle/button
4. Verify:
   - [ ] Custom input field appears
   - [ ] Format examples show: `gpt-4o`, `gpt-4-turbo`, `gpt-4o-mini`
   - [ ] Documentation link points to OpenAI docs
5. Enter custom model: `gpt-5-preview`
6. Click Save
7. Verify:
   - [ ] Success message appears
8. Reload page
9. Verify:
   - [ ] Custom model `gpt-5-preview` is displayed

### Test 1.3: Gemini Custom Model
**Requirement: 1.1, 1.2, 1.3**

1. Navigate to Settings page
2. Select "Google Gemini" as provider
3. Click "Use Custom Model" toggle/button
4. Verify:
   - [ ] Custom input field appears
   - [ ] Format examples show: `gemini-2.5-flash`, `gemini-3-pro-preview`
   - [ ] Documentation link points to Google AI docs
5. Enter custom model: `gemini-4-ultra-preview`
6. Click Save
7. Verify:
   - [ ] Success message appears
8. Reload page
9. Verify:
   - [ ] Custom model `gemini-4-ultra-preview` is displayed

---

## Test Suite 2: New Gemini Models in Dropdown

### Test 2.1: Verify New Models Present
**Requirement: 2.1, 2.2, 2.3, 2.4**

1. Navigate to Settings page
2. Select "Google Gemini" as provider
3. Click "Use Predefined Model" (if in custom mode)
4. Open model dropdown
5. Verify the following models are present:
   - [ ] Gemini 3 Pro Preview (gemini-3-pro-preview)
   - [ ] Gemini 2.5 Flash (gemini-2.5-flash)
   - [ ] Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite)
   - [ ] Gemini 2.5 Pro (gemini-2.5-pro)

### Test 2.2: Verify Old Models Removed
**Requirement: 2.5**

1. In the same dropdown, verify the following models are NOT present:
   - [ ] Gemini 2.0 Flash Exp (gemini-2.0-flash-exp)
   - [ ] Gemini Exp 1206 (gemini-exp-1206)
   - [ ] Gemini 2.0 Flash Thinking (gemini-2.0-flash-thinking-exp-01-21)
   - [ ] Gemini 1.5 Pro 002 (gemini-1.5-pro-002)
   - [ ] Gemini 1.5 Flash 002 (gemini-1.5-flash-002)
   - [ ] Gemini 1.5 Flash 8B (gemini-1.5-flash-8b)

---

## Test Suite 3: Saving and Loading Custom Models

### Test 3.1: Save and Reload Custom Model
**Requirement: 1.4, 1.5**

1. Navigate to Settings
2. Select any provider
3. Enter custom model: `test-model-123`
4. Click Save
5. Close browser tab
6. Open new tab and navigate to Settings
7. Verify:
   - [ ] Custom model `test-model-123` is displayed
   - [ ] Custom mode is active
   - [ ] Model name is exactly as entered

### Test 3.2: Special Characters in Model Name
**Requirement: 1.3, 4.1**

1. Navigate to Settings
2. Enter custom model with special characters: `model-v2.5_beta-001`
3. Click Save
4. Reload page
5. Verify:
   - [ ] Model name is preserved exactly
   - [ ] No encoding issues
   - [ ] Special characters display correctly

### Test 3.3: Whitespace Handling
**Requirement: 1.3**

1. Navigate to Settings
2. Enter custom model with leading/trailing spaces: `  gpt-4o  `
3. Click Save
4. Verify:
   - [ ] Whitespace is trimmed
   - [ ] Model saved as `gpt-4o`

---

## Test Suite 4: Switching Between Custom and Predefined

### Test 4.1: Predefined to Custom
**Requirement: 1.1, 1.2**

1. Navigate to Settings
2. Select "OpenAI" provider
3. Select predefined model "GPT-4o"
4. Click Save
5. Click "Use Custom Model"
6. Verify:
   - [ ] Input field appears
   - [ ] Previous predefined selection is cleared
   - [ ] Format examples appear
7. Enter custom model: `gpt-4-custom`
8. Click Save
9. Reload page
10. Verify:
    - [ ] Custom model is displayed
    - [ ] Custom mode is active

### Test 4.2: Custom to Predefined
**Requirement: 1.1, 1.2**

1. Navigate to Settings (with custom model active)
2. Click "Use Predefined Model"
3. Verify:
   - [ ] Dropdown appears
   - [ ] Custom input is hidden
   - [ ] Format examples are hidden
4. Select a predefined model
5. Click Save
6. Reload page
7. Verify:
   - [ ] Predefined model is displayed
   - [ ] Predefined mode is active

---

## Test Suite 5: Format Examples and Documentation Links

### Test 5.1: Anthropic Format Examples
**Requirement: 5.1, 5.2**

1. Navigate to Settings
2. Select "Anthropic" provider
3. Enable custom mode
4. Verify format examples section shows:
   - [ ] Header: "Format Examples for Anthropic"
   - [ ] Example: `claude-3-5-sonnet-20241022`
   - [ ] Example: `claude-3-opus-20240229`
   - [ ] Example: `claude-3-sonnet-20240229`
   - [ ] Documentation link present
5. Click documentation link
6. Verify:
   - [ ] Opens in new tab
   - [ ] Points to https://docs.anthropic.com/claude/docs/models-overview

### Test 5.2: OpenAI Format Examples
**Requirement: 5.1, 5.3**

1. Navigate to Settings
2. Select "OpenAI" provider
3. Enable custom mode
4. Verify format examples section shows:
   - [ ] Header: "Format Examples for OpenAI"
   - [ ] Example: `gpt-4o`
   - [ ] Example: `gpt-4-turbo`
   - [ ] Example: `gpt-4o-mini`
   - [ ] Documentation link present
5. Click documentation link
6. Verify:
   - [ ] Opens in new tab
   - [ ] Points to https://platform.openai.com/docs/models

### Test 5.3: Gemini Format Examples
**Requirement: 5.1, 5.4**

1. Navigate to Settings
2. Select "Google Gemini" provider
3. Enable custom mode
4. Verify format examples section shows:
   - [ ] Header: "Format Examples for Google Gemini"
   - [ ] Example: `gemini-2.5-flash`
   - [ ] Example: `gemini-3-pro-preview`
   - [ ] Example: `gemini-2.5-pro`
   - [ ] Documentation link present
5. Click documentation link
6. Verify:
   - [ ] Opens in new tab
   - [ ] Points to https://ai.google.dev/models/gemini

---

## Test Suite 6: Warning and Confirmation Messages

### Test 6.1: Custom Model Warning
**Requirement: 3.3**

1. Navigate to Settings
2. Enable custom mode for any provider
3. Verify warning message is displayed:
   - [ ] Warning icon present (amber/yellow)
   - [ ] Message states custom models are not validated
   - [ ] Message mentions model will be sent directly to provider
   - [ ] Warning is not alarming in tone
   - [ ] Warning is visible but not intrusive

### Test 6.2: Save Confirmation
**Requirement: 3.4**

1. Navigate to Settings
2. Enter a custom model
3. Click Save
4. Verify confirmation message:
   - [ ] Success message appears
   - [ ] Message confirms settings were saved
   - [ ] Message disappears after a few seconds
   - [ ] Message is green/positive in color

### Test 6.3: Empty Input Validation
**Requirement: 1.3**

1. Navigate to Settings
2. Enable custom mode
3. Leave input field empty
4. Click Save
5. Verify:
   - [ ] Error message appears
   - [ ] Message states "Model name cannot be empty"
   - [ ] Save is prevented
   - [ ] Error message is red/negative in color

---

## Test Suite 7: Tooltips Display Correct Information

### Test 7.1: Predefined Model Tooltips
**Requirement: 3.2**

1. Navigate to Settings
2. Select any provider
3. Ensure predefined mode is active
4. Hover over a model in the dropdown
5. Verify tooltip displays:
   - [ ] Model name
   - [ ] Context window size
   - [ ] Input pricing
   - [ ] Output pricing
   - [ ] Description
6. Test with multiple models
7. Verify:
   - [ ] Each model has unique information
   - [ ] Pricing is formatted correctly
   - [ ] Context window shows appropriate units

### Test 7.2: New Gemini Model Metadata
**Requirement: 2.1, 2.2, 2.3, 2.4**

1. Navigate to Settings
2. Select "Google Gemini" provider
3. Hover over "Gemini 3 Pro Preview"
4. Verify tooltip shows:
   - [ ] Context window: 1,048,576 tokens
   - [ ] Description mentions "most intelligent" and "agentic capabilities"
5. Hover over "Gemini 2.5 Flash"
6. Verify tooltip shows:
   - [ ] Context window: 1,048,576 tokens
   - [ ] Description mentions "fast" and "thinking capabilities"
7. Hover over "Gemini 2.5 Flash-Lite"
8. Verify tooltip shows:
   - [ ] Context window: 1,048,576 tokens
   - [ ] Description mentions "fastest" and "cost-efficiency"
9. Hover over "Gemini 2.5 Pro"
10. Verify tooltip shows:
    - [ ] Context window: 1,048,576 tokens
    - [ ] Description mentions "advanced thinking" and "complex reasoning"

---

## Test Suite 8: Cross-Browser Testing

### Test 8.1: Chrome/Edge
1. Open application in Chrome or Edge
2. Run through Test Suites 1-7
3. Document any issues:
   - [ ] All features work correctly
   - Issues found: _______________

### Test 8.2: Firefox
1. Open application in Firefox
2. Run through Test Suites 1-7
3. Document any issues:
   - [ ] All features work correctly
   - Issues found: _______________

### Test 8.3: Safari (if available)
1. Open application in Safari
2. Run through Test Suites 1-7
3. Document any issues:
   - [ ] All features work correctly
   - Issues found: _______________

---

## Test Suite 9: Accessibility with Keyboard Navigation

### Test 9.1: Tab Navigation
**Requirement: All**

1. Navigate to Settings page
2. Press Tab key repeatedly
3. Verify:
   - [ ] Focus moves through all interactive elements
   - [ ] Focus indicator is visible
   - [ ] Tab order is logical (top to bottom, left to right)
   - [ ] Can reach provider dropdown
   - [ ] Can reach model selector/input
   - [ ] Can reach custom mode toggle
   - [ ] Can reach Save button

### Test 9.2: Keyboard Interaction
1. Use Tab to focus provider dropdown
2. Press Enter or Space
3. Verify:
   - [ ] Dropdown opens
4. Use Arrow keys to navigate options
5. Press Enter to select
6. Verify:
   - [ ] Selection works
7. Tab to custom mode toggle
8. Press Enter or Space
9. Verify:
   - [ ] Mode switches
10. Tab to custom input field
11. Type a model name
12. Press Tab to Save button
13. Press Enter
14. Verify:
    - [ ] Settings save successfully

### Test 9.3: Screen Reader Compatibility
1. Enable screen reader (NVDA, JAWS, or VoiceOver)
2. Navigate to Settings
3. Verify:
   - [ ] Provider dropdown is announced
   - [ ] Model selector is announced
   - [ ] Custom mode toggle is announced
   - [ ] Input field has appropriate label
   - [ ] Warning messages are announced
   - [ ] Error messages are announced
   - [ ] Success messages are announced

### Test 9.4: Focus Management
1. Navigate to Settings
2. Click "Use Custom Model"
3. Verify:
   - [ ] Focus moves to custom input field
4. Click "Use Predefined Model"
5. Verify:
   - [ ] Focus moves to model dropdown

---

## Test Suite 10: Visual Design and Responsiveness

### Test 10.1: Desktop View (1920x1080)
1. Set browser window to 1920x1080
2. Navigate to Settings
3. Verify:
   - [ ] Layout is well-proportioned
   - [ ] No horizontal scrolling
   - [ ] Text is readable
   - [ ] Spacing is appropriate

### Test 10.2: Laptop View (1366x768)
1. Set browser window to 1366x768
2. Navigate to Settings
3. Verify:
   - [ ] Layout adapts appropriately
   - [ ] All elements are accessible
   - [ ] No overlapping elements

### Test 10.3: Tablet View (768x1024)
1. Set browser window to 768x1024
2. Navigate to Settings
3. Verify:
   - [ ] Layout is responsive
   - [ ] Touch targets are appropriately sized
   - [ ] Text remains readable

### Test 10.4: Mobile View (375x667)
1. Set browser window to 375x667
2. Navigate to Settings
3. Verify:
   - [ ] Layout stacks vertically
   - [ ] All features remain accessible
   - [ ] Text is readable without zooming

### Test 10.5: Dark Mode
1. Toggle dark mode (if available)
2. Navigate to Settings
3. Verify:
   - [ ] All text is readable
   - [ ] Contrast is sufficient
   - [ ] Colors are appropriate
   - [ ] Warning messages are visible
   - [ ] Format examples are readable

---

## Test Suite 11: Edge Cases and Error Handling

### Test 11.1: Very Long Model Names
1. Navigate to Settings
2. Enter a very long model name (100+ characters)
3. Click Save
4. Verify:
   - [ ] Model name is accepted
   - [ ] Display handles long names gracefully
   - [ ] No layout breaking

### Test 11.2: Unicode Characters
1. Navigate to Settings
2. Enter model name with unicode: `模型-测试-🚀`
3. Click Save
4. Reload page
5. Verify:
   - [ ] Unicode characters are preserved
   - [ ] Display is correct

### Test 11.3: Network Failure During Save
1. Navigate to Settings
2. Open browser DevTools
3. Go to Network tab
4. Enable "Offline" mode
5. Try to save settings
6. Verify:
   - [ ] Error message appears
   - [ ] User is informed of network issue
   - [ ] Form state is preserved

### Test 11.4: Rapid Provider Switching
1. Navigate to Settings
2. Rapidly switch between providers
3. Verify:
   - [ ] UI updates correctly
   - [ ] No race conditions
   - [ ] Format examples update appropriately

---

## Test Suite 12: Integration Testing

### Test 12.1: End-to-End Custom Model Flow
1. Navigate to Settings
2. Select "OpenAI" provider
3. Enter API key (if not already configured)
4. Enable custom mode
5. Enter custom model: `gpt-4o-test`
6. Click Save
7. Navigate to Documents page
8. Upload a test document
9. Generate questions
10. Verify:
    - [ ] Questions are generated
    - [ ] No errors related to model name
    - [ ] System uses the custom model name

### Test 12.2: Model Name in API Calls
1. Open browser DevTools
2. Go to Network tab
3. Navigate to Settings
4. Save a custom model
5. Navigate to Documents and generate questions
6. Check network requests
7. Verify:
    - [ ] Model name is sent in API request
    - [ ] Model name matches what was entered
    - [ ] No transformation of model name

---

## Summary Checklist

After completing all test suites, verify:

- [ ] All three providers support custom model input
- [ ] New Gemini models appear in dropdown
- [ ] Old Gemini models are removed
- [ ] Custom models save and load correctly
- [ ] Switching between custom and predefined works
- [ ] Format examples display correctly for all providers
- [ ] Documentation links work and point to correct URLs
- [ ] Warning messages appear for custom models
- [ ] Confirmation messages appear after save
- [ ] Tooltips display correct metadata
- [ ] Works in Chrome/Edge
- [ ] Works in Firefox
- [ ] Works in Safari (if tested)
- [ ] Keyboard navigation works completely
- [ ] Screen reader announces all elements
- [ ] Responsive design works at all breakpoints
- [ ] Dark mode displays correctly
- [ ] Edge cases are handled gracefully
- [ ] End-to-end flow works with custom models

---

## Issues Found

Document any issues discovered during testing:

| Test Suite | Test Case | Issue Description | Severity | Status |
|------------|-----------|-------------------|----------|--------|
|            |           |                   |          |        |
|            |           |                   |          |        |
|            |           |                   |          |        |

---

## Sign-off

Tester Name: _______________
Date: _______________
Signature: _______________

All critical tests passed: [ ] Yes [ ] No
Feature ready for release: [ ] Yes [ ] No

Notes:
_______________________________________________
_______________________________________________
_______________________________________________
