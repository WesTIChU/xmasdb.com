import React from 'react';
import { HollyDivider } from './HollyDivider';

const hallmarkExample = `{
  "title": "A Christmas Angel Match",
  "year": 2025,
  "network": "Hallmark",
  "tmdb_id": 1538155,
  "imdb_id": "tt36503047",
  "actors": [
    { "name": "Meghan Ory", "tmdb_id": 43928 },
    { "name": "Benjamin Ayres", "tmdb_id": 62172 }
  ],
  "christmas_ingredients": [
    { "id": "angel", "name": "Angel" },
    { "id": "christmas-magic", "name": "Christmas Magic" },
    { "id": "matchmaking", "name": "Matchmaking" }
  ],
  "xmasdb_url": "https://xmasdb.com/movie/1538155/a-christmas-angel-match/"
}`;

const homeAssistantExample = `rest:
  - resource: "https://xmasdb.com/api/v1/movies?network=hallmark&year=2025&limit=10"
    sensor:
      - name: "XmasDB Hallmark Movies"
        value_template: "{{ value_json.count }}"
        json_attributes:
          - movies`;

const curlExample = `curl "https://xmasdb.com/api/v1/movies?network=hallmark&limit=5"`;

const javascriptExample = `const response = await fetch(
  "https://xmasdb.com/api/v1/movies?network=hallmark&limit=5"
);

const data = await response.json();

console.log(data.movies);`;

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded border border-[#DCD3C7] bg-[#FFFDF9] p-4 text-[#403A34] shadow-sm">
      <code className="font-mono text-xs leading-relaxed sm:text-sm">{children}</code>
    </pre>
  );
}

function Endpoint({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-[#F1EADF] px-1.5 py-0.5 font-mono text-sm text-[#841818]">{children}</code>;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#E7DFD5] pt-6 sm:pt-7" aria-labelledby={id}>
      <h2 id={id} className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export const ApiPage: React.FC = () => (
  <div id="api-page" className="mx-auto max-w-5xl px-0 py-6 text-left sm:py-8" aria-labelledby="api-heading">
    <header className="pb-5 sm:pb-6">
      <div className="text-center">
        <h1 id="api-heading" className="font-heading text-2xl font-semibold tracking-[0.015em] text-[#1A3D2F] sm:text-3xl">XmasDB API</h1>
        <p className="mx-auto mt-2 max-w-2xl font-body text-base leading-relaxed text-[#1A3D2F] sm:text-lg">Free, read-only access to XmasDB&apos;s curated Christmas movie catalogue.</p>
        <HollyDivider className="my-5 sm:my-6" lineClassName="w-6 sm:w-8" ornamentClassName="h-4 w-12 sm:h-5 sm:w-14" />
      </div>
    </header>

    <div className="space-y-10 font-body text-base leading-relaxed text-[#4A433B] sm:space-y-12 sm:text-lg">
      <Section id="api-quick-start" title="Quick Start">
        <p>Base URL:</p>
        <CodeBlock>https://xmasdb.com/api/v1/</CodeBlock>
        <p>No API key is currently required.</p>
        <p>Public use requires attribution and a link back to XmasDB.com. See API Terms &amp; Attribution below.</p>
      </Section>

      <Section id="api-movies" title="Movies">
        <p><Endpoint>GET /api/v1/movies</Endpoint> returns curated XmasDB movie records.</p>
        <p>Supported filters are <code className="font-mono text-sm">network</code>, <code className="font-mono text-sm">year</code>, <code className="font-mono text-sm">actor</code>, <code className="font-mono text-sm">ingredient</code> and <code className="font-mono text-sm">limit</code>. Filters can be combined. The current maximum limit is 1000.</p>
        <div className="space-y-2">
          <CodeBlock>{`https://xmasdb.com/api/v1/movies?network=hallmark&limit=10
https://xmasdb.com/api/v1/movies?network=lifetime&year=2025&limit=10
https://xmasdb.com/api/v1/movies?ingredient=small-town&limit=10
https://xmasdb.com/api/v1/movies?network=hallmark&ingredient=old-flame&limit=10
https://xmasdb.com/api/v1/movies?actor=43928&limit=5`}</CodeBlock>
        </div>
        <h3 className="pt-2 font-heading text-xl font-semibold text-[#1A3D2F]">Movie response</h3>
        <CodeBlock>{hallmarkExample}</CodeBlock>
      </Section>

      <Section id="api-actors" title="Actors">
        <p><Endpoint>GET /api/v1/actors</Endpoint> lists actors represented in the XmasDB Christmas catalogue.</p>
        <p><Endpoint>GET /api/v1/actors/43928</Endpoint> returns Meghan Ory and her XmasDB Christmas movies. These endpoints describe relationships within this catalogue, not general actor biographies or filmographies.</p>
        <CodeBlock>https://xmasdb.com/api/v1/actors/43928{`\n`}https://xmasdb.com/api/v1/movies?actor=43928&amp;limit=5</CodeBlock>
      </Section>

      <Section id="api-ingredients" title="Christmas Ingredients">
        <p>Christmas Ingredients are XmasDB&apos;s curated themes, settings and story elements used to help describe and discover Christmas movies.</p>
        <p><Endpoint>GET /api/v1/ingredients</Endpoint> lists the vocabulary. <Endpoint>GET /api/v1/ingredients/small-town</Endpoint> returns the ingredient and its movies.</p>
        <CodeBlock>https://xmasdb.com/api/v1/ingredients{`\n`}https://xmasdb.com/api/v1/ingredients/small-town{`\n`}https://xmasdb.com/api/v1/movies?ingredient=small-town</CodeBlock>
      </Section>

      <Section id="api-home-assistant" title="Using XmasDB with Home Assistant">
        <p>This REST sensor asks XmasDB for up to ten Hallmark movies from 2025. The sensor state contains the returned movie count, while the movie data is available as an attribute for dashboards, templates and automations.</p>
        <CodeBlock>{homeAssistantExample}</CodeBlock>
        <p>Home Assistant requests the JSON from XmasDB. XmasDB does not directly control Home Assistant or any media server.</p>
      </Section>

      <Section id="api-examples" title="Other Examples">
        <h3 className="font-heading text-xl font-semibold text-[#1A3D2F]">curl</h3>
        <CodeBlock>{curlExample}</CodeBlock>
        <p>A response contains a <code className="font-mono text-sm">count</code> and a <code className="font-mono text-sm">movies</code> array, using the same movie fields shown above.</p>
        <h3 className="pt-2 font-heading text-xl font-semibold text-[#1A3D2F]">JavaScript</h3>
        <CodeBlock>{javascriptExample}</CodeBlock>
      </Section>

      <Section id="api-use-cases" title="What Can I Build?">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Home Assistant:</strong> show Christmas movie information on a dashboard or use catalogue data in automations.</li>
          <li><strong>Media servers:</strong> use the TMDB and IMDb identifiers to help match curated movies with Plex, Jellyfin, Radarr or personal media tools.</li>
          <li><strong>Personal dashboards:</strong> build Hallmark, Lifetime or GAF watch lists and Christmas movie trackers.</li>
          <li><strong>Discovery:</strong> find movies by year, network, actor or Christmas Ingredient.</li>
          <li><strong>Scripts:</strong> use the JSON from shell scripts, Python, JavaScript or other software.</li>
        </ul>
      </Section>

      <Section id="api-terms" title="API Terms &amp; Attribution">
        <p>XmasDB API data is free to use for personal projects and third-party applications.</p>
        <p>If you use the XmasDB API in a public website, app or service, you must provide clear attribution with a visible link to <a href="https://xmasdb.com/" className="text-[#841818] underline decoration-[#C8BFB3] underline-offset-2 hover:text-[#1A3D2F]">https://xmasdb.com/</a>.</p>
        <p>Suggested attribution:</p>
        <p className="border-l-2 border-[#DCCB9C] pl-4">Christmas movie data provided by <a href="https://xmasdb.com/" className="text-[#841818] underline decoration-[#C8BFB3] underline-offset-2 hover:text-[#1A3D2F]">XmasDB.com</a></p>
        <p>Please do not present XmasDB&apos;s curated catalogue, network classifications or Christmas Ingredients as your own, resell access to the XmasDB API itself, or imply that your project is endorsed by XmasDB.</p>
        <p>XmasDB includes identifiers and information originating from third-party sources such as TMDB and IMDb. Use of those services and their data remains subject to their respective terms.</p>
      </Section>

      <Section id="api-notes" title="Notes">
        <ul className="list-disc space-y-2 pl-6">
          <li>TMDB and IMDb identifiers may help connect records with other services. XmasDB is not a replacement for, or proxy of, TMDB.</li>
          <li>No raw TMDB responses, images, biographies or internal catalogue data are exposed here.</li>
          <li>Invalid filters return HTTP 400. Unknown actors and ingredients return HTTP 404.</li>
        </ul>
      </Section>
    </div>
  </div>
);
