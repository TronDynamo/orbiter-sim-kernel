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
        // Star-Killer: supernova ring first, then the core collapses into a black hole.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000 && !e.GetState().star_supernova_triggered; ++i) e.UpdateTick();
        CHECK(e.GetState().star_supernova_triggered && !e.GetState().star_collapsed, "stage 1: supernova before collapse");
        for (uint32_t i = 0; i < SUPERNOVA_RING_TICKS + 1; ++i) e.UpdateTick();
        CHECK(e.GetState().star_collapsed, "stage 2: core collapses after the blast ring");
        CHECK(e.GetState().star_radius == STAR_COLLAPSED_RADIUS, "collapsed star has black-hole radius");
    }
    {
        // A second Star-Killer does not expand the star again.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000 && !e.GetState().star_supernova_triggered; ++i) e.UpdateTick();
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000; ++i) e.UpdateTick();
        CHECK(e.GetState().star_collapsed, "second Star-Killer does not restart the supernova");
    }
    {
        // Black-hole pull: outer planets drift inward once the star has collapsed.
        OrbiterSimulationEngine e;
        double before = e.GetState().planet_orbit_radius[3];
        e.LaunchSuperweapon(WeaponClass::STARKILLER_NEEDLE, 0.0, 300.0, -1);
        for (int i = 0; i < 20000 && !e.GetState().star_collapsed; ++i) e.UpdateTick();
        double at_collapse = e.GetState().planet_orbit_radius[3];
        for (int i = 0; i < 100; ++i) e.UpdateTick();
        CHECK(at_collapse == before, "no planet pull during the blast ring");
        CHECK(e.GetState().planet_orbit_radius[3] < at_collapse, "planets keep drifting after collapse");
    }
    {
        // Singularity torpedo leaves a vortex for 5 seconds, then it ends.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::SINGULARITY_TORPEDO, 400.0, 0.0, 0);
        for (int i = 0; i < 40000 && e.GetState().planet_status[0] != WorldStatus::BLACK_HOLE_COLLAPSED; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_vortex_ticks_left[0] > 0, "torpedo leaves an active vortex");
        for (uint32_t i = 0; i < VORTEX_DURATION_TICKS + 1; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_vortex_ticks_left[0] == 0, "vortex ends after its duration");
    }
    {
        // Tick rate matches the browser's 60 FPS loop.
        CHECK(TICKS_PER_SECOND == 60, "simulation runs at 60 ticks per second");
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

    {
        // Singularity torpedo collapses the target into a black hole and it stops orbiting.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::SINGULARITY_TORPEDO, 110.0, 0.0, 0);
        for (int i = 0; i < 40000 && e.GetState().planet_status[0] == WorldStatus::ACTIVE_PRISTINE; ++i) e.UpdateTick();
        double x = e.GetState().planet_x[0], y = e.GetState().planet_y[0];
        for (int i = 0; i < 500; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_status[0] == WorldStatus::BLACK_HOLE_COLLAPSED, "torpedo collapses its target");
        CHECK(e.GetState().planet_population[0] == 0.0, "collapsed world has no population");
        CHECK(e.GetState().planet_x[0] == x && e.GetState().planet_y[0] == y, "collapsed world stays put");
    }

    {
        // Drill enters the cracking stage inside the threshold, then shatters the world.
        OrbiterSimulationEngine e;
        e.LaunchSuperweapon(WeaponClass::PLANET_CRACKER_DRILL, 400.0, 0.0, 0);
        bool sawCracking = false;
        for (int i = 0; i < 40000 && e.GetState().planet_status[0] != WorldStatus::FRACTURED_DEBRIS; ++i) {
            e.UpdateTick();
            if (e.GetState().planet_status[0] == WorldStatus::CRACKING_STAGE1) sawCracking = true;
        }
        CHECK(sawCracking, "drill enters cracking stage before impact");
        CHECK(e.GetState().planet_status[0] == WorldStatus::FRACTURED_DEBRIS, "cracked world then fractures");
    }

    std::printf("%s (%d failures)\n", failures ? "FAILED" : "PASSED", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
