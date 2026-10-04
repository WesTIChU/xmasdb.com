import { getBrandById } from '../data/brands';
import { buildCalendarPayload } from './catalogue-api';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = 48;
const CONTENT_RIGHT = PAGE_WIDTH - RIGHT;
const NETWORK_RIGHT = CONTENT_RIGHT;
const NETWORK_WIDTH = 92;
const TITLE_LEFT = 78;
const TITLE_RIGHT = CONTENT_RIGHT - NETWORK_WIDTH - 18;
const TITLE_WIDTH = TITLE_RIGHT - TITLE_LEFT;
const COLORS = {
  cream: '0.988 0.976 0.949',
  forest: '0.102 0.239 0.184',
  red: '0.518 0.094 0.094',
  gold: '0.722 0.533 0.043',
  rule: '0.855 0.820 0.769',
  muted: '0.380 0.345 0.306',
};

interface PdfMovie {
  title: string;
  network: string;
  dateKey: string | null;
}

interface PdfGroup {
  dateKey: string | null;
  label: string;
  movies: PdfMovie[];
}

interface PdfPage {
  groups: PdfGroup[];
  continuation: boolean;
}

function pdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function dateText(dateKey: string | null): string {
  if (!dateKey) return 'DATE TBA';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day))).toUpperCase();
}

// Helvetica is a built-in PDF font. This conservative width estimate keeps
// wrapping safely inside the title column without needing a font dependency.
function textWidth(value: string, fontSize: number): number {
  return value.length * fontSize * 0.51;
}

function wrapText(value: string, maxWidth: number, fontSize: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function circlePath(cx: number, cy: number, radius: number): string {
  const k = radius * 0.5522848;
  return `${(cx + radius).toFixed(2)} ${cy.toFixed(2)} m ${(cx + radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + radius).toFixed(2)} ${cx.toFixed(2)} ${(cy + radius).toFixed(2)} c ${(cx - k).toFixed(2)} ${(cy + radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} c ${(cx - radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - radius).toFixed(2)} ${cx.toFixed(2)} ${(cy - radius).toFixed(2)} c ${(cx + k).toFixed(2)} ${(cy - radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + radius).toFixed(2)} ${cy.toFixed(2)} c f`;
}

function groupRows(group: PdfGroup): Array<{ movie: PdfMovie; lines: string[]; height: number }> {
  return group.movies.map((movie) => {
    const lines = wrapText(movie.title, TITLE_WIDTH, 10.2);
    return { movie, lines, height: Math.max(27, lines.length * 12 + 11) };
  });
}

function groupHeight(group: PdfGroup): number {
  return 31 + groupRows(group).reduce((sum, row) => sum + row.height, 0) + 13;
}

function paginate(groups: PdfGroup[]): PdfPage[] {
  const pages: PdfPage[] = [];
  let page: PdfPage = { groups: [], continuation: false };
  let used = 0;
  const firstLimit = 610;
  const otherLimit = 688;
  groups.forEach((group) => {
    const limit = pages.length === 0 ? firstLimit : otherLimit;
    const remaining = limit - used;
    if (page.groups.length && groupHeight(group) > remaining) {
      pages.push(page);
      page = { groups: [], continuation: true };
      used = 0;
    }

    // A very large group can still flow, but normal date groups always keep
    // their heading and first row together because the break happens here.
    const rows = groupRows(group);
    if (groupHeight(group) <= (pages.length === 0 ? firstLimit : otherLimit)) {
      page.groups.push(group);
      used += groupHeight(group);
      return;
    }

    let chunk: PdfGroup = { ...group, movies: [] };
    rows.forEach((row) => {
      if (chunk.movies.length && 31 + groupRows(chunk).reduce((sum, item) => sum + item.height, 0) + row.height > otherLimit) {
        page.groups.push(chunk);
        pages.push(page);
        page = { groups: [], continuation: true };
        chunk = { ...group, label: `${group.label} (continued)`, movies: [] };
      }
      chunk.movies.push(row.movie);
    });
    if (chunk.movies.length) {
      page.groups.push(chunk);
      used = groupHeight(chunk);
    }
  });
  if (page.groups.length || !pages.length) pages.push(page);
  return pages;
}

function drawHeader(commands: string[], year: number, continuation: boolean): number {
  if (continuation) {
    commands.push(`${COLORS.cream} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
    commands.push(`${COLORS.forest} rg`, `BT /F2 10 Tf ${LEFT} 795 Td (XmasDB) Tj /F1 8 Tf 60 0 Td (${year} CHRISTMAS MOVIE CHECKLIST) Tj ET`);
    commands.push(`${COLORS.gold} RG 0.8 w ${LEFT} 780 m ${CONTENT_RIGHT} 780 l S`);
    return 748;
  }
  commands.push(`${COLORS.cream} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
  commands.push(`${COLORS.forest} rg`, `BT /F2 21 Tf ${LEFT} 780 Td (XmasDB) Tj ET`);
  commands.push(`${COLORS.red} rg`, `BT /F2 14 Tf ${LEFT} 753 Td (${year} CHRISTMAS MOVIE CHECKLIST) Tj ET`);
  commands.push(`${COLORS.muted} rg`, `BT /F1 9 Tf ${LEFT} 735 Td (Hallmark  |  Lifetime  |  Great American Family  |  UPtv) Tj ET`);
  // A light divider with two holly leaves and berries: festive, but low-ink.
  commands.push(`${COLORS.gold} RG 0.8 w ${LEFT} 716 m ${CONTENT_RIGHT} 716 l S`);
  commands.push(`${COLORS.forest} RG 1 w 67 719 m 76 724 l 84 719 l S 0.52 0.08 0.08 rg ${circlePath(78, 721, 2.5)} ${circlePath(85, 721, 2.5)}`);
  commands.push(`${COLORS.muted} rg`, `BT /F1 8.5 Tf ${LEFT} 694 Td (Tick them off as you watch.) Tj ET`);
  return 670;
}

function drawGroup(commands: string[], group: PdfGroup, yStart: number): number {
  let y = yStart;
  commands.push(`${COLORS.red} rg`, `BT /F2 10 Tf ${LEFT} ${y} Td (${pdfText(group.label)}) Tj ET`);
  y -= 15;
  commands.push(`${COLORS.gold} RG 0.55 w ${LEFT} ${y} m ${CONTENT_RIGHT} ${y} l S`);
  y -= 7;
  groupRows(group).forEach(({ movie, lines, height }) => {
    const center = y - height / 2;
    const checkboxY = center - 6;
    commands.push(`${COLORS.forest} RG 1 w ${LEFT} ${checkboxY.toFixed(2)} 12 12 re S`);
    const titleY = y - 14;
    commands.push(`${COLORS.forest} rg`);
    lines.forEach((line, index) => commands.push(`BT /F1 10.2 Tf ${TITLE_LEFT} ${(titleY - index * 12).toFixed(2)} Td (${pdfText(line)}) Tj ET`));
    const network = movie.network;
    const networkX = NETWORK_RIGHT - textWidth(network, 9.2);
    commands.push(`${COLORS.muted} rg`, `BT /F1 9.2 Tf ${networkX.toFixed(2)} ${(center - 3).toFixed(2)} Td (${pdfText(network)}) Tj ET`);
    y -= height;
    commands.push(`${COLORS.rule} RG 0.35 w ${LEFT} ${(y + 3).toFixed(2)} m ${CONTENT_RIGHT} ${(y + 3).toFixed(2)} l S`);
  });
  return y - 13;
}

function buildGroups(year: number, network?: string): PdfGroup[] {
  const payload = buildCalendarPayload();
  const movies: PdfMovie[] = payload.movies
    .filter((movie) => (movie.dateKey ? Number(movie.dateKey.slice(0, 4)) === year : movie.year === year) && (!network || movie.brandId === network))
    .sort((a, b) => (a.dateKey || '9999-99-99').localeCompare(b.dateKey || '9999-99-99') || a.title.localeCompare(b.title))
    .map((movie) => ({
      title: movie.title,
      network: getBrandById(movie.brandId)?.shortName || movie.brandId,
      dateKey: movie.dateKey,
    }));
  const groups = new Map<string, PdfMovie[]>();
  movies.forEach((movie) => groups.set(movie.dateKey || 'tba', [...(groups.get(movie.dateKey || 'tba') || []), movie]));
  return [...groups.entries()].map(([dateKey, entries]) => ({ dateKey: dateKey === 'tba' ? null : dateKey, label: dateText(dateKey === 'tba' ? null : dateKey), movies: entries }));
}

function buildPageContent(page: PdfPage, year: number, pageNumber: number, totalPages: number): string {
  const commands: string[] = [];
  let y = drawHeader(commands, year, page.continuation);
  page.groups.forEach((group) => { y = drawGroup(commands, group, y); });
  commands.push(`${COLORS.rule} RG 0.45 w ${LEFT} 40 m ${CONTENT_RIGHT} 40 l S`);
  commands.push(`${COLORS.muted} rg`, `BT /F1 7.8 Tf ${LEFT} 26 Td (xmasdb.com/calendar/  |  A printable XmasDB season guide) Tj ET`);
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  commands.push(`BT /F1 7.8 Tf ${(CONTENT_RIGHT - textWidth(pageLabel, 7.8)).toFixed(2)} 26 Td (${pageLabel}) Tj ET`);
  return commands.join('\n');
}

export function buildCalendarPdf(year: number, network?: string): Buffer {
  const pages = paginate(buildGroups(year, network));
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObject = add('');
  const regularFont = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const headingFont = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageRefs: number[] = [];
  pages.forEach((page, index) => {
    const stream = buildPageContent(page, year, index + 1, pages.length);
    const contentRef = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    pageRefs.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${headingFont} 0 R >> >> /Contents ${contentRef} 0 R >>`));
  });
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
