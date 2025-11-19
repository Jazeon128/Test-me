# REUSABLE PROMPT: Convert Practice Test to Anki Deck

Copy and paste this prompt, then attach your practice test document:

---

## PROMPT START

I need you to convert this practice test into an Anki deck CSV file compatible with the **Multiple Choice for Anki add-on (AllInOne note type)**.

### SOURCE MATERIAL
[Attach your practice test file - can be PDF, Word doc, text file, or paste the questions]

### OUTPUT REQUIREMENTS

**Create a CSV file with these specifications:**

#### CSV Structure (11 columns):
1. **Question** - The question text/scenario
2. **QType** - Question type code:
   - `2` = Single choice (one correct answer)
   - `1` = Multiple choice (two or more correct answers)
3. **Q_1** - Option A text
4. **Q_2** - Option B text
5. **Q_3** - Option C text
6. **Q_4** - Option D text
7. **Q_5** - Option E text (leave empty if only 4 options)
8. **Answers** - Binary format showing correct answers:
   - Example: `0 0 1 0 0` means Option C is correct
   - Example: `1 0 0 1 0` means Options A and D are correct
   - Format: Five space-separated digits (0=incorrect, 1=correct)
9. **Sources** - Leave empty
10. **Extra 1** - Explanation formatted as HTML with:
    - Correct answer statement in green bold: `<p style="color: #2d7a2d; font-weight: bold;">C is correct - [reason]</p>`
    - Bullet list explaining wrong answers: `<ul style="margin: 10px 0; padding-left: 20px;"><li><strong>Option A:</strong> [why wrong]</li>...</ul>`
11. **Tags** - Leave empty

#### Special Instructions:

1. **For questions with 5 options (A-E):**
   - Use all 5 Q_1 through Q_5 columns
   - Keep only the 4 best options if asked to reduce to 4

2. **For "Select TWO" or "Select ALL that apply" questions:**
   - Set QType to `1`
   - Mark multiple correct answers in Answers field (e.g., `1 0 1 0 0` for A and C)

3. **Format the Extra 1 (Explanation) field as HTML:**
   - Start with: `<div class="explanation">`
   - Add correct answer statement in green
   - Add bulleted list with `<ul>` and `<li>` tags
   - End with: `</div>`
   - Include why EACH wrong answer is incorrect

4. **Handle special characters:**
   - Commands, code, or technical syntax should be preserved exactly
   - Escape quotes if needed for CSV format

5. **Create TWO versions:**
   - One with comma separator (standard)
   - One with semicolon separator (better for Excel preview)

### VERIFICATION STEPS

After creating the CSV, verify:
- [ ] All rows have exactly 11 columns
- [ ] QType is 1 for multi-select, 2 for single-select
- [ ] Answers field has correct binary format (5 digits)
- [ ] Every question has at least one correct answer (at least one `1` in Answers)
- [ ] Extra 1 field contains valid HTML
- [ ] No unescaped quotes breaking CSV structure

### DELIVERABLES

Provide:
1. **Main CSV file** (comma-separated) with descriptive name
2. **Semicolon CSV file** (same content, semicolon delimiter)
3. **Import instructions** explaining:
   - Which Anki add-on to use
   - Field mapping diagram
   - "Allow HTML in fields" reminder
   - Any special notes about the question set

### EXAMPLE ROW

```csv
"What is 2+2?",2,"3","4","5","6",,0 1 0 0 0,,"<div class=""explanation""><p style=""color: #2d7a2d; font-weight: bold;"">B is correct - 2+2 equals 4.</p><ul style=""margin: 10px 0; padding-left: 20px;""><li><strong>Option A:</strong> 3 is the result of 1+2, not 2+2.</li><li><strong>Option C:</strong> 5 is the result of 2+3, not 2+2.</li><li><strong>Option D:</strong> 6 is the result of 2+4, not 2+2.</li></ul></div>",
```

### ADDITIONAL CONTEXT (Optional - customize as needed)

- [ ] Subject/Topic: _______________
- [ ] Target certification/exam: _______________
- [ ] Preferred answer explanation style: _______________
- [ ] Any specific terminology to preserve: _______________

## PROMPT END

---

## HOW TO USE THIS PROMPT

### Step 1: Copy the prompt above (from "PROMPT START" to "PROMPT END")

### Step 2: Customize (optional)
Fill in the "Additional Context" section if you want to specify:
- What subject/exam the questions are for
- Any special formatting preferences
- Technical terms that must be preserved exactly

### Step 3: Attach your source material
- PDF of practice test
- Word document with questions
- Text file with Q&A
- Or paste questions directly into the chat

### Step 4: Submit and wait for CSV files

You'll receive:
- ✅ Formatted CSV file(s) ready to import
- ✅ Import instructions
- ✅ Verification that all fields are correct

## EXAMPLE USAGE

```
[Copy the prompt above]

Additional Context:
- Subject/Topic: AWS Solutions Architect
- Target certification: SAA-C03
- Preferred style: Technical with command examples

[Attach: aws_practice_test.pdf]
```

## TIPS FOR BEST RESULTS

### ✅ DO:
- Provide questions with clear answer indicators (A, B, C, D or 1, 2, 3, 4)
- Include explanations if available (Claude will enhance them)
- Specify if questions are multi-select
- Mention any technical terminology to preserve

### ❌ AVOID:
- Questions without clear options
- Image-based questions (unless you describe them)
- Questions requiring tables/diagrams (unless described textually)

## TROUBLESHOOTING

**If CSV imports incorrectly:**
1. Verify you selected the right add-on note type
2. Check "Allow HTML in fields" is enabled
3. Ensure field mapping matches the 11-column structure
4. Try the semicolon version if comma version has issues

**If explanations don't format:**
1. Make sure "Allow HTML in fields" is checked
2. Verify Extra 1 is mapped to the explanation field
3. Check that HTML tags are present in the CSV

**If answers are wrong:**
1. Check the Answers column binary format
2. Verify QType matches (1=multi, 2=single)
3. Count the digits (should be 5: one for each Q_1 through Q_5)

## VARIATIONS OF THIS PROMPT

### For Different Formats:

**If you want the "Proper MCQ" note type instead:**
Replace the CSV structure with:
```
Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation

- CorrectAnswer should be the letter(s): "C" or "A and D"
- Explanation should be plain text, not HTML
- No QType or Answers columns needed
```

**If you want plain text (no HTML formatting):**
In the prompt, change:
```
10. **Extra 1** - Explanation in plain text format
    - Start with correct answer statement
    - Separate wrong answers with periods or line breaks
    - No HTML tags needed
```

**If you want to add tags/categories:**
In the prompt, change:
```
11. **Tags** - Add relevant tags separated by spaces
    Example: "networking security-groups aws-vpc"
```

## COMPATIBLE WITH

This prompt works with:
- ✅ Multiple Choice for Anki add-on (ID: 1566095810)
- ✅ AllInOne (kprim, mc, sc) note type
- ✅ Anki Desktop, AnkiMobile, AnkiDroid
- ✅ Any practice test with clear Q&A format

## WHAT YOU GET

After using this prompt, you'll have:
- 📄 Professional Anki deck ready to import
- 🎨 Beautifully formatted explanations
- ✅ Verified structure (all fields correct)
- 📝 Clear import instructions
- 🔄 Multiple format options (comma/semicolon)

## SAVE THIS PROMPT

Bookmark this prompt or save it to a file so you can:
- Convert any practice test to Anki
- Maintain consistent formatting across decks
- Quickly create study materials for any subject
- Share with study groups

---

**Created by: Raymond's GCP ACE Exam Prep Project**
**Last Updated: 2025**
**Compatible with: Claude AI, ChatGPT, and other LLMs**
