import test from "node:test";
import assert from "node:assert/strict";
import { createDesktopNotifications } from "../web/desktop_notifications.js";
import { createSequenceController } from "../web/sequence_controller.js";
import { newSequence } from "../web/sequence_state.js";

test("desktop notifications are opt-in, hidden-only and tolerate browser failures", async () => {
  const values = new Map(), sent = [];
  let requested = 0;
  class API {
    static permission = "default";
    static async requestPermission() { requested++; return API.permission = "granted"; }
    constructor(title, options) { sent.push(options.body); }
  }
  const document = { visibilityState: "hidden" };
  const window = { Notification: API, isSecureContext: true };
  const storage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) };
  const n = createDesktopNotifications({storage, document, window});
  n.notify("off"); assert.deepEqual(sent, []); assert.equal(requested, 0);
  await n.setEnabled(true); n.notify("done"); assert.deepEqual(sent, ["done"]);
  document.visibilityState = "visible"; n.notify("foreground"); assert.equal(sent.length, 1);
  assert.equal(createDesktopNotifications({storage, document, window}).enabled, true);
  API.permission = "denied"; assert.equal(n.enabled, false); assert.match(n.hint, /blocked/);
  await n.setEnabled(true); assert.equal(n.enabled, false);
  const unavailable = createDesktopNotifications({storage, document, window: {}});
  await unavailable.setEnabled(true); unavailable.notify("ignored"); assert.equal(unavailable.enabled, false);
  const broken = createDesktopNotifications({storage: {getItem(){throw Error();},setItem(){throw Error();}}, document, window});
  await broken.setEnabled(false); assert.doesNotThrow(() => broken.notify("ignored"));
});

test("sequence reports one terminal notification, never per chunk or on cancellation", async () => {
  for (const mode of ["complete", "failed", "cancelled", "attention"]) {
    const state = newSequence(), events = [];
    let controller;
    controller = createSequenceController({state, snapshot:()=>({}), prepare:async()=>true,
      cancel:async()=>{}, settled:status=>events.push(status),
      run:async(payload, emit)=>{
        if(mode === "cancelled") {controller.cancel(); return;}
        if(mode === "failed") throw Error("offline");
        for(const chunk of state.chunks) emit({type:"chunk", operation_id:payload.operation_id,
          chunk_id:chunk.id, prompt:"Complete prompt", ...(mode === "attention" ? {attention:{reason:"format"}} : {})});
      }});
    await controller.start("all");
    assert.deepEqual(events, mode === "cancelled" ? [] : [mode]);
  }
});
