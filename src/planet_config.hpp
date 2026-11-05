// GENERATED from config/planets.js by scripts/gen-config.mjs. Do not edit by hand.
#pragma once
#include <cstddef>
#include <cstdint>

namespace orbiter_config {

constexpr double STAR_RADIUS = 44.0;
constexpr double STAR_MASS = 10000.0;
constexpr uint32_t DEBRIS_LIFETIME_TICKS = 20000.0;
constexpr double DRILL_CRACK_DISTANCE = 45.0;
constexpr uint32_t TICKS_PER_SECOND = 60.0;
constexpr uint32_t SUPERNOVA_RING_TICKS = 120.0;
constexpr double STAR_COLLAPSED_RADIUS = 12.0;
constexpr double STAR_PULL_PER_TICK = 0.08;
constexpr uint32_t VORTEX_DURATION_TICKS = 300.0;
constexpr double VORTEX_RADIUS = 75.0;
constexpr double VORTEX_PULL_PER_TICK = 1.2;

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
constexpr size_t CONDUIT_COUNT = 0;
constexpr double CONDUIT_MAX_LENGTH = 650.0;
constexpr double CONDUIT_AMBER_LENGTH = 455.0;
constexpr double CREDITS_PER_MILLION_POP = 1.0;
constexpr double CREDITS_PER_CONDUIT = 5.0;
constexpr size_t WEAPON_COUNT = 4;

inline constexpr PlanetDef PLANETS[PLANET_COUNT] = {
    { 101u, 300.0, 0.0, 0.005233333333333334, 10.0, 12500000.0, 15.0 }, // Thalassa
    { 102u, 255.0, 2.0, 0.003266666666666667, 11.0, 45000000.0, 12.0 }, // Aeros
    { 103u, 335.0, 3.5, 0.0023333333333333335, 10.0, 8200000.0, 10.0 }, // Ferrum
    { 104u, 420.0, 1.0, 0.00175, 12.0, 2100000.0, 8.0 }, // Kryos
};

inline constexpr WeaponDef WEAPONS[WEAPON_COUNT] = {
    { 1.8 }, // Titan-Buster Thermonuclear Warhead
    { 1.8 }, // Planetary Core-Drill
    { 18.0 }, // Stellar Inversion Needle
    { 2.5 }, // Resonance Singularity Torpedo
};

inline constexpr ConduitDef CONDUITS[CONDUIT_COUNT > 0 ? CONDUIT_COUNT : 1] = {

};

} // namespace orbiter_config
