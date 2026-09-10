export function normalizeTrainingSearch(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

// Keep the original slide index: filtering must never renumber navigation targets.
export function searchTrainingSlides(slides, content, keyword) {
  const terms = normalizeTrainingSearch(keyword).split(' ').filter(Boolean);
  return slides.map((slide, index) => ({ slide, index })).filter(({ slide, index }) => {
    const haystack = normalizeTrainingSearch(`${slide.nav} ${slide.title} ${content[index] || ''}`);
    return terms.every(term => haystack.includes(term));
  });
}
