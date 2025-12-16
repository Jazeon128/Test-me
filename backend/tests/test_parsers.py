import pytest
from unittest.mock import MagicMock, patch
from app.services.parsers.youtube import YouTubeParser
from app.services.parsers.powerpoint import PowerPointParser

# Mock the youtube_transcript_api
@patch('app.services.parsers.youtube.YouTubeTranscriptApi')
def test_youtube_parser(mock_yt_api):
    # Setup mock
    mock_yt_api.get_transcript.return_value = [
        {'text': 'Hello world', 'start': 0.0, 'duration': 1.0},
        {'text': 'This is a test', 'start': 1.0, 'duration': 2.0}
    ]

    parser = YouTubeParser()
    result = parser.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert result.full_text == "Hello world This is a test"
    assert result.metadata['source'] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert result.metadata['video_id'] == "dQw4w9WgXcQ"

def test_youtube_parser_invalid_url():
    parser = YouTubeParser()
    with pytest.raises(ValueError):
        parser.parse("https://notayoutubeurl.com")

# Mock the pptx library
@patch('app.services.parsers.powerpoint.Presentation')
def test_pptx_parser(mock_presentation):
    # Setup mock presentation structure
    mock_prs = MagicMock()
    slide1 = MagicMock()
    shape1 = MagicMock()
    shape1.has_text_frame = True
    shape1.text = "Slide 1 Title"
    shape2 = MagicMock()
    shape2.has_text_frame = True
    shape2.text = "Slide 1 Content"
    slide1.shapes = [shape1, shape2]
    slide1.has_notes_slide = False

    slide2 = MagicMock()
    shape3 = MagicMock()
    shape3.has_text_frame = True
    shape3.text = "Slide 2 Content"
    slide2.shapes = [shape3]
    slide2.has_notes_slide = False

    mock_prs.slides = [slide1, slide2]
    mock_presentation.return_value = mock_prs

    parser = PowerPointParser()
    # We can pass a dummy path since we mocked Presentation
    result = parser.parse("dummy_path.pptx")

    expected_content = "Slide 1 Title\nSlide 1 Content\n\nSlide 2 Content"
    assert result.full_text.strip() == expected_content.strip()
    assert result.metadata['source'] == "dummy_path.pptx"
