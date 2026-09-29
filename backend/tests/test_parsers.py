from types import SimpleNamespace

import pytest
from unittest.mock import MagicMock, patch
from app.services.parsers.youtube import YouTubeParser
from app.services.parsers.powerpoint import PowerPointParser


# Mock the youtube_transcript_api
@patch("app.services.parsers.youtube.YouTubeTranscriptApi")
def test_youtube_parser(mock_yt_api):
    # youtube-transcript-api 1.x is instance based and returns snippet objects
    # with a .text attribute, not the dicts the old class method returned.
    snippets = [
        SimpleNamespace(text="Hello world", start=0.0, duration=1.0),
        SimpleNamespace(text="This is a test", start=1.0, duration=2.0),
    ]
    mock_yt_api.return_value.fetch.return_value = snippets

    parser = YouTubeParser()
    result = parser.parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert result.full_text == "Hello world This is a test"
    assert result.metadata["source"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert result.metadata["video_id"] == "dQw4w9WgXcQ"


def test_youtube_parser_invalid_url():
    parser = YouTubeParser()
    with pytest.raises(ValueError):
        parser.parse("https://notayoutubeurl.com")


# Mock the pptx library
@patch("app.services.parsers.powerpoint.Presentation")
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
    assert result.metadata["source"] == "dummy_path.pptx"


@patch("app.services.parsers.youtube.YouTubeTranscriptApi")
def test_youtube_parser_reads_the_stored_url_file(mock_yt_api, tmp_path):
    """Upload stores the URL in a .youtube file and passes its path, like every other parser."""
    mock_yt_api.return_value.fetch.return_value = [SimpleNamespace(text="Hello", start=0.0, duration=1.0)]
    stored = tmp_path / "20260929_video.youtube"
    stored.write_text("https://www.youtube.com/watch?v=dQw4w9WgXcQ\n", encoding="utf-8")

    result = YouTubeParser().parse(str(stored))

    assert result.metadata["video_id"] == "dQw4w9WgXcQ"
    assert result.metadata["source"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    mock_yt_api.return_value.fetch.assert_called_once_with("dQw4w9WgXcQ")
