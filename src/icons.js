// src/icons.js — lokalny, minimalny renderer ikon SVG używanych w grze

const ICONS = {
  droplet: '<path d="M12 2s6 6.4 6 11a6 6 0 1 1-12 0c0-4.6 6-11 6-11z"/>',
  droplets: '<path d="M7 3s4 4.3 4 7a4 4 0 0 1-8 0c0-2.7 4-7 4-7z"/><path d="M17 7s4 4.3 4 7a4 4 0 0 1-8 0c0-2.7 4-7 4-7z"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  'help-circle': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 0 1 5 1.4c0 2-2.5 2.1-2.5 4"/><path d="M12 18h.01"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4z"/><path d="M6 6H3a5 5 0 0 0 5 5"/><path d="M18 6h3a5 5 0 0 1-5 5"/><path d="M12 12v5"/><path d="M8 21h8"/><path d="M10 17h4"/>',
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 4 6v4h8v-4c2.5-1 4-3 4-6a8 8 0 0 0-8-8z"/><path d="M9 11h.01"/><path d="M15 11h.01"/><path d="M10 16h4"/>',
  brain: '<path d="M8 6a3 3 0 0 1 5-2 3 3 0 0 1 5 3v10a3 3 0 0 1-5 2 3 3 0 0 1-5-2V6z"/><path d="M12 4v16"/><path d="M8 10h4"/><path d="M12 14h4"/>',
  microscope: '<path d="M6 18h12"/><path d="M8 21h8"/><path d="m9 13 6-6"/><path d="m7 11 6 6"/><path d="M14 4l4 4"/><path d="M11 3l6 6"/>',
  sword: '<path d="M14 4 5 13"/><path d="m19 3 2 2-9 9-2-2z"/><path d="m5 13 6 6"/><path d="m2 22 6-6"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1 1 0 0 1 .7-1.7H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><path d="M7 10h.01"/><path d="M10 7h.01"/><path d="M14 7h.01"/><path d="M17 10h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.9 4.9 2.1 2.1"/><path d="m17 17 2.1 2.1"/><path d="m19.1 4.9-2.1 2.1"/><path d="m7 17-2.1 2.1"/>',
  cross: '<path d="M12 3v18"/><path d="M6 8h12"/>',
  landmark: '<path d="M3 21h18"/><path d="M5 10h14"/><path d="M6 10v8"/><path d="M10 10v8"/><path d="M14 10v8"/><path d="M18 10v8"/><path d="m12 3 9 5H3z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M2 21v-2a4 4 0 0 1 3-3.9"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h13l-2 5 2 5H5"/>',
  'trending-up': '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  'minus-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'shield-check': '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9 12 2 2 4-5"/>',
  type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-5-5-7-5-12-3 2-6 5-6 9 0 0-2-1-2-4-2 2-3 4-3 7a7 7 0 0 0 9 7z"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z"/>',
  'text-cursor-input': '<path d="M5 4h14"/><path d="M5 20h14"/><path d="M12 4v16"/><path d="M8 8h8v8H8z"/>',
  'flip-horizontal-2': '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M21 16v3a2 2 0 0 1-2 2h-3"/><path d="M12 3v18"/>',
  'message-circle': '<path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20l1.4-4.8A8.5 8.5 0 1 1 21 11.5z"/>',
  'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>',
  zap: '<path d="M13 2 3 14h8l-1 8 11-13h-8z"/>',
  'grid-2x2-plus': '<path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M17.5 14v7"/><path d="M14 17.5h7"/>',
  scroll: '<path d="M8 21h8a4 4 0 0 0 4-4V5a2 2 0 0 0-2-2H8a4 4 0 0 0-4 4v12a2 2 0 0 0 2 2h2z"/><path d="M8 3v18"/><path d="M12 8h4"/><path d="M12 12h4"/>',
  'book-open': '<path d="M12 7v14"/><path d="M3 5h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"/>',
  feather: '<path d="M20 4c-7 0-12 5-12 12v4"/><path d="M20 4c0 7-5 12-12 12"/><path d="M8 16l-4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
  library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4v15.5"/><path d="M8 4v13"/><path d="M12 4v13"/><path d="M16 4v13"/><path d="M20 4v13"/>',
  'circle-dollar-sign': '<circle cx="12" cy="12" r="9"/><path d="M12 6v12"/><path d="M15 9.5A3 3 0 0 0 12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2a3 3 0 0 1-3-1.5"/>',
  'refresh-cw': '<path d="M21 12a9 9 0 0 1-15 6.7"/><path d="M3 12A9 9 0 0 1 18 5.3"/><path d="M18 2v4h-4"/><path d="M6 22v-4h4"/>',
};

export function icon(name, size = 18) {
  const body = ICONS[name] ?? '<circle cx="12" cy="12" r="8"/>';
  return `<svg data-icon="${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${body}</svg>`;
}

export function initIcons() {
  document.querySelectorAll('i[data-lucide]').forEach(el => {
    const name = el.getAttribute('data-lucide');
    const width = Number(el.getAttribute('width')) || 18;
    const span = document.createElement('span');
    span.innerHTML = icon(name, width);
    el.replaceWith(span.firstElementChild);
  });
}
