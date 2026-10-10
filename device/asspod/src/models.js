// The assPod's bodies: the Video (5th generation, the original) and the nano (2nd generation). The
// main menu's assPod Model picks one; Color picks among that body's own finishes. Both run the same
// OS on a 4:3 screen; the nano's is 240 x 180 logical px against the Video's 320 x 240, so its text is
// larger on its screen, as on the real one. The nano plays no video: its menus leave the Videos out.
//
// Geometry in millimetres, model frame (tools/asspod-model, tools/nano2-model GEOMETRY): origin at
// the body's centre, y toward the top. `scale` is how much larger than life it is shown in the hand;
// podd (native/podd/podd.cpp VIDEO / NANO) and its render models use the same numbers. `screen` is
// the OS's logical screen on that body.

export const MODELS = Object.freeze({
  video: Object.freeze({
    id: 'video',
    label: 'Video Gen 1',
    about: 'assPod Video',
    body: { w: 61.8, h: 103.5, d: 11.0 },
    lcd: { cy: 24.2, w: 50.8, h: 38.1 },
    win: { w: 53.2, h: 40.5 },
    wheel: { cy: -24.0 },
    screen: { w: 320, h: 240 },            // logical px (os/theme.js setScreenSize)
    scale: 0.085 / 0.0618,                 // shown 85 mm wide
    finishKey: 'finish',
    finishes: [['black', 'Black'], ['white', 'White']],
    videos: true,
  }),
  nano: Object.freeze({
    id: 'nano',
    label: 'Nano Gen 2',
    about: 'assPod nano',
    body: { w: 40.0, h: 90.0, d: 6.5 },
    lcd: { cy: 28.88, w: 29.6, h: 22.2 },
    win: { w: 31.62, h: 24.04 },
    wheel: { cy: -13.3 },
    screen: { w: 240, h: 180 },            // the same text on less screen: six rows, as on the real nano
    scale: 1.3125,                         // shown 52.5 mm wide
    finishKey: 'nanoFinish',
    finishes: [['silver', 'Silver'], ['green', 'Green'], ['blue', 'Blue'], ['pink', 'Pink'], ['black', 'Black'], ['red', '(PRODUCT)RED']],
    videos: false,
  }),
});

export const MODEL_ORDER = ['video', 'nano'];

/** The current body's definition. */
export function currentModel(settings) {
  return MODELS[settings.get('model')] || MODELS.video;
}

/** The current body's finish (one of its own; its first otherwise). */
export function currentFinish(settings) {
  const m = currentModel(settings);
  const f = settings.get(m.finishKey);
  return m.finishes.some(([k]) => k === f) ? f : m.finishes[0][0];
}

/** The body in metres as shown in the hand: { w, h, d } at the model's scale. */
export function bodyMetres(m) {
  const k = m.scale / 1000;
  return { w: m.body.w * k, h: m.body.h * k, d: m.body.d * k };
}
