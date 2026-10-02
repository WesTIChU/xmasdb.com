export const NORMAL_LOGO = '/logo-550.webp';
export const NORMAL_LOGO_SRCSET = '/logo-550.webp 550w, /logo-1100.webp 1100w';
export const NORMAL_LOGO_SIZES = '(min-width: 1024px) 527px, 240px';
export const HALLOWEEN_LOGO = '/logo-halloween-q95.webp';

const UK_TIME_ZONE = 'Europe/London';

export function getSeasonalLogo(date: Date = new Date()): string {
  const month = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIME_ZONE,
    month: 'numeric',
  }).format(date));

  return month === 10 ? HALLOWEEN_LOGO : NORMAL_LOGO;
}
