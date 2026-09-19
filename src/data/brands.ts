import { Brand, Movie } from '../types';

export const BRANDS: Brand[] = [
  {
    id: 'hallmark',
    name: 'Hallmark Christmas Movies',
    shortName: 'Hallmark',
    slug: 'hallmark',
    description: 'The iconic holiday collection from Hallmark.',
    accentColor: '#841818',
  },
  {
    id: 'lifetime',
    name: 'Lifetime Christmas Movies',
    shortName: 'Lifetime',
    slug: 'lifetime',
    description: 'It\'s a Wonderful Lifetime holiday movies celebrating love, family, and warmth.',
    accentColor: '#1A3D2F',
  },
  {
    id: 'gaf',
    name: 'GAF Christmas Movies',
    shortName: 'GAF',
    slug: 'gaf',
    description: 'Great American Family Great American Christmas holiday movie collection.',
    accentColor: '#B8860B',
  },
  {
    id: 'uptv',
    name: 'UPtv Christmas Movies',
    shortName: 'UPtv',
    slug: 'uptv',
    description: 'UPtv Most Uplifting Christmas Ever holiday movie celebration.',
    accentColor: '#59524A',
  },
];

export function getBrandById(id: string): Brand | undefined {
  return BRANDS.find((b) => b.id === id);
}

export function getBrandBySlug(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug.toLowerCase().trim());
}

export function getPopulatedBrands(movies: Pick<Movie, 'brandId'>[] = []): Brand[] {
  const counts = new Map<string, number>();
  for (const movie of movies) {
    const brandId = movie.brandId.toLowerCase();
    counts.set(brandId, (counts.get(brandId) || 0) + 1);
  }
  return BRANDS.filter((brand) => (counts.get(brand.id) || 0) > 0);
}
