"""
Progress calculation utilities for question generation tracking
"""


def calculate_generation_progress(questions_completed: int, total_questions: int) -> int:
    """
    Calculate progress percentage during question generation phase.
    
    The progress allocation is:
    - 0-10%: Document parsing (before generation)
    - 10-20%: Parsing complete, generation starting
    - 20-90%: Question generation (70% allocated)
    - 90-100%: Saving to database
    
    This function calculates progress during the generation phase (20-90%).
    
    Formula: 20 + (questions_completed / total_questions * 70)
    
    Args:
        questions_completed: Number of questions that have been generated
        total_questions: Total number of questions to generate
        
    Returns:
        Progress percentage as integer (20-90)
        
    Examples:
        >>> calculate_generation_progress(0, 10)
        20
        >>> calculate_generation_progress(5, 10)
        55
        >>> calculate_generation_progress(10, 10)
        90
        >>> calculate_generation_progress(0, 0)
        20
    """
    # Handle edge case: zero questions (avoid division by zero)
    if total_questions == 0:
        return 20
    
    # Calculate progress: 20% base + (70% * completion ratio)
    progress_pct = 20 + round((questions_completed / total_questions) * 70)
    
    # Ensure result never exceeds 90 during generation phase
    return min(progress_pct, 90)
