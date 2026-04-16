// src/icons.js — pomocnik do renderowania ikon Lucide

export function icon(name, size = 18) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;flex-shrink:0;"></i>`;
}

export function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  } else {
    // Poczekaj na załadowanie Lucide
    setTimeout(() => {
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 100);
  }
}
