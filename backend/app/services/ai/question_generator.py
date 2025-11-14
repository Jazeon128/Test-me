import json
import re
from typing import List, Dict, Optional
from anthropic import Anthropic
from openai import OpenAI
from ...config import settings
from ..parsers.base_parser import ParsedDocument, ParsedSection


class QuestionGenerator:
    """Generate multiple-choice questions from document content using AI"""

    def __init__(self):
        self.provider = settings.AI_PROVIDER

        if self.provider == "anthropic":
            self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            self.model = "claude-3-5-sonnet-20241022"
        elif self.provider == "openai":
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = "gpt-4-turbo-preview"
        else:
            raise ValueError(f"Unknown AI provider: {self.provider}")

    def generate_questions(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int = 10,
        difficulty: str = "mixed"
    ) -> List[Dict]:
        """
        Generate multiple-choice questions from a parsed document

        Args:
            parsed_doc: The parsed document with sections
            num_questions: Number of questions to generate
            difficulty: "easy", "medium", "hard", or "mixed"

        Returns:
            List of question dictionaries with questions, options, answers, and references
        """
        # Select diverse sections to cover different parts of the document
        selected_sections = self._select_sections(parsed_doc.sections, num_questions)

        all_questions = []

        # Generate questions in batches (process multiple sections at once)
        batch_size = 5
        for i in range(0, len(selected_sections), batch_size):
            batch_sections = selected_sections[i : i + batch_size]
            batch_questions = self._generate_batch(batch_sections, difficulty)
            all_questions.extend(batch_questions)

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

    def _generate_batch(self, sections: List[ParsedSection], difficulty: str) -> List[Dict]:
        """Generate questions for a batch of sections"""
        questions = []

        for section in sections:
            # Generate 1 question per section
            question = self._generate_single_question(section, difficulty)
            if question:
                questions.append(question)

        return questions

    def _generate_single_question(self, section: ParsedSection, difficulty: str) -> Optional[Dict]:
        """Generate a single multiple-choice question from a section"""
        prompt = self._build_prompt(section.text, difficulty)

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

    def _build_prompt(self, text: str, difficulty: str) -> str:
        """Build the prompt for question generation"""
        difficulty_instructions = {
            "easy": "Create a straightforward question testing basic recall or understanding.",
            "medium": "Create a question requiring comprehension and some analysis.",
            "hard": "Create a challenging question requiring deep understanding and critical thinking.",
            "mixed": "Create a question with appropriate difficulty based on the content."
        }

        prompt = f"""Based on the following text, generate ONE high-quality multiple-choice question.

TEXT:
{text}

REQUIREMENTS:
1. {difficulty_instructions.get(difficulty, difficulty_instructions["medium"])}
2. The question must be directly answerable from the text
3. Provide exactly 4 answer options (A, B, C, D)
4. Only ONE option should be correct
5. Make incorrect options plausible but clearly wrong
6. Include a brief explanation of why the correct answer is right

RESPOND ONLY with valid JSON in this exact format:
{{
  "question": "Your question here?",
  "options": [
    {{"option": "A", "text": "First option"}},
    {{"option": "B", "text": "Second option"}},
    {{"option": "C", "text": "Third option"}},
    {{"option": "D", "text": "Fourth option"}}
  ],
  "correct_answer": "A",
  "explanation": "Brief explanation of why this is correct",
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
