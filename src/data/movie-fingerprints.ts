import type { Movie } from '../types';
import { getFingerprintById, isFingerprintId, type FingerprintDefinition, type FingerprintId } from './fingerprints';

/**
 * Phase-one editorial sample and explicitly applied classifier results.
 */
export const PROTOTYPE_MOVIE_FINGERPRINTS: Readonly<Record<string, readonly FingerprintId[]>> = {
  "gaf-2019-my-best-friend-s-christmas": [
    "fake-relationship",
    "friends-to-lovers",
    "old-flame",
    "returns-home"
  ],
  "gaf-2021-a-christmas-miracle-for-daisy": [
    "business-owner",
    "christmas-parade",
    "small-town"
  ],
  "gaf-2021-a-christmas-star": [
    "parent-child",
    "single-parent",
    "widow-widower"
  ],
  "gaf-2021-a-kindhearted-christmas": [
    "business-owner",
    "small-town",
    "widow-widower"
  ],
  "gaf-2021-a-lot-like-christmas": [
    "business-owner",
    "competition",
    "rivals-to-lovers",
    "save-the-business",
    "small-town"
  ],
  "gaf-2021-angel-falls-christmas": [
    "doctor-nurse",
    "workaholic"
  ],
  "gaf-2021-christmas-is-you": [
    "celebrity",
    "entertainment-showbiz",
    "music",
    "old-flame",
    "returns-home"
  ],
  "gaf-2021-christmas-time-is-here": [
    "hotel-resort",
    "parent-child",
    "resort",
    "small-town",
    "widow-widower"
  ],
  "gaf-2021-hot-chocolate-holiday": [
    "baking-cooking",
    "business-owner",
    "restaurant-cafe",
    "rivals-to-lovers"
  ],
  "gaf-2021-jingle-bell-princess": [
    "royalty",
    "seaside"
  ],
  "gaf-2021-joy-for-christmas": [
    "athlete",
    "family-business",
    "family-tradition",
    "save-the-business"
  ],
  "gaf-2021-much-ado-about-christmas": [
    "secret-identity"
  ],
  "gaf-2021-royally-wrapped-for-christmas": [
    "royalty"
  ],
  "gaf-2021-the-great-christmas-switch": [
    "big-city",
    "siblings",
    "single-parent"
  ],
  "gaf-2021-when-hope-calls-christmas": [
    "old-flame",
    "small-town"
  ],
  "gaf-2022-a-brush-with-christmas": [
    "christmas-festival",
    "family-business",
    "restaurant-cafe"
  ],
  "gaf-2022-a-christmas-present": [
    "siblings",
    "widow-widower"
  ],
  "gaf-2022-a-merry-christmas-wish": [
    "big-city",
    "countryside-farm",
    "hometown",
    "returns-home"
  ],
  "gaf-2022-a-royal-christmas-on-ice": [
    "athlete",
    "royalty",
    "small-town"
  ],
  "gaf-2022-aisle-be-home-for-christmas": [
    "old-flame",
    "reunion",
    "second-chance",
    "snowed-in-stranded"
  ],
  "gaf-2022-b-b-merry": [
    "competition",
    "family-business",
    "hotel-resort",
    "inn-bnb",
    "save-the-business",
    "writer-journalist"
  ],
  "gaf-2022-catering-christmas": [
    "baking-cooking"
  ],
  "gaf-2022-christmas-at-the-drive-in": [
    "hometown",
    "returns-home"
  ],
  "gaf-2022-christmas-in-pine-valley": [
    "business-owner",
    "countryside-farm",
    "writer-journalist"
  ],
  "gaf-2022-christmas-lovers-anonymous": [
    "writer-journalist"
  ],
  "gaf-2022-christmas-on-candy-cane-lane": [
    "parent-child",
    "single-parent"
  ],
  "gaf-2022-crown-prince-of-christmas": [
    "fake-relationship",
    "mistaken-identity",
    "secret-identity"
  ],
  "gaf-2022-i-m-glad-it-s-christmas": [
    "career-vs-love",
    "entertainment-showbiz",
    "music"
  ],
  "gaf-2022-love-at-the-christmas-contest": [
    "christmas-competition",
    "competition",
    "old-flame",
    "parent-child",
    "single-parent",
    "widow-widower"
  ],
  "gaf-2022-my-favorite-christmas-tree": [
    "business-owner",
    "christmas-tree-farm",
    "countryside-farm",
    "siblings",
    "small-town"
  ],
  "gaf-2022-the-art-of-christmas": [
    "teacher"
  ],
  "gaf-2023-a-belgian-chocolate-christmas": [
    "baking-cooking",
    "mistaken-identity"
  ],
  "gaf-2023-a-christmas-blessing": [
    "baking-cooking",
    "business-owner",
    "celebrity",
    "entertainment-showbiz"
  ],
  "gaf-2023-a-christmas-for-the-ages": [
    "family-tradition"
  ],
  "gaf-2023-a-dash-of-christmas": [
    "baking-cooking",
    "chef-baker",
    "competition",
    "entertainment-showbiz"
  ],
  "gaf-2023-a-royal-christmas-holiday": [
    "royalty",
    "writer-journalist"
  ],
  "gaf-2023-a-royal-date-for-christmas": [
    "business-owner",
    "royalty"
  ],
  "gaf-2023-bringing-christmas-home": [
    "business-owner",
    "investigation",
    "military",
    "mystery",
    "teacher"
  ],
  "gaf-2023-christmas-in-maple-hills": [
    "countryside-farm",
    "family-business",
    "family-legacy",
    "inheritance",
    "investigation",
    "mystery"
  ],
  "gaf-2023-christmas-keepsake": [
    "parent-child",
    "unexpected-romance"
  ],
  "gaf-2023-christmas-on-windmill-way": [
    "baking-cooking",
    "christmas-competition",
    "christmas-market",
    "competition",
    "family-business",
    "family-legacy",
    "family-tradition",
    "old-flame",
    "save-the-business"
  ],
  "gaf-2023-journey-to-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "snowed-in-stranded"
  ],
  "gaf-2023-meet-me-under-the-mistletoe": [
    "rivals-to-lovers"
  ],
  "gaf-2023-merry-mystery-christmas": [
    "investigation",
    "mystery",
    "writer-journalist"
  ],
  "gaf-2023-my-christmas-hero": [
    "doctor-nurse",
    "military"
  ],
  "gaf-2023-our-christmas-wedding": [
    "christmas-wedding"
  ],
  "gaf-2023-paris-christmas-waltz": [
    "competition",
    "entertainment-showbiz"
  ],
  "gaf-2023-peppermint-and-postcards": [
    "christmas-wish",
    "matchmaking",
    "new-blended-family",
    "parent-child"
  ],
  "gaf-2023-santa-maybe": [
    "entertainment-showbiz"
  ],
  "gaf-2023-the-jinglebell-jubilee": [
    "matchmaking"
  ],
  "gaf-2023-twas-the-text-before-christmas": [
    "big-city",
    "doctor-nurse"
  ],
  "gaf-2024-a-christmas-castle-proposal-a-royal-in-paradise-ii": [
    "royalty"
  ],
  "gaf-2024-a-christmas-less-traveled": [
    "business-owner",
    "family-legacy",
    "parent-child",
    "restaurant-cafe"
  ],
  "gaf-2024-a-cinderella-christmas-ball": [
    "christmas-ball",
    "europe-abroad",
    "royalty"
  ],
  "gaf-2024-a-little-women-s-christmas": [
    "siblings",
    "small-town"
  ],
  "gaf-2024-a-royal-christmas-ballet": [
    "entertainment-showbiz",
    "unexpected-romance"
  ],
  "gaf-2024-a-vintage-christmas": [
    "hometown"
  ],
  "gaf-2024-christmas-by-candlelight": [
    "business-owner",
    "christmas-wish"
  ],
  "gaf-2024-christmas-in-scotland": [
    "christmas-competition",
    "christmas-festival",
    "competition",
    "europe-abroad",
    "small-town"
  ],
  "gaf-2024-christmas-under-the-northern-lights": [
    "faith",
    "hometown",
    "parent-child",
    "returns-home"
  ],
  "gaf-2024-christmas-wreaths-and-ribbons": [
    "business-owner",
    "save-the-business"
  ],
  "gaf-2024-coupled-up-for-christmas": [
    "fake-relationship"
  ],
  "gaf-2024-get-him-back-for-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "music",
    "returns-home",
    "reunion"
  ],
  "gaf-2024-home-sweet-christmas": [
    "childhood-sweethearts",
    "countryside-farm",
    "family-legacy",
    "hometown",
    "inheritance",
    "returns-home",
    "reunion"
  ],
  "gaf-2024-i-heard-the-bells": [
    "faith",
    "writer-journalist"
  ],
  "gaf-2024-let-it-snow": [
    "hotel-resort",
    "resort",
    "save-the-business"
  ],
  "gaf-2024-once-upon-a-christmas-wish": [
    "childhood-sweethearts",
    "christmas-magic",
    "christmas-wish",
    "reunion",
    "small-town",
    "wish-comes-true"
  ],
  "gaf-2024-tails-of-christmas": [
    "military",
    "returns-home"
  ],
  "gaf-2024-the-fabric-of-christmas": [
    "career-vs-love",
    "christmas-wedding",
    "siblings",
    "teacher"
  ],
  "gaf-2025-a-christmas-prayer": [
    "christmas-wish",
    "faith",
    "widow-widower"
  ],
  "gaf-2025-a-royal-christmas-tail": [
    "royalty",
    "unexpected-romance"
  ],
  "gaf-2025-a-wisconsin-christmas-pie": [
    "baking-cooking",
    "chef-baker",
    "family-business",
    "hometown",
    "returns-home",
    "save-the-business",
    "small-town"
  ],
  "gaf-2025-another-sweet-christmas": [
    "entertainment-showbiz",
    "hometown"
  ],
  "gaf-2025-christmas-at-mistletoe-manor": [
    "europe-abroad",
    "castle-manor",
    "unexpected-trip",
    "entertainment-showbiz"
  ],
  "gaf-2025-christmas-at-the-inn": [
    "business-owner",
    "hometown",
    "restaurant-cafe",
    "returns-home",
    "reunion",
    "second-chance"
  ],
  "gaf-2025-christmas-in-midnight-clear": [
    "rivals-to-lovers",
    "small-town"
  ],
  "gaf-2025-christmas-north-of-nashville": [
    "family-business",
    "hometown",
    "returns-home",
    "save-the-business"
  ],
  "gaf-2025-christmas-on-every-page": [
    "big-city",
    "bookshop",
    "family-business",
    "hometown",
    "returns-home",
    "save-the-business"
  ],
  "gaf-2025-creating-christmas": [
    "celebrity",
    "small-town",
    "teacher",
    "writer-journalist"
  ],
  "gaf-2025-have-we-met-this-christmas": [
    "amnesia",
    "family-business",
    "inn-bnb",
    "mountains",
    "save-the-business",
    "second-chance"
  ],
  "gaf-2025-karen-kingsbury-s-the-christmas-ring": [
    "friends-to-lovers",
    "hometown",
    "military",
    "widow-widower"
  ],
  "gaf-2025-mario-lopez-presents-chasing-christmas": [
    "christmas-wish",
    "entertainment-showbiz",
    "parent-child",
    "unexpected-romance"
  ],
  "gaf-2025-once-upon-a-christmas-crown": [
    "baking-cooking",
    "christmas-competition",
    "competition",
    "royalty",
    "secret-identity",
    "small-town"
  ],
  "gaf-2025-the-christmas-spark": [
    "competition",
    "small-town",
    "unexpected-romance",
    "widow-widower"
  ],
  "gaf-2025-there-s-no-place-like-christmas": [
    "hometown",
    "returns-home",
    "small-town",
    "workplace-romance"
  ],
  "gaf-2025-timeless-tidings-of-joy": [
    "family-business",
    "family-legacy",
    "inheritance"
  ],
  "gaf-2026-a-christmas-prayer-tradition": [
    "faith"
  ],
  "gaf-2026-a-christmas-rescue": [
    "doctor-nurse",
    "small-town"
  ],
  "gaf-2026-a-second-chance-christmas": [
    "family-reunion",
    "mountains",
    "old-flame",
    "parent-child",
    "reunion",
    "second-chance",
    "snowed-in-stranded"
  ],
  "gaf-2026-a-sweet-christmas-anniversary": [
    "europe-abroad",
    "hotel-resort",
    "mystery"
  ],
  "gaf-2026-a-very-evergreen-christmas": [
    "countryside-farm",
    "christmas-tree-farm",
    "inheritance"
  ],
  "gaf-2026-an-accidental-arctic-christmas": [
    "athlete",
    "entertainment-showbiz",
    "family-tradition",
    "parent-child",
    "single-parent"
  ],
  "gaf-2026-an-ozark-mountain-christmas": [
    "faith",
    "family-legacy",
    "hometown",
    "returns-home",
    "siblings"
  ],
  "gaf-2026-christmas-at-the-starlight": [
    "business-owner",
    "entertainment-showbiz",
    "family-business",
    "family-legacy",
    "family-tradition",
    "music",
    "restaurant-cafe",
    "save-the-business",
    "small-town"
  ],
  "gaf-2026-christmas-by-the-spoonful": [
    "baking-cooking",
    "business-owner",
    "family-tradition",
    "writer-journalist"
  ],
  "gaf-2026-christmas-wrapped-in-love": [
    "business-owner",
    "doctor-nurse",
    "fake-relationship",
    "workaholic"
  ],
  "gaf-2026-letters-this-christmas": [
    "career-vs-love",
    "mystery",
    "old-flame",
    "writer-journalist"
  ],
  "gaf-2026-making-christmas-bright": [
    "faith",
    "small-town",
    "teacher"
  ],
  "gaf-2026-silver-bells-at-christmas": [
    "business-owner",
    "family-business",
    "old-flame",
    "save-the-business"
  ],
  "gaf-2026-the-christmas-yes-list": [
    "hometown",
    "returns-home"
  ],
  "gaf-2026-the-greatest-christmas-gift": [
    "christmas-wedding",
    "faith"
  ],
  "gaf-2026-the-ornament-library": [
    "writer-journalist"
  ],
  "hallmark-2008-the-most-wonderful-time-of-the-year": [
    "parent-child",
    "single-parent"
  ],
  "hallmark-2012-a-bride-for-christmas": [
    "runaway-bride-broken-engagement"
  ],
  "hallmark-2013-window-wonderland": [
    "competition",
    "rivals-to-lovers"
  ],
  "hallmark-2014-christmas-under-wraps": [
    "career-vs-love",
    "doctor-nurse",
    "small-town",
    "unexpected-romance"
  ],
  "hallmark-2015-a-christmas-detour": [
    "unexpected-romance",
    "unexpected-trip"
  ],
  "hallmark-2015-a-christmas-melody": [
    "business-owner",
    "hometown",
    "parent-child",
    "returns-home",
    "single-parent",
    "teacher"
  ],
  "hallmark-2015-angel-of-christmas": [
    "christmas-magic",
    "family-legacy",
    "family-tradition",
    "writer-journalist"
  ],
  "hallmark-2015-charming-christmas": [
    "workaholic",
    "workplace-romance"
  ],
  "hallmark-2015-christmas-incorporated": [
    "big-city",
    "save-the-business"
  ],
  "hallmark-2015-christmas-land": [
    "christmas-tree-farm",
    "countryside-farm",
    "inheritance"
  ],
  "hallmark-2015-crown-for-christmas": [
    "royalty",
    "unexpected-romance"
  ],
  "hallmark-2015-i-m-not-ready-for-christmas": [
    "christmas-magic",
    "christmas-wish",
    "santa"
  ],
  "hallmark-2015-ice-sculpture-christmas": [
    "baking-cooking",
    "childhood-sweethearts",
    "christmas-competition",
    "competition",
    "restaurant-cafe"
  ],
  "hallmark-2015-just-in-time-for-christmas": [
    "alternate-life",
    "career-vs-love",
    "hometown",
    "small-town",
    "time-travel"
  ],
  "hallmark-2015-merry-matrimony": [
    "career-vs-love",
    "christmas-wedding",
    "old-flame",
    "workplace-romance"
  ],
  "hallmark-2015-northpole-open-for-christmas": [
    "christmas-magic",
    "hotel-resort",
    "inheritance",
    "inn-bnb"
  ],
  "hallmark-2015-on-the-twelfth-day-of-christmas": [
    "career-vs-love",
    "writer-journalist"
  ],
  "hallmark-2015-once-upon-a-holiday": [
    "royalty",
    "secret-identity",
    "unexpected-romance"
  ],
  "hallmark-2015-tis-the-season-for-love": [
    "entertainment-showbiz",
    "hometown",
    "returns-home",
    "small-town"
  ],
  "hallmark-2016-a-december-bride": [
    "christmas-wedding",
    "fake-relationship",
    "love-triangle",
    "old-flame"
  ],
  "hallmark-2016-a-dream-of-christmas": [
    "alternate-life",
    "angel",
    "christmas-magic",
    "christmas-wish",
    "wish-comes-true"
  ],
  "hallmark-2016-a-nutcracker-christmas": [
    "entertainment-showbiz"
  ],
  "hallmark-2016-a-wish-for-christmas": [
    "christmas-magic",
    "christmas-wish",
    "santa",
    "wish-comes-true"
  ],
  "hallmark-2016-broadcasting-christmas": [
    "christmas-competition",
    "competition",
    "entertainment-showbiz",
    "writer-journalist"
  ],
  "hallmark-2016-christmas-cookies": [
    "business-owner",
    "career-vs-love",
    "save-the-business",
    "small-town"
  ],
  "hallmark-2016-christmas-in-homestead": [
    "celebrity",
    "entertainment-showbiz",
    "inn-bnb",
    "single-parent",
    "small-town"
  ],
  "hallmark-2016-christmas-list": [
    "unexpected-romance"
  ],
  "hallmark-2016-every-christmas-has-a-story": [
    "celebrity",
    "entertainment-showbiz",
    "old-flame"
  ],
  "hallmark-2016-journey-back-to-christmas": [
    "time-travel"
  ],
  "hallmark-2016-looks-like-christmas": [
    "competition",
    "rivals-to-lovers",
    "single-parent"
  ],
  "hallmark-2016-love-you-like-christmas": [
    "small-town",
    "unexpected-romance",
    "unexpected-trip"
  ],
  "hallmark-2016-my-christmas-dream": [
    "workplace-romance"
  ],
  "hallmark-2016-my-christmas-love": [
    "mystery"
  ],
  "hallmark-2016-sleigh-bells-ring": [
    "christmas-parade",
    "hometown"
  ],
  "hallmark-2016-the-mistletoe-promise": [
    "fake-relationship"
  ],
  "hallmark-2017-a-gift-to-remember": [
    "amnesia",
    "unexpected-romance"
  ],
  "hallmark-2017-christmas-at-holly-lodge": [
    "family-tradition",
    "hotel-resort",
    "inheritance",
    "inn-bnb",
    "resort"
  ],
  "hallmark-2017-christmas-connection": [
    "big-city",
    "hometown",
    "investigation",
    "mystery",
    "parent-child",
    "returns-home",
    "single-parent",
    "unexpected-romance",
    "unexpected-trip",
    "widow-widower",
    "writer-journalist"
  ],
  "hallmark-2017-christmas-festival-of-ice": [
    "christmas-competition",
    "christmas-festival",
    "competition",
    "family-tradition",
    "parent-child",
    "small-town"
  ],
  "hallmark-2017-christmas-getaway": [
    "hotel-resort",
    "mountains",
    "parent-child",
    "resort",
    "single-parent",
    "unexpected-romance",
    "widow-widower",
    "writer-journalist"
  ],
  "hallmark-2017-christmas-in-evergreen": [
    "christmas-magic",
    "christmas-wish",
    "parent-child",
    "unexpected-romance",
    "wish-comes-true"
  ],
  "hallmark-2017-christmas-next-door": [
    "writer-journalist"
  ],
  "hallmark-2017-coming-home-for-christmas": [
    "countryside-farm",
    "love-triangle"
  ],
  "hallmark-2017-enchanted-christmas": [
    "business-owner",
    "hometown",
    "hotel-resort",
    "old-flame",
    "parent-child",
    "returns-home",
    "reunion",
    "second-chance"
  ],
  "hallmark-2017-finding-santa": [
    "christmas-parade",
    "family-legacy",
    "family-tradition",
    "small-town"
  ],
  "hallmark-2017-marry-me-at-christmas": [
    "business-owner",
    "celebrity",
    "christmas-wedding",
    "entertainment-showbiz",
    "small-town",
    "unexpected-romance"
  ],
  "hallmark-2017-miss-christmas": [
    "tree-lighting"
  ],
  "hallmark-2017-royal-new-year-s-eve": [
    "royalty"
  ],
  "hallmark-2017-sharing-christmas": [
    "business-owner"
  ],
  "hallmark-2017-switched-for-christmas": [
    "mistaken-identity",
    "siblings"
  ],
  "hallmark-2017-the-christmas-cottage": [
    "christmas-wedding",
    "old-flame",
    "second-chance"
  ],
  "hallmark-2017-the-christmas-train": [
    "unexpected-trip",
    "writer-journalist"
  ],
  "hallmark-2017-the-mistletoe-inn": [
    "inn-bnb",
    "unexpected-romance",
    "writer-journalist"
  ],
  "hallmark-2017-the-sweetest-christmas": [
    "baking-cooking",
    "chef-baker",
    "christmas-competition",
    "competition",
    "old-flame",
    "restaurant-cafe",
    "reunion"
  ],
  "hallmark-2018-a-gingerbread-romance": [
    "baking-cooking",
    "chef-baker",
    "christmas-competition",
    "competition"
  ],
  "hallmark-2018-a-godwink-christmas": [
    "inn-bnb",
    "seaside"
  ],
  "hallmark-2018-a-majestic-christmas": [
    "business-owner",
    "christmas-festival",
    "hometown",
    "returns-home",
    "small-town"
  ],
  "hallmark-2018-a-midnight-kiss": [
    "siblings",
    "unexpected-romance"
  ],
  "hallmark-2018-a-shoe-addict-s-christmas": [
    "angel",
    "christmas-magic",
    "time-travel"
  ],
  "hallmark-2018-christmas-at-graceland": [
    "career-vs-love",
    "entertainment-showbiz",
    "music",
    "old-flame",
    "reunion"
  ],
  "hallmark-2018-christmas-at-grand-valley": [
    "hometown",
    "hotel-resort",
    "returns-home"
  ],
  "hallmark-2018-christmas-at-pemberley-manor": [
    "castle-manor",
    "christmas-festival",
    "small-town",
    "unexpected-romance"
  ],
  "hallmark-2018-christmas-at-the-palace": [
    "athlete",
    "castle-manor",
    "royal-estate",
    "royalty"
  ],
  "hallmark-2018-christmas-everlasting": [
    "childhood-sweethearts",
    "hometown",
    "inheritance",
    "old-flame",
    "returns-home",
    "siblings",
    "workaholic"
  ],
  "hallmark-2018-christmas-in-evergreen-letters-to-santa": [
    "hometown",
    "returns-home",
    "save-the-business"
  ],
  "hallmark-2018-christmas-in-love": [
    "bakery",
    "baking-cooking",
    "chef-baker",
    "small-town"
  ],
  "hallmark-2018-christmas-joy": [
    "baking-cooking",
    "christmas-competition",
    "competition",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "hallmark-2018-christmas-made-to-order": [
    "career-vs-love"
  ],
  "hallmark-2018-entertaining-christmas": [
    "parent-child",
    "writer-journalist"
  ],
  "hallmark-2018-homegrown-christmas": [
    "hometown",
    "old-flame",
    "returns-home",
    "second-chance"
  ],
  "hallmark-2018-hope-at-christmas": [
    "bookshop",
    "christmas-wish",
    "inheritance",
    "parent-child",
    "santa",
    "single-parent",
    "teacher"
  ],
  "hallmark-2018-it-s-christmas-eve": [
    "music"
  ],
  "hallmark-2018-jingle-around-the-clock": [
    "christmas-magic",
    "reunion",
    "workplace-romance"
  ],
  "hallmark-2018-mingle-all-the-way": [
    "matchmaking"
  ],
  "hallmark-2018-pride-prejudice-and-mistletoe": [
    "business-owner",
    "family-reconciliation",
    "hometown",
    "parent-child",
    "restaurant-cafe",
    "returns-home",
    "rivals-to-lovers"
  ],
  "hallmark-2018-reunited-at-christmas": [
    "hometown",
    "returns-home",
    "writer-journalist"
  ],
  "hallmark-2018-road-to-christmas": [
    "entertainment-showbiz",
    "family-reconciliation",
    "family-reunion",
    "matchmaking",
    "parent-child",
    "reunion",
    "siblings"
  ],
  "hallmark-2018-welcome-to-christmas": [
    "mountains",
    "resort",
    "small-town"
  ],
  "hallmark-2019-a-cheerful-christmas": [
    "love-triangle"
  ],
  "hallmark-2019-a-christmas-duet": [
    "entertainment-showbiz",
    "inn-bnb",
    "music",
    "old-flame",
    "reunion",
    "second-chance"
  ],
  "hallmark-2019-a-christmas-love-story": [
    "music",
    "single-parent",
    "widow-widower"
  ],
  "hallmark-2019-check-inn-to-christmas": [
    "family-business",
    "inn-bnb",
    "save-the-business"
  ],
  "hallmark-2019-christmas-at-dollywood": [
    "matchmaking",
    "mountains",
    "workplace-romance"
  ],
  "hallmark-2019-christmas-at-graceland-home-for-the-holidays": [
    "returns-home",
    "widow-widower"
  ],
  "hallmark-2019-christmas-at-the-plaza": [
    "big-city",
    "hotel-resort"
  ],
  "hallmark-2019-christmas-in-evergreen-tidings-of-joy": [
    "writer-journalist"
  ],
  "hallmark-2019-christmas-in-rome": [
    "big-city",
    "europe-abroad"
  ],
  "hallmark-2019-christmas-scavenger-hunt": [
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "hallmark-2019-christmas-town": [
    "small-town",
    "unexpected-trip"
  ],
  "hallmark-2019-christmas-under-the-stars": [
    "teacher"
  ],
  "hallmark-2019-christmas-wishes-mistletoe-kisses": [
    "single-parent"
  ],
  "hallmark-2019-holiday-date": [
    "fake-relationship"
  ],
  "hallmark-2019-it-s-beginning-to-look-a-lot-like-christmas": [
    "christmas-competition",
    "competition"
  ],
  "hallmark-2019-merry-bright": [
    "business-owner",
    "matchmaking",
    "mistaken-identity",
    "workplace-romance"
  ],
  "hallmark-2019-picture-a-perfect-christmas": [
    "hometown",
    "returns-home"
  ],
  "hallmark-2019-sense-sensibility-snowmen": [
    "business-owner",
    "siblings"
  ],
  "hallmark-2019-the-christmas-club": [
    "christmas-magic",
    "unexpected-romance"
  ],
  "hallmark-2019-the-mistletoe-secret": [
    "hometown",
    "love-triangle",
    "writer-journalist"
  ],
  "hallmark-2019-write-before-christmas": [
    "siblings"
  ],
  "hallmark-2020-a-christmas-carousel": [
    "royalty"
  ],
  "hallmark-2020-a-nashville-christmas-carol": [
    "entertainment-showbiz",
    "ghost-spirit",
    "workaholic"
  ],
  "hallmark-2020-a-timeless-christmas": [
    "castle-manor",
    "time-travel"
  ],
  "hallmark-2020-chateau-christmas": [
    "celebrity",
    "music",
    "old-flame",
    "returns-home",
    "reunion"
  ],
  "hallmark-2020-christmas-by-starlight": [
    "family-business",
    "restaurant-cafe",
    "save-the-business"
  ],
  "hallmark-2020-christmas-comes-twice": [
    "hometown",
    "second-chance",
    "time-travel"
  ],
  "hallmark-2020-christmas-in-vienna": [
    "entertainment-showbiz",
    "europe-abroad",
    "music"
  ],
  "hallmark-2020-christmas-she-wrote": [
    "hometown",
    "returns-home",
    "writer-journalist"
  ],
  "hallmark-2020-christmas-waltz": [
    "christmas-wedding"
  ],
  "hallmark-2020-cross-country-christmas": [
    "returns-home",
    "snowed-in-stranded"
  ],
  "hallmark-2020-five-star-christmas": [
    "family-business",
    "hometown",
    "inn-bnb",
    "returns-home",
    "save-the-business",
    "secret-identity",
    "siblings",
    "unexpected-romance"
  ],
  "hallmark-2020-good-morning-christmas": [
    "entertainment-showbiz",
    "rivals-to-lovers",
    "small-town"
  ],
  "hallmark-2020-heart-of-the-holidays": [
    "hometown",
    "old-flame",
    "returns-home",
    "small-town"
  ],
  "hallmark-2020-if-i-only-had-christmas": [
    "business-owner"
  ],
  "hallmark-2020-jingle-bell-bride": [
    "celebrity",
    "small-town"
  ],
  "hallmark-2020-love-lights-hanukkah": [
    "restaurant-cafe",
    "unexpected-romance"
  ],
  "hallmark-2020-never-kiss-a-man-in-a-christmas-sweater": [
    "single-parent",
    "unexpected-romance"
  ],
  "hallmark-2020-one-royal-holiday": [
    "hometown",
    "parent-child",
    "royalty",
    "snowed-in-stranded"
  ],
  "hallmark-2020-the-christmas-house": [
    "celebrity",
    "entertainment-showbiz",
    "family-reconciliation",
    "family-reunion",
    "family-tradition",
    "parent-child",
    "returns-home",
    "reunion",
    "siblings"
  ],
  "hallmark-2021-a-christmas-together-with-you": [
    "old-flame"
  ],
  "hallmark-2021-a-christmas-treasure": [
    "chef-baker",
    "hometown",
    "small-town",
    "writer-journalist"
  ],
  "hallmark-2021-a-dickens-of-a-holiday": [
    "celebrity",
    "christmas-festival",
    "entertainment-showbiz",
    "hometown"
  ],
  "hallmark-2021-a-holiday-in-harlem": [
    "hometown"
  ],
  "hallmark-2021-a-kiss-before-christmas": [
    "alternate-life"
  ],
  "hallmark-2021-a-royal-queens-christmas": [
    "royalty"
  ],
  "hallmark-2021-a-very-merry-bridesmaid": [
    "childhood-sweethearts",
    "christmas-wedding",
    "siblings"
  ],
  "hallmark-2021-an-unexpected-christmas": [
    "fake-relationship",
    "hometown",
    "old-flame"
  ],
  "hallmark-2021-boyfriends-of-christmas-past": [
    "ghost-spirit",
    "old-flame"
  ],
  "hallmark-2021-christmas-at-castle-hart": [
    "castle-manor",
    "europe-abroad",
    "mistaken-identity",
    "royalty"
  ],
  "hallmark-2021-christmas-ceo": [
    "business-owner",
    "old-flame",
    "second-chance"
  ],
  "hallmark-2021-christmas-in-harmony": [
    "entertainment-showbiz",
    "music",
    "old-flame"
  ],
  "hallmark-2021-christmas-in-tahoe": [
    "entertainment-showbiz",
    "family-business",
    "hotel-resort",
    "music",
    "old-flame",
    "save-the-business"
  ],
  "hallmark-2021-christmas-sail": [
    "family-reconciliation",
    "parent-child",
    "returns-home"
  ],
  "hallmark-2021-coyote-creek-christmas": [
    "christmas-magic",
    "inn-bnb"
  ],
  "hallmark-2021-eight-gifts-of-hanukkah": [
    "unexpected-romance"
  ],
  "hallmark-2021-gingerbread-miracle": [
    "bakery",
    "baking-cooking",
    "christmas-wish"
  ],
  "hallmark-2021-making-spirits-bright": [
    "christmas-competition",
    "competition",
    "save-the-business"
  ],
  "hallmark-2021-my-christmas-family-tree": [
    "unexpected-trip"
  ],
  "hallmark-2021-nantucket-noel": [
    "business-owner",
    "save-the-business",
    "seaside",
    "toy-shop"
  ],
  "hallmark-2021-next-stop-christmas": [
    "alternate-life",
    "old-flame",
    "returns-home",
    "time-travel"
  ],
  "hallmark-2021-sister-swap-a-hometown-holiday": [
    "bakery",
    "business-owner",
    "chef-baker",
    "family-business",
    "hometown",
    "parent-child",
    "restaurant-cafe",
    "siblings",
    "single-parent",
    "widow-widower"
  ],
  "hallmark-2021-sister-swap-christmas-in-the-city": [
    "bakery",
    "business-owner",
    "chef-baker",
    "family-business",
    "parent-child",
    "restaurant-cafe",
    "siblings",
    "single-parent",
    "widow-widower"
  ],
  "hallmark-2021-the-christmas-contest": [
    "christmas-competition",
    "competition",
    "old-flame"
  ],
  "hallmark-2021-the-christmas-house-2-deck-those-halls": [
    "christmas-competition",
    "competition",
    "siblings"
  ],
  "hallmark-2021-the-nine-kittens-of-christmas": [
    "reunion"
  ],
  "hallmark-2021-the-santa-stakeout": [
    "investigation",
    "mystery"
  ],
  "hallmark-2021-tis-the-season-to-be-merry": [
    "writer-journalist"
  ],
  "hallmark-2021-you-me-and-the-christmas-trees": [
    "christmas-tree-farm",
    "countryside-farm",
    "family-business",
    "tree-lighting"
  ],
  "hallmark-2022-a-big-fat-family-christmas": [
    "career-vs-love",
    "family-secret",
    "family-tradition",
    "secret-identity",
    "workplace-romance",
    "writer-journalist"
  ],
  "hallmark-2022-a-christmas-cookie-catastrophe": [
    "bakery",
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "family-business",
    "family-legacy",
    "inheritance",
    "investigation",
    "mystery",
    "save-the-business",
    "small-town"
  ],
  "hallmark-2022-a-cozy-christmas-inn": [
    "inn-bnb",
    "old-flame"
  ],
  "hallmark-2022-a-fabled-holiday": [
    "childhood-sweethearts",
    "reunion"
  ],
  "hallmark-2022-a-holiday-spectacular": [
    "big-city",
    "christmas-wish",
    "entertainment-showbiz"
  ],
  "hallmark-2022-a-kismet-christmas": [
    "hometown",
    "returns-home",
    "writer-journalist"
  ],
  "hallmark-2022-a-magical-christmas-village": [
    "christmas-magic",
    "christmas-wish",
    "parent-child",
    "wish-comes-true"
  ],
  "hallmark-2022-a-royal-corgi-christmas": [
    "royalty",
    "unexpected-romance"
  ],
  "hallmark-2022-a-tale-of-two-christmases": [
    "alternate-life",
    "big-city",
    "christmas-magic",
    "family-tradition",
    "hometown",
    "returns-home"
  ],
  "hallmark-2022-all-saints-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "music",
    "old-flame",
    "returns-home"
  ],
  "hallmark-2022-christmas-at-the-golden-dragon": [
    "family-business",
    "family-legacy",
    "parent-child",
    "restaurant-cafe",
    "siblings"
  ],
  "hallmark-2022-christmas-class-reunion": [
    "reunion"
  ],
  "hallmark-2022-ghosts-of-christmas-always": [
    "ghost-spirit"
  ],
  "hallmark-2022-hanukkah-on-rye": [
    "business-owner",
    "competition",
    "matchmaking",
    "rivals-to-lovers"
  ],
  "hallmark-2022-haul-out-the-holly": [
    "returns-home"
  ],
  "hallmark-2022-holiday-heritage": [
    "family-reconciliation",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "hallmark-2022-in-merry-measure": [
    "celebrity",
    "entertainment-showbiz",
    "hometown",
    "music",
    "returns-home",
    "siblings"
  ],
  "hallmark-2022-inventing-the-christmas-prince": [
    "parent-child"
  ],
  "hallmark-2022-jolly-good-christmas": [
    "big-city",
    "europe-abroad"
  ],
  "hallmark-2022-lights-camera-christmas": [
    "business-owner",
    "celebrity",
    "entertainment-showbiz"
  ],
  "hallmark-2022-my-southern-family-christmas": [
    "family-secret",
    "parent-child",
    "secret-identity",
    "writer-journalist"
  ],
  "hallmark-2022-noel-next-door": [
    "rivals-to-lovers",
    "single-parent"
  ],
  "hallmark-2022-the-holiday-sitter": [
    "siblings",
    "unexpected-romance",
    "workaholic"
  ],
  "hallmark-2022-the-most-colorful-time-of-the-year": [
    "teacher"
  ],
  "hallmark-2022-the-royal-nanny": [
    "royalty",
    "secret-identity"
  ],
  "hallmark-2022-three-wise-men-and-a-baby": [
    "family-reconciliation",
    "siblings"
  ],
  "hallmark-2022-twas-the-night-before-christmas": [
    "entertainment-showbiz"
  ],
  "hallmark-2022-undercover-holiday": [
    "celebrity",
    "entertainment-showbiz",
    "fake-relationship",
    "music",
    "returns-home",
    "secret-identity"
  ],
  "hallmark-2022-we-wish-you-a-married-christmas": [
    "inn-bnb"
  ],
  "hallmark-2022-when-i-think-of-christmas": [
    "hometown",
    "music",
    "old-flame",
    "returns-home",
    "reunion",
    "second-chance"
  ],
  "hallmark-2022-xmas": [
    "competition",
    "secret-identity"
  ],
  "hallmark-2023-a-biltmore-christmas": [
    "castle-manor",
    "entertainment-showbiz",
    "time-travel",
    "writer-journalist"
  ],
  "hallmark-2023-a-heidelberg-holiday": [
    "christmas-market",
    "europe-abroad"
  ],
  "hallmark-2023-a-merry-scottish-christmas": [
    "europe-abroad",
    "family-reunion",
    "family-secret",
    "parent-child",
    "reunion",
    "siblings"
  ],
  "hallmark-2023-a-not-so-royal-christmas": [
    "mistaken-identity",
    "royalty",
    "writer-journalist"
  ],
  "hallmark-2023-catch-me-if-you-claus": [
    "entertainment-showbiz",
    "writer-journalist"
  ],
  "hallmark-2023-checkin-it-twice": [
    "athlete",
    "hometown",
    "sports"
  ],
  "hallmark-2023-christmas-by-design": [
    "christmas-competition",
    "competition"
  ],
  "hallmark-2023-christmas-in-notting-hill": [
    "athlete",
    "celebrity",
    "football",
    "returns-home",
    "unexpected-romance"
  ],
  "hallmark-2023-christmas-island": [
    "snowed-in-stranded",
    "unexpected-trip"
  ],
  "hallmark-2023-christmas-with-a-kiss": [
    "christmas-festival",
    "hometown",
    "returns-home",
    "unexpected-romance",
    "writer-journalist"
  ],
  "hallmark-2023-everything-christmas": [
    "family-tradition"
  ],
  "hallmark-2023-flipping-for-christmas": [
    "inheritance",
    "siblings"
  ],
  "hallmark-2023-friends-family-christmas": [
    "big-city",
    "fake-relationship",
    "matchmaking"
  ],
  "hallmark-2023-holiday-hotline": [
    "single-parent",
    "unexpected-romance"
  ],
  "hallmark-2023-holiday-road": [
    "snowed-in-stranded",
    "unexpected-trip",
    "writer-journalist"
  ],
  "hallmark-2023-joyeux-noel": [
    "europe-abroad",
    "mystery",
    "writer-journalist"
  ],
  "hallmark-2023-letters-to-santa": [
    "christmas-magic",
    "christmas-wish",
    "family-reconciliation",
    "parent-child",
    "santa",
    "siblings"
  ],
  "hallmark-2023-magic-in-mistletoe": [
    "christmas-festival",
    "hometown",
    "returns-home",
    "writer-journalist"
  ],
  "hallmark-2023-my-norwegian-holiday": [
    "europe-abroad"
  ],
  "hallmark-2023-mystic-christmas": [
    "reunion"
  ],
  "hallmark-2023-navigating-christmas": [
    "parent-child",
    "seaside",
    "single-parent"
  ],
  "hallmark-2023-never-been-chris-d": [
    "hometown",
    "love-triangle",
    "old-flame",
    "returns-home",
    "reunion"
  ],
  "hallmark-2023-our-christmas-mural": [
    "competition",
    "single-parent",
    "teacher"
  ],
  "hallmark-2023-round-and-round": [
    "matchmaking",
    "time-travel"
  ],
  "hallmark-2023-the-santa-summit": [
    "christmas-festival"
  ],
  "hallmark-2023-the-secret-gift-of-christmas": [
    "parent-child",
    "single-parent",
    "widow-widower"
  ],
  "hallmark-2023-to-all-a-good-night": [
    "rescue",
    "small-town"
  ],
  "hallmark-2023-where-are-you-christmas": [
    "christmas-magic",
    "christmas-wish"
  ],
  "hallmark-2024-a-90s-christmas": [
    "christmas-magic",
    "second-chance",
    "siblings",
    "time-travel",
    "workaholic"
  ],
  "hallmark-2024-a-carol-for-two": [
    "career-vs-love",
    "entertainment-showbiz",
    "love-triangle",
    "music",
    "restaurant-cafe"
  ],
  "hallmark-2024-christmas-on-call": [
    "big-city"
  ],
  "hallmark-2024-christmas-with-the-singhs": [
    "family-tradition"
  ],
  "hallmark-2024-confessions-of-a-christmas-letter": [
    "christmas-competition",
    "competition",
    "fake-relationship",
    "writer-journalist"
  ],
  "hallmark-2024-debbie-macomber-s-joyful-mrs-miracle": [
    "christmas-magic",
    "family-reconciliation",
    "family-reunion",
    "old-flame",
    "returns-home",
    "reunion",
    "second-chance",
    "siblings"
  ],
  "hallmark-2024-deck-the-walls": [
    "hometown",
    "returns-home",
    "rivals-to-lovers",
    "siblings",
    "unexpected-romance"
  ],
  "hallmark-2024-following-yonder-star": [
    "celebrity",
    "entertainment-showbiz",
    "hotel-resort",
    "inn-bnb",
    "resort",
    "teacher"
  ],
  "hallmark-2024-holiday-crashers": [
    "mistaken-identity",
    "mountains",
    "unexpected-trip"
  ],
  "hallmark-2024-holiday-touchdown-a-chiefs-love-story": [
    "competition",
    "football",
    "sports"
  ],
  "hallmark-2024-jingle-bell-run": [
    "athlete",
    "christmas-competition",
    "competition",
    "sports"
  ],
  "hallmark-2024-operation-nutcracker": [
    "investigation",
    "mystery"
  ],
  "hallmark-2024-our-holiday-story": [
    "rivals-to-lovers"
  ],
  "hallmark-2024-private-princess-christmas": [
    "royalty"
  ],
  "hallmark-2024-santa-tell-me": [
    "santa",
    "unexpected-romance"
  ],
  "hallmark-2024-scouting-for-christmas": [
    "bakery",
    "business-owner",
    "chef-baker",
    "matchmaking",
    "parent-child",
    "single-parent"
  ],
  "hallmark-2024-sugarplummed": [
    "christmas-magic",
    "christmas-wish",
    "wish-comes-true"
  ],
  "hallmark-2024-the-5-year-christmas-party": [
    "big-city",
    "reunion",
    "rivals-to-lovers",
    "workplace-romance"
  ],
  "hallmark-2024-the-christmas-charade": [
    "christmas-ball",
    "fake-relationship",
    "investigation",
    "mistaken-identity",
    "mystery"
  ],
  "hallmark-2024-the-christmas-quest": [
    "competition",
    "europe-abroad",
    "old-flame"
  ],
  "hallmark-2024-the-finnish-line": [
    "athlete",
    "competition",
    "europe-abroad",
    "family-legacy",
    "parent-child",
    "sports"
  ],
  "hallmark-2024-three-wiser-men-and-a-boy": [
    "parent-child",
    "siblings"
  ],
  "hallmark-2024-tis-the-season-to-be-irish": [
    "europe-abroad"
  ],
  "hallmark-2024-to-have-and-to-holiday": [
    "parent-child"
  ],
  "hallmark-2024-trivia-at-st-nick-s": [
    "christmas-competition",
    "competition",
    "football"
  ],
  "hallmark-2024-twas-the-date-before-christmas": [
    "christmas-competition",
    "fake-relationship",
    "family-tradition"
  ],
  "hallmark-2025-a-christmas-angel-match": [
    "angel",
    "christmas-magic",
    "matchmaking"
  ],
  "hallmark-2025-a-grand-ole-opry-christmas": [
    "entertainment-showbiz",
    "family-legacy",
    "music"
  ],
  "hallmark-2025-a-keller-christmas-vacation": [
    "christmas-market",
    "europe-abroad",
    "siblings"
  ],
  "hallmark-2025-a-make-or-break-holiday": [
    "fake-relationship"
  ],
  "hallmark-2025-a-newport-christmas": [
    "alternate-life",
    "christmas-ball",
    "christmas-wish",
    "time-travel",
    "wish-comes-true"
  ],
  "hallmark-2025-a-royal-montana-christmas": [
    "countryside-farm",
    "royalty"
  ],
  "hallmark-2025-a-suite-holiday-romance": [
    "big-city",
    "hotel-resort",
    "mistaken-identity",
    "unexpected-romance",
    "writer-journalist"
  ],
  "hallmark-2025-an-alpine-holiday": [
    "europe-abroad",
    "family-reconciliation",
    "mountains",
    "reunion",
    "siblings"
  ],
  "hallmark-2025-christmas-above-the-clouds": [
    "ghost-spirit",
    "old-flame",
    "reunion",
    "second-chance",
    "workaholic"
  ],
  "hallmark-2025-christmas-at-the-catnip-cafe": [
    "business-owner",
    "doctor-nurse",
    "inheritance",
    "restaurant-cafe"
  ],
  "hallmark-2025-christmas-on-duty": [
    "military",
    "reunion",
    "rivals-to-lovers",
    "snowed-in-stranded"
  ],
  "hallmark-2025-holiday-touchdown-a-bills-love-story": [
    "family-tradition",
    "football",
    "sports"
  ],
  "hallmark-2025-melt-my-heart-this-christmas": [
    "competition",
    "secret-identity"
  ],
  "hallmark-2025-merry-christmas-ted-cooper": [
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "hallmark-2025-she-s-making-a-list": [
    "career-vs-love",
    "single-parent",
    "unexpected-romance",
    "widow-widower"
  ],
  "hallmark-2025-sing-it-for-christmas": [
    "faith",
    "music"
  ],
  "hallmark-2025-the-christmas-baby": [
    "parent-child"
  ],
  "hallmark-2025-the-christmas-cup": [
    "christmas-competition",
    "competition",
    "hometown",
    "military",
    "returns-home"
  ],
  "hallmark-2025-the-more-the-merrier": [
    "doctor-nurse",
    "snowed-in-stranded"
  ],
  "hallmark-2025-the-snow-must-go-on": [
    "celebrity",
    "entertainment-showbiz",
    "hometown",
    "returns-home"
  ],
  "hallmark-2025-three-wisest-men": [
    "parent-child",
    "siblings"
  ],
  "hallmark-2025-tidings-for-the-season": [
    "entertainment-showbiz",
    "single-parent"
  ],
  "hallmark-2025-we-met-in-december": [
    "unexpected-romance"
  ],
  "hallmark-2026-a-danish-christmas": [
    "europe-abroad",
    "family-business",
    "inn-bnb",
    "mistaken-identity"
  ],
  "hallmark-2026-a-grand-biltmore-christmas": [
    "castle-manor",
    "reunion",
    "time-travel"
  ],
  "hallmark-2026-a-season-of-promises": [
    "entertainment-showbiz",
    "family-reconciliation",
    "matchmaking",
    "parent-child",
    "siblings",
    "widow-widower"
  ],
  "hallmark-2026-adopting-st-nick": [
    "business-owner",
    "family-business",
    "parent-child",
    "single-parent"
  ],
  "hallmark-2026-an-angel-in-my-stocking": [
    "angel",
    "old-flame",
    "small-town",
    "snowed-in-stranded"
  ],
  "hallmark-2026-barking-all-the-way": [
    "career-vs-love",
    "matchmaking",
    "old-flame",
    "returns-home",
    "workaholic"
  ],
  "hallmark-2026-christmas-delivered": [
    "business-owner",
    "christmas-tree-farm",
    "countryside-farm"
  ],
  "hallmark-2026-christmas-in-blue-dog-valley": [
    "business-owner",
    "doctor-nurse",
    "family-business",
    "small-town"
  ],
  "hallmark-2026-double-booked-for-the-holidays": [
    "bookshop",
    "europe-abroad",
    "inn-bnb",
    "siblings",
    "unexpected-trip"
  ],
  "hallmark-2026-eight-nights-for-love": [
    "big-city",
    "friends-to-lovers",
    "time-travel"
  ],
  "hallmark-2026-forgotten-holiday": [
    "amnesia",
    "family-business",
    "second-chance"
  ],
  "hallmark-2026-hearts-all-aglow": [
    "celebrity",
    "christmas-ball",
    "entertainment-showbiz",
    "music"
  ],
  "hallmark-2026-holiday-ever-after-a-disney-world-wish-come-true": [
    "christmas-wish",
    "rivals-to-lovers",
    "wish-comes-true"
  ],
  "hallmark-2026-holiday-touchdown-a-bears-love-story": [
    "football"
  ],
  "hallmark-2026-holiday-unplugged": [
    "parent-child",
    "single-parent",
    "teacher",
    "widow-widower",
    "workplace-romance"
  ],
  "hallmark-2026-merry-memories": [
    "military",
    "parent-child",
    "siblings",
    "teacher"
  ],
  "hallmark-2026-miles-to-christmas": [
    "christmas-parade",
    "returns-home",
    "siblings",
    "snowed-in-stranded",
    "unexpected-romance",
    "unexpected-trip"
  ],
  "hallmark-2026-mistletoe-and-mimosas": [
    "business-owner",
    "christmas-competition",
    "competition",
    "inheritance",
    "returns-home",
    "save-the-business"
  ],
  "hallmark-2026-mr-mrs-christmas": [
    "christmas-market",
    "family-tradition",
    "parent-child",
    "single-parent",
    "small-town"
  ],
  "hallmark-2026-my-christmas-cowboy": [
    "celebrity",
    "countryside-farm",
    "entertainment-showbiz",
    "old-flame",
    "returns-home",
    "small-town"
  ],
  "hallmark-2026-noelle-nomads": [
    "doctor-nurse",
    "parent-child",
    "unexpected-romance",
    "unexpected-trip"
  ],
  "hallmark-2026-our-holiday-playbook": [
    "baking-cooking",
    "christmas-competition",
    "competition",
    "fake-relationship",
    "family-tradition",
    "football",
    "hometown",
    "returns-home",
    "siblings",
    "sports",
    "teacher"
  ],
  "hallmark-2026-return-to-santa": [
    "childhood-sweethearts",
    "christmas-magic",
    "christmas-wish",
    "friends-to-lovers",
    "reunion",
    "santa",
    "wish-comes-true"
  ],
  "hallmark-2026-save-the-date-for-christmas": [
    "christmas-wedding",
    "matchmaking"
  ],
  "hallmark-2026-snow-globe-town": [
    "siblings",
    "small-town",
    "unexpected-romance",
    "writer-journalist"
  ],
  "hallmark-2026-the-christmas-eve-feast": [
    "baking-cooking",
    "chef-baker",
    "family-tradition",
    "hometown",
    "returns-home"
  ],
  "hallmark-2026-the-most-wonderful-secret": [
    "siblings",
    "small-town",
    "teacher",
    "widow-widower"
  ],
  "hallmark-2026-the-nights-before-christmas": [
    "big-city",
    "christmas-magic",
    "christmas-wish",
    "time-travel",
    "wish-comes-true",
    "writer-journalist"
  ],
  "hallmark-2026-the-snowflake-effect": [
    "big-city",
    "christmas-magic",
    "unexpected-romance"
  ],
  "hallmark-2026-tis-the-season-for-setups": [
    "hotel-resort",
    "parent-child",
    "resort",
    "single-parent"
  ],
  "hallmark-2026-what-if-christmas": [
    "alternate-life",
    "big-city",
    "career-vs-love",
    "christmas-magic",
    "doctor-nurse"
  ],
  "hallmark-2026-who-s-coming-for-christmas": [
    "inheritance",
    "single-parent"
  ],
  "hallmark-2026-winter-wonderlanes": [
    "career-vs-love",
    "family-business",
    "family-legacy",
    "hometown",
    "old-flame",
    "returns-home",
    "save-the-business",
    "second-chance",
    "writer-journalist"
  ],
  "lifetime-2003-comfort-and-joy": [
    "alternate-life",
    "parent-child",
    "workaholic"
  ],
  "lifetime-2005-his-and-her-christmas": [
    "save-the-business",
    "writer-journalist"
  ],
  "lifetime-2005-recipe-for-a-perfect-christmas": [
    "chef-baker",
    "parent-child",
    "writer-journalist"
  ],
  "lifetime-2006-a-christmas-wedding": [
    "christmas-wedding"
  ],
  "lifetime-2006-all-she-wants-for-christmas": [
    "family-business",
    "love-triangle",
    "returns-home",
    "save-the-business",
    "workplace-romance"
  ],
  "lifetime-2006-christmas-on-chestnut-street": [
    "business-owner",
    "christmas-competition",
    "competition"
  ],
  "lifetime-2006-the-road-to-christmas": [
    "christmas-wedding",
    "parent-child",
    "snowed-in-stranded",
    "teacher",
    "unexpected-trip"
  ],
  "lifetime-2006-under-the-mistletoe": [
    "matchmaking",
    "parent-child",
    "single-parent"
  ],
  "lifetime-2007-an-accidental-christmas": [
    "matchmaking",
    "reunion",
    "seaside",
    "second-chance"
  ],
  "lifetime-2007-christmas-in-paradise": [
    "parent-child"
  ],
  "lifetime-2007-lost-holiday-the-jim-suzanne-shemwell-story": [
    "snowed-in-stranded"
  ],
  "lifetime-2008-a-christmas-proposal": [
    "childhood-sweethearts",
    "mountains",
    "small-town"
  ],
  "lifetime-2008-a-very-merry-daughter-of-the-bride": [
    "parent-child"
  ],
  "lifetime-2008-will-you-merry-me": [
    "family-tradition"
  ],
  "lifetime-2009-12-men-of-christmas": [
    "entertainment-showbiz"
  ],
  "lifetime-2009-christmas-angel": [
    "secret-identity",
    "writer-journalist"
  ],
  "lifetime-2009-the-christmas-hope": [
    "doctor-nurse",
    "family-reconciliation",
    "parent-child"
  ],
  "lifetime-2010-a-nanny-for-christmas": [
    "big-city",
    "business-owner"
  ],
  "lifetime-2011-12-wishes-of-christmas": [
    "christmas-magic",
    "christmas-wish",
    "wish-comes-true"
  ],
  "lifetime-2011-dear-santa": [
    "christmas-wish",
    "parent-child",
    "single-parent"
  ],
  "lifetime-2012-a-christmas-wedding-date": [
    "christmas-wedding",
    "hometown",
    "returns-home",
    "time-travel"
  ],
  "lifetime-2012-all-about-christmas-eve": [
    "big-city",
    "career-vs-love"
  ],
  "lifetime-2012-finding-mrs-claus": [
    "big-city",
    "christmas-wish",
    "santa"
  ],
  "lifetime-2012-holiday-spin": [
    "christmas-competition",
    "competition",
    "parent-child"
  ],
  "lifetime-2012-holly-s-holiday": [
    "unexpected-romance"
  ],
  "lifetime-2012-love-at-the-christmas-table": [
    "friends-to-lovers"
  ],
  "lifetime-2012-merry-in-laws": [
    "christmas-magic",
    "santa",
    "secret-identity"
  ],
  "lifetime-2012-the-march-sisters-at-christmas": [
    "old-flame",
    "siblings"
  ],
  "lifetime-2012-the-real-st-nick": [
    "amnesia",
    "doctor-nurse",
    "unexpected-romance"
  ],
  "lifetime-2013-a-christmas-wedding": [
    "christmas-wedding",
    "hometown",
    "siblings",
    "small-town"
  ],
  "lifetime-2013-a-country-christmas-story": [
    "competition",
    "entertainment-showbiz",
    "mountains",
    "music"
  ],
  "lifetime-2013-a-snow-globe-christmas": [
    "alternate-life",
    "christmas-magic",
    "entertainment-showbiz",
    "small-town",
    "workaholic"
  ],
  "lifetime-2013-a-star-for-christmas": [
    "bakery",
    "business-owner",
    "celebrity",
    "chef-baker",
    "entertainment-showbiz",
    "small-town",
    "unexpected-romance",
    "workplace-romance"
  ],
  "lifetime-2013-all-i-want-for-christmas": [
    "christmas-magic",
    "rivals-to-lovers",
    "santa",
    "workplace-romance"
  ],
  "lifetime-2013-christmas-in-the-city": [
    "big-city",
    "family-business",
    "parent-child",
    "santa",
    "save-the-business",
    "secret-identity"
  ],
  "lifetime-2013-christmas-on-the-bayou": [
    "big-city",
    "career-vs-love",
    "childhood-sweethearts",
    "hometown",
    "parent-child",
    "returns-home",
    "workaholic"
  ],
  "lifetime-2013-dear-secret-santa": [
    "hometown",
    "old-flame",
    "parent-child",
    "returns-home",
    "small-town",
    "workaholic"
  ],
  "lifetime-2013-kristin-s-christmas-past": [
    "family-secret",
    "time-travel"
  ],
  "lifetime-2013-the-christmas-consultant": [
    "workaholic"
  ],
  "lifetime-2013-the-twelve-trees-of-christmas": [
    "big-city",
    "christmas-competition",
    "competition",
    "rivals-to-lovers"
  ],
  "lifetime-2014-an-en-vogue-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "music",
    "reunion",
    "save-the-business"
  ],
  "lifetime-2014-the-santa-con": [
    "christmas-wish",
    "matchmaking"
  ],
  "lifetime-2014-wishin-and-hopin": [
    "teacher"
  ],
  "lifetime-2015-a-christmas-reunion": [
    "bakery",
    "baking-cooking",
    "christmas-competition",
    "competition",
    "hometown",
    "inheritance",
    "old-flame",
    "returns-home",
    "reunion"
  ],
  "lifetime-2015-a-gift-wrapped-christmas": [
    "parent-child",
    "single-parent",
    "workaholic"
  ],
  "lifetime-2015-becoming-santa": [
    "family-secret",
    "santa"
  ],
  "lifetime-2015-last-chance-for-christmas": [
    "santa",
    "unexpected-romance"
  ],
  "lifetime-2015-the-christmas-gift": [
    "writer-journalist"
  ],
  "lifetime-2015-the-flight-before-christmas": [
    "inn-bnb",
    "snowed-in-stranded"
  ],
  "lifetime-2015-wish-upon-a-christmas": [
    "business-owner",
    "family-business",
    "old-flame",
    "returns-home",
    "save-the-business"
  ],
  "lifetime-2017-a-very-merry-toy-store": [
    "business-owner",
    "competition",
    "save-the-business",
    "toy-shop"
  ],
  "lifetime-2017-christmas-in-mississippi": [
    "christmas-festival",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "lifetime-2017-delivering-christmas": [
    "christmas-wish",
    "parent-child"
  ],
  "lifetime-2017-four-christmases-and-a-wedding": [
    "christmas-festival"
  ],
  "lifetime-2017-my-christmas-prince": [
    "big-city",
    "career-vs-love",
    "hometown",
    "returns-home",
    "royalty",
    "teacher"
  ],
  "lifetime-2017-snowed-inn-christmas": [
    "inn-bnb",
    "matchmaking",
    "save-the-business",
    "small-town",
    "snowed-in-stranded",
    "unexpected-trip",
    "workplace-romance",
    "writer-journalist"
  ],
  "lifetime-2017-wrapped-up-in-christmas": [
    "matchmaking"
  ],
  "lifetime-2018-a-christmas-arrangement": [
    "business-owner",
    "christmas-competition",
    "competition",
    "rivals-to-lovers"
  ],
  "lifetime-2018-a-christmas-in-tennessee": [
    "bakery",
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "family-business",
    "mountains",
    "parent-child",
    "small-town"
  ],
  "lifetime-2018-a-twist-of-christmas": [
    "rivals-to-lovers",
    "single-parent",
    "unexpected-romance"
  ],
  "lifetime-2018-a-very-nutty-christmas": [
    "bakery",
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "christmas-magic",
    "military",
    "unexpected-romance"
  ],
  "lifetime-2018-christmas-around-the-corner": [
    "bookshop",
    "business-owner",
    "save-the-business",
    "small-town"
  ],
  "lifetime-2018-christmas-harmony": [
    "hometown",
    "music",
    "returns-home",
    "small-town"
  ],
  "lifetime-2018-christmas-lost-and-found": [
    "family-tradition",
    "returns-home"
  ],
  "lifetime-2018-christmas-pen-pals": [
    "business-owner",
    "hometown",
    "old-flame",
    "returns-home",
    "save-the-business"
  ],
  "lifetime-2018-christmas-perfection": [
    "christmas-magic"
  ],
  "lifetime-2018-every-day-is-christmas": [
    "workaholic"
  ],
  "lifetime-2018-every-other-holiday": [
    "christmas-wish",
    "countryside-farm",
    "parent-child",
    "reunion",
    "second-chance"
  ],
  "lifetime-2018-hometown-christmas": [
    "athlete",
    "family-tradition",
    "hometown",
    "old-flame",
    "returns-home",
    "second-chance"
  ],
  "lifetime-2018-jingle-belle": [
    "entertainment-showbiz",
    "hometown",
    "music",
    "old-flame",
    "returns-home",
    "reunion",
    "second-chance",
    "small-town"
  ],
  "lifetime-2018-mr-365": [
    "entertainment-showbiz",
    "unexpected-romance",
    "workaholic",
    "workplace-romance"
  ],
  "lifetime-2018-my-christmas-inn": [
    "inheritance",
    "inn-bnb",
    "small-town",
    "unexpected-romance"
  ],
  "lifetime-2018-poinsettias-for-christmas": [
    "christmas-parade",
    "countryside-farm",
    "family-business",
    "hometown",
    "parent-child",
    "returns-home",
    "save-the-business"
  ],
  "lifetime-2018-santa-s-boots": [
    "family-business",
    "returns-home",
    "save-the-business",
    "workplace-romance"
  ],
  "lifetime-2018-the-christmas-contract": [
    "christmas-market",
    "fake-relationship",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "lifetime-2018-the-christmas-pact": [
    "friends-to-lovers"
  ],
  "lifetime-2019-a-christmas-winter-song": [
    "music",
    "parent-child"
  ],
  "lifetime-2019-a-christmas-wish": [
    "christmas-wish",
    "love-triangle",
    "siblings",
    "small-town"
  ],
  "lifetime-2019-a-date-by-christmas-eve": [
    "christmas-magic"
  ],
  "lifetime-2019-a-storybook-christmas": [
    "business-owner",
    "save-the-business",
    "unexpected-romance"
  ],
  "lifetime-2019-a-sweet-christmas-romance": [
    "bakery",
    "baking-cooking",
    "chef-baker",
    "christmas-competition",
    "competition",
    "hometown",
    "returns-home",
    "rivals-to-lovers"
  ],
  "lifetime-2019-a-very-vintage-christmas": [
    "business-owner"
  ],
  "lifetime-2019-always-and-forever-christmas": [
    "business-owner",
    "family-business",
    "hometown",
    "inheritance",
    "restaurant-cafe",
    "returns-home"
  ],
  "lifetime-2019-christmas-9-to-5": [
    "writer-journalist"
  ],
  "lifetime-2019-christmas-a-la-mode": [
    "baking-cooking",
    "business-owner",
    "christmas-competition",
    "competition",
    "countryside-farm",
    "family-business",
    "family-legacy",
    "save-the-business",
    "siblings"
  ],
  "lifetime-2019-christmas-hotel": [
    "hotel-resort"
  ],
  "lifetime-2019-christmas-in-louisiana": [
    "christmas-festival",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "lifetime-2019-christmas-in-the-highlands": [
    "christmas-ball",
    "europe-abroad",
    "royalty",
    "unexpected-romance"
  ],
  "lifetime-2019-christmas-love-letter": [
    "hometown",
    "investigation",
    "mystery",
    "returns-home",
    "writer-journalist"
  ],
  "lifetime-2019-christmas-reservations": [
    "family-business",
    "hotel-resort",
    "old-flame",
    "resort",
    "single-parent",
    "widow-widower"
  ],
  "lifetime-2019-christmas-stars": [
    "career-vs-love",
    "entertainment-showbiz",
    "music"
  ],
  "lifetime-2019-christmas-unleashed": [
    "hometown",
    "old-flame"
  ],
  "lifetime-2019-grounded-for-christmas": [
    "fake-relationship",
    "old-flame",
    "snowed-in-stranded"
  ],
  "lifetime-2019-matchmaker-christmas": [
    "love-triangle",
    "matchmaking",
    "old-flame"
  ],
  "lifetime-2019-merry-liddle-christmas": [
    "family-reunion"
  ],
  "lifetime-2019-no-time-like-christmas": [
    "entertainment-showbiz",
    "music",
    "old-flame",
    "save-the-business"
  ],
  "lifetime-2019-radio-christmas": [
    "entertainment-showbiz",
    "small-town"
  ],
  "lifetime-2019-random-acts-of-christmas": [
    "investigation",
    "mystery",
    "writer-journalist"
  ],
  "lifetime-2019-rediscovering-christmas": [
    "christmas-ball",
    "christmas-festival",
    "siblings"
  ],
  "lifetime-2019-staging-christmas": [
    "parent-child",
    "widow-widower"
  ],
  "lifetime-2019-sweet-mountain-christmas": [
    "entertainment-showbiz",
    "music",
    "returns-home",
    "snowed-in-stranded"
  ],
  "lifetime-2019-the-christmas-temp": [
    "workplace-romance"
  ],
  "lifetime-2019-the-magical-christmas-shoes": [
    "christmas-magic"
  ],
  "lifetime-2019-the-road-home-for-christmas": [
    "entertainment-showbiz",
    "hometown",
    "music",
    "rivals-to-lovers",
    "unexpected-trip"
  ],
  "lifetime-2019-twinkle-all-the-way": [
    "business-owner",
    "christmas-wedding",
    "family-business"
  ],
  "lifetime-2019-you-light-up-my-christmas": [
    "family-business",
    "hometown",
    "old-flame",
    "returns-home"
  ],
  "lifetime-2020-a-christmas-break": [
    "celebrity",
    "hometown",
    "old-flame",
    "returns-home",
    "reunion"
  ],
  "lifetime-2020-a-christmas-exchange": [
    "big-city",
    "countryside-farm",
    "europe-abroad"
  ],
  "lifetime-2020-a-christmas-mission": [
    "business-owner",
    "childhood-sweethearts",
    "family-tradition",
    "military",
    "old-flame",
    "parent-child"
  ],
  "lifetime-2020-a-crafty-christmas-romance": [
    "business-owner",
    "christmas-wish",
    "investigation",
    "mystery"
  ],
  "lifetime-2020-a-sugar-spice-holiday": [
    "baking-cooking",
    "christmas-competition",
    "competition",
    "hometown",
    "returns-home",
    "small-town"
  ],
  "lifetime-2020-a-taste-of-christmas": [
    "baking-cooking",
    "chef-baker",
    "restaurant-cafe",
    "save-the-business"
  ],
  "lifetime-2020-a-very-charming-christmas-town": [
    "business-owner",
    "small-town",
    "writer-journalist"
  ],
  "lifetime-2020-a-welcome-home-christmas": [
    "christmas-ball",
    "military"
  ],
  "lifetime-2020-christmas-at-maple-creek": [
    "writer-journalist"
  ],
  "lifetime-2020-christmas-ever-after": [
    "inn-bnb",
    "unexpected-romance",
    "writer-journalist"
  ],
  "lifetime-2020-christmas-on-ice": [
    "athlete",
    "business-owner",
    "save-the-business",
    "single-parent",
    "sports"
  ],
  "lifetime-2020-christmas-on-the-menu": [
    "baking-cooking",
    "chef-baker",
    "hometown",
    "inn-bnb",
    "parent-child",
    "restaurant-cafe",
    "returns-home",
    "rivals-to-lovers",
    "writer-journalist"
  ],
  "lifetime-2020-christmas-on-the-vine": [
    "business-owner",
    "family-business",
    "hometown",
    "returns-home",
    "save-the-business",
    "winery"
  ],
  "lifetime-2020-christmas-unwrapped": [
    "investigation",
    "writer-journalist"
  ],
  "lifetime-2020-christmas-with-a-crown": [
    "christmas-festival",
    "hometown",
    "returns-home",
    "royalty",
    "secret-identity",
    "unexpected-romance"
  ],
  "lifetime-2020-dear-christmas": [
    "hometown",
    "parent-child",
    "returns-home",
    "unexpected-romance",
    "writer-journalist"
  ],
  "lifetime-2020-feliz-navidad": [
    "matchmaking",
    "parent-child",
    "siblings",
    "single-parent",
    "unexpected-romance",
    "widow-widower"
  ],
  "lifetime-2020-homemade-christmas": [
    "career-vs-love",
    "love-triangle"
  ],
  "lifetime-2020-inn-love-by-christmas": [
    "competition",
    "hometown",
    "hotel-resort",
    "inn-bnb",
    "returns-home",
    "small-town"
  ],
  "lifetime-2020-let-s-meet-again-on-christmas-eve": [
    "old-flame",
    "reunion",
    "second-chance"
  ],
  "lifetime-2020-lonestar-christmas": [
    "countryside-farm",
    "family-reconciliation",
    "parent-child",
    "restaurant-cafe",
    "reunion",
    "single-parent",
    "unexpected-romance"
  ],
  "lifetime-2020-merry-liddle-christmas-wedding": [
    "christmas-wedding"
  ],
  "lifetime-2020-my-sweet-holiday": [
    "family-business",
    "hometown",
    "parent-child",
    "returns-home",
    "unexpected-romance"
  ],
  "lifetime-2020-once-upon-a-main-street": [
    "business-owner",
    "competition"
  ],
  "lifetime-2020-spotlight-on-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "hometown",
    "returns-home",
    "small-town",
    "unexpected-romance"
  ],
  "lifetime-2020-the-christmas-aunt": [
    "friends-to-lovers",
    "hometown",
    "returns-home",
    "reunion"
  ],
  "lifetime-2020-the-christmas-ball": [
    "castle-manor",
    "christmas-ball",
    "europe-abroad"
  ],
  "lifetime-2020-the-christmas-edition": [
    "save-the-business",
    "small-town",
    "writer-journalist"
  ],
  "lifetime-2020-the-christmas-high-note": [
    "music",
    "parent-child",
    "unexpected-romance"
  ],
  "lifetime-2020-the-christmas-listing": [
    "business-owner",
    "competition",
    "inn-bnb",
    "rivals-to-lovers"
  ],
  "lifetime-2020-the-christmas-setup": [
    "career-vs-love",
    "matchmaking",
    "returns-home",
    "siblings"
  ],
  "lifetime-2020-the-christmas-yule-blog": [
    "christmas-parade",
    "small-town",
    "teacher",
    "writer-journalist"
  ],
  "lifetime-2020-the-santa-squad": [
    "teacher",
    "unexpected-romance",
    "widow-widower"
  ],
  "lifetime-2020-too-close-for-christmas": [
    "siblings"
  ],
  "lifetime-2021-a-christmas-dance-reunion": [
    "childhood-sweethearts",
    "hotel-resort",
    "resort",
    "returns-home",
    "reunion",
    "save-the-business"
  ],
  "lifetime-2021-a-christmas-to-savour": [
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "restaurant-cafe",
    "rivals-to-lovers"
  ],
  "lifetime-2021-an-ice-wine-christmas": [
    "family-business",
    "hometown",
    "returns-home",
    "winery"
  ],
  "lifetime-2021-baking-spirits-bright": [
    "baking-cooking",
    "family-business",
    "save-the-business"
  ],
  "lifetime-2021-blending-christmas": [
    "hotel-resort",
    "resort"
  ],
  "lifetime-2021-candy-cane-candidate": [
    "hometown",
    "returns-home"
  ],
  "lifetime-2021-christmas-a-la-carte": [
    "business-owner",
    "entertainment-showbiz",
    "restaurant-cafe",
    "writer-journalist"
  ],
  "lifetime-2021-christmas-by-chance": [
    "business-owner"
  ],
  "lifetime-2021-christmas-in-tune": [
    "entertainment-showbiz",
    "music",
    "old-flame",
    "parent-child",
    "reunion",
    "second-chance"
  ],
  "lifetime-2021-christmas-movie-magic": [
    "entertainment-showbiz",
    "mystery",
    "writer-journalist"
  ],
  "lifetime-2021-dancing-through-the-snow": [
    "entertainment-showbiz",
    "parent-child",
    "teacher",
    "unexpected-romance"
  ],
  "lifetime-2021-falling-in-love-at-christmas": [
    "rivals-to-lovers",
    "unexpected-romance",
    "workplace-romance"
  ],
  "lifetime-2021-holiday-in-santa-fe": [
    "family-business"
  ],
  "lifetime-2021-it-takes-a-christmas-village": [
    "christmas-market",
    "save-the-business"
  ],
  "lifetime-2021-kirk-franklin-s-a-gospel-christmas": [
    "faith",
    "music"
  ],
  "lifetime-2021-maps-and-mistletoe": [
    "unexpected-romance"
  ],
  "lifetime-2021-match-made-in-mistletoe": [
    "big-city",
    "christmas-ball",
    "unexpected-romance"
  ],
  "lifetime-2021-miracle-in-motor-city": [
    "celebrity",
    "entertainment-showbiz",
    "music",
    "old-flame",
    "second-chance"
  ],
  "lifetime-2021-mistletoe-in-montana": [
    "business-owner",
    "countryside-farm",
    "single-parent"
  ],
  "lifetime-2021-my-favorite-christmas-melody": [
    "entertainment-showbiz",
    "hometown",
    "music",
    "returns-home"
  ],
  "lifetime-2021-rebuilding-a-dream-christmas": [
    "childhood-sweethearts",
    "family-tradition",
    "hometown"
  ],
  "lifetime-2021-saying-yes-to-christmas": [
    "career-vs-love",
    "christmas-magic",
    "christmas-wish",
    "hometown",
    "old-flame",
    "returns-home",
    "workaholic"
  ],
  "lifetime-2021-sit-stay-love": [
    "rescue",
    "workplace-romance"
  ],
  "lifetime-2021-sweet-navidad": [
    "baking-cooking",
    "chef-baker"
  ],
  "lifetime-2021-the-enchanted-christmas-cake": [
    "bakery",
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "christmas-magic",
    "family-business"
  ],
  "lifetime-2021-the-holiday-fix-up": [
    "christmas-festival",
    "hometown",
    "inn-bnb",
    "old-flame",
    "returns-home",
    "second-chance"
  ],
  "lifetime-2021-toying-with-the-holidays": [
    "reunion"
  ],
  "lifetime-2021-under-the-christmas-tree": [
    "rivals-to-lovers"
  ],
  "lifetime-2021-welcome-to-the-christmas-family-reunion": [
    "entertainment-showbiz",
    "family-reunion",
    "music",
    "reunion"
  ],
  "lifetime-2021-writing-around-the-christmas-tree": [
    "inn-bnb",
    "writer-journalist"
  ],
  "lifetime-2022-a-christmas-spark": [
    "widow-widower",
    "parent-child",
    "christmas-festival",
    "unexpected-romance"
  ],
  "lifetime-2022-a-christmas-to-treasure": [
    "hometown",
    "reunion",
    "second-chance"
  ],
  "lifetime-2022-a-country-christmas-harmony": [
    "entertainment-showbiz",
    "music",
    "old-flame",
    "reunion",
    "second-chance"
  ],
  "lifetime-2022-a-new-orleans-noel": [
    "workplace-romance",
    "unexpected-romance"
  ],
  "lifetime-2022-a-show-stopping-christmas": [
    "business-owner",
    "celebrity",
    "entertainment-showbiz",
    "ghost-spirit",
    "save-the-business"
  ],
  "lifetime-2022-baking-all-the-way": [
    "bakery",
    "baking-cooking",
    "business-owner",
    "chef-baker",
    "small-town"
  ],
  "lifetime-2022-christmas-on-mistletoe-lake": [
    "christmas-festival"
  ],
  "lifetime-2022-christmas-plus-one": [
    "christmas-wedding",
    "christmas-wish",
    "siblings"
  ],
  "lifetime-2022-cloudy-with-a-chance-of-christmas": [
    "entertainment-showbiz",
    "rivals-to-lovers"
  ],
  "lifetime-2022-kirk-franklin-s-the-night-before-christmas": [
    "family-reconciliation",
    "parent-child",
    "snowed-in-stranded",
    "teacher"
  ],
  "lifetime-2022-loving-christmas": [
    "christmas-competition"
  ],
  "lifetime-2022-merry-swissmas": [
    "inn-bnb",
    "single-parent"
  ],
  "lifetime-2022-merry-textmas": [
    "returns-home",
    "siblings"
  ],
  "lifetime-2022-mistletoe-match": [
    "single-parent",
    "widow-widower",
    "writer-journalist",
    "secret-identity",
    "career-vs-love"
  ],
  "lifetime-2022-planes-trains-and-christmas-trees": [
    "snowed-in-stranded"
  ],
  "lifetime-2022-record-breaking-christmas": [
    "doctor-nurse",
    "investigation",
    "small-town"
  ],
  "lifetime-2022-reindeer-games-homecoming": [
    "competition",
    "family-tradition",
    "old-flame"
  ],
  "lifetime-2022-santa-bootcamp": [
    "santa"
  ],
  "lifetime-2022-scentsational-christmas": [
    "family-business",
    "hometown",
    "parent-child",
    "returns-home",
    "writer-journalist"
  ],
  "lifetime-2022-single-and-ready-to-jingle": [
    "small-town",
    "unexpected-romance",
    "unexpected-trip"
  ],
  "lifetime-2022-steppin-into-the-holiday": [
    "business-owner",
    "celebrity",
    "entertainment-showbiz"
  ],
  "lifetime-2022-the-12-days-of-christmas-eve": [
    "christmas-magic",
    "family-reconciliation",
    "parent-child",
    "santa",
    "time-travel"
  ],
  "lifetime-2022-the-holiday-dating-guide": [
    "writer-journalist",
    "matchmaking",
    "unexpected-romance"
  ],
  "lifetime-2022-well-suited-for-christmas": [
    "competition"
  ],
  "lifetime-2023-christmas-at-the-chalet": [
    "resort",
    "parent-child",
    "entertainment-showbiz"
  ],
  "lifetime-2023-ladies-of-the-80s-a-divas-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "reunion"
  ],
  "lifetime-2023-laughing-all-the-way": [
    "business-owner",
    "celebrity",
    "entertainment-showbiz",
    "writer-journalist"
  ],
  "lifetime-2023-mom-s-christmas-boyfriend": [
    "single-parent",
    "parent-child",
    "matchmaking",
    "christmas-wish",
    "unexpected-romance"
  ],
  "lifetime-2025-a-pickleball-christmas": [
    "athlete",
    "sports",
    "returns-home",
    "family-business",
    "competition",
    "save-the-business",
    "unexpected-romance"
  ],
  "lifetime-2025-a-runaway-bride-for-christmas": [
    "runaway-bride-broken-engagement",
    "returns-home",
    "old-flame",
    "unexpected-romance"
  ],
  "lifetime-2025-rodeo-christmas-romance": [
    "countryside-farm"
  ],
  "lifetime-2025-the-christmas-campaign": [
    "workplace-romance",
    "career-vs-love",
    "unexpected-romance"
  ],
  "uptv-2008-the-christmas-clause": [
    "alternate-life",
    "career-vs-love",
    "christmas-wish",
    "wish-comes-true"
  ],
  "uptv-2009-a-golden-christmas": [
    "childhood-sweethearts",
    "competition",
    "hometown",
    "mistaken-identity",
    "returns-home"
  ],
  "uptv-2010-christmas-mail": [
    "workplace-romance"
  ],
  "uptv-2011-3-holiday-tails": [
    "matchmaking",
    "old-flame",
    "second-chance"
  ],
  "uptv-2011-a-christmas-kiss": [
    "big-city",
    "entertainment-showbiz",
    "unexpected-romance"
  ],
  "uptv-2013-guess-who-s-coming-to-christmas": [
    "celebrity",
    "christmas-wish",
    "entertainment-showbiz",
    "music",
    "small-town",
    "unexpected-trip"
  ],
  "uptv-2013-marry-me-for-christmas": [
    "business-owner",
    "fake-relationship",
    "returns-home"
  ],
  "uptv-2013-my-santa": [
    "parent-child",
    "single-parent",
    "unexpected-romance"
  ],
  "uptv-2014-marry-us-for-christmas": [
    "career-vs-love",
    "christmas-wedding",
    "fake-relationship",
    "workaholic"
  ],
  "uptv-2014-naughty-nice": [
    "rivals-to-lovers"
  ],
  "uptv-2014-paper-angels": [
    "parent-child"
  ],
  "uptv-2014-the-tree-that-saved-christmas": [
    "christmas-tree-farm",
    "countryside-farm",
    "family-business",
    "save-the-business"
  ],
  "uptv-2015-angels-in-the-snow": [
    "mountains"
  ],
  "uptv-2015-christmas-trade": [
    "christmas-magic",
    "parent-child",
    "single-parent"
  ],
  "uptv-2015-my-one-christmas-wish": [
    "christmas-wish"
  ],
  "uptv-2016-a-christmas-in-vermont": [
    "career-vs-love",
    "save-the-business",
    "small-town",
    "unexpected-romance"
  ],
  "uptv-2016-a-husband-for-christmas": [
    "fake-relationship",
    "workplace-romance"
  ],
  "uptv-2016-a-puppy-for-christmas": [
    "christmas-wish",
    "wish-comes-true"
  ],
  "uptv-2016-girlfriends-of-christmas-past": [
    "old-flame",
    "resort"
  ],
  "uptv-2016-married-by-christmas": [
    "inheritance"
  ],
  "uptv-2016-merry-christmas-baby": [
    "business-owner"
  ],
  "uptv-2016-the-rooftop-christmas-tree": [
    "investigation",
    "mystery"
  ],
  "uptv-2017-a-christmas-cruise": [
    "seaside",
    "unexpected-romance",
    "writer-journalist"
  ],
  "uptv-2017-christmas-princess": [
    "christmas-parade"
  ],
  "uptv-2017-christmas-solo": [
    "parent-child",
    "single-parent"
  ],
  "uptv-2017-second-chance-christmas": [
    "amnesia",
    "second-chance"
  ],
  "uptv-2017-the-christmas-calendar": [
    "chef-baker",
    "mystery",
    "secret-identity",
    "small-town"
  ],
  "uptv-2018-a-christmas-switch": [
    "alternate-life",
    "christmas-magic",
    "entertainment-showbiz",
    "music"
  ],
  "uptv-2018-christmas-catch": [
    "investigation",
    "mystery",
    "unexpected-romance"
  ],
  "uptv-2018-christmas-on-holly-lane": [
    "reunion"
  ],
  "uptv-2018-christmas-on-the-coast": [
    "writer-journalist"
  ],
  "uptv-2018-christmas-with-a-prince": [
    "doctor-nurse",
    "old-flame",
    "royalty"
  ],
  "uptv-2018-hometown-holiday": [
    "business-owner",
    "entertainment-showbiz",
    "hometown"
  ],
  "uptv-2021-the-picture-of-christmas": [
    "christmas-festival",
    "christmas-tree-farm",
    "countryside-farm",
    "hometown",
    "inheritance",
    "returns-home",
    "small-town"
  ],
  "uptv-2021-unperfect-christmas-wish": [
    "entertainment-showbiz",
    "music"
  ],
  "uptv-2022-a-christmas-masquerade": [
    "christmas-ball",
    "mistaken-identity"
  ],
  "uptv-2022-a-prince-and-pauper-christmas": [
    "investigation",
    "mistaken-identity"
  ],
  "uptv-2022-a-royal-christmas-match": [
    "career-vs-love",
    "royalty"
  ],
  "uptv-2022-a-tiny-home-christmas": [
    "family-business",
    "old-flame",
    "save-the-business",
    "second-chance"
  ],
  "uptv-2022-an-eclectic-christmas": [
    "business-owner",
    "inheritance",
    "small-town"
  ],
  "uptv-2022-christmas-in-rockwell": [
    "celebrity",
    "entertainment-showbiz",
    "hometown",
    "returns-home",
    "small-town"
  ],
  "uptv-2022-christmas-on-the-rocks": [
    "hotel-resort",
    "old-flame",
    "resort",
    "snowed-in-stranded"
  ],
  "uptv-2022-christmas-on-the-slopes": [
    "chef-baker",
    "hotel-resort",
    "resort"
  ],
  "uptv-2022-country-roads-christmas": [
    "celebrity",
    "entertainment-showbiz",
    "family-reconciliation",
    "music",
    "parent-child",
    "reunion"
  ],
  "uptv-2022-dognapped-hound-for-the-holidays": [
    "investigation",
    "rescue"
  ],
  "uptv-2022-sappy-holiday": [
    "chef-baker",
    "countryside-farm",
    "rescue",
    "snowed-in-stranded",
    "unexpected-romance"
  ],
  "uptv-2022-the-case-of-the-christmas-diamond": [
    "investigation",
    "mystery",
    "writer-journalist"
  ],
  "uptv-2022-the-search-for-secret-santa": [
    "investigation",
    "writer-journalist"
  ],
  "uptv-2022-the-snowball-effect": [
    "career-vs-love",
    "competition",
    "entertainment-showbiz",
    "small-town",
    "snowed-in-stranded"
  ],
  "uptv-2023-12-dares-of-christmas": [
    "siblings",
    "teacher"
  ],
  "uptv-2023-a-very-english-christmas": [
    "christmas-market",
    "christmas-wedding",
    "countryside-farm",
    "siblings"
  ],
  "uptv-2023-christmas-at-the-amish-bakery": [
    "amish",
    "countryside-farm",
    "returns-home",
    "save-the-business",
    "bakery",
    "family-business"
  ],
  "uptv-2023-christmas-in-big-sky-country": [
    "rescue",
    "unexpected-romance"
  ],
  "uptv-2023-christmas-time-capsule": [
    "matchmaking"
  ],
  "uptv-2023-christmas-with-the-knightlys": [
    "fake-relationship",
    "teacher"
  ],
  "uptv-2023-country-hearts-christmas": [
    "countryside-farm",
    "entertainment-showbiz",
    "music",
    "siblings"
  ],
  "uptv-2023-dial-s-for-santa": [
    "hometown",
    "investigation",
    "mystery",
    "returns-home"
  ],
  "uptv-2023-mistletoe-connection": [
    "business-owner",
    "unexpected-romance"
  ],
  "uptv-2023-the-best-thing-about-christmas": [
    "angel",
    "entertainment-showbiz",
    "music",
    "parent-child"
  ],
  "uptv-2023-we-re-scrooged": [
    "ghost-spirit",
    "old-flame",
    "reunion",
    "second-chance"
  ],
  "uptv-2023-yuletide-the-knot": [
    "christmas-wedding",
    "old-flame",
    "small-town"
  ],
  "uptv-2024-a-bluegrass-christmas": [
    "celebrity",
    "countryside-farm",
    "entertainment-showbiz",
    "family-business",
    "music",
    "save-the-business"
  ],
  "uptv-2024-a-novel-christmas": [
    "bookshop",
    "career-vs-love",
    "entertainment-showbiz",
    "single-parent",
    "writer-journalist"
  ],
  "uptv-2024-a-soldier-for-christmas": [
    "military",
    "parent-child",
    "single-parent",
    "widow-widower"
  ],
  "uptv-2024-festival-of-trees": [
    "christmas-competition",
    "competition"
  ],
  "uptv-2024-north-by-north-pole-a-dial-s-mystery": [
    "christmas-festival",
    "christmas-wish",
    "mystery",
    "santa"
  ],
  "uptv-2025-a-christmas-murder-mystery": [
    "mystery",
    "murder-mystery",
    "investigation",
    "writer-journalist",
    "family-secret"
  ],
  "uptv-2025-a-royal-christmas-hope": [
    "royalty",
    "secret-identity",
    "unexpected-romance"
  ],
  "uptv-2025-a-royal-christmas-manor": [
    "business-owner",
    "inn-bnb",
    "royalty",
    "secret-identity",
    "unexpected-romance"
  ],
  "uptv-2025-christmas-in-amish-country": [
    "amish",
    "baking-cooking",
    "chef-baker",
    "countryside-farm",
    "hometown",
    "returns-home"
  ],
  "uptv-2025-christmas-in-the-ballroom": [
    "celebrity",
    "entertainment-showbiz"
  ],
  "uptv-2025-saving-the-christmas-ranch": [
    "family-business",
    "save-the-business"
  ],
  "uptv-2025-the-great-christmas-snow-in": [
    "snowed-in-stranded",
    "runaway-bride-broken-engagement",
    "unexpected-romance"
  ],
  "uptv-2026-a-royal-stables-christmas": [
    "royalty",
    "secret-identity"
  ],
  "uptv-2026-christmas-en-pointe": [
    "small-town",
    "returns-home",
    "old-flame",
    "second-chance",
    "save-the-business"
  ],
  "uptv-2026-snowbody-like-you": [
    "old-flame",
    "reunion",
    "second-chance"
  ]
};

export function getMovieFingerprintIds(movie: Pick<Movie, 'id' | 'fingerprints'>): FingerprintId[] {
  const values = movie.fingerprints ?? PROTOTYPE_MOVIE_FINGERPRINTS[movie.id] ?? [];
  return [...new Set(values)].filter(isFingerprintId);
}

export function getMovieFingerprints(movie: Pick<Movie, 'id' | 'fingerprints'>): FingerprintDefinition[] {
  return getMovieFingerprintIds(movie).map((id) => getFingerprintById(id)!).filter(Boolean);
}

export function movieHasFingerprint(movie: Pick<Movie, 'id' | 'fingerprints'>, fingerprintId: string): boolean {
  return getMovieFingerprintIds(movie).includes(fingerprintId as FingerprintId);
}

export function getRelatedMovieFingerprints(movies: Array<Pick<Movie, 'id' | 'fingerprints'>>, currentFingerprintId: string): FingerprintDefinition[] {
  const counts = new Map<FingerprintId, number>();
  for (const movie of movies) {
    for (const fingerprintId of getMovieFingerprintIds(movie)) {
      if (fingerprintId !== currentFingerprintId) counts.set(fingerprintId, (counts.get(fingerprintId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || getFingerprintById(left[0])!.label.localeCompare(getFingerprintById(right[0])!.label))
    .map(([id]) => getFingerprintById(id)!)
    .filter(Boolean);
}
