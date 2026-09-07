import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(process.env.H3_WRITER_SOURCE || new URL("../web/main.js", import.meta.url), "utf8");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Execute the actual orchestration functions, replacing only their IO boundaries.
function controller(names, dependencies) {
  const context = vm.createContext(dependencies);
  for (const name of names) {
    const declaration = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, "m"));
    assert.ok(declaration, name);
    vm.runInContext(declaration[0], context);
  }
  return context;
}

test("upload completion renders the current mode, including replacement", async () => {
  for (const replacement of [null, "old"]) {
    const pending = deferred();
    const renders = [];
    const studio = { mode: "Reference", assets: [], sessionId: "session" };
    const api = controller(["uploadFiles"], {
      studio, uploadMedia: () => pending.promise,
      showToast() {}, hideToast() {}, audioWasAdded: () => false,
      renderMedia: (mode) => renders.push(mode),
    });
    const operation = api.uploadFiles("Reference", [{}], replacement);
    studio.mode = "I2VA";
    pending.resolve({ session_id: "session", assets: [{ id: "new", mode: "Reference" }] });
    await operation;
    assert.deepEqual(renders, ["I2VA"]);
    assert.equal(studio.assets[0].mode, "Reference");
  }
});

test("Clear everything does not clear another mode or newer input", async () => {
  for (const changeMode of [false, true]) {
    const pending = deferred();
    const studio = { mode: "Reference" };
    let fields = { brief: "old", prompt: "old", lyrics: "" };
    const api = controller(["clearEverything"], {
      studio, currentDraftFields: () => ({ ...fields }),
      clearCurrentMedia: () => pending.promise,
      clearCurrentPrompts: () => { fields = { brief: "", prompt: "" }; },
      showToast() {},
    });
    const operation = api.clearEverything();
    if (changeMode) studio.mode = "I2VA";
    fields = { brief: "new", prompt: "new", lyrics: "" };
    pending.resolve(true);
    await operation;
    assert.equal(fields.prompt, "new");
  }
});

function refinementController(lyricsMode, pending) {
  const started = deferred();
  const output = { value: "original" };
  const instruction = { value: "rewrite" };
  const generic = { value: "brief", checked: true, textContent: "", hidden: true };
  const submit = { disabled: false };
  const panel = { querySelector: (selector) => {
    if (selector.includes("submit")) return submit;
    if (selector === "textarea" || selector.includes("instruction")) return instruction;
    return generic;
  } };
  const studio = { mode: lyricsMode ? "Music3" : "Reference", selectedModel: { name: "model", runtime_ready: true }, root: {
    querySelector: (selector) => {
      if (selector.includes("panel")) return panel;
      if (selector === "[data-output]" || selector === "[data-music-lyrics]") return output;
      return generic;
    },
  } };
  const api = controller([lyricsMode ? "submitLyricsRefinement" : "submitRefinement"], {
    studio, prepareWriterRequest: async () => true, generationModeIsAvailable: () => true,
    markActiveWriterRequest() {}, clearActiveWriterRequest() {}, setGenerationState() {},
    vramHandoffCoordinator: { trackWriterRequest: (promise) => promise },
    refine: () => { started.resolve(); return pending.promise; },
    buildRefinePayload: () => ({}), buildLyricsRefinePayload: () => ({}),
    currentBriefTextarea: () => generic, newGenerationSeed: () => 1,
    renderPromptHighlights() {}, formatGenerationMeta: () => "", syncRuntimeSummary() {},
    syncModifiedState() {}, saveCurrentModeDraft() {}, showToast() {}, updateMusicLyricsCount() {},
    icon: () => "", getStatus: async () => ({}), updatePromptResidency() {},
  });
  return { api, output, instruction, started: started.promise };
}

for (const lyrics of [false, true]) {
  test(`${lyrics ? "Lyrics" : "Prompt"} Refine preserves newer editable text and instruction`, async () => {
    const pending = deferred();
    const { api, output, instruction, started } = refinementController(lyrics, pending);
    const operation = lyrics ? api.submitLyricsRefinement() : api.submitRefinement();
    await started;
    output.value = "new user text";
    instruction.value = "new instruction";
    pending.resolve({ prompt: "late result", total_seconds: 1, tokens_per_second: 1 });
    await operation;
    assert.equal(output.value, "new user text");
    assert.equal(instruction.value, "new instruction");
  });
}

test("Refine applies an owned result without clearing a newer instruction", async () => {
  const pending = deferred();
  const { api, output, instruction, started } = refinementController(false, pending);
  const operation = api.submitRefinement();
  await started;
  instruction.value = "next instruction";
  pending.resolve({ prompt: "rewritten", total_seconds: 1, tokens_per_second: 1 });
  await operation;
  assert.equal(output.value, "rewritten");
  assert.equal(instruction.value, "next instruction");
});

test("an in-flight status response cannot restore busy after generation finishes", async () => {
  const generation = deferred();
  const started = deferred();
  const status = deferred();
  const { api } = refinementController(false, generation);
  let poll;
  let statusCalls = 0;
  Object.assign(api, {
    generate: () => { started.resolve(); return generation.promise; },
    buildGeneratePayload: () => ({}),
    setInterval: (callback) => { poll = callback; return 1; },
    clearInterval() {},
    getStatus: () => ++statusCalls === 1 ? status.promise : Promise.resolve({}),
    setGenerationState: (phase) => { api.studio.requestBusy = phase === "busy"; },
  });
  controller(["startGenerationPreview"], api);
  const operation = api.startGenerationPreview();
  await started.promise;
  const oldPoll = poll();
  generation.resolve({ prompt: "done", total_seconds: 1, tokens_per_second: 1 });
  await operation;
  assert.equal(api.studio.requestBusy, false);
  status.resolve({ phase: "generating" });
  await oldPoll;
  assert.equal(api.studio.requestBusy, false);
});

const composerSource = await readFile(new URL("../web/media_composer.js", import.meta.url), "utf8");
test("an old Composer Add cannot clear a reopened composition", async () => {
  const upload = deferred();
  const started = deferred();
  const state = { items: [{}], open: true, openGeneration: 1 };
  const context = vm.createContext({
    state, dom: { add: { disabled: false } },
    exportPicture: async () => ({}),
    onAddPicture: () => { started.resolve(); return upload.promise; },
    normalizeCanvas() {}, close: () => { state.open = false; },
    notify() {}, renderPreview() {},
  });
  const declaration = composerSource.match(/^  async function addPicture\([^]*?^  }/m);
  vm.runInContext(declaration[0], context);
  const operation = context.addPicture();
  await started.promise;
  state.openGeneration++;
  state.items = [{ uid: "new composition" }];
  upload.resolve();
  await operation;
  assert.equal(state.items[0]?.uid, "new composition");
  assert.equal(state.open, true);
});
