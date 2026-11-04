// C API for WebAssembly. One static engine; state arrays are read through pointers
// into its memory, so the frontend builds typed-array views with no serialization.
// Pointers are valid until the module's memory grows (ALLOW_MEMORY_GROWTH is off).
#include <cstdint>

#include "orbiter_kernel.hpp"

namespace {
orbiter::OrbiterSimulationEngine g_engine;
}

extern "C" {

void orbiter_reset() { g_engine = orbiter::OrbiterSimulationEngine{}; }
void orbiter_tick(uint32_t n) { for (uint32_t i = 0; i < n; ++i) g_engine.UpdateTick(); }
void orbiter_launch(int32_t type, double x, double y, int32_t target_planet) {
    g_engine.LaunchSuperweapon(static_cast<orbiter::WeaponClass>(type), x, y, target_planet);
}
double orbiter_tick_count() { return static_cast<double>(g_engine.tick()); }

uint32_t orbiter_planet_count() { return static_cast<uint32_t>(g_engine.GetState().planet_count); }
uint32_t orbiter_conduit_count() { return static_cast<uint32_t>(g_engine.GetState().conduit_count); }
uint32_t orbiter_missile_count() { return static_cast<uint32_t>(g_engine.GetState().missile_count); }
uint32_t orbiter_asteroid_count() { return static_cast<uint32_t>(g_engine.GetState().asteroid_count); }

double orbiter_star_radius() { return g_engine.GetState().star_radius; }
uint8_t orbiter_star_collapsed() { return g_engine.GetState().star_collapsed ? 1 : 0; }
uint8_t orbiter_star_supernova() { return g_engine.GetState().star_supernova_triggered ? 1 : 0; }

const double* orbiter_planet_x() { return g_engine.GetState().planet_x; }
const double* orbiter_planet_y() { return g_engine.GetState().planet_y; }
const double* orbiter_planet_orbit_radius() { return g_engine.GetState().planet_orbit_radius; }
const double* orbiter_planet_population() { return g_engine.GetState().planet_population; }
const uint8_t* orbiter_planet_status() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().planet_status);
}
const uint32_t* orbiter_planet_vortex_ticks() { return g_engine.GetState().planet_vortex_ticks_left; }

const double* orbiter_conduit_throughput() { return g_engine.GetState().conduit_throughput; }
const double* orbiter_conduit_length() { return g_engine.GetState().conduit_current_length; }
const uint8_t* orbiter_conduit_snapped() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().conduit_snapped);
}
const uint8_t* orbiter_conduit_surge() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().conduit_harmonic_surge);
}

const double* orbiter_missile_x() { return g_engine.GetState().missile_x; }
const double* orbiter_missile_y() { return g_engine.GetState().missile_y; }
const uint8_t* orbiter_missile_active() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().missile_active);
}
const uint8_t* orbiter_missile_type() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().missile_type);
}

const double* orbiter_planet_gain_total() { return g_engine.GetState().planet_gain_total; }
const uint8_t* orbiter_planet_flow() { return g_engine.GetState().planet_flow; }

int32_t orbiter_conduit_add(uint32_t source, uint32_t target) { return g_engine.AddConduit(source, target); }
int32_t orbiter_conduit_remove(uint32_t index) { return g_engine.RemoveConduit(index); }
const uint8_t* orbiter_conduit_occluded() {
    return reinterpret_cast<const uint8_t*>(g_engine.GetState().conduit_occluded);
}
const uint32_t* orbiter_conduit_source() { return g_engine.GetState().conduit_source; }
const uint32_t* orbiter_conduit_target() { return g_engine.GetState().conduit_target; }
const double* orbiter_conduit_max_length() { return g_engine.GetState().conduit_max_length; }

const double* orbiter_asteroid_x() { return g_engine.GetState().asteroid_x; }
const double* orbiter_asteroid_y() { return g_engine.GetState().asteroid_y; }

}  // extern "C"
