// Generates src/planet_config.hpp from config/planets.js. Do not edit the header by hand.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STAR, PLANETS, CONDUITS, DEBRIS } from '../config/planets.js';

const lit = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
const indexOf = (key) => {
  const i = PLANETS.findIndex((p) => p.key === key);
  if (i < 0) throw new Error(`conduit references unknown planet "${key}"`);
  return i;
};

const planetRows = PLANETS.map((p) =>
  `    { ${p.id}u, ${lit(p.orbit)}, ${lit(p.angle)}, ${lit(p.speed)}, ${lit(p.r)}, ${lit(p.population)}, ${lit(p.yield)} }, // ${p.name}`
).join('\n');
const conduitRows = CONDUITS.map((c) =>
  `    { ${indexOf(c.source)}u, ${indexOf(c.target)}u, ${lit(c.maxLength)}, ${lit(c.throughput)} },`
).join('\n');

const out = `// GENERATED from config/planets.js by scripts/gen-config.mjs. Do not edit by hand.
#pragma once
#include <cstddef>
#include <cstdint>

namespace orbiter_config {

constexpr double STAR_RADIUS = ${lit(STAR.radius)};
constexpr double STAR_MASS = ${lit(STAR.mass)};
constexpr uint32_t DEBRIS_LIFETIME_TICKS = ${lit(DEBRIS.lifetimeTicks)};

struct PlanetDef {
    uint32_t id;
    double orbit_radius;
    double angle;        // radians at tick 0
    double speed;        // radians per tick
    double radius;
    double population;
    double yield_rate;
};

struct ConduitDef {
    uint32_t source;     // index into PLANETS
    uint32_t target;
    double max_length;
    double throughput;
};

constexpr size_t PLANET_COUNT = ${PLANETS.length};
constexpr size_t CONDUIT_COUNT = ${CONDUITS.length};

inline constexpr PlanetDef PLANETS[PLANET_COUNT] = {
${planetRows}
};

inline constexpr ConduitDef CONDUITS[CONDUIT_COUNT] = {
${conduitRows}
};

} // namespace orbiter_config
`;

const target = fileURLToPath(new URL('../src/planet_config.hpp', import.meta.url));
writeFileSync(target, out);
console.log(`wrote ${target} (${PLANETS.length} planets, ${CONDUITS.length} conduits)`);
