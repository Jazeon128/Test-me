"""
Backward compatibility module for Test model.

This module provides backward compatibility by re-exporting Deck as Test.
New code should import from deck.py instead.

DEPRECATED: Use 'from app.models.deck import Deck' instead
"""

from .deck import Deck, DeckQuestion

# Backward compatibility aliases
Test = Deck
TestQuestion = DeckQuestion

__all__ = ["Test", "TestQuestion", "Deck", "DeckQuestion"]
