// Small things the app and its panes share.
import { presentationReceiver } from './link.js';

export const $ = (id) => document.getElementById(id);
// this page is an output display (a window on the projector, or a second screen), not the editor
export const IS_OUTPUT = location.hash === '#output' || !!presentationReceiver();
export const COARSE = matchMedia('(pointer: coarse)').matches;
// ?lowres renders far fewer pixels: for the automated tests, which run on software WebGL
export const MAX_RENDER_PIXELS = new URLSearchParams(location.search).has('lowres') ? 6e4 : 2.6e6;
export const FIT_CODE = { fill: 0, fit: 1, stretch: 2 };
// sessionStorage, which can throw where storage is blocked
export const session = (op, key, value) => { try { return sessionStorage[op + 'Item'](key, value); } catch { return null; } };
