// Minimal checks for the kernel. Run with `npm test`.
#include <cstdio>
#include <cmath>
#include <cstdlib>

#include "orbiter_kernel.hpp"
#include "planet_config.hpp"

static int failures = 0;

// The drill (0.9 units/tick) can only catch slower worlds. Kryos (index 3) moves about 0.74 units/tick,
// so start the drill a little behind it on the same orbit.
static void LaunchDrillAtKryos(orbiter::OrbiterSimulationEngine& e) {
    double th = orbiter_config::PLANETS[3].angle - 0.15;
    double r = orbiter_config::PLANETS[3].orbit_radius;
    e.LaunchSuperweapon(orbiter::WeaponClass::PLANET_CRACKER_DRILL, r * std::cos(th), r * std::sin(th), 3);
}
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
        CHECK(e.GetState().planet_status[1] == WorldStatus::GLASSED_IRRADIATED, "ICBM glasses Aeros");
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
        LaunchDrillAtKryos(e);
        for (int i = 0; i < 40000 && e.GetState().planet_status[3] == WorldStatus::ACTIVE_PRISTINE; ++i) e.UpdateTick();
        for (int i = 0; i < 40000 && e.GetState().planet_status[3] != WorldStatus::FRACTURED_DEBRIS; ++i) e.UpdateTick();
        double x = e.GetState().planet_x[3], y = e.GetState().planet_y[3];
        for (int i = 0; i < 1000; ++i) e.UpdateTick();
        CHECK(e.GetState().planet_status[3] == WorldStatus::FRACTURED_DEBRIS, "drill fractures its target");
        CHECK(e.GetState().planet_x[3] == x && e.GetState().planet_y[3] == y, "fractured world stays put");
    }
    {
        // Debris expires after its lifetime.
        OrbiterSimulationEngine e;
        LaunchDrillAtKryos(e);
        for (int i = 0; i < 40000 && e.GetState().planet_status[3] != WorldStatus::FRACTURED_DEBRIS; ++i) e.UpdateTick();
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
        LaunchDrillAtKryos(e);
        bool sawCracking = false;
        for (int i = 0; i < 40000 && e.GetState().planet_status[3] != WorldStatus::FRACTURED_DEBRIS; ++i) {
            e.UpdateTick();
            if (e.GetState().planet_status[3] == WorldStatus::CRACKING_STAGE1) sawCracking = true;
        }
        CHECK(sawCracking, "drill enters cracking stage before impact");
        CHECK(e.GetState().planet_status[3] == WorldStatus::FRACTURED_DEBRIS, "cracked world then fractures");
    }

    {
        // Player conduits: refused links, length tracking, sun occlusion and snapping.
        OrbiterSimulationEngine e;
        const auto& s = e.GetState();
        CHECK(e.AddConduit(0, 0) == CONDUIT_ERR_BAD_PLANET, "conduit to itself is refused");
        CHECK(e.AddConduit(0, 9) == CONDUIT_ERR_BAD_PLANET, "conduit to an unknown planet is refused");
        CHECK(e.AddConduit(0, 1) == 0, "Thalassa to Aeros is accepted at the start");
        CHECK(e.AddConduit(1, 0) == CONDUIT_ERR_DUPLICATE, "the same pair in reverse is refused");
        CHECK(s.conduit_count == 1, "one conduit exists after the refusals");

        bool sawOccluded = false, sawOccludedWithFlow = false;
        for (int i = 0; i < 80000 && !s.conduit_snapped[0]; ++i) {
            e.UpdateTick();
            if (s.conduit_occluded[0]) {
                sawOccluded = true;
                if (s.conduit_throughput[0] != 0.0) sawOccludedWithFlow = true;
            }
        }
        CHECK(sawOccluded, "the dying star occludes Thalassa to Aeros at some point");
        CHECK(!sawOccludedWithFlow, "an occluded conduit carries no throughput");
        CHECK(!s.conduit_snapped[0], "Thalassa to Aeros never snaps (its longest run stays under the cap)");

        OrbiterSimulationEngine f;
        const auto& t = f.GetState();
        CHECK(f.AddConduit(0, 3) == 0, "Thalassa to Kryos is accepted at the start");
        for (int i = 0; i < 80000 && !t.conduit_snapped[0]; ++i) f.UpdateTick();
        CHECK(t.conduit_snapped[0], "a conduit stretched past the cap snaps");
        CHECK(t.conduit_throughput[0] == 0.0, "a snapped conduit carries no throughput");
        CHECK(t.conduit_current_length[0] > CONDUIT_MAX_LENGTH, "the snapped conduit was longer than the cap");

        OrbiterSimulationEngine g;
        const auto& u = g.GetState();
        g.AddConduit(0, 1);
        g.AddConduit(0, 3);
        CHECK(u.conduit_count == 2, "two conduits exist before removal");
        CHECK(g.RemoveConduit(0) == 0, "removing the first conduit succeeds");
        CHECK(u.conduit_count == 1, "removal shrinks the list");
        CHECK(u.conduit_source[0] == 0 && u.conduit_target[0] == 3, "the last conduit moves into the freed slot");
        CHECK(g.RemoveConduit(5) == -1, "removing a missing conduit is refused");
    }

    {
        // Siphoning: a live conduit delivers a world's output each tick; nothing flows through a shadowed one.
        OrbiterSimulationEngine idle;
        for (int i = 0; i < 600; ++i) idle.UpdateTick();
        CHECK(idle.GetState().planet_gain_total[0] == 0.0, "no conduit, no siphoned output");

        OrbiterSimulationEngine e;
        const auto& s = e.GetState();
        e.AddConduit(0, 1);
        double before = s.planet_gain_total[0];
        e.UpdateTick();
        double perTick = s.planet_gain_total[0] - before;
        double base = s.planet_yield_rate[0] / 60.0;
        CHECK(std::abs(perTick - base) < 1e-9 || std::abs(perTick - 3.0 * base) < 1e-9,
              "a live conduit delivers one tick of output (tripled under surge)");

        bool sawShadow = false, shadowFlow = false;
        for (int i = 0; i < 80000 && !sawShadow; ++i) {
            double g0 = s.planet_gain_total[0];
            e.UpdateTick();
            if (s.conduit_occluded[0]) {
                sawShadow = true;
                if (s.planet_gain_total[0] != g0) shadowFlow = true;
            }
        }
        CHECK(sawShadow, "the star shadows the conduit at some point");
        CHECK(!shadowFlow, "no output is delivered while the conduit is in shadow");
    }

    {
        // Credits: a live conduit pays both worlds' population rate plus its fee each tick.
        OrbiterSimulationEngine e;
        const auto& s = e.GetState();
        e.AddConduit(0, 1);
        double before = s.credit_total;
        e.UpdateTick();
        double expected = (CREDITS_PER_MILLION_POP * (s.planet_population[0] + s.planet_population[1]) / 1e6 + CREDITS_PER_CONDUIT) / 60.0;
        CHECK(std::abs((s.credit_total - before) - expected) < 1e-9, "a live conduit pays population and conduit credits");

        OrbiterSimulationEngine idle;
        for (int i = 0; i < 300; ++i) idle.UpdateTick();
        CHECK(idle.GetState().credit_total == 0.0, "no conduit, no credits");
    }

    std::printf("%s (%d failures)\n", failures ? "FAILED" : "PASSED", failures);
    return failures ? EXIT_FAILURE : EXIT_SUCCESS;
}
