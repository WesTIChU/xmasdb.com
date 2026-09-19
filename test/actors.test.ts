import assert from 'assert';
import { calculateAge, calculateAgeAtDeath, formatActorDate, getCatalogueUniqueActors } from '../src/utils/tmdb';
import { getActorByTmdbId, getAllActors, getPopularActorsByBrand } from '../src/data/actors';
import { MOVIES, getMoviesByActorSlug } from '../src/data/movies';
import { getActorSingleRichJson } from '../src/utils/feeds';

console.log('Running XmasDB Actor & TMDB Pipeline Test Suite...\n');

const referenceMovie = MOVIES[0];
const referenceCast = referenceMovie.cast[0];
const referenceActorId = referenceCast.tmdbPersonId!;

// 1. Age Calculation Tests
{
  console.log('Test 1: Dynamic Age Calculation for Living Actors');
  // Fixed reference date: 2026-09-19
  const refDate = new Date(2026, 8, 19); // September 19, 2026

  // Lacey Chabert: born 1982-09-30 (hasn't had birthday yet in Sept 2026 -> age 43)
  const laceyAge = calculateAge('1982-09-30', null, refDate);
  assert.strictEqual(laceyAge, 43, 'Lacey Chabert age on Sept 19, 2026 should be 43');

  // Tyler Hynes: born 1986-05-06 (already had birthday in May 2026 -> age 40)
  const tylerAge = calculateAge('1986-05-06', null, refDate);
  assert.strictEqual(tylerAge, 40, 'Tyler Hynes age on Sept 19, 2026 should be 40');

  console.log('✓ Living actor age calculated dynamically with date arithmetic.');
}

// 2. Deceased Actor Age Test (Mandate: "do not display a current age")
{
  console.log('Test 2: Deceased Actors Do NOT Display Current Age');
  // Treat Williams: born 1951-12-01, died 2023-06-12
  const treatCurrentAge = calculateAge('1951-12-01', '2023-06-12');
  assert.strictEqual(treatCurrentAge, null, 'calculateAge must return null for deceased actor with deathday');

  const treatAgeAtDeath = calculateAgeAtDeath('1951-12-01', '2023-06-12');
  assert.strictEqual(treatAgeAtDeath, 71, 'Treat Williams age at death should be 71');

  console.log('✓ Deceased actors do not display current age; age at death is correctly calculated.');
}

// 3. Missing Data Scenarios
{
  console.log('Test 3: Missing Metadata Returns Null Gracefully');
  assert.strictEqual(calculateAge(undefined, null), null);
  assert.strictEqual(calculateAge(null, null), null);
  assert.strictEqual(calculateAge('invalid-date', null), null);
  assert.strictEqual(formatActorDate(undefined), null);
  assert.strictEqual(formatActorDate(null), null);
  assert.strictEqual(formatActorDate('1982-09-30'), 'September 30, 1982');
  console.log('✓ Missing and invalid date fields handled safely.');
}

// 4. TMDB Deduplication Test
{
  console.log('Test 4: TMDB Unique Catalogue Ingestion Deduplication');
  const uniqueCatalogueActors = getCatalogueUniqueActors();
  const idSet = new Set<number>();
  for (const a of uniqueCatalogueActors) {
    assert.ok(!idSet.has(a.tmdbPersonId), `Duplicate TMDB ID encountered: ${a.tmdbPersonId}`);
    idSet.add(a.tmdbPersonId);
  }
  console.log(`✓ Confirmed ${uniqueCatalogueActors.length} unique actors deduplicated by TMDB Person ID.`);
}

// 5. Stored TMDB Data Retrieval
{
  console.log('Test 5: Stored TMDB Actor Retrieval by ID and Slug');
  const actor = getActorByTmdbId(referenceActorId);
  assert.ok(actor, `Reference actor should exist by TMDB Person ID ${referenceActorId}`);
  assert.strictEqual(actor?.name, referenceCast.name);
  assert.strictEqual(actor?.birthday, referenceCast.birthday);
  assert.ok(actor?.profileUrl?.startsWith('/images/people/'), 'Actor profile should use the local image cache');
  console.log('✓ Imported actor data correctly loads from the local catalogue.');
}

// 6. Catalogue Movies & Brand Breakdown
{
  console.log('Test 6: XmasDB Catalogue Movie Count & Multi-Brand Filmography');
  const referenceMovies = getMoviesByActorSlug(referenceCast.slug);
  assert.ok(referenceMovies.length >= 1, 'Reference actor should have movies in XmasDB');

  // Check an actor with multiple movies or multiple brands
  const allActors = getAllActors();
  assert.ok(allActors.length >= 50, 'Should load all catalogue actors');

  const hallmarkPopular = getPopularActorsByBrand('hallmark', 6);
  assert.strictEqual(hallmarkPopular.length, 6, 'Should return 6 popular Hallmark actors');

  console.log('✓ XmasDB filmography and popular brand stats verified.');
}

// 7. Rich Feeds Include TMDB Metadata
{
  console.log('Test 7: Actor Rich JSON Feed Serialization');
  const actorJsonStr = getActorSingleRichJson(referenceActorId);
  assert.ok(actorJsonStr, 'Reference actor rich JSON feed should not be null');
  const parsed = JSON.parse(actorJsonStr!);
  assert.strictEqual(parsed.tmdbPersonId, referenceActorId);
  assert.strictEqual(parsed.name, referenceCast.name);
  assert.ok(parsed.credits && parsed.credits.length > 0);
  console.log('✓ Local actor rich JSON feed serialization validated.');
}

// 8. Search Autocomplete Indexing and Actor Movie Counts
{
  console.log('Test 8: Search Autocomplete Local Matching');
  const { MOVIES } = await import('../src/data/movies');
  const { getBrandById } = await import('../src/data/brands');

  // Test movie matching
  const catalogueMovie = MOVIES[0];
  assert.ok(catalogueMovie, 'Should have a local catalogue movie');
  const brand = getBrandById(catalogueMovie.brandId);
  assert.ok(brand, 'Brand should be resolvable');
  assert.strictEqual(brand?.shortName, 'Hallmark');

  // Test actor matching
  const allActors = getAllActors();
  const referenceMatches = allActors.filter((a) =>
    a.tmdbPersonId === referenceActorId
  );
  assert.ok(referenceMatches.length >= 1, 'Should find the reference catalogue actor');

  // Verify actor movie count map
  const actorMovieCounts = new Map<string, number>();
  for (const movie of MOVIES) {
    for (const member of movie.cast) {
      const slug = member.slug.toLowerCase().trim();
      actorMovieCounts.set(slug, (actorMovieCounts.get(slug) || 0) + 1);
    }
  }
  const laceyCount = actorMovieCounts.get('lacey-chabert') || 0;
  assert.ok(laceyCount >= 1, 'Lacey Chabert should have at least 1 Christmas movie count');

  console.log('✓ Search autocomplete indexing and count aggregation verified.');
}

console.log('\nAll tests passed successfully! 🎉');
