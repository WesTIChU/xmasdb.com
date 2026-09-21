import type { CrewMember } from '../types';

export const CREATIVE_CREW_JOBS = ['Director', 'Writer', 'Screenplay', 'Story'] as const;
export type CreativeCrewJob = typeof CREATIVE_CREW_JOBS[number];

export function isCreativeCrewJob(job: string): job is CreativeCrewJob {
  return (CREATIVE_CREW_JOBS as readonly string[]).includes(job);
}

export function getCreativeCrew(crew: CrewMember[] | undefined): CrewMember[] {
  const unique = new Map<string, CrewMember>();
  for (const member of crew || []) {
    if (!isCreativeCrewJob(member.job)) continue;
    const key = `${member.id}:${member.job}`;
    if (!unique.has(key)) unique.set(key, member);
  }
  return [...unique.values()];
}

export function getPersonSlug(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
