// Minimal checks for the kernel. Run with `npm test`.
#include <cstdio>
#include <cstdlib>

#include "orbiter_kernel.hpp"
#include "planet_config.hpp"

static int failures = 0;
#define CHECK(cond, msg) do { if (!(cond)) { std::printf("FAIL: %s\n", msg); ++failures; } else { std::printf("ok:   %s\n", msg); } } while (0)

int main() {
    using namespace orbiter;
    using namespace orbiter_config;

    {
        OrbiterSimulationEngine e;
        const auto& s = e.GetState();
        CHECK(s.planet_count == PLANET_COUNT, "planet count matches config");
        CHECK(s.conduit_count == CONDUIT_COUNT, "conduit count matches config");
        CHECK(s.planet_orbit_radius[0] > s.star_radius, "innermost planet clears the star");
    }
    {
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::THERMONUCLEAR_ICBM, 110.0, 0.0, 1);
        for (int i = 0; i < 20000 && e.GetState().planet_status[1] == WorldStatus::ACTIVE_PRISTINE; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_status[1] == WorldStatus::GLASSED_IRRADIATED, "ICBM glasses Verdant Hub");
        CHECK(e.GetState().planet_population[1] < PLANETS[1].population, "glassing reduces population");
    }
    {
        OrbiterSimulationEngine e;
        for (int i = 0; i < 100; ++i) e.UpdateTick();
        CHECK(e.tick() == 100, "tick counter advances");
    }

    {
        // Missile slots are reused once a shot has resolved.
        OrbiterSimulationEngine e;
        for (size_t n = 0; n < MAX_MISSILES + 10; ++n) {
            e.LaunchSuperweapon(WeaponClass::THERMONUCLEAR_ICBM, 110.0, 0.0, 1);
            for (int i = 0; i < 20000 && e.GetState().missile_active[e.GetState().missile_count - 1]; ++i) e.UpdateTick();
        }
        CHECK(e.GetState().missile_count <= MAX_MISSILES, "missile slots are reused");
    }
    {
        // A second Star-Killer does not expand the star again.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000 && !e.GetState().star_supernova_triggered; ++i) e.UpdateTick();
        double r1 = e.GetState().star_radius;
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000 && e.GetState().missile_active[e.GetState().missile_count - 1]; ++i) e.UpdateTick();
        CHECK(e.GetState().star_radius == r1, "second Star-Killer does not re-expand the star");
    }
    {
        // A cracked world stops orbiting and keeps its last position.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::PLANET_CRACKER_DRILL, 110.0, 0.0, 0);
        for (int i = 0; i < 40000 && e.GetState().planet_status[0] == WorldStatus::ACTIVE_PRISTINE; ++i) e.UpdateTick();
        double x = e.GetState().planet_x[0], y = e.GetState().planet_y[0];
        for (int i = 0; i < 1000; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_status[0] == WorldStatus::FRACTURED_DEBRIS, "drill fractures its target");
        CHECK(e.GetState().planet_x[0] == x && e.GetState().planet_y[0] == y, "fractured world stays put");
    }
    {
        // Debris expires after its lifetime.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::PLANET_CRACKER_DRILL, 110.0, 0.0, 0);
        for (int i = 0; i < 40000 && e.GetState().planet_status[0] == WorldStatus::ACTIVE_PRISTINE; ++i) e.UpdateTick();
        CHECK(e.GetState().asteroid_count == 32, "drill spawns a debris ring");
        for (uint32_t i = 0; i < DEBRIS_LIFETIME_TICKS + 1; ++i) e.UpdateTick();
        CHECK(e.GetState().asteroid_count == 0, "debris expires after its lifetime");
    }

    std::printf("%s (%d failures)\n", failures ? "FAILED" : "PASSED", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
