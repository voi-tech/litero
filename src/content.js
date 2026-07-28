export function buildGameCategories(categories) {
  return (categories ?? []).map(category => ({
    id: category.id,
    name: category.name,
    icon: category.icon,
    definition: category.definition?.trim() ?? '',
    easyWords: (category.easyWords ?? []).map(entry => ({ ...entry })),
    hardWords: (category.hardWords ?? []).map(entry => ({ ...entry })),
  }));
}

export function validateGameCategories(categories) {
  const errors = [];
  for (const category of categories ?? []) {
    const label = category.name || category.id || 'Kategoria';
    if (!category.definition?.trim()) errors.push(`${label}: brak definicji kategorii`);
    if (!category.easyWords?.length) errors.push(`${label}: brak łatwych słów`);
    if (!category.hardWords?.length) errors.push(`${label}: brak trudnych słów`);
  }
  return { valid: errors.length === 0, errors };
}
