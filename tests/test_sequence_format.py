import unittest

from backend.models.contract import ModelError
from backend.sequence import assemble_chunk, plain_chunk_prompt, validate_sequence
from backend.sequence_routes import run_sequence
from backend.sequence_repair import assemble_repair, preserve_content
from tests.test_sequence import draft, body
from tests import test_sequence as fixtures
from tests.test_sequence_output import ASSETS

SOUND = "\n\noverall_soundscape:\nSoft footsteps and room ambience.\n\nnon_diegetic_music:\nN/A"


class SequenceFormatTests(unittest.IsolatedAsyncioTestCase):
    def test_compact_uses_the_same_inputs_and_media_but_a_different_writing_contract(self):
        state = draft(); state["chunks"][0]["prompt"] = "She stands by the window."
        request = body(state); request.update(action="refine", chunk_id="c1", instruction="Move slowly")
        state["chunks"][1]["prompt"] = "She turns toward the chair."
        plan = {1: {"progression":"turn", "ending":"facing chair"}}
        official = assemble_chunk(state, 1, request, {}, plan)
        state["outputFormat"] = "compact"
        compact = assemble_chunk(state, 1, request, {}, plan)
        self.assertEqual(compact["media_inputs"], official["media_inputs"])
        for key in ["mode", "duration_seconds", "aspect_ratio", "creative_brief", "media_manifest"]:
            self.assertEqual(compact["input"][key], official["input"][key])
        self.assertEqual(compact["completion_policy"], "single_call")
        content = compact["messages"][-1]["content"]
        for term in ["She stands by the window.", "She turns toward the chair.", "Move slowly", "facing chair", "local 0–10s"]:
            self.assertIn(term, content)
        self.assertNotIn("Return the official guide's complete sections", content)
        self.assertIn("natural-language prose", content)
        self.assertEqual(state["instructions"], "Write only the current chunk. Preserve continuity.")

    def test_compact_prose_is_not_subject_to_official_sections(self):
        prose = 'A woman from <Picture 2> stands at the window shown in <Picture 1>. At 05:00 she turns. She says <d>[English] Hello.</d>' + SOUND
        result = plain_chunk_prompt("```text\n" + prose + "\n```", "Reference", 10, ASSETS, "compact")
        self.assertIn("At 00:05.000", result)
        self.assertNotIn("subject_definitions:", result)
        with self.assertRaises(ModelError): plain_chunk_prompt(prose, "Reference", 10, ASSETS)
        for bad in [prose.replace("<Picture 2>", "<Picture 9>"), prose.replace("05:00", "55:00"), "{\"steps\":[]}", prose.replace("</d>", "")]:
            with self.assertRaises(ModelError): plain_chunk_prompt(bad, "Reference", 10, ASSETS, "compact")

    async def test_compact_batch_uses_one_plan_and_the_existing_lifecycle(self):
        helper = fixtures.SequenceBatchTests(); services, calls, unloads, _ = helper.services()
        original = services._run_thread_worker
        async def worker(function, *args, **kwargs):
            result, cancel = await original(function, *args, **kwargs)
            if len(args) > 1 and args[1].get("sequence_stage") != "plan":
                result["prompt"] = f"She continues walking toward the window, interval {len(calls)}." + SOUND
            return result, cancel
        services._run_thread_worker = worker
        state = draft(); state["outputFormat"] = "compact"; events = []
        async def emit(event): events.append(event)
        await run_sequence(body(state), services, emit)
        self.assertEqual(len(helper.plan_calls), 1)
        self.assertEqual(len(calls), 3)
        self.assertEqual(unloads, ["batch"])
        self.assertEqual(len([e for e in events if e["type"] == "chunk"]), 3)
        self.assertIn("interval 1", calls[1][1]["messages"][-1]["content"])
        self.assertFalse(any(e.get("attention") for e in events))

    async def test_compact_format_correction_runs_at_most_once(self):
        for repaired in ["She sits quietly." + SOUND, "integrated_multimodal_description: She sits quietly." + SOUND]:
            helper = fixtures.SequenceBatchTests(); services, calls, unloads, _ = helper.services()
            original = services._run_thread_worker
            async def worker(function, *args, **kwargs):
                result, cancel = await original(function, *args, **kwargs)
                if len(args) > 1:
                    result["prompt"] = repaired if args[1].get("sequence_stage") == "repair" else "integrated_multimodal_description: She sits quietly." + SOUND
                return result, cancel
            services._run_thread_worker = worker
            state = draft(1); state["outputFormat"] = "compact"; events = []
            async def emit(event): events.append(event)
            await run_sequence(body(state), services, emit)
            self.assertEqual(len(calls), 2)
            self.assertEqual(helper.plan_calls, [])
            self.assertEqual(unloads, ["batch"])
            result = next(e for e in events if e["type"] == "chunk")
            self.assertEqual(bool(result.get("attention")), repaired.startswith("integrated"))
            self.assertEqual(result["prompt"], repaired)

    def test_compact_repair_cannot_rewrite_descriptive_content(self):
        state = draft(1); state["outputFormat"] = "compact"
        item = assemble_chunk(state, 0, body(state), {})
        raw = "integrated_multimodal_description: She sits." + SOUND
        with self.assertRaises(ModelError) as error: plain_chunk_prompt(raw, "T2VA", 10, [], "compact")
        repair = assemble_repair(item, raw, error.exception)
        self.assertEqual(repair["input"]["output_format"], "compact")
        self.assertIn("Return the full Compact prompt", repair["messages"][-1]["content"])
        preserve_content(raw, "She sits." + SOUND, "T2VA", "compact")
        with self.assertRaises(ModelError): preserve_content(raw, "She runs." + SOUND, "T2VA", "compact")

    def test_compact_requires_sound_fields_and_does_not_infer_missing_sound_content(self):
        valid = "She walks across the room." + SOUND
        self.assertEqual(plain_chunk_prompt(valid, "T2VA", 10, [], "compact"), valid)
        music = valid.replace("N/A", "Gentle piano music requested for this scene.")
        self.assertEqual(plain_chunk_prompt(music, "T2VA", 10, [], "compact"), music)
        for bad in ["She walks.", valid.replace("N/A", ""), valid.replace("overall_soundscape:", "sound:"),
                    valid + "\nnon_diegetic_music: N/A", valid.replace("Soft footsteps and room ambience.", "")]:
            with self.subTest(prompt=bad), self.assertRaises(ModelError) as error:
                plain_chunk_prompt(bad, "T2VA", 10, [], "compact")
            self.assertFalse(error.exception.details["repairable"])
        with self.assertRaises(ModelError): preserve_content(valid, music, "T2VA", "compact")
        with self.assertRaises(ModelError):
            preserve_content(valid, valid.replace("Soft footsteps and room ambience.", "Heavy rain."), "T2VA", "compact")

    def test_unknown_format_is_rejected_and_old_drafts_remain_official(self):
        self.assertNotIn("outputFormat", validate_sequence(body(draft(1))))
        state = draft(1); state["outputFormat"] = "unknown"
        from backend.assembly import AssemblyError
        with self.assertRaises(AssemblyError): validate_sequence(body(state))
