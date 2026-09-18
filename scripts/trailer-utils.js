export function selectTrailerVideos(results) {
  return (Array.isArray(results) ? results : [])
    .filter(video => video?.site === 'YouTube' && video.key && ['Trailer', 'Teaser'].includes(video.type))
    .sort((a, b) => Number(b.type === 'Trailer') - Number(a.type === 'Trailer') || Number(b.official) - Number(a.official));
}
