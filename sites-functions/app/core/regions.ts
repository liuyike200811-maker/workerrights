import { REGIONS } from "../knowledge/data.ts";
import { stripSuffix } from "./util.ts";

export interface DistrictInfo {
  id: string;
  name: string;
  official_code: string | null;
}

export interface CityInfo {
  id: string;
  name: string;
  short: string;
  districts: Record<string, DistrictInfo>;
}

function buildRegionIndex(): Record<string, CityInfo> {
  const index: Record<string, CityInfo> = {};
  for (const city of REGIONS.cities) {
    const info: CityInfo = {
      id: `henan-${city.code}`,
      name: city.name,
      short: stripSuffix(city.name, "市"),
      districts: {},
    };
    city.districts.forEach((district, position) => {
      const name = typeof district === "string" ? district : district[0];
      const code = typeof district === "string" ? null : district[1];
      info.districts[name] = {
        id: `henan-${city.code}-${String(position + 1).padStart(2, "0")}`,
        name,
        official_code: code,
      };
    });
    index[city.name] = info;
  }
  return index;
}

export const REGION_INDEX: Record<string, CityInfo> = buildRegionIndex();

function cityAlias(cityName: string): string[] {
  const short = stripSuffix(cityName, "市");
  const aliases = [cityName];
  if (short && short !== cityName) aliases.push(short);
  return aliases;
}

export function detectLocation(text: string): {
  location_province: string | null;
  location_city: string | null;
  location_district: string | null;
} {
  const result = {
    location_province: null as string | null,
    location_city: null as string | null,
    location_district: null as string | null,
  };
  if (!text) return result;
  if (text.includes("河南")) result.location_province = "河南省";

  let matchedCity: CityInfo | null = null;
  for (const [cityName, cityInfo] of Object.entries(REGION_INDEX)) {
    if (cityAlias(cityName).some((alias) => text.includes(alias))) {
      matchedCity = cityInfo;
      break;
    }
  }
  if (!matchedCity) return result;

  result.location_province = "河南省";
  result.location_city = matchedCity.name;
  const districtHits: Array<[number, string]> = [];
  for (const districtName of Object.keys(matchedCity.districts)) {
    if (text.includes(districtName)) {
      districtHits.push([districtName.length, districtName]);
      continue;
    }
    let short = districtName;
    for (const suffix of ["回族区", "区", "县", "市"]) {
      if (short.endsWith(suffix) && short.length > suffix.length + 1) {
        short = short.slice(0, short.length - suffix.length);
        break;
      }
    }
    if (short !== districtName && short.length >= 2 && text.includes(short)) {
      districtHits.push([short.length, districtName]);
    }
  }
  if (districtHits.length) {
    districtHits.sort((a, b) => (b[0] - a[0]) || (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0));
    result.location_district = districtHits[0][1];
  }
  return result;
}

export function resolveCity(cityName: string | null | undefined): CityInfo | null {
  if (!cityName) return null;
  for (const [name, info] of Object.entries(REGION_INDEX)) {
    if (cityName === name || cityName === stripSuffix(name, "市")) return info;
  }
  return null;
}

export function resolveDistrict(
  cityName: string | null | undefined,
  districtName: string | null | undefined,
): DistrictInfo | null {
  const city = resolveCity(cityName);
  if (!city || !districtName) return null;
  if (districtName in city.districts) return city.districts[districtName];
  for (const [name, info] of Object.entries(city.districts)) {
    if (name.includes(districtName) || districtName.includes(name)) return info;
  }
  return null;
}

export type RegionScope = "henan" | "national";

// Local provisions follow the worksite location: Henan facts unlock Henan
// material, a known non-Henan location restricts to national material, and an
// unknown location falls back to query-text detection (national by default).
export function caseRegionScope(facts: { location_province?: unknown; location_city?: unknown }): RegionScope | null {
  const province = typeof facts.location_province === "string" ? facts.location_province : null;
  const city = typeof facts.location_city === "string" ? facts.location_city : null;
  if ((province && province.includes("河南")) || resolveCity(city)) return "henan";
  if (province || city) return "national";
  return null;
}

const HENAN_HINTS: string[] = ["河南"];
for (const city of REGIONS.cities) {
  HENAN_HINTS.push(city.name);
  const short = stripSuffix(city.name, "市");
  if (short && short !== city.name) HENAN_HINTS.push(short);
}

export function mentionsHenan(text: string): boolean {
  return HENAN_HINTS.some((hint) => text.includes(hint));
}