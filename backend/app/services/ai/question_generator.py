import json
import re
from typing import List, Dict, Optional
from anthropic import Anthropic
from openai import OpenAI
import google.generativeai as genai
from sqlalchemy.orm import Session
from ...config import settings
from ..parsers.base_parser import ParsedDocument, ParsedSection
from ..exam_templates import ExamTemplateManager


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
            api_key = get_setting(db, "api_key")
        else:
            self.provider = settings.AI_PROVIDER
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
            self.model = "claude-3-5-sonnet-20241022"
        elif self.provider == "openai":
            self.client = OpenAI(api_key=api_key)
            self.model = "gpt-4-turbo-preview"
        elif self.provider == "gemini":
            genai.configure(api_key=api_key)
            # Use gemini-1.5-pro without -latest suffix
            self.client = genai.GenerativeModel("gemini-1.5-pro")
            self.model = "gemini-1.5-pro"
        else:
            raise ValueError(f"Unknown AI provider: {self.provider}")

        # Initialize exam template manager
        self.exam_template_manager = ExamTemplateManager()

    def generate_questions(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int = 10,
        difficulty: str = "mixed",
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        exam_template_config: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Generate multiple-choice questions from a parsed document

        Args:
            parsed_doc: The parsed document with sections
            num_questions: Number of questions to generate
            difficulty: "easy", "medium", "hard", or "mixed"
            custom_prompt: Optional custom instructions for question generation
            example_questions: Optional list of example questions to inspire style
            exam_template_config: Optional exam template configuration (GCP ACE, AWS SAA style)

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
        questions_per_section = max(1, (num_questions + sections_needed - 1) // sections_needed)  # Ceiling division

        # Generate questions from each section
        for section in selected_sections:
            # Generate multiple questions per section if needed
            for _ in range(questions_per_section):
                if len(all_questions) >= num_questions:
                    break

                question = self._generate_single_question(
                    section,
                    difficulty,
                    custom_prompt,
                    example_questions,
                    exam_template_config
                )
                if question:
                    all_questions.append(question)

            if len(all_questions) >= num_questions:
                break

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

    def _generate_single_question(
        self,
        section: ParsedSection,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        exam_template_config: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Generate a single multiple-choice question from a section"""
        prompt = self._build_prompt(
            section.text,
            difficulty,
            custom_prompt,
            example_questions,
            exam_template_config
        )

        try:
            if self.provider == "anthropic":
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}],
                )
                content = response.content[0].text

            elif self.provider == "openai":
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                )
                content = response.choices[0].message.content

            elif self.provider == "gemini":
                response = self.client.generate_content(prompt)
                content = response.text

            # Parse the response
            question_data = self._parse_response(content)

            if question_data:
                # Add reference information
                question_data["reference"] = {
                    "text": section.text[:200] + "..." if len(section.text) > 200 else section.text,
                    "page": section.page,
                    "section": section.section,
                    "paragraph": section.paragraph,
                }
                question_data["difficulty"] = difficulty if difficulty != "mixed" else question_data.get("difficulty", "medium")

                return question_data

        except Exception as e:
            print(f"Error generating question: {e}")
            return None

    def _build_prompt(
        self,
        text: str,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        exam_template_config: Optional[Dict] = None
    ) -> str:
        """Build the prompt for question generation"""

        # If exam template config is provided, use structured exam template
        if exam_template_config:
            try:
                return self.exam_template_manager.build_exam_prompt(
                    source_text=text,
                    config=exam_template_config
                )
            except Exception as e:
                print(f"Error building exam template prompt: {e}")
                # Fall back to basic prompt

        # Otherwise, use the standard prompt
        difficulty_instructions = {
            "easy": "Create a straightforward exam-style question testing basic recall and key facts. This should be answerable by a student who has read and understood the material.",
            "medium": "Create an exam-style question requiring comprehension and application of concepts. This should test whether a student can apply knowledge to new situations or identify relationships.",
            "hard": "Create a challenging exam-style question requiring analysis, synthesis, or evaluation. This should test deep understanding, critical thinking, or the ability to compare/contrast concepts.",
            "mixed": "Create an exam-style question with appropriate difficulty. Write it as if preparing students for a standardized test or final exam."
        }

        # Build example questions section if provided
        examples_section = ""
        if example_questions and len(example_questions) > 0:
            examples_section = "\n\nEXAMPLE QUESTIONS (use these as inspiration for style and format):\n"
            for i, ex in enumerate(example_questions[:3], 1):  # Limit to 3 examples
                examples_section += f"\nExample {i}:\n"
                examples_section += f"Question: {ex.get('question', '')}\n"
                examples_section += f"Difficulty: {ex.get('difficulty', 'medium')}\n"

        # Build custom prompt section if provided
        custom_section = ""
        if custom_prompt:
            custom_section = f"\n\nADDITIONAL INSTRUCTIONS:\n{custom_prompt}\n"

        prompt = f"""You are creating exam preparation questions. Based on the following text, generate ONE high-quality multiple-choice exam question.

TEXT:
{text}

REQUIREMENTS:
1. {difficulty_instructions.get(difficulty, difficulty_instructions["mixed"])}
2. Write the question as if it would appear on an actual exam or standardized test
3. The question must be directly answerable from the text provided
4. Provide exactly 4 answer options (A, B, C, D)
5. Only ONE option should be correct
6. Make incorrect options plausible and tempting to students who haven't fully understood the material
7. Use clear, professional exam language
8. Include a brief explanation of why the correct answer is right (for study purposes)

EXAM QUESTION STYLES TO USE:
- "Which of the following..."
- "According to the text..."
- "What is the primary/main..."
- "The author suggests that..."
- "Based on the passage..."{examples_section}{custom_section}

RESPOND ONLY with valid JSON in this exact format:
{{
  "question": "Your exam-style question here?",
  "options": [
    {{"option": "A", "text": "First plausible option"}},
    {{"option": "B", "text": "Second plausible option"}},
    {{"option": "C", "text": "Third plausible option"}},
    {{"option": "D", "text": "Fourth plausible option"}}
  ],
  "correct_answer": "A",
  "explanation": "Brief explanation of why this answer is correct and why distractors are wrong",
  "difficulty": "easy|medium|hard"
}}

JSON Response:"""

        return prompt

    def _parse_response(self, response: str) -> Optional[Dict]:
        """Parse the AI response into structured question data"""
        try:
            # Extract JSON from response (handle cases where AI adds extra text)
            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                data = json.loads(json_str)

                # Validate structure
                required_fields = ["question", "options", "correct_answer", "explanation"]
                if all(field in data for field in required_fields):
                    return data

        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Response was: {response}")

        return None
