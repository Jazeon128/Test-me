import json
import re
from typing import List, Dict, Optional
from anthropic import Anthropic
from openai import OpenAI
import google.generativeai as genai
from sqlalchemy.orm import Session
from ...config import settings
from ..parsers.base_parser import ParsedDocument, ParsedSection


def get_setting(db: Session, key: str) -> Optional[str]:
    """Get a setting value from database"""
    from ...models.settings import Settings
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


class QuestionGenerator:
    """Generate multiple-choice questions from document content using AI"""

    def __init__(self, db: Session = None):
        # Try to get settings from database first, fall back to env vars
        if db:
            self.provider = get_setting(db, "ai_provider") or settings.AI_PROVIDER
            self.model = get_setting(db, "ai_model") or settings.AI_MODEL
            api_key = get_setting(db, "api_key")
        else:
            self.provider = settings.AI_PROVIDER
            self.model = settings.AI_MODEL
            api_key = None

        # Fall back to environment variables if no DB settings
        if not api_key:
            if self.provider == "anthropic":
                api_key = settings.ANTHROPIC_API_KEY
            elif self.provider == "openai":
                api_key = settings.OPENAI_API_KEY
            elif self.provider == "gemini":
                api_key = settings.GEMINI_API_KEY

        if not api_key:
            raise ValueError(f"No API key configured for provider: {self.provider}")

        if self.provider == "anthropic":
            self.client = Anthropic(api_key=api_key)
            if not self.model:
                self.model = "claude-3-5-sonnet-20241022"
        elif self.provider == "openai":
            self.client = OpenAI(api_key=api_key)
            if not self.model:
                self.model = "gpt-4o"
        elif self.provider == "gemini":
            genai.configure(api_key=api_key)
            if not self.model:
                self.model = "gemini-2.0-flash-exp" # Default to latest fast model
            self.client = genai.GenerativeModel(self.model)
        else:
            raise ValueError(f"Unknown AI provider: {self.provider}")



    def generate_questions(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int = 10,
        difficulty: str = "mixed",
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        Generate multiple-choice questions from a parsed document

        Args:
            parsed_doc: The parsed document with sections
            num_questions: Number of questions to generate
            difficulty: "easy", "medium", "hard", or "mixed"
            custom_prompt: Optional custom instructions for question generation
            example_questions: Optional list of example questions to inspire style

        Returns:
            List of question dictionaries with questions, options, answers, and references
        """
        # Select diverse sections to cover different parts of the document
        # If we need more questions than sections, we'll reuse sections
        num_sections = len(parsed_doc.sections)
        sections_needed = min(num_questions, num_sections)

        selected_sections = self._select_sections(parsed_doc.sections, sections_needed)

        all_questions = []

        # Calculate how many questions to generate per section
        questions_per_section = max(1, (num_questions + sections_needed - 1) // sections_needed)

        # Generate questions from each section
        # Dynamically adjust max batch size based on total request
        max_batch_size = 10 if num_questions >= 20 else 5

        for i, section in enumerate(selected_sections, 1):
            if len(all_questions) >= num_questions:
                break

            # Determine how many questions to ask for in this batch
            remaining_needed = num_questions - len(all_questions)
            batch_size = min(questions_per_section, remaining_needed, max_batch_size)

            if batch_size <= 0:
                break

            print(f"[*] Processing section {i}/{len(selected_sections)}: requesting {batch_size} questions (have {len(all_questions)}/{num_questions})")

            questions = self._generate_batch_questions(
                section,
                batch_size,
                difficulty,
                custom_prompt,
                example_questions
            )

            if questions:
                all_questions.extend(questions)
                print(f"[+] Got {len(questions)} questions from section {i}")
            else:
                print(f"[-] Failed to get questions from section {i}")

        # Limit to requested number
        return all_questions[:num_questions]

    def _select_sections(self, sections: List[ParsedSection], num_needed: int) -> List[ParsedSection]:
        """Select diverse sections from the document"""
        if len(sections) <= num_needed:
            return sections

        # Select evenly distributed sections
        step = len(sections) / num_needed
        selected = []
        for i in range(num_needed):
            idx = int(i * step)
            selected.append(sections[idx])

        return selected

    def _generate_batch_questions(
        self,
        section: ParsedSection,
        count: int,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """Generate a batch of multiple-choice questions from a section"""
        import time

        prompt = self._build_batch_prompt(
            section.text,
            count,
            difficulty,
            custom_prompt,
            example_questions
        )

        try:
            content = ""
            provider_display = {
                "anthropic": "Anthropic Claude",
                "openai": "OpenAI GPT-4",
                "gemini": "Google Gemini"
            }.get(self.provider, self.provider)

            print(f"[*] Initializing {provider_display} API client with model {self.model}...")
            print(f"[*] Sending request to {provider_display} for {count} questions...")
            print(f"[*] Waiting for {provider_display} API response...")

            api_start_time = time.time()

            if self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    messages=[{"role": "user", "content": prompt}],
                )
                content = response.content[0].text

            elif self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=8192,
                )
                content = response.choices[0].message.content

            elif self.provider == "gemini":
                generation_config = genai.types.GenerationConfig(
                    max_output_tokens=8192,
                    temperature=0.7,
                )
                response = self.client.generate_content(
                    prompt,
                    generation_config=generation_config
                )
                content = response.text

            api_elapsed = time.time() - api_start_time
            print(f"[+] Received response from {provider_display} (took {api_elapsed:.2f} seconds)")
            print(f"[*] Parsing and validating questions...")

            # Parse the response
            questions_data = self._parse_batch_response(content)

            valid_questions = []
            for q_data in questions_data:
                # Add reference information
                q_data["reference"] = {
                    "text": section.text[:200] + "..." if len(section.text) > 200 else section.text,
                    "page": section.page,
                    "section": section.section,
                    "paragraph": section.paragraph,
                }
                q_data["difficulty"] = difficulty if difficulty != "mixed" else q_data.get("difficulty", "medium")
                valid_questions.append(q_data)

            print(f"[+] Successfully validated {len(valid_questions)} questions")
            return valid_questions

        except Exception as e:
            print(f"[-] Error generating questions batch: {e}")
            import traceback
            print(traceback.format_exc())
            return []

    def _build_batch_prompt(
        self,
        text: str,
        count: int,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None
    ) -> str:
        """Build the prompt for batch question generation"""

        difficulty_instructions = {
            "easy": "Create straightforward exam-style questions testing basic recall and key facts.",
            "medium": "Create exam-style questions requiring comprehension and application of concepts.",
            "hard": "Create challenging exam-style questions requiring analysis, synthesis, or evaluation.",
            "mixed": "Create exam-style questions with varying difficulty levels."
        }

        # Build example questions section if provided
        examples_section = ""
        if example_questions and len(example_questions) > 0:
            examples_section = "\n\nEXAMPLE QUESTIONS (use these as inspiration for style and format):\n"
            for i, ex in enumerate(example_questions[:2], 1):
                examples_section += f"\nExample {i}:\n"
                examples_section += f"Question: {ex.get('question', '')}\n"
                examples_section += f"Difficulty: {ex.get('difficulty', 'medium')}\n"

        # Build custom prompt section if provided
        custom_section = ""
        if custom_prompt:
            custom_section = f"\n\nADDITIONAL INSTRUCTIONS:\n{custom_prompt}\n"

        prompt = f"""You are an expert educational assessment designer creating {count} high-quality multiple-choice exam questions from the provided text.

TEXT TO ANALYZE:
{text}

DIFFICULTY LEVEL: {difficulty}
{difficulty_instructions.get(difficulty, difficulty_instructions["mixed"])}

CRITICAL QUALITY REQUIREMENTS:

**Question Stem Guidelines:**
- Write COMPLETE questions that make sense without seeing the options
- Each stem should test ONE specific concept from the text
- Avoid negative wording unless absolutely necessary (no "Which is NOT...")
- Keep stems clear, concise, and unambiguous
- Focus on testing understanding and application, not just memorization

**Answer Options (A, B, C, D):**
- Make all 4 options similar in length and grammatical structure
- Base INCORRECT options on common misconceptions or logical errors a learner might make
- Ensure all distractors are plausible to someone who hasn't mastered the material
- Avoid obviously wrong answers, joke options, or "none of the above"
- The correct answer should be definitively correct based on the text

**Cognitive Level Alignment:**
- For "easy": Test remembering key facts and basic comprehension (Bloom's levels 1-2)
- For "medium": Test application of concepts and analysis (Bloom's levels 3-4)
- For "hard": Test evaluation, synthesis, and complex reasoning (Bloom's levels 5-6)
- For "mixed": Vary cognitive levels across questions

**Quality Checklist - Each question must:**
✓ Test specific, important knowledge from the text
✓ Have ONE clearly correct answer supported by the text
✓ Have 3 plausible but definitely incorrect distractors
✓ Use professional, exam-appropriate language
✓ Be directly answerable from the provided text
✓ Test understanding, not trivia or trick knowledge
✓ Work as a standalone assessment item

**Avoid These Common Mistakes:**
✗ Don't write vague or ambiguous questions
✗ Don't use "all of the above" or "none of the above"
✗ Don't make questions depend on memorizing exact wording
✗ Don't create options that are partially correct
✗ Don't use double negatives or confusing phrasing
✗ Don't ask about the document itself (e.g., "What does this document say?", "Who owns the copyright?", "What are the reuse conditions?")
✗ Don't ask about metadata, authors, dates, or legal disclaimers
✗ Don't ask about the structure of the text (e.g., "What is in the first paragraph?")

**CRITICAL INSTRUCTION:**
Focus ONLY on the educational subject matter and concepts taught in the text. Ignore all headers, footers, page numbers, copyright notices, and legal text. If the text contains a cheat sheet or summary, ask about the *concepts* in it, not about the cheat sheet itself.

Generate EXACTLY {count} questions following these guidelines.

RESPOND ONLY with a valid JSON ARRAY of objects in this exact format:
[
  {{
    "question": "Question text here?",
    "options": [
      {{"option": "A", "text": "Option A text"}},
      {{"option": "B", "text": "Option B text"}},
      {{"option": "C", "text": "Option C text"}},
      {{"option": "D", "text": "Option D text"}}
    ],
    "correct_answer": "A",
    "explanation": "Explanation here",
    "difficulty": "medium"
  }},
  ...
]

JSON Response:"""

        return prompt

    def _parse_batch_response(self, response: str) -> List[Dict]:
        """Parse the AI response into a list of structured question data"""
        try:
            # Extract JSON from response
            json_match = re.search(r"\[.*\]", response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                data = json.loads(json_str)

                if isinstance(data, list):
                    valid_items = []
                    required_fields = ["question", "options", "correct_answer", "explanation"]
                    
                    for item in data:
                        if all(field in item for field in required_fields):
                            valid_items.append(item)
                    
                    return valid_items

        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON batch: {e}")
            print(f"Response was: {response}")

        return []
