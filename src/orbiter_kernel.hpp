// Orbiter: Stellar Conquest - high-tick simulation kernel.
// Structure-of-arrays state, fixed-capacity buffers, no allocation on the tick path.
// Body definitions come from planet_config.hpp (generated from config/planets.js).
#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>

#include "planet_config.hpp"

namespace orbiter {

constexpr double PI = 3.14159265358979323846;
constexpr double TWO_PI = 2.0 * PI;
constexpr double DEG_TO_RAD = PI / 180.0;

constexpr size_t MAX_PLANETS = 64;
constexpr size_t MAX_CONDUITS = 256;
constexpr size_t MAX_MISSILES = 128;
constexpr size_t MAX_ASTEROIDS = 1024;

static_assert(orbiter_config::PLANET_COUNT <= MAX_PLANETS, "too many planets in config");
static_assert(orbiter_config::CONDUIT_COUNT <= MAX_CONDUITS, "too many conduits in config");
static_assert(orbiter_config::WEAPON_COUNT == 4, "WeaponClass and WEAPONS table out of step");

enum class WorldStatus : uint8_t {
    ACTIVE_PRISTINE = 0,
    GLASSED_IRRADIATED = 1,
    FRACTURED_DEBRIS = 2,
    BLACK_HOLE_COLLAPSED = 3,
    CRACKING_STAGE1 = 4,  // drill within DRILL_CRACK_DISTANCE; visual only, ends at impact
};

enum class WeaponClass : uint8_t {
    THERMONUCLEAR_ICBM = 0,
    PLANET_CRACKER_DRILL = 1,
    STARKILLER_NEEDLE = 2,
    SINGULARITY_TORPEDO = 3,
};

struct StellarSystemState {
    double star_x{0.0};
    double star_y{0.0};
    double star_radius{orbiter_config::STAR_RADIUS};
    double star_mass{orbiter_config::STAR_MASS};
    bool star_destabilized{false};
    bool star_supernova_triggered{false};
    uint32_t star_blast_ticks_left{0};   // stage 1: supernova ring
    bool star_collapsed{false};          // stage 2: black hole, pulls planets inward

    size_t planet_count{0};
    uint32_t planet_id[MAX_PLANETS];
    double planet_orbit_radius[MAX_PLANETS];
    double planet_angle[MAX_PLANETS];
    double planet_speed[MAX_PLANETS];
    double planet_x[MAX_PLANETS];
    double planet_y[MAX_PLANETS];
    double planet_radius[MAX_PLANETS];
    double planet_population[MAX_PLANETS];
    double planet_yield_rate[MAX_PLANETS];   // output per second
    double planet_gain_total[MAX_PLANETS];   // output siphoned through conduits since reset
    uint8_t planet_flow[MAX_PLANETS];        // 0 = not siphoned this tick, 1 = flowing, 3 = harmonic surge
    WorldStatus planet_status[MAX_PLANETS];
    uint32_t planet_vortex_ticks_left[MAX_PLANETS];  // singularity vortex pull

    size_t conduit_count{0};
    uint32_t conduit_source[MAX_CONDUITS];
    uint32_t conduit_target[MAX_CONDUITS];
    double conduit_max_length[MAX_CONDUITS];
    double conduit_current_length[MAX_CONDUITS];
    bool conduit_occluded[MAX_CONDUITS];
    bool conduit_snapped[MAX_CONDUITS];
    double conduit_throughput[MAX_CONDUITS];
    bool conduit_harmonic_surge[MAX_CONDUITS];

    size_t missile_count{0};
    WeaponClass missile_type[MAX_MISSILES];
    double missile_x[MAX_MISSILES];
    double missile_y[MAX_MISSILES];
    double missile_vx[MAX_MISSILES];
    double missile_vy[MAX_MISSILES];
    double missile_speed[MAX_MISSILES];
    int32_t missile_target_planet[MAX_MISSILES]; // -1 for central star
    bool missile_active[MAX_MISSILES];

    size_t asteroid_count{0};
    double asteroid_x[MAX_ASTEROIDS];
    double asteroid_y[MAX_ASTEROIDS];
    double asteroid_vx[MAX_ASTEROIDS];
    double asteroid_vy[MAX_ASTEROIDS];
    uint32_t asteroid_ttl[MAX_ASTEROIDS]; // ticks left before the debris expires
};

// True if the segment (x1,y1)-(x2,y2) passes within radius r of (cx,cy).
inline bool CheckCircleSegmentIntersection(double x1, double y1, double x2, double y2,
                                           double cx, double cy, double r) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    double len_sq = dx * dx + dy * dy;
    if (len_sq < 1e-6) return false;

    double t = ((cx - x1) * dx + (cy - y1) * dy) / len_sq;
    t = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);
    double px = x1 + t * dx;
    double py = y1 + t * dy;
    double dist_sq = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    return dist_sq <= r * r;
}

// Results of AddConduit that are below zero.
constexpr int32_t CONDUIT_ERR_BAD_PLANET = -1;  // self link, unknown planet, or a destroyed world
constexpr int32_t CONDUIT_ERR_DUPLICATE = -2;   // the pair is already linked
constexpr int32_t CONDUIT_ERR_TOO_LONG = -3;    // would snap at once
constexpr int32_t CONDUIT_ERR_OCCLUDED = -4;    // the dying star is in the way
constexpr int32_t CONDUIT_ERR_FULL = -5;

class OrbiterSimulationEngine {
public:
    OrbiterSimulationEngine();

    void InitFromConfig();
    void UpdateTick();
    void CheckSyzygyAlignments();
    void LaunchSuperweapon(WeaponClass type, double origin_x, double origin_y, int32_t target_planet_idx);
    void UpdateProjectiles();
    void ExecuteImpact(size_t missile_idx, int32_t planet_idx);
    void SpawnDebrisRing(double cx, double cy, size_t count);
    void UpdateDebris();

    // Player conduits. Returns the new conduit's index, or a CONDUIT_ERR_* code below zero.
    int32_t AddConduit(uint32_t source, uint32_t target);
    // Removes a conduit by moving the last one into its slot. Returns 0, or -1 if there is no such conduit.
    int32_t RemoveConduit(uint32_t index);
    void UpdateStar();
    void RunBenchmark(uint64_t total_ticks);

    uint64_t tick() const { return current_tick; }
    const StellarSystemState& GetState() const { return state; }

private:
    StellarSystemState state;
    uint64_t current_tick{0};
    double syzygy_tolerance_rad{5.0 * DEG_TO_RAD};
};

} // namespace orbiter
