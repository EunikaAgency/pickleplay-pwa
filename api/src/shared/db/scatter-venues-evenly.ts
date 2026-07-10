import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { connectDb, disconnectDb } from "./index.js";
import { Venue } from "../../features/venues/venues.model.js";

type VenueRow = {
  _id: unknown;
  displayName: string;
  slug: string;
};

type SeedRow = {
  lat: number;
  lng: number;
  fullAddress: string;
};

type ParsedSeed = SeedRow & {
  area: string;
  cityName: string;
  region: string;
  country: string;
  addressLine1: string;
  googleMapsUrl: string;
};

const SEED_FILE_URL = new URL("../../../../luzon_location_seed_lat_lng_address.json", import.meta.url);
const DINK_SLUG = "the-dink-lab";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function parseSeedRow(row: SeedRow): ParsedSeed {
  const parts = row.fullAddress.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 4) {
    throw new Error(`Invalid seed fullAddress: ${row.fullAddress}`);
  }

  const area = parts[0]!;
  const cityName = parts[1]!;
  const region = parts[2]!;
  const country = parts[parts.length - 1]!;

  return {
    ...row,
    area,
    cityName,
    region,
    country,
    addressLine1: `${area}, ${cityName}`,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`,
  };
}

function loadSeeds(): ParsedSeed[] {
  const raw = readFileSync(SEED_FILE_URL, "utf8");
  const data = JSON.parse(raw) as SeedRow[];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Seed file is empty or invalid");
  }
  return data.map(parseSeedRow);
}

async function main() {
  await connectDb();

  const backup = await Venue.find({})
    .select("_id slug displayName lat lng cityName area region fullAddress googleMapsUrl")
    .lean() as any[];

  writeFileSync(
    new URL("./scatter-venues-evenly.backup.json", import.meta.url).pathname,
    JSON.stringify(backup.map((v) => ({
      id: String(v._id),
      slug: v.slug,
      displayName: v.displayName,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      cityName: v.cityName ?? null,
      area: v.area ?? null,
      region: v.region ?? null,
      fullAddress: v.fullAddress ?? null,
      googleMapsUrl: v.googleMapsUrl ?? null,
    })), null, 2),
  );

  const dink = await Venue.findOne({ slug: DINK_SLUG })
    .select("_id displayName slug lat lng cityName area region fullAddress")
    .lean() as any;

  if (!dink) throw new Error("The Dink Lab not found");

  const venues = await Venue.find({ slug: { $ne: DINK_SLUG } })
    .sort({ _id: 1 })
    .select("_id displayName slug")
    .lean() as VenueRow[];

  const seeds = shuffle(loadSeeds());
  if (seeds.length < venues.length) {
    throw new Error(`Not enough seed rows: have ${seeds.length}, need ${venues.length}`);
  }

  const shuffledVenues = shuffle(venues);
  const assignments = shuffledVenues.map((venue, index) => ({
    venue,
    seed: seeds[index]!,
  }));

  for (const { venue, seed } of assignments) {
    await Venue.updateOne(
      { _id: venue._id },
      {
        $set: {
          lat: seed.lat,
          lng: seed.lng,
          country: seed.country,
          cityName: seed.cityName,
          area: seed.area,
          region: seed.region,
          addressLine1: seed.addressLine1,
          fullAddress: seed.fullAddress,
          googleMapsUrl: seed.googleMapsUrl,
        },
        $unset: { cityId: 1 },
      },
    );
  }

  console.log(JSON.stringify({
    moved: assignments.length,
    seedsUsed: assignments.length,
    seedsAvailable: seeds.length,
    dink: {
      displayName: dink.displayName,
      slug: dink.slug,
      cityName: dink.cityName,
      area: dink.area,
      region: dink.region,
      fullAddress: dink.fullAddress,
      lat: dink.lat,
      lng: dink.lng,
    },
    sample: assignments.slice(0, 5).map(({ venue, seed }) => ({
      venue: venue.displayName,
      slug: venue.slug,
      cityName: seed.cityName,
      area: seed.area,
      region: seed.region,
      lat: seed.lat,
      lng: seed.lng,
    })),
  }, null, 2));

  await disconnectDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
