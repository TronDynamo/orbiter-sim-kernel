#include "orbiter_kernel.hpp"

#include <algorithm>
#include <chrono>
#include <iostream>

namespace orbiter {

OrbiterSimulationEngine::OrbiterSimulationEngine() { InitFromConfig(); }

void OrbiterSimulationEngine::InitFromConfig() {
    using namespace orbiter_config;
    state = StellarSystemState{};
    state.star_x = 0.0;
    state.star_y = 0.0;
    state.star_radius = STAR_RADIUS;
    state.star_mass = STAR_MASS;

    state.planet_count = PLANET_COUNT;
    for (size_t i = 0; i < PLANET_COUNT; ++i) {
        const PlanetDef& p = PLANETS[i];
        state.planet_id[i] = p.id;
        state.planet_orbit_radius[i] = p.orbit_radius;
        state.planet_angle[i] = p.angle;
        state.planet_speed[i] = p.speed;
        state.planet_radius[i] = p.radius;
        state.planet_population[i] = p.population;
        state.planet_yield_rate[i] = p.yield_rate;
        state.planet_status[i] = WorldStatus::ACTIVE_PRISTINE;
    }

    state.conduit_count = CONDUIT_COUNT;
    for (size_t c = 0; c < CONDUIT_COUNT; ++c) {
        const ConduitDef& d = CONDUITS[c];
        state.conduit_source[c] = d.source;
        state.conduit_target[c] = d.target;
        state.conduit_max_length[c] = d.max_length;
        state.conduit_throughput[c] = d.throughput;
    }

    state.missile_count = 0;
    state.asteroid_count = 0;
}

void OrbiterSimulationEngine::UpdateTick() {
    current_tick++;

    // 1. Orbital propagation
    for (size_t i = 0; i < state.planet_count; ++i) {
        if (state.planet_status[i] == WorldStatus::BLACK_HOLE_COLLAPSED ||
            state.planet_status[i] == WorldStatus::FRACTURED_DEBRIS) continue;
        state.planet_angle[i] += state.planet_speed[i];
        if (state.planet_angle[i] >= TWO_PI) state.planet_angle[i] -= TWO_PI;
        state.planet_x[i] = state.star_x + state.planet_orbit_radius[i] * std::cos(state.planet_angle[i]);
        state.planet_y[i] = state.star_y + state.planet_orbit_radius[i] * std::sin(state.planet_angle[i]);
    }

    // 2. Conduit stress, snapping and star occlusion
    for (size_t c = 0; c < state.conduit_count; ++c) {
        if (state.conduit_snapped[c]) continue;

        uint32_t s_idx = state.conduit_source[c];
        uint32_t t_idx = state.conduit_target[c];
        double x1 = state.planet_x[s_idx], y1 = state.planet_y[s_idx];
        double x2 = state.planet_x[t_idx], y2 = state.planet_y[t_idx];

        double dx = x2 - x1, dy = y2 - y1;
        double dist = std::sqrt(dx * dx + dy * dy);
        state.conduit_current_length[c] = dist;

        if (dist > state.conduit_max_length[c]) {
            state.conduit_snapped[c] = true;
            state.conduit_throughput[c] = 0.0;
            continue;
        }

        bool occluded = CheckCircleSegmentIntersection(x1, y1, x2, y2,
                                                       state.star_x, state.star_y, state.star_radius);
        state.conduit_occluded[c] = occluded;
        if (occluded) {
            state.conduit_throughput[c] = 0.0;
        } else {
            double surge_mult = state.conduit_harmonic_surge[c] ? 3.0 : 1.0;
            state.conduit_throughput[c] = (state.planet_yield_rate[s_idx] + state.planet_yield_rate[t_idx]) * surge_mult;
        }
    }

    // 3. Syzygy detection every 16 ticks
    if ((current_tick & 0x0F) == 0) CheckSyzygyAlignments();

    // 4. Weapon kinematics and impacts
    UpdateProjectiles();

    // 5. Debris drift
    UpdateDebris();
}

void OrbiterSimulationEngine::CheckSyzygyAlignments() {
    for (size_t c = 0; c < state.conduit_count; ++c) {
        if (state.conduit_snapped[c] || state.conduit_occluded[c]) {
            state.conduit_harmonic_surge[c] = false;
            continue;
        }
        uint32_t s = state.conduit_source[c];
        uint32_t t = state.conduit_target[c];

        double diff = std::abs(state.planet_angle[s] - state.planet_angle[t]);
        while (diff > PI) diff = std::abs(diff - TWO_PI);

        state.conduit_harmonic_surge[c] =
            diff < syzygy_tolerance_rad || std::abs(diff - PI) < syzygy_tolerance_rad;
    }
}

void OrbiterSimulationEngine::LaunchSuperweapon(WeaponClass type, double origin_x, double origin_y, int32_t target_planet_idx) {
    // Reuse the first free slot; grow the array only when none is free.
    size_t idx = MAX_MISSILES;
    for (size_t m = 0; m < state.missile_count; ++m) {
        if (!state.missile_active[m]) { idx = m; break; }
    }
    if (idx == MAX_MISSILES) {
        if (state.missile_count >= MAX_MISSILES) return;
        idx = state.missile_count++;
    }
    state.missile_type[idx] = type;
    state.missile_x[idx] = origin_x;
    state.missile_y[idx] = origin_y;
    state.missile_target_planet[idx] = target_planet_idx;
    state.missile_active[idx] = true;

    if (type == WeaponClass::THERMONUCLEAR_ICBM) state.missile_speed[idx] = 1.8;
    else if (type == WeaponClass::PLANET_CRACKER_DRILL) state.missile_speed[idx] = 0.9;
    else state.missile_speed[idx] = 3.5;
}

void OrbiterSimulationEngine::UpdateProjectiles() {
    for (size_t m = 0; m < state.missile_count; ++m) {
        if (!state.missile_active[m]) continue;

        double target_x, target_y, hit_radius;
        int32_t p_idx = state.missile_target_planet[m];
        if (p_idx >= 0 && p_idx < static_cast<int32_t>(state.planet_count)) {
            target_x = state.planet_x[p_idx];
            target_y = state.planet_y[p_idx];
            hit_radius = state.planet_radius[p_idx];
        } else {
            target_x = state.star_x;
            target_y = state.star_y;
            hit_radius = state.star_radius;
        }

        double dx = target_x - state.missile_x[m];
        double dy = target_y - state.missile_y[m];
        double dist = std::sqrt(dx * dx + dy * dy);

        if (dist <= hit_radius) {
            ExecuteImpact(m, p_idx);
            state.missile_active[m] = false;
        } else {
            double inv = 1.0 / dist;
            state.missile_x[m] += dx * inv * state.missile_speed[m];
            state.missile_y[m] += dy * inv * state.missile_speed[m];
        }
    }
}

void OrbiterSimulationEngine::ExecuteImpact(size_t missile_idx, int32_t planet_idx) {
    WeaponClass wep = state.missile_type[missile_idx];

    if (planet_idx >= 0 && planet_idx < static_cast<int32_t>(state.planet_count)) {
        WorldStatus status = state.planet_status[planet_idx];
        if (status == WorldStatus::FRACTURED_DEBRIS || status == WorldStatus::BLACK_HOLE_COLLAPSED) return;
        if (wep == WeaponClass::THERMONUCLEAR_ICBM) {
            if (status != WorldStatus::ACTIVE_PRISTINE) return;
            state.planet_status[planet_idx] = WorldStatus::GLASSED_IRRADIATED;
            state.planet_population[planet_idx] *= 0.15;
            state.planet_yield_rate[planet_idx] *= 0.25;
        } else if (wep == WeaponClass::PLANET_CRACKER_DRILL) {
            state.planet_status[planet_idx] = WorldStatus::FRACTURED_DEBRIS;
            state.planet_population[planet_idx] = 0.0;
            state.planet_yield_rate[planet_idx] = 0.0;
            for (size_t c = 0; c < state.conduit_count; ++c) {
                if (state.conduit_source[c] == static_cast<uint32_t>(planet_idx) ||
                    state.conduit_target[c] == static_cast<uint32_t>(planet_idx)) {
                    state.conduit_snapped[c] = true;
                }
            }
            SpawnDebrisRing(state.planet_x[planet_idx], state.planet_y[planet_idx], 32);
        }
    } else if (wep == WeaponClass::STARKILLER_NEEDLE && !state.star_supernova_triggered) {
        state.star_supernova_triggered = true;
        state.star_destabilized = true;
        state.star_radius *= 2.5;
        for (size_t c = 0; c < state.conduit_count; ++c) state.conduit_snapped[c] = true;
    }
}

void OrbiterSimulationEngine::SpawnDebrisRing(double cx, double cy, size_t count) {
    for (size_t i = 0; i < count && state.asteroid_count < MAX_ASTEROIDS; ++i) {
        size_t a = state.asteroid_count++;
        double angle = (TWO_PI / count) * i;
        double speed = 0.3 + (i % 5) * 0.1;
        state.asteroid_x[a] = cx + std::cos(angle) * 15.0;
        state.asteroid_y[a] = cy + std::sin(angle) * 15.0;
        state.asteroid_vx[a] = std::cos(angle) * speed;
        state.asteroid_vy[a] = std::sin(angle) * speed;
        state.asteroid_ttl[a] = orbiter_config::DEBRIS_LIFETIME_TICKS;
    }
}

void OrbiterSimulationEngine::UpdateDebris() {
    size_t i = 0;
    while (i < state.asteroid_count) {
        state.asteroid_x[i] += state.asteroid_vx[i];
        state.asteroid_y[i] += state.asteroid_vy[i];
        if (state.asteroid_ttl[i] > 0) --state.asteroid_ttl[i];
        if (state.asteroid_ttl[i] == 0) {
            // Expired: move the last live piece into this slot and shrink.
            size_t last = --state.asteroid_count;
            state.asteroid_x[i] = state.asteroid_x[last];
            state.asteroid_y[i] = state.asteroid_y[last];
            state.asteroid_vx[i] = state.asteroid_vx[last];
            state.asteroid_vy[i] = state.asteroid_vy[last];
            state.asteroid_ttl[i] = state.asteroid_ttl[last];
            continue;
        }
        ++i;
    }
}

void OrbiterSimulationEngine::RunBenchmark(uint64_t total_ticks) {
    std::cout << ">>> Running " << total_ticks << "-tick kernel stress test...\n";
    auto start = std::chrono::steady_clock::now();
    for (uint64_t t = 0; t < total_ticks; ++t) UpdateTick();
    auto end = std::chrono::steady_clock::now();

    std::chrono::duration<double, std::milli> ms = end - start;
    double seconds = ms.count() / 1000.0;
    double ticks_per_sec = seconds > 0.0 ? total_ticks / seconds : 0.0;

    std::cout << ">>> Completed " << total_ticks << " ticks in " << ms.count() << " ms.\n";
    std::cout << ">>> Throughput: " << static_cast<uint64_t>(ticks_per_sec) << " ticks/second.\n";
}

} // namespace orbiter
