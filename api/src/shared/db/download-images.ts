// Pickleballers API — Image downloader
// Fetches venue JPEGs from the Google Drive URLs in venues.csv and saves them
// to real-data/handoff/images/venues/<slug>/<filename> using the canonical
// filenames from venue_images.csv. Run BEFORE `npm run db:import` so the
// importer can mirror the result into uploads/.
//
// Usage: npm run db:download-images
//        DRY_RUN=1 npm run db:download-images
//        FORCE=1   npm run db:download-images   (re-download even if file exists)

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../../');
const handoffDir = path.join(apiRoot, 'real-data/handoff');
const imagesRoot = path.join(handoffDir, 'images');

const DRY_RUN = process.env.DRY_RUN === '1';
const FORCE = process.env.FORCE === '1';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);

type Row = Record<string, string>;

function readCsv(file: string): Row[] {
  const p = path.join(handoffDir, file);
  if (!fs.existsSync(p)) return [];
  return parse(fs.readFileSync(p, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true }) as Row[];
}

function extractDriveId(url: string): string | null {
  if (!url) return null;
  // Matches /file/d/<ID>/ and ?id=<ID>
  const m = url.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/) || url.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  return m ? m[1]! : null;
}

function pipeList(v: string | undefined): string[] {
  if (!v) return [];
  return v.split('|').map((x) => x.trim()).filter(Boolean);
}

interface DownloadJob {
  slug: string;
  driveUrl: string;
  driveId: string;
  destAbs: string;
  expectedBytes?: number;
}

async function downloadOne(job: DownloadJob): Promise<{ ok: boolean; reason?: string; bytes?: number }> {
  // Skip if exists and not forced; if size hint matches, definitely skip.
  if (!FORCE && fs.existsSync(job.destAbs)) {
    const have = fs.statSync(job.destAbs).size;
    if (!job.expectedBytes || have === job.expectedBytes) {
      return { ok: true, reason: 'skip-exists', bytes: have };
    }
  }

  if (DRY_RUN) return { ok: true, reason: 'dry-run' };

  // Google Drive: hit the export=download endpoint, follow redirects.
  const url = `https://drive.google.com/uc?export=download&id=${job.driveId}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };

    const buf = Buffer.from(await res.arrayBuffer());

    // Heuristic: Drive returns an HTML interstitial for large/virus-scan files.
    // JPEG starts with FFD8 FF; PNG with 89 50 4E 47.
    const isImage =
      (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
      (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47);

    if (!isImage) {
      // Try once more honouring the confirmation token in cookies/page if present.
      const text = buf.subarray(0, 4096).toString('utf-8');
      const confirmMatch = text.match(/confirm=([0-9A-Za-z_-]+)/);
      if (confirmMatch) {
        const url2 = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${job.driveId}`;
        const res2 = await fetch(url2, { redirect: 'follow' });
        if (!res2.ok) return { ok: false, reason: `http-${res2.status}` };
        const buf2 = Buffer.from(await res2.arrayBuffer());
        const isImage2 =
          (buf2[0] === 0xff && buf2[1] === 0xd8 && buf2[2] === 0xff) ||
          (buf2[0] === 0x89 && buf2[1] === 0x50 && buf2[2] === 0x4e && buf2[3] === 0x47);
        if (!isImage2) return { ok: false, reason: 'not-image-after-confirm' };
        fs.mkdirSync(path.dirname(job.destAbs), { recursive: true });
        fs.writeFileSync(job.destAbs, buf2);
        return { ok: true, bytes: buf2.length };
      }
      return { ok: false, reason: 'not-image' };
    }

    fs.mkdirSync(path.dirname(job.destAbs), { recursive: true });
    fs.writeFileSync(job.destAbs, buf);
    return { ok: true, bytes: buf.length };
  } catch (e: any) {
    return { ok: false, reason: `error:${e.message || 'unknown'}` };
  }
}

async function run() {
  console.log(`🚀 Image downloader`);
  console.log(`   handoff:    ${handoffDir}`);
  console.log(`   target:     ${imagesRoot}`);
  console.log(`   DRY_RUN=${DRY_RUN} FORCE=${FORCE} CONCURRENCY=${CONCURRENCY}\n`);

  const venuesCsv = readCsv('venues.csv');
  const imagesCsv = readCsv('venue_images.csv');

  // Build canonical filename list per venue from venue_images.csv.
  const byVenue = new Map<string, { web_path: string; filename: string; role: string; position: number; bytes?: number }[]>();
  for (const img of imagesCsv) {
    const slug = img.venue_slug;
    if (!slug) continue;
    if (!byVenue.has(slug)) byVenue.set(slug, []);
    byVenue.get(slug)!.push({
      web_path: img.web_path || '',
      filename: img.filename || '',
      role: img.role || 'gallery',
      position: parseInt(img.position || '0', 10) || 0,
      bytes: img.bytes ? parseInt(img.bytes, 10) : undefined,
    });
  }
  // Sort: hero first (position 0), then gallery by position.
  for (const list of byVenue.values()) {
    list.sort((a, b) => {
      if (a.role === 'hero' && b.role !== 'hero') return -1;
      if (b.role === 'hero' && a.role !== 'hero') return 1;
      return a.position - b.position;
    });
  }

  // Build download jobs by pairing each venue's Drive URLs to the canonical
  // filename list in order.
  const jobs: DownloadJob[] = [];
  let noManifest = 0;
  let noUrls = 0;

  for (const v of venuesCsv) {
    const slug = v.slug;
    if (!slug) continue;
    const manifest = byVenue.get(slug);
    if (!manifest || manifest.length === 0) { noManifest++; continue; }

    const urls: string[] = [];
    const main = v.main_image_url;
    if (main) urls.push(main);
    urls.push(...pipeList(v.gallery_image_urls));

    if (urls.length === 0) { noUrls++; continue; }

    const n = Math.min(urls.length, manifest.length);
    for (let i = 0; i < n; i++) {
      const u = urls[i]!;
      const m = manifest[i]!;
      const id = extractDriveId(u);
      if (!id) continue;
      jobs.push({
        slug,
        driveUrl: u,
        driveId: id,
        destAbs: path.join(handoffDir, m.web_path),
        expectedBytes: m.bytes,
      });
    }
  }

  console.log(`  Plan: ${jobs.length} downloads across ${byVenue.size} venues  (${noManifest} venues had no image manifest, ${noUrls} had no Drive URLs)\n`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  const failures: { slug: string; reason: string }[] = [];

  // Simple bounded concurrency
  let idx = 0;
  async function worker(workerId: number) {
    while (idx < jobs.length) {
      const myIdx = idx++;
      const job = jobs[myIdx]!;
      const result = await downloadOne(job);
      if (result.ok) {
        if (result.reason === 'skip-exists') skipped++;
        else copied++;
      } else {
        failed++;
        failures.push({ slug: job.slug, reason: result.reason || 'unknown' });
      }
      if ((myIdx + 1) % 25 === 0 || myIdx === jobs.length - 1) {
        const pct = Math.round(((myIdx + 1) / jobs.length) * 100);
        process.stdout.write(`  ${myIdx + 1}/${jobs.length} (${pct}%) — copied=${copied} skipped=${skipped} failed=${failed}\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  process.stdout.write('\n');

  console.log(`\n✅ Done. copied=${copied} skipped=${skipped} failed=${failed} (of ${jobs.length})`);
  if (failed > 0 && failures.length > 0) {
    const grouped = new Map<string, number>();
    for (const f of failures) grouped.set(f.reason, (grouped.get(f.reason) || 0) + 1);
    console.log('\n  Failure reasons:');
    for (const [reason, count] of [...grouped.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${count.toString().padStart(4)} × ${reason}`);
    }
    console.log('\n  Sample failures:');
    for (const f of failures.slice(0, 5)) console.log(`    ${f.slug}: ${f.reason}`);
  }
  console.log('\n  Next: run `npm run db:import` to mirror real-data/handoff/images → uploads/images.');
}

run().catch((e) => {
  console.error('❌ Downloader failed:', e);
  process.exit(1);
});
