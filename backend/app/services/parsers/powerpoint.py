from pptx import Presentation
from .base_parser import BaseParser, ParsedDocument, ParsedSection


class PowerPointParser(BaseParser):
    def parse(self, file_path: str) -> ParsedDocument:
        """
        Parses a PowerPoint file and returns the text from all slides.
        Includes text from shapes and notes slides.
        """
        try:
            prs = Presentation(file_path)
            sections = []
            full_text_parts = []

            for i, slide in enumerate(prs.slides):
                slide_text = []
                # Extract text from shapes in the slide
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_text.append(shape.text.strip())

                # Extract text from notes slide (if available)
                if slide.has_notes_slide:
                    notes_slide = slide.notes_slide
                    for shape in notes_slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            slide_text.append(shape.text.strip())

                if slide_text:
                    slide_content = "\n".join(slide_text)
                    full_text_parts.append(slide_content)
                    sections.append(
                        ParsedSection(
                            text=slide_content,
                            page=i + 1,  # Use slide number as page number
                            section=f"Slide {i + 1}",
                        )
                    )

            full_text = "\n\n".join(full_text_parts)

            return ParsedDocument(
                full_text=full_text,
                sections=sections,
                num_pages=len(prs.slides),
                metadata={"source": file_path, "type": "pptx"},
            )
        except Exception as e:
            raise Exception(f"Failed to parse PowerPoint file: {str(e)}")
