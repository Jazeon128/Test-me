"""Build structured prompts for professional certification exam questions"""

from typing import List, Dict, Optional
from .gcp_ace_archetypes import GCP_ACE_ARCHETYPES, AWS_SAA_ARCHETYPES


class ExamPromptBuilder:
    """Builds prompts for professional certification-style questions"""

    def __init__(self, cert_type: str = "gcp_ace"):
        """Initialize with certification type"""
        if cert_type == "gcp_ace":
            self.archetypes = GCP_ACE_ARCHETYPES
            self.cert_name = "Google Cloud Certified Associate Cloud Engineer (ACE)"
        elif cert_type == "aws_saa":
            self.archetypes = AWS_SAA_ARCHETYPES
            self.cert_name = "AWS Certified Solutions Architect - Associate (SAA)"
        else:
            raise ValueError(f"Unknown certification type: {cert_type}")

    def build_prompt(
        self,
        source_text: str,
        archetype: Optional[str] = None,
        topics: Optional[List[str]] = None,
        constraints: Optional[str] = None,
        distractor_strategy: str = "mixed"
    ) -> str:
        """
        Build a structured exam question prompt

        Args:
            source_text: The source material to generate questions from
            archetype: The question archetype (optional - AI will determine from content)
            topics: List of topics/services to focus on
            constraints: Scenario constraints (e.g., "most cost-effective")
            distractor_strategy: How to generate wrong answers

        Returns:
            Complete prompt string
        """
        # If no archetype specified, use generic exam-style prompt
        if not archetype:
            return self._build_generic_prompt(source_text, topics, constraints, distractor_strategy)

        if archetype not in self.archetypes:
            raise ValueError(f"Unknown archetype: {archetype}")

        arch_config = self.archetypes[archetype]

        # Build topics list
        topics_str = self._format_topics(topics, arch_config.get("common_services", []))

        # Build constraint section
        constraint_str = self._format_constraints(constraints, arch_config.get("example_constraints", []))

        # Build distractor strategy section
        distractor_str = self._format_distractor_strategy(distractor_strategy, arch_config.get("distractor_focus", []))

        # Build complete prompt
        prompt = f"""## 🎯 ROLE AND GOAL ##

You are an expert {self.cert_name} question designer. Your goal is to generate ONE (1) high-quality, multiple-choice practice question in the style of a professional certification exam.

## 📋 QUESTION STRUCTURE (MUST FOLLOW) ##

This question MUST be a "micro-scenario" with these 5 parts:
1. **Persona/Context:** A role for the user (e.g., "You are a Cloud Engineer...", "Your manager has asked...")
2. **Problem/Scenario:** A specific, practical situation
3. **Goal/Task:** A clear objective
4. **Constraint (The "Twist"):** A key phrase that makes the question tricky and narrows the correct answer
5. **Multiple-Choice Options:** Four options (A, B, C, D)

## 🎓 ARCHETYPE: {arch_config['name']} ##

**Description:** {arch_config['description']}

**Structure Requirements:**
{self._format_list(arch_config.get('structure', []))}

{topics_str}

{constraint_str}

## 🧠 DISTRACTOR STRATEGY (MUST FOLLOW) ##

The four options MUST adhere to this formula:
* **One (1) Correct Answer:** The ONLY solution that perfectly satisfies both the Goal and the Constraint
* **One (1) "Plausible but Wrong" Distractor:** A valid action that works but FAILS the constraint
* **One (1) "Conceptually Close" Distractor:** Uses right keywords but wrong service/command
* **One (1) "Clearly Wrong" Distractor:** Unrelated service, non-existent feature, or service from another cloud

{distractor_str}

## 📚 SOURCE MATERIAL ##

{source_text}

## ✅ REQUIREMENTS ##

1. Create a realistic micro-scenario following the "{arch_config['name']}" archetype
2. Include a professional persona and specific business context
3. The question MUST be directly answerable from the source material
4. Focus on the specified topics and constraints
5. Use clear, professional certification exam language
6. Question styles to use:
   - "Which of the following..."
   - "What is the MOST cost-effective/secure way to..."
   - "A company needs to... Which approach should you recommend?"
   - "You are troubleshooting... What is the BEST solution?"

## 📝 OUTPUT FORMAT ##

Respond ONLY with valid JSON in this exact format:

{{
  "question": "Complete exam-style question with persona, problem, goal, and constraint",
  "options": [
    {{"option": "A", "text": "First option - following distractor strategy"}},
    {{"option": "B", "text": "Second option - following distractor strategy"}},
    {{"option": "C", "text": "Third option - following distractor strategy"}},
    {{"option": "D", "text": "Fourth option - following distractor strategy"}}
  ],
  "correct_answer": "A",
  "explanation": "DETAILED multi-paragraph explanation that:
1. Identifies the correct answer and explains WHY it satisfies both the goal AND the constraint
2. For EACH incorrect option, explains specifically WHY it is wrong:
   - Option B is incorrect because...
   - Option C is incorrect because...
   - Option D is incorrect because...",
  "difficulty": "hard",
  "archetype": "{archetype}",
  "topics": {topics if topics else []}
}}

JSON Response:"""

        return prompt

    def _format_topics(self, user_topics: Optional[List[str]], common_services: List[str]) -> str:
        """Format the topics/services section"""
        if user_topics:
            topics_list = "\n".join([f"- {topic}" for topic in user_topics])
            return f"""## 🎯 TOPICS/SERVICES TO FOCUS ON ##

**User-Specified Topics:**
{topics_list}

**Suggested Services for this Archetype:**
{', '.join(common_services[:8])}"""
        else:
            return f"""## 🎯 TOPICS/SERVICES TO FOCUS ON ##

**Focus on these common services:**
{', '.join(common_services[:8])}"""

    def _format_constraints(self, user_constraint: Optional[str], example_constraints: List[str]) -> str:
        """Format the constraints section"""
        if user_constraint:
            return f"""## 🔧 SCENARIO CONSTRAINTS ##

**CRITICAL: The question MUST include this constraint:**
"{user_constraint}"

This constraint is the "twist" that makes one answer clearly correct and eliminates others.

**Examples of similar constraints:**
{self._format_list(example_constraints[:4])}"""
        else:
            examples = self._format_list(example_constraints[:4])
            return f"""## 🔧 SCENARIO CONSTRAINTS ##

**Include one of these constraint types to create the "twist":**
{examples}"""

    def _format_distractor_strategy(self, strategy: str, distractor_focus: List[str]) -> str:
        """Format the distractor strategy section"""
        base = f"""**Common Wrong Answers for this Archetype:**
{self._format_list(distractor_focus)}"""

        if strategy == "plausible":
            return f"""{base}

**Emphasis:** Make all distractors highly plausible. Each wrong answer should be a solution that:
- Could work in a different scenario
- A junior engineer might reasonably choose
- Fails the specific constraint in subtle ways"""
        elif strategy == "conceptual":
            return f"""{base}

**Emphasis:** Focus on conceptually similar but incorrect options:
- Similar service names (e.g., Cloud SQL vs Cloud Spanner)
- Similar commands with wrong syntax
- Right concept, wrong implementation"""
        else:  # mixed
            return f"""{base}

**Use a mix of distractor types** as specified in the formula above."""

    def _format_list(self, items: List[str]) -> str:
        """Format a list of items with bullets"""
        return "\n".join([f"- {item}" for item in items])

    def _build_generic_prompt(
        self,
        source_text: str,
        topics: Optional[List[str]] = None,
        constraints: Optional[str] = None,
        distractor_strategy: str = "mixed"
    ) -> str:
        """Build a generic exam-style prompt when no specific archetype is selected"""

        # Build topics section
        topics_section = ""
        if topics:
            topics_list = "\n".join([f"- {topic}" for topic in topics])
            topics_section = f"""
## 🎯 TOPICS TO FOCUS ON ##

{topics_list}
"""

        # Build constraints section
        constraints_section = ""
        if constraints:
            constraints_section = f"""
## 🔧 SCENARIO CONSTRAINT ##

**CRITICAL: The question MUST include this constraint:**
"{constraints}"

This constraint is the "twist" that makes one answer clearly correct and eliminates others.
"""

        prompt = f"""## 🎯 ROLE AND GOAL ##

You are an expert {self.cert_name} question designer. Your goal is to generate ONE (1) high-quality, multiple-choice practice question in the style of a professional certification exam.

## 📋 QUESTION STRUCTURE (MUST FOLLOW) ##

This question MUST be a "micro-scenario" with these 5 parts:
1. **Persona/Context:** A role for the user (e.g., "You are a Cloud Engineer...", "Your manager has asked...")
2. **Problem/Scenario:** A specific, practical situation
3. **Goal/Task:** A clear objective
4. **Constraint (The "Twist"):** A key phrase that makes the question tricky and narrows the correct answer (e.g., "most cost-effective", "least privilege", "highest availability")
5. **Multiple-Choice Options:** Four options (A, B, C, D)

## 🎓 QUESTION ARCHETYPE ##

**Analyze the source material** and determine the most appropriate question type:
- **Security/IAM**: Focus on access control, permissions, encryption, compliance
- **Cost Optimization**: Focus on pricing models, resource sizing, cost reduction
- **Performance/Scalability**: Focus on scaling, caching, optimization
- **Networking**: Focus on VPCs, connectivity, DNS, load balancing
- **Storage/Databases**: Focus on choosing appropriate data stores
- **Operations**: Focus on monitoring, logging, troubleshooting, DevOps
- **High Availability**: Focus on redundancy, failover, disaster recovery
{topics_section}{constraints_section}
## 🧠 DISTRACTOR STRATEGY (MUST FOLLOW) ##

The four options MUST adhere to this formula:
* **One (1) Correct Answer:** The ONLY solution that perfectly satisfies both the Goal and the Constraint
* **One (1) "Plausible but Wrong" Distractor:** A valid action that works but FAILS the constraint
* **One (1) "Conceptually Close" Distractor:** Uses right keywords but wrong service/command
* **One (1) "Clearly Wrong" Distractor:** Unrelated service, non-existent feature, or service from another cloud

## 📚 SOURCE MATERIAL ##

{source_text}

## ✅ REQUIREMENTS ##

1. Create a realistic micro-scenario based on the source material
2. Include a professional persona and specific business context
3. The question MUST be directly answerable from the source material
4. Use clear, professional certification exam language
5. Question styles to use:
   - "Which of the following..."
   - "What is the MOST cost-effective/secure/efficient way to..."
   - "A company needs to... Which approach should you recommend?"
   - "You are troubleshooting... What is the BEST solution?"

## 📝 OUTPUT FORMAT ##

Respond ONLY with valid JSON in this exact format:

{{
  "question": "Complete exam-style question with persona, problem, goal, and constraint",
  "options": [
    {{"option": "A", "text": "First option - following distractor strategy"}},
    {{"option": "B", "text": "Second option - following distractor strategy"}},
    {{"option": "C", "text": "Third option - following distractor strategy"}},
    {{"option": "D", "text": "Fourth option - following distractor strategy"}}
  ],
  "correct_answer": "A",
  "explanation": "DETAILED multi-paragraph explanation that:
1. Identifies the correct answer and explains WHY it satisfies both the goal AND the constraint
2. For EACH incorrect option, explains specifically WHY it is wrong:
   - Option B is incorrect because...
   - Option C is incorrect because...
   - Option D is incorrect because...",
  "difficulty": "medium"
}}

JSON Response:"""

        return prompt


def get_available_archetypes(cert_type: str = "gcp_ace") -> Dict[str, Dict]:
    """Get all available archetypes for a certification"""
    if cert_type == "gcp_ace":
        return GCP_ACE_ARCHETYPES
    elif cert_type == "aws_saa":
        return AWS_SAA_ARCHETYPES
    else:
        return {}
