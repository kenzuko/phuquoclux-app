import type { MapEntity } from "./catalog";
import type { BoundingBox } from "./discovery";

const MIN_PAD = 0.012;

export function boundsForEntities(
  entities: readonly MapEntity[],
): BoundingBox | undefined {
  if (!entities.length) return undefined;

  let west = entities[0].lng;
  let east = entities[0].lng;
  let south = entities[0].lat;
  let north = entities[0].lat;

  for (const entity of entities.slice(1)) {
    west = Math.min(west, entity.lng);
    east = Math.max(east, entity.lng);
    south = Math.min(south, entity.lat);
    north = Math.max(north, entity.lat);
  }

  const width = east - west;
  const height = north - south;
  const lngPad = Math.max(MIN_PAD, width * 0.18);
  const latPad = Math.max(MIN_PAD, height * 0.18);

  return {
    west: west - lngPad,
    south: south - latPad,
    east: east + lngPad,
    north: north + latPad,
  };
}
