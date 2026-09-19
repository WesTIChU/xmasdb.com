/** Calculates an actor's current age from locally stored dates. */
export function calculateAge(
  birthday?: string | null,
  deathday?: string | null,
  referenceDate: Date = new Date()
): number | null {
  if (!birthday || deathday) return null;
  const birth = new Date(birthday);
  if (isNaN(birth.getTime())) return null;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDifference = referenceDate.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Calculates age at death from locally stored dates. */
export function calculateAgeAtDeath(birthday?: string | null, deathday?: string | null): number | null {
  if (!birthday || !deathday) return null;
  const birth = new Date(birthday);
  const death = new Date(deathday);
  if (isNaN(birth.getTime()) || isNaN(death.getTime())) return null;

  let age = death.getFullYear() - birth.getFullYear();
  const monthDifference = death.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && death.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Formats a stored YYYY-MM-DD date for actor pages. */
export function formatActorDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateStr;

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[monthIdx]} ${day}, ${year}`;
}

export function isValidActorDate(dateStr?: string | null): boolean {
  return Boolean(dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(Date.parse(`${dateStr}T00:00:00Z`)));
}

/** Removes common attribution boilerplate while preserving the stored biography text. */
export function sanitizeBiography(biography?: string | null): string | null {
  if (!biography) return null;
  const cleaned = biography
    .replace(/^\s*From Wikipedia, the free encyclopedia\.?\s*/i, '')
    .replace(/\s*Description above from the Wikipedia article[\s\S]*$/i, '')
    .trim();
  return cleaned || null;
}
