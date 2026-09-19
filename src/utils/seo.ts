import { toCanonicalUrl } from './urls';

export interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  schema?: Record<string, unknown>;
  noIndex?: boolean;
}

export function updateSeoTags({
  title,
  description,
  canonicalPath,
  image,
  schema,
  noIndex = false,
}: SeoOptions): void {
  if (typeof document === 'undefined') return;

  const fullCanonicalUrl = canonicalPath ? toCanonicalUrl(canonicalPath) : null;

  // Document Title
  document.title = title;

  // Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', description);

  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    document.head.appendChild(robots);
  }
  robots.setAttribute('content', noIndex ? 'noindex, follow' : 'index, follow');

  // Canonical Link Tag
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!fullCanonicalUrl) {
    canonicalLink?.remove();
  } else if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  if (canonicalLink && fullCanonicalUrl) canonicalLink.setAttribute('href', fullCanonicalUrl);

  // Open Graph: URL
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    document.head.appendChild(ogUrl);
  }
  if (fullCanonicalUrl) {
    ogUrl.setAttribute('content', fullCanonicalUrl);
  } else {
    ogUrl.remove();
  }

  // Open Graph: Title
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitle);
  }
  ogTitle.setAttribute('content', title);

  // Open Graph: Description
  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (!ogDesc) {
    ogDesc = document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    document.head.appendChild(ogDesc);
  }
  ogDesc.setAttribute('content', description);

  // Open Graph: Image (if specified)
  if (image) {
    let ogImg = document.querySelector('meta[property="og:image"]');
    if (!ogImg) {
      ogImg = document.createElement('meta');
      ogImg.setAttribute('property', 'og:image');
      document.head.appendChild(ogImg);
    }
    ogImg.setAttribute('content', image);
  }

  // Schema.org JSON-LD structured data script
  let jsonLdScript = document.getElementById('schema-json-ld');
  if (!jsonLdScript) {
    jsonLdScript = document.createElement('script');
    jsonLdScript.setAttribute('id', 'schema-json-ld');
    jsonLdScript.setAttribute('type', 'application/ld+json');
    document.head.appendChild(jsonLdScript);
  }

  if (schema) {
    jsonLdScript.textContent = JSON.stringify(schema, null, 2);
  } else {
    jsonLdScript.textContent = '';
  }
}
