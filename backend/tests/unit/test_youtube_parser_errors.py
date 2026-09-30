"""Transcript failures read as one plain sentence."""
import pytest
from youtube_transcript_api import TranscriptsDisabled, VideoUnavailable

from app.services.parsers import youtube
from app.services.parsers.youtube import YouTubeParser


@pytest.mark.parametrize("error,expected", [
    (TranscriptsDisabled("abc"), "This video has no captions, so there is no transcript to study from."),
    (VideoUnavailable("abc"), "This video is unavailable or private."),
])
def test_transcript_errors_are_plain(monkeypatch, error, expected):
    class FakeApi:
        def fetch(self, video_id):
            raise error
    monkeypatch.setattr(youtube, "YouTubeTranscriptApi", FakeApi)
    with pytest.raises(Exception) as caught:
        YouTubeParser().get_transcript("abc")
    assert str(caught.value) == expected
