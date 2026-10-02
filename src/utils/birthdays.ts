import type { BirthdayActor } from '../api/types';

export interface BirthdayDate { month: number; day: number; year: number }

export function parseBirthday(value: string | undefined | null): BirthdayDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? { year, month, day } : null;
}

function dayOfYear(month: number, day: number, year: number): number {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
}

export function ageOnBirthday(birthday: string, referenceDate: Date = new Date()): number | null {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;
  const birthdayThisYear = new Date(referenceDate.getFullYear(), parsed.month - 1, parsed.day);
  const targetYear = referenceDate <= birthdayThisYear ? referenceDate.getFullYear() : referenceDate.getFullYear() + 1;
  const age = targetYear - parsed.year;
  return age >= 0 ? age : null;
}

export function birthdayDistance(birthday: string, referenceDate: Date = new Date()): number | null {
  const parsed = parseBirthday(birthday);
  if (!parsed) return null;
  const year = referenceDate.getFullYear();
  const today = dayOfYear(referenceDate.getMonth() + 1, referenceDate.getDate(), year);
  const birthdayDay = dayOfYear(parsed.month, parsed.day, year);
  return birthdayDay >= today ? birthdayDay - today : dayOfYear(12, 31, year) - today + dayOfYear(parsed.month, parsed.day, year + 1);
}

export function sortBirthdays(actors: BirthdayActor[]): BirthdayActor[] {
  return [...actors].sort((left, right) => {
    const a = parseBirthday(left.birthday); const b = parseBirthday(right.birthday);
    return (a && b ? a.month - b.month || a.day - b.day : 0) || left.name.localeCompare(right.name);
  });
}

export function upcomingBirthdays(actors: BirthdayActor[], referenceDate: Date = new Date(), limit = 6): BirthdayActor[] {
  return [...actors].sort((left, right) => (birthdayDistance(left.birthday, referenceDate) ?? Infinity) - (birthdayDistance(right.birthday, referenceDate) ?? Infinity) || left.name.localeCompare(right.name)).slice(0, limit);
}
