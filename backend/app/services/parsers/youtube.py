import os
import re
from youtube_transcript_api import YouTubeTranscriptApi
from typing import Optional
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class YouTubeParser(BaseParser):
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extracts the video ID from a YouTube URL.
        Supports various formats:
        - https://www.youtube.com/watch?v=VIDEO_ID
        - https://youtu.be/VIDEO_ID
        - https://www.youtube.com/embed/VIDEO_ID
        """
        # Regular expression for YouTube video ID
        regex = r"(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^\"&?\/\s]{11})"
        match = re.search(regex, url)
        if match:
            return match.group(1)
        return None

    def get_transcript(self, video_id: str) -> str:
        """
        Fetches the transcript for a given video ID.
        Returns the transcript as a single string.
        """
        try:
            # youtube-transcript-api 1.x is instance based: the old class method
            # YouTubeTranscriptApi.get_transcript was removed, so the previous
            # call raised AttributeError and no YouTube source ever parsed.
            fetched = YouTubeTranscriptApi().fetch(video_id)
            return " ".join(snippet.text for snippet in fetched)
        except Exception as e:
            raise Exception(f"Failed to fetch transcript: {str(e)}")

    def parse(self, source: str) -> ParsedDocument:
        """
        Main entry point: Parses a YouTube URL and returns the transcript text.

        `source` is either the URL or the path of the `.youtube` file the upload
        endpoint stores it in. Every other parser takes a file path, so upload
        passes one here too; reading only a URL made every YouTube upload fail
        with "Invalid YouTube URL".
        """
        url = source
        if os.path.isfile(source):
            with open(source, encoding="utf-8") as handle:
                url = handle.read().strip()

        video_id = self.extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        content = self.get_transcript(video_id)

        return ParsedDocument(
            full_text=content,
            sections=[ParsedSection(text=content)],
            metadata={"source": url, "video_id": video_id, "type": "youtube"},
        )
