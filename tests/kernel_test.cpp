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

    std::printf("%s (%d failures)\n", failures ? "FAILED" : "PASSED", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
