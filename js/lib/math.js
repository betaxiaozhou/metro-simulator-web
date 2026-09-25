export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function ms2kmh(v) {
  return v * 3.6;
}

export function kmh2ms(v) {
  return v / 3.6;
}
