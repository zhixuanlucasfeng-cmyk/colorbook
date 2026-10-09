import { generate } from './gen.js?v=5';
onmessage = ({ data: { rgba, w, h, opts } }) => postMessage(generate(rgba, w, h, opts));
