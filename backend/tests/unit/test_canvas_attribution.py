from app.services.viz import generator, templates


def test_prompt_keeps_exact_attribution_rule():
    rule = (
        '- Keep who said what. When the source attributes a claim to a person, organisation or document '
        '("X said", "X claims", "according to X", or a pronoun such as "It said" or "They said"), '
        'the node\'s label and detail both keep that attribution. '
        'Never restate an attributed, reported or disputed claim as plain fact.\n'
        '  Source: "In 2009 the institute replied. It said it had developed the chart in the 1960s."\n'
        '  Wrong label: "Institute develops chart". Right label: "Institute says it developed chart".\n'
        '- On a timeline, place an attributed claim at the date the claim was made, '
        'and mention the date it refers to in the detail.'
    )
    prompt = generator._prompt(
        templates.TEMPLATES["flowchart"], "Draw", "Learning pyramid",
        [{"id": "s1", "text": "In 2009 the NTL Institute said it had developed the pyramid."}],
        3, 8, "horizontal", False,
    )
    assert (
        '- Use the words the source uses. Do not invent terminology it does not contain.\n'
        + rule + '\n'
        '- If the source does not support part of the request, leave it out rather than filling it in.'
    ) in prompt
