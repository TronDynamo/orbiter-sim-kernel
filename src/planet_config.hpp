// GENERATED from config/planets.js by scripts/gen-config.mjs. Do not edit by hand.
#pragma once
#include <cstddef>
#include <cstdint>

namespace orbiter_config {

constexpr double STAR_RADIUS = 45.0;
constexpr double STAR_MASS = 10000.0;
constexpr uint32_t DEBRIS_LIFETIME_TICKS = 20000.0;
constexpr double DRILL_CRACK_DISTANCE = 45.0;
constexpr uint32_t TICKS_PER_SECOND = 60.0;
constexpr uint32_t SUPERNOVA_RING_TICKS = 120.0;
constexpr double STAR_COLLAPSED_RADIUS = 8.0;
constexpr double STAR_PULL_PER_TICK = 0.002;
constexpr uint32_t VORTEX_DURATION_TICKS = 300.0;
constexpr double VORTEX_RADIUS = 60.0;
constexpr double VORTEX_PULL_PER_TICK = 0.5;

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

constexpr size_t PLANET_COUNT = 4;
constexpr size_t CONDUIT_COUNT = 1;
constexpr size_t WEAPON_COUNT = 4;

inline constexpr PlanetDef PLANETS[PLANET_COUNT] = {
    { 101u, 110.0, 0.0, 0.00035, 14.0, 12500000.0, 25.0 }, // Aureus Prime
    { 102u, 190.0, 1.2, 0.00021, 18.0, 45000000.0, 18.0 }, // Verdant Hub
    { 103u, 270.0, 3.1, 0.00014, 16.0, 8200000.0, 12.0 }, // Ferrum Ridge
    { 104u, 360.0, 4.8, 0.00008, 22.0, 2100000.0, 8.0 }, // Kryos Vault
};

inline constexpr WeaponDef WEAPONS[WEAPON_COUNT] = {
    { 1.8 }, // Titan-Buster Thermonuclear Warhead
    { 0.9 }, // Planetary Core-Drill
    { 18.0 }, // Stellar Inversion Needle
    { 2.5 }, // Resonance Singularity Torpedo
};

inline constexpr ConduitDef CONDUITS[CONDUIT_COUNT] = {
    { 0u, 1u, 320.0, 100.0 },
};

} // namespace orbiter_config
