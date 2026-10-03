import json
import re
import time
import traceback
from typing import List, Dict, Optional, Callable
from anthropic import Anthropic
from openai import OpenAI
from google import genai
from google.genai import types as genai_types
from sqlalchemy.orm import Session
from ...config import settings
from ..typesafe_key import typesafe_key
from ..secrets import NAMES, get_secret
from .retry import LABELS, RetryState, _call_with_retry, call_with_deadline
from .clients import OPENROUTER_ROUTING, OPENROUTER_DEADLINE, OPENROUTER_TIMEOUT
from .ledger import record_call
from ..parsers.base_parser import ParsedDocument, ParsedSection
from . import sourcing, verify
from ...utils.logging import get_logger
from ...utils.redact import redact_secrets
from ...utils.metrics import track_question_generation, track_ai_api_call, estimate_cost
from ...exceptions import AIServiceError

logger = get_logger(__name__)

PASSAGE_CHARS = 2000


def passage_from(text: str) -> str:
    """Keep a source passage, ending at a nearby sentence boundary if possible."""
    if len(text) <= PASSAGE_CHARS:
        return text
    ends = [
        match.start() + 1
        for match in re.finditer(r"[.!?] |\n", text[:PASSAGE_CHARS])
        if match.start() + 1 >= PASSAGE_CHARS - 400
    ]
    return text[:ends[-1] if ends else PASSAGE_CHARS]


#: Per-request timeout for Gemini, in milliseconds as google-genai expects.
GEMINI_TIMEOUT_MS = 180_000

#: Retries are reported by the generator, so the SDK makes one attempt.
GEMINI_RETRY = genai_types.HttpRetryOptions(attempts=1)


def explain_provider_error(message: str, provider: str = "gemini") -> str:
    """Turn a raw provider error into a sentence a user can act on."""
    label = LABELS.get(provider, provider)
    if provider == "openrouter":
        timeout = re.match(r"OpenRouter took too long to answer \(over (\d+(?:\.\d+)?) s\)", message)
        if timeout:
            return (f"OpenRouter took too long to answer (over {timeout[1]} s). "
                    "Try again, or pick another model in Settings.")
    if "RESOURCE_EXHAUSTED" in message or message.startswith("429"):
        return (f"{label}: the free-tier quota is used up (429). Wait for it to reset, "
                "or add a paid key in Settings.")
    if provider == "openrouter" and message.startswith("402"):
        return "OpenRouter has insufficient credits (402). Add credits in OpenRouter."
    if "UNAVAILABLE" in message or message.startswith("503"):
        return f"{label} is overloaded (503). Try again in a few minutes."
    return message


def get_setting(db: Session, key: str) -> Optional[str]:
    """Get a setting value from database"""
    from ...models.settings import Settings

    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


class QuestionGenerator:
    """
    Generate multiple-choice questions from document content using AI.

    This class uses various AI providers (Anthropic Claude, OpenAI GPT, Google Gemini) to
    automatically generate high-quality multiple-choice questions from parsed document content.
    The generator supports customization of difficulty levels, question count, and can use
    example questions to guide the AI's output style.

    Supported AI Providers:
    -----------------------
    - **Anthropic Claude**: claude-sonnet-5 (default)
    - **OpenAI GPT**: gpt-4o (default)
    - **Google Gemini**: gemini-3.8-flash (default)

    Features:
    ---------
    - Generates questions with exactly 4 options (A, B, C, D)
    - Ensures one correct answer per question
    - Provides detailed explanations for correct answers
    - Supports difficulty levels: easy, medium, hard, mixed
    - Distributes questions evenly across document sections
    - Tracks metrics: generation time, token usage, estimated costs
    - Comprehensive error handling and logging

    Question Quality Guidelines:
    ----------------------------
    The generator enforces strict quality requirements:
    - Complete question stems that make sense without options
    - Plausible distractors based on common misconceptions
    - Professional, exam-appropriate language
    - Focus on understanding, not memorization
    - Avoids trick questions and "none of the above"

    Example Usage:
    --------------
    ```python
    from sqlalchemy.orm import Session
    from app.services.ai.question_generator import QuestionGenerator
    from app.services.parsers.pdf_parser import PDFParser

    # Initialize with database session for settings
    generator = QuestionGenerator(db=db_session)

    # Parse a document
    parser = PDFParser()
    parsed_doc = parser.parse("study_guide.pdf")

    # Generate 10 medium difficulty questions
    questions = generator.generate_questions(
        parsed_doc=parsed_doc,
        num_questions=10,
        difficulty="medium"
    )

    # Each question has: question_text, options, correct_answer, explanation, difficulty
    for q in questions:
        print(f"Q: {q['question']}")
        for opt in q['options']:
            print(f"  {opt['option']}. {opt['text']}")
    ```

    Configuration:
    --------------
    The generator can be configured via:
    1. Database settings (preferred): ai_provider, ai_model, api_key
    2. Environment variables: AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY, etc.

    Metrics Tracking:
    -----------------
    The generator automatically tracks:
    - Generation duration
    - Number of questions generated
    - AI provider and model used
    - Token usage (input/output)
    - Estimated costs
    - Success/failure rates
    """

    def __init__(
        self, db: Optional[Session] = None,
        step_callback: Optional[Callable[[str, int, int], None]] = None,
    ):
        self.step_callback = step_callback
        self._sections_done = 0
        self._sections_total = 0
        # Questions discarded by verification during the last run, each carrying
        # the reasons it was flagged. Read by the caller for reporting.
        self.flagged_questions: List[Dict] = []
        self.failed_batches: List[Dict] = []
        self.provider_quota_exhausted = False

        # Kept so the System One features can resolve their own key from
        # settings, the same way the canvas router does.
        self.db = db

        # Task settings fall back to the legacy pair and then the environment.
        if db:
            self.provider = (get_setting(db, "generation_provider")
                             or get_setting(db, "ai_provider") or settings.AI_PROVIDER)
            self.model = (get_setting(db, "generation_model")
                          or get_setting(db, "ai_model") or settings.AI_MODEL)
        else:
            self.provider = settings.AI_PROVIDER
            self.model = settings.AI_MODEL
        api_key = (get_secret(self.provider, db=db, config=settings)
                   if self.provider in NAMES else "")

        if not api_key:
            raise AIServiceError(
                message=f"No API key configured for provider: {self.provider}",
                provider=self.provider,
                details={"configuration_required": True},
            )

        self._api_key = api_key
        if self.provider == "anthropic":
            self.client = Anthropic(api_key=api_key, max_retries=0)
            if not self.model:
                self.model = "claude-sonnet-5"
        elif self.provider == "openai":
            self.client = OpenAI(api_key=api_key, max_retries=0)
            if not self.model:
                self.model = "gpt-4o"
        elif self.provider == "openrouter":
            self.client = OpenAI(
                api_key=api_key, base_url="https://openrouter.ai/api/v1",
                max_retries=0, timeout=OPENROUTER_TIMEOUT,
                default_headers={
                    "HTTP-Referer": "https://github.com/Jazeon128/Test-me",
                    "X-OpenRouter-Title": "Test Me",
                },
            )
            if not self.model:
                self.model = "openrouter/auto"
        elif self.provider == "gemini":
            # The google-genai client talks HTTPS through httpx, which honours
            # SSL_CERT_FILE, so a machine whose TLS is intercepted (a corporate
            # proxy, or antivirus doing HTTPS scanning) works with its CA bundle.
            # The timeout makes a stalled handshake fail instead of hanging the
            # generation job. google-genai takes it in milliseconds.
            self.client = genai.Client(
                api_key=api_key,
                http_options=genai_types.HttpOptions(
                    timeout=GEMINI_TIMEOUT_MS, retry_options=GEMINI_RETRY
                ),
            )
            if not self.model:
                self.model = "gemini-3.8-flash"
        else:
            raise AIServiceError(
                message=f"Unknown AI provider: {self.provider}",
                provider=self.provider,
                details={"supported_providers": ["anthropic", "openai", "gemini", "openrouter"]},
            )

    def generate_questions(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int = 10,
        difficulty: str = "mixed",
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        step_callback: Optional[Callable[[str, int, int], None]] = None,
        card_type: str = "mcq",
    ) -> List[Dict]:
        """
        Generate multiple-choice questions from a parsed document

        Args:
            parsed_doc: The parsed document with sections
            num_questions: Number of questions to generate
            difficulty: "easy", "medium", "hard", or "mixed"
            custom_prompt: Optional custom instructions for question generation
            example_questions: Optional list of example questions to inspire style
            progress_callback: Optional callback function invoked as (current, total)
                             after each question completes. Allows real-time progress tracking.
            step_callback: Optional callback invoked as (step, sections_done, sections_total).
            card_type: "mcq" for multiple-choice questions or "flashcard" for front-and-back cards.

        Returns:
            List of question dictionaries with questions, options, answers, and references
        """
        if card_type not in ("mcq", "flashcard"):
            raise ValueError("Unknown card type")
        self.card_type = card_type
        if step_callback is not None:
            self.step_callback = step_callback
        start_time = time.time()
        self.failed_batches = []
        self.flagged_questions = []
        self.provider_quota_exhausted = False

        try:
            if not any(section.text.strip() for section in parsed_doc.sections):
                raise ValueError(
                    "This document has no extractable text. If it is a scanned PDF, "
                    "run OCR on it first."
                )
            return self._generate_questions_internal(
                parsed_doc,
                num_questions,
                difficulty,
                custom_prompt,
                example_questions,
                start_time,
                progress_callback,
            )
        except Exception:
            # Track failed generation, then re-raise unchanged
            elapsed_time = time.time() - start_time
            track_question_generation(
                provider=self.provider,
                difficulty=difficulty,
                duration=elapsed_time,
                num_questions=0,
                success=False,
            )
            raise

    def _generate_questions_internal(
        self,
        parsed_doc: ParsedDocument,
        num_questions: int,
        difficulty: str,
        custom_prompt: Optional[str],
        example_questions: Optional[List[Dict]],
        start_time: float,
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> List[Dict]:
        """Internal method for question generation with metrics tracking"""

        logger.info(
            "question_generation_started",
            document_title=parsed_doc.title,
            num_sections=len(parsed_doc.sections),
            num_questions_requested=num_questions,
            difficulty=difficulty,
            provider=self.provider,
            model=self.model,
            has_custom_prompt=custom_prompt is not None,
        )

        # Select diverse sections to cover different parts of the document
        # If we need more questions than sections, we'll reuse sections
        num_sections = len(parsed_doc.sections)
        sections_needed = min(num_questions, num_sections)

        selected_sections = self._select_sections(parsed_doc.sections, sections_needed)

        self._sections_done = 0
        self._sections_total = len(selected_sections)
        all_questions = []

        # Calculate how many questions to generate per section
        questions_per_section = max(1, (num_questions + sections_needed - 1) // sections_needed)

        # Generate questions from each section
        # Dynamically adjust max batch size based on total request
        max_batch_size = 10 if num_questions >= 20 else 5

        for i, section in enumerate(selected_sections, 1):
            if self.provider_quota_exhausted:
                break
            if len(all_questions) >= num_questions:
                break

            # Determine how many questions to ask for in this batch
            remaining_needed = num_questions - len(all_questions)
            batch_size = min(questions_per_section, remaining_needed, max_batch_size)

            if batch_size <= 0:
                break

            logger.debug(
                "processing_section",
                section_number=i,
                total_sections=len(selected_sections),
                batch_size=batch_size,
                questions_generated=len(all_questions),
                questions_target=num_questions,
            )

            self._report_step(f"Asking {LABELS.get(self.provider, self.provider)}")
            questions = self._generate_batch_questions(
                section,
                batch_size,
                difficulty,
                custom_prompt,
                example_questions,
                progress_callback,
                len(all_questions),
                num_questions,
            )

            if questions:
                self._report_step("Checking cards" if self.card_type == "flashcard" else "Checking questions")
                questions = self._verify_batch(section, questions)
                all_questions.extend(questions)
                logger.debug(
                    "section_processed_success",
                    section_number=i,
                    questions_from_section=len(questions),
                    total_questions=len(all_questions),
                )
            else:
                logger.warning(
                    "section_processed_failure",
                    section_number=i,
                    section_text_length=len(section.text),
                )

            self._sections_done = i

        # Limit to requested number
        final_questions = all_questions[:num_questions]
        if not final_questions and not self.flagged_questions and self.failed_batches:
            raise AIServiceError(
                message=(f"{LABELS.get(self.provider, self.provider)} failed on {len(self.failed_batches)} of "
                         f"{len(selected_sections)} section(s): "
                         f"{explain_provider_error(self.failed_batches[-1]['message'], self.provider)}"),
                provider=self.provider,
            )
        elapsed_time = time.time() - start_time

        # Track metrics
        track_question_generation(
            provider=self.provider,
            difficulty=difficulty,
            duration=elapsed_time,
            num_questions=len(final_questions),
            success=True,
        )

        logger.info(
            "question_generation_completed",
            questions_generated=len(final_questions),
            questions_requested=num_questions,
            duration_seconds=round(elapsed_time, 2),
            provider=self.provider,
            model=self.model,
            success=True,
        )

        self._report_step("Finishing generation")
        return final_questions

    def _report_step(self, step: str) -> None:
        callback = getattr(self, "step_callback", None)
        if callback is not None:
            callback(step, self._sections_done, self._sections_total)

    def _generation_call(self, call):
        state = RetryState()
        started = time.monotonic()
        response = None
        error = None
        bounded_call = (lambda: call_with_deadline(call, OPENROUTER_DEADLINE)
                        if self.provider == "openrouter" else call())
        try:
            response = _call_with_retry(
                bounded_call, LABELS.get(self.provider, self.provider),
                state=state, on_step=self._report_step,
                on_timeout=lambda exc, start, attempt: record_call(
                    db=getattr(self, "db", None), task="generation",
                    provider=self.provider, model=self.model, started=start,
                    attempts=attempt, error=exc, job_id=getattr(self, "job_id", None),
                ),
            )
            return response
        except Exception as exc:
            error = exc
            if state.quota_exhausted:
                self.provider_quota_exhausted = True
            raise
        finally:
            record_call(
                db=getattr(self, "db", None), task="generation",
                provider=self.provider, model=self.model, started=started,
                attempts=state.attempts, response=response, error=error,
                job_id=getattr(self, "job_id", None),
            )

    def _gemini_generate(self, prompt: str):
        return self._generation_call(lambda: self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.7,
                automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            ),
        ))

    def _select_sections(
        self, sections: List[ParsedSection], num_needed: int
    ) -> List[ParsedSection]:
        """Choose the sections worth generating questions from.

        Even spacing through a document picks whatever happens to sit at those
        offsets, which in a real PDF is often a contents page, a copyright notice
        or a reference list. Jev scores each section on what could be examined
        from it and the best ones win.

        Without a TypeSafe key, or if Jev cannot be reached, this falls back to
        the original even spacing. Generation never depends on the judgment.
        """
        if len(sections) <= num_needed:
            return sections

        api_key = self._typesafe_key()
        if not api_key:
            return sourcing._evenly_spaced(sections, num_needed)

        payload = [
            {"id": str(index), "heading": section.section or "", "text": section.text}
            for index, section in enumerate(sections)
        ]

        chosen = sourcing.select_sections(payload, num_needed, api_key)
        return [sections[int(item["id"])] for item in chosen]

    def _verify_batch(self, section: ParsedSection, questions: List[Dict]) -> List[Dict]:
        """Drop questions the source does not support.

        A question whose keyed answer is wrong is worse than a missing question,
        because the user studies it and learns the wrong thing with no way to
        tell. So a flagged question is removed rather than shown with a warning.

        Flagged questions are counted on the generator so the caller can report
        how many were discarded, and so the flag rate can be measured against
        real documents before anyone tunes the threshold.
        """
        api_key = self._typesafe_key()
        if not api_key:
            return questions

        verdicts = verify.verify_batch(section.text, questions, api_key)
        passed, flagged = verify.partition(questions, verdicts)

        if flagged:
            if not hasattr(self, "flagged_questions"):
                self.flagged_questions = []
            self.flagged_questions.extend(flagged)
            logger.info(
                "questions_flagged",
                flagged=len(flagged),
                kept=len(passed),
                reasons=[reason for item in flagged for reason in item.get("flags", [])],
            )

        return passed

    def _typesafe_key(self) -> str:
        """Use the shared settings lookup, or the environment without a session.

        Only real non-empty strings count, including for mock sessions.
        """
        return typesafe_key(getattr(self, "db", None))

    def _generate_batch_questions(
        self,
        section: ParsedSection,
        count: int,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        questions_so_far: int = 0,
        total_questions: int = 0,
    ) -> List[Dict]:
        """Generate a batch of multiple-choice questions from a section"""
        try:
            prompt = self._batch_prompt(section.text, count, difficulty, custom_prompt, example_questions)
            content = ""
            provider_display = {
                "anthropic": "Anthropic Claude",
                "openai": "OpenAI GPT-4",
                "gemini": "Google Gemini",
            }.get(self.provider, self.provider)

            logger.debug(
                "ai_api_call_started",
                provider=self.provider,
                model=self.model,
                questions_requested=count,
                section_length=len(section.text),
            )

            api_start_time = time.time()
            input_tokens = None
            output_tokens = None
            estimated_cost_value = None

            if self.provider == "anthropic":
                response = self._generation_call(lambda: self.client.messages.create(
                    model=self.model,
                    max_tokens=8192,
                    messages=[{"role": "user", "content": prompt}],
                ))
                content = response.content[0].text
                # Extract token usage from response
                if hasattr(response, "usage"):
                    input_tokens = response.usage.input_tokens
                    output_tokens = response.usage.output_tokens

            elif self.provider in {"openai", "openrouter"}:
                options = ({"extra_body": OPENROUTER_ROUTING, "stream": False,
                            "timeout": OPENROUTER_TIMEOUT}
                           if self.provider == "openrouter" else {})
                response = self._generation_call(lambda: self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=8192,
                    **options,
                ))
                content = response.choices[0].message.content
                # Extract token usage from response
                if hasattr(response, "usage"):
                    input_tokens = response.usage.prompt_tokens
                    output_tokens = response.usage.completion_tokens

            elif self.provider == "gemini":
                response = self._gemini_generate(prompt)
                content = response.text
                # Extract token usage from response
                if hasattr(response, "usage_metadata"):
                    input_tokens = response.usage_metadata.prompt_token_count
                    output_tokens = response.usage_metadata.candidates_token_count

            api_elapsed = time.time() - api_start_time

            # Calculate estimated cost if we have token counts
            if input_tokens is not None and output_tokens is not None:
                estimated_cost_value = estimate_cost(
                    self.provider, self.model, input_tokens, output_tokens
                )

            # Track AI API metrics
            track_ai_api_call(
                provider=self.provider,
                model=self.model,
                duration=api_elapsed,
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost=estimated_cost_value,
            )

            logger.info(
                "ai_api_call_completed",
                provider=self.provider,
                model=self.model,
                duration_seconds=round(api_elapsed, 2),
                response_length=len(content),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost_usd=round(estimated_cost_value, 6) if estimated_cost_value else None,
                success=True,
            )

            # Parse the response
            questions_data = self._parse_generated_response(content)
            if not questions_data:
                item_name = "cards" if getattr(self, "card_type", "mcq") == "flashcard" else "questions"
                raise ValueError(f"Response contained no valid {item_name}")

            valid_questions = []
            for q_data in questions_data:
                # Add reference information
                q_data["reference"] = {
                    "text": section.text[:200] + "..." if len(section.text) > 200 else section.text,
                    "passage": passage_from(section.text),
                    "page": section.page,
                    "section": section.section,
                    "paragraph": section.paragraph,
                }
                q_data["difficulty"] = self._generated_difficulty(q_data, difficulty)
                valid_questions.append(q_data)

                # Invoke progress callback after each question is parsed
                if progress_callback is not None:
                    current_question = questions_so_far + len(valid_questions)
                    progress_callback(current_question, total_questions)

            logger.debug(
                "questions_validated",
                questions_parsed=len(questions_data),
                questions_valid=len(valid_questions),
            )

            return valid_questions

        except Exception as e:
            # Track failed API call
            api_elapsed = time.time() - api_start_time if "api_start_time" in locals() else 0
            track_ai_api_call(
                provider=self.provider, model=self.model, duration=api_elapsed, success=False
            )

            secrets = [getattr(self, "_api_key", "")]
            message = redact_secrets(str(e), secrets)
            logger.error(
                "question_generation_error",
                error_type=type(e).__name__,
                error_message=message,
                provider=self.provider,
                model=self.model,
                section_page=section.page,
                section_paragraph=section.paragraph,
                stack_trace=redact_secrets(traceback.format_exc(), secrets),
            )
            if not hasattr(self, "failed_batches"):
                self.failed_batches = []
            self.failed_batches.append({
                "section_page": section.page,
                "error_type": type(e).__name__,
                "message": message[:200],
            })
            return []

    def _batch_prompt(self, text, count, difficulty, custom_prompt, example_questions):
        if getattr(self, "card_type", "mcq") == "flashcard":
            return self._build_flashcard_prompt(text, count, custom_prompt)
        return self._build_batch_prompt(text, count, difficulty, custom_prompt, example_questions)

    def _parse_generated_response(self, content):
        if getattr(self, "card_type", "mcq") == "flashcard":
            return self._parse_flashcard_response(content)
        return self._parse_batch_response(content)

    def _generated_difficulty(self, question, difficulty):
        if getattr(self, "card_type", "mcq") == "flashcard":
            return "medium"
        return difficulty if difficulty != "mixed" else question.get("difficulty", "medium")

    def _build_flashcard_prompt(self, section_text, count, custom_prompt=None):
        custom = f"\nADDITIONAL INSTRUCTIONS:\n{custom_prompt}" if custom_prompt else ""
        return f"""Generate exactly {count} flashcards using only the passage below.
Use no outside facts. Each card tests one idea. Ignore metadata and legal notices.
The front names a term or concept or asks a short prompt. It must not contain the answer.
The front is at most 200 characters. The back answers the front in 1 to 3 sentences,
at most 600 characters. The passage must state or directly imply the answer.
Return only a JSON array of objects with front, back, and reference fields:
[{{"front": "Short prompt", "back": "Answer", "reference": "Supporting passage"}}]
PASSAGE:
{section_text}{custom}"""

    def _parse_flashcard_response(self, response):
        match = re.search(r"\[.*\]", response, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []
        cards = []
        for item in data:
            card = self._parse_flashcard_item(item)
            if card:
                cards.append(card)
        return cards

    @staticmethod
    def _parse_flashcard_item(item):
        if not isinstance(item, dict):
            return None
        front, back = item.get("front"), item.get("back")
        if not isinstance(front, str) or not isinstance(back, str):
            return None
        front, back = front.strip(), back.strip()
        if not front or not back or len(front) > 200 or len(back) > 600:
            return None
        return dict(card_type="flashcard", question=front, explanation=back,
                    reference=item.get("reference", {}), difficulty="medium")

    def _build_batch_prompt(
        self,
        text: str,
        count: int,
        difficulty: str,
        custom_prompt: Optional[str] = None,
        example_questions: Optional[List[Dict]] = None,
    ) -> str:
        """Build the prompt for batch question generation"""

        difficulty_instructions = {
            "easy": "Create straightforward exam-style questions testing basic recall and key facts.",
            "medium": "Create exam-style questions requiring comprehension and application of concepts.",
            "hard": "Create challenging exam-style questions requiring analysis, synthesis, or evaluation.",
            "mixed": "Create exam-style questions with varying difficulty levels.",
        }

        # Build example questions section if provided
        examples_section = ""
        if example_questions and len(example_questions) > 0:
            examples_section = (
                "\n\nEXAMPLE QUESTIONS (use these as inspiration for style and format):\n"
            )
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
- Explanations must explain the correct answer by its content and never refer to options by letter (A, B, C or D), because the options are shuffled after generation.

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

Generate EXACTLY {count} questions following these guidelines.{custom_section}

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
            logger.warning("invalid_batch_json", error_type=type(e).__name__)

        return []
