const optimizedHomepagePosterIds = new Set([
  '480626',
  '249060',
  '1127936',
  '737793',
  '235494',
  '971464',
]);

const optimizedHomepageActorIds = new Set([
  '22082',
  '218923',
  '589182',
  '134673',
  '62909',
  '122888',
  '1292329',
  '104646',
  '43265',
  '78501',
  '4568',
  '43426',
  '35472',
  '168750',
  '92856',
  '2120306',
  '31363',
  '169469',
  '151975',
  '82943',
  '1751311',
  '2081445',
  '1233560',
  '33669',
]);

export function getHomepagePosterSrcSet(url: string): string | undefined {
  const match = url.match(/^\/images\/posters\/(\d+)\.jpg$/);
  if (!match || !optimizedHomepagePosterIds.has(match[1])) return undefined;
  return `/images/optimized/posters/${match[1]}-320.webp 320w, ${url} 500w`;
}

export function getHomepageActorSrcSet(url: string): string | undefined {
  const match = url.match(/^\/images\/people\/(\d+)\.webp$/);
  if (!match || !optimizedHomepageActorIds.has(match[1])) return undefined;
  return `/images/optimized/people/${match[1]}-216.webp 216w, ${url} 500w`;
}
