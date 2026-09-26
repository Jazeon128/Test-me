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
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)  # type: ignore[attr-defined]
            # Combine all text parts into one string
            full_text = " ".join([item["text"] for item in transcript_list])
            return full_text
        except Exception as e:
            raise Exception(f"Failed to fetch transcript: {str(e)}")

    def parse(self, url: str) -> ParsedDocument:
        """
        Main entry point: Parses a YouTube URL and returns the transcript text.
        """
        video_id = self.extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        content = self.get_transcript(video_id)

        return ParsedDocument(
            full_text=content,
            sections=[ParsedSection(text=content)],
            metadata={"source": url, "video_id": video_id, "type": "youtube"},
        )
