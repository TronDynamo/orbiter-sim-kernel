// Generates src/planet_config.hpp from config/planets.js. Do not edit the header by hand.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STAR, PLANETS, CONDUITS, CONDUIT_RULES, CREDIT_RULES, DEBRIS, WEAPONS, DRILL_CRACK_DISTANCE, TICKS_PER_SECOND, STAR_COLLAPSE, VORTEX } from '../config/planets.js';

const lit = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
const indexOf = (key) => {
  const i = PLANETS.findIndex((p) => p.key === key);
  if (i < 0) throw new Error(`conduit references unknown planet "${key}"`);
  return i;
};

const weaponRows = WEAPONS.map((w) => `    { ${lit(w.speed)} }, // ${w.name}`).join('\n');
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
constexpr double DRILL_CRACK_DISTANCE = ${lit(DRILL_CRACK_DISTANCE)};
constexpr uint32_t TICKS_PER_SECOND = ${lit(TICKS_PER_SECOND)};
constexpr uint32_t SUPERNOVA_RING_TICKS = ${lit(STAR_COLLAPSE.ringTicks)};
constexpr double STAR_COLLAPSED_RADIUS = ${lit(STAR_COLLAPSE.collapsedRadius)};
constexpr double STAR_PULL_PER_TICK = ${lit(STAR_COLLAPSE.pullPerTick)};
constexpr uint32_t VORTEX_DURATION_TICKS = ${lit(VORTEX.durationTicks)};
constexpr double VORTEX_RADIUS = ${lit(VORTEX.radius)};
constexpr double VORTEX_PULL_PER_TICK = ${lit(VORTEX.pullPerTick)};

struct PlanetDef {
    uint32_t id;
    double orbit_radius;
    double angle;        // radians at tick 0
    double speed;        // radians per tick
    double radius;
    double population;
    double yield_rate;
};

struct WeaponDef {
    double speed;        // world units per tick
};

struct ConduitDef {
    uint32_t source;     // index into PLANETS
    uint32_t target;
    double max_length;
    double throughput;
};

constexpr size_t PLANET_COUNT = ${PLANETS.length};
constexpr size_t CONDUIT_COUNT = ${CONDUITS.length};
constexpr double CONDUIT_MAX_LENGTH = ${lit(CONDUIT_RULES.maxLength)};
constexpr double CONDUIT_AMBER_LENGTH = ${lit(CONDUIT_RULES.amberLength)};
constexpr double CREDITS_PER_MILLION_POP = ${lit(CREDIT_RULES.perMillionPopPerSecond)};
constexpr double CREDITS_PER_CONDUIT = ${lit(CREDIT_RULES.perConduitPerSecond)};
constexpr size_t WEAPON_COUNT = ${WEAPONS.length};

inline constexpr PlanetDef PLANETS[PLANET_COUNT] = {
${planetRows}
};

inline constexpr WeaponDef WEAPONS[WEAPON_COUNT] = {
${weaponRows}
};

inline constexpr ConduitDef CONDUITS[CONDUIT_COUNT > 0 ? CONDUIT_COUNT : 1] = {
${conduitRows}
};

} // namespace orbiter_config
`;

const target = fileURLToPath(new URL('../src/planet_config.hpp', import.meta.url));
writeFileSync(target, out);
console.log(`wrote ${target} (${PLANETS.length} planets, ${CONDUITS.length} conduits)`);
