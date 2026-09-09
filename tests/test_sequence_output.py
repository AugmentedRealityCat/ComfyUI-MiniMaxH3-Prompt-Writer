import unittest

from backend.models.contract import ModelError
from backend.sequence import plain_chunk_prompt


def base(narrative="[Shot 1] A fixed view of the room. Light shifts slowly."):
    return f"integrated_multimodal_description: {narrative}\n\noverall_soundscape: Distant traffic.\n\nnon_diegetic_music: N/A"


def reference():
    return """subject_definitions:
<Subject 1> is the person whose appearance comes from <Picture 2>.
<Picture 1> is the first frame of [Shot 1].

summary: [keyframe completion + reference generation] <Subject 1> stands by the window in <Picture 1>.

retention_analysis: <Subject 1> is fully_preserved. <Picture 1> is fully_preserved as the opening frame.

detailed_description: Live-action. A fixed medium view.
[Shot 1] <Subject 1> stands by the window in <Picture 1>, then turns away.

overall_soundscape: Distant traffic.

non_diegetic_music: N/A"""


ASSETS = [dict(reference="<Picture 1>", conditioning="First frame"), dict(reference="<Picture 2>", conditioning="Reference")]


class SequenceOutputTests(unittest.TestCase):
    def test_image_only_request_constrains_impossible_task_types(self):
        from backend.sequence_repair import media_contract
        contract = media_contract("Reference", ASSETS)
        self.assertIn("keyframe completion", contract)
        self.assertIn("reference generation", contract)
        allowed = contract.split(".", 1)[0]
        for impossible in ["video continuation", "video editing", "audio reuse", "audio reference"]:
            self.assertNotIn(impossible, allowed)

    def test_complete_base_and_reference_are_unchanged(self):
        for prompt, mode, assets in [(base(), "T2VA", []), (reference(), "Reference", ASSETS)]:
            self.assertEqual(plain_chunk_prompt(prompt, mode, 10, assets), prompt)
        spaced = reference().replace("summary:", "summary :")
        self.assertEqual(plain_chunk_prompt(spaced, "Reference", 10, ASSETS), spaced)
        portrait = base("[Shot 1] Live-action, framed at 9:16. Light shifts.")
        self.assertEqual(plain_chunk_prompt(portrait, "T2VA", 10, []), portrait)

    def test_shots_restart_and_cuts_increase_inside_local_duration(self):
        valid = base("[Shot 1] A room. [Shot 2] At 00:03.000, a window. [Shot 3] At 00:09.000, a chair.")
        self.assertEqual(plain_chunk_prompt(valid, "T2VA", 10, []), valid)
        for narrative in ["[Shot 4] A room.", "[Shot 1] At 00:00.000, a room.",
                          "[Shot 1] A room. [Shot 3] At 00:03.000, a chair.",
                          "[Shot 1] A room.\n[Shot 2] A chair.",
                          "[Shot 1] A room. [Shot 2] At 00:10.000, a chair.",
                          "[Shot 1] A room. [Shot 2] At 00:05.000, a chair. [Shot 3] At 00:04.000, a window."]:
            with self.subTest(narrative=narrative), self.assertRaises(ModelError):
                plain_chunk_prompt(base(narrative), "T2VA", 10, [])

    def test_local_timing_cleanup_and_ambiguous_notation(self):
        prompt = base("[Shot 1] She walks. At 05:000 she turns. By 00:10.000 she sits.")
        clean = plain_chunk_prompt("```text\n" + prompt + "\n```", "T2VA", 10, [])
        self.assertEqual(clean, prompt.replace("05:000", "00:05.000"))
        self.assertEqual(plain_chunk_prompt(clean, "T2VA", 10, []), clean)
        for value in ["00:15.000", "00:60.000", "05:00", "0:05.000", "00:05.0", "05:000"]:
            with self.subTest(value=value), self.assertRaises(ModelError):
                plain_chunk_prompt(base(f"[Shot 1] She walks ({value}), then turns."), "T2VA", 10, [])

    def test_literal_dialogue_and_visible_text_are_not_contract_syntax(self):
        prompt = base('[Shot 1] A sign reads "Chunk 4 <Picture 99> 25:000". A woman (S1) says <d>[English] At 55:000, [Shot 8].</d>')
        self.assertEqual(plain_chunk_prompt(prompt, "T2VA", 10, []), prompt)
        with self.assertRaises(ModelError):
            plain_chunk_prompt(prompt.replace("</d>", ""), "T2VA", 10, [])

    def test_request_local_media_namespace_and_subject_definitions(self):
        for prompt in [reference().replace("<Picture 2>", "<Picture 3>"),
                       reference().replace("<Subject 1> stands", "<Subject 1] stands"),
                       reference().replace("<Subject 1> stands", "<Subject 2> stands"),
                       reference().replace("<Subject 1>", "<Subject 0>"),
                       reference().replace("<Picture 1> is the first frame of [Shot 1].", "")]:
            with self.subTest(prompt=prompt[:80]), self.assertRaises(ModelError):
                plain_chunk_prompt(prompt, "Reference", 10, ASSETS)
        for token in ["<Picture 1>", "<Audio 1>", "<Video 1>", "<Subject 1>", "Picture 7"]:
            with self.subTest(token=token), self.assertRaises(ModelError):
                plain_chunk_prompt(base(f"[Shot 1] A view of {token}."), "T2VA", 10, [])

    def test_base_frame_alignment_uses_local_duration_and_final_shot(self):
        alignment = "How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 2) aligns with the 10.00-second mark of the target video."
        prompt = alignment + "\n\n" + base("[Shot 1] Rain. [Shot 2] At 00:05.000, the swordsman steps back.")
        self.assertEqual(plain_chunk_prompt(prompt, "FL2VA", 10, ASSETS), prompt)
        for wrong in [prompt.replace("10.00-second", "30.00-second"), prompt.replace("from Shot 2", "from Shot 1")]:
            with self.assertRaises(ModelError): plain_chunk_prompt(wrong, "FL2VA", 10, ASSETS)

    def test_sequence_wrappers_and_incomplete_reference_contract_fail(self):
        for prompt in [reference().replace("[keyframe completion + reference generation]", ""),
                       reference() + "\nChunk 4", reference().replace("overall_soundscape: Distant traffic.", "")]:
            with self.assertRaises(ModelError): plain_chunk_prompt(prompt, "Reference", 10, ASSETS)
        from backend.sequence_output import validate_output
        for task in ["video continuation", "video editing", "audio reference", "audio reuse"]:
            raw = reference().replace("keyframe completion + reference generation", f"keyframe completion + {task}")
            with self.subTest(task=task):
                with self.assertRaises(ModelError): validate_output(raw, "Reference", 10, ASSETS)
                self.assertEqual(plain_chunk_prompt(raw, "Reference", 10, ASSETS), reference())

    def test_task_metadata_correction_is_narrow_and_does_not_edit_content(self):
        from backend.sequence_repair import normalize_image_task_prefix
        raw = reference().replace("keyframe completion + reference generation", "video continuation")
        raw = raw.replace("turns away", 'reads "[video continuation]"')
        result = normalize_image_task_prefix(raw, "Reference", ASSETS)
        self.assertIn('reads "[video continuation]"', result)
        self.assertIn("summary: [keyframe completion + reference generation]", result)
        for mode, assets in [("T2VA", ASSETS), ("Reference", []), ("Reference", ASSETS + [dict(reference="<Video 1>", conditioning="Reference")])]:
            self.assertEqual(normalize_image_task_prefix(raw, mode, assets), raw)
        unknown = raw.replace("[video continuation]", "[unknown task]", 1)
        self.assertEqual(normalize_image_task_prefix(unknown, "Reference", ASSETS), unknown)

    def test_validator_does_not_claim_semantic_replay_detection(self):
        prompt = base("[Shot 1] She returns to the hallway and repeats her walk to the window.")
        self.assertEqual(plain_chunk_prompt(prompt, "T2VA", 10, []), prompt)
