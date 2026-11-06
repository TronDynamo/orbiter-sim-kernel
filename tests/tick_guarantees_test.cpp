// Guarantees for the tick path: no heap allocation while the simulation runs, and swept hits that cannot skip a world.
// Run with `npm test`. The global operator new below counts every heap allocation in the process.
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <new>

#include "orbiter_kernel.hpp"
#include "planet_config.hpp"

static unsigned long long g_allocations = 0;
void* operator new(std::size_t n) {
    ++g_allocations;
    if (void* p = std::malloc(n ? n : 1)) return p;
    throw std::bad_alloc();
}
void* operator new[](std::size_t n) { return operator new(n); }
void operator delete(void* p) noexcept { std::free(p); }
void operator delete[](void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
void operator delete[](void* p, std::size_t) noexcept { std::free(p); }

static int failures = 0;
#define CHECK(cond, msg) do { if (!(cond)) { std::printf("FAIL: %s\n", msg); ++failures; } else { std::printf("ok:   %s\n", msg); } } while (0)

int main() {
    using namespace orbiter;
    using namespace orbiter_config;

    // A loaded system with conduits, several weapons in flight and debris, run for thousands of ticks.
    OrbiterSimulationEngine e;
    e.SurveyPlanet(0);
    e.SurveyPlanet(1);
    e.AddConduit(0, 1);
    e.AddConduit(1, 2);
    e.AddConduit(2, 3);
    e.LaunchSuperweapon(WeaponClass::THERMONUCLEAR_ICBM, 110.0, 0.0, 1);
    e.LaunchSuperweapon(WeaponClass::SINGULARITY_TORPEDO, -140.0, 0.0, 2);

    g_allocations = 0;
    for (int t = 0; t < 20000; ++t) e.UpdateTick();
    CHECK(g_allocations == 0, "20,000 loaded ticks make zero heap allocations");
    std::printf("      (allocations counted during ticks: %llu)\n", g_allocations);

    // Swept check: a step that crosses a world's disc must count as a hit even when neither end point is inside it.
    CHECK(CheckCircleSegmentIntersection(-100.0, 0.0, 100.0, 0.0, 0.0, 0.0, 5.0),
          "a segment passing through a world's disc is a hit");
    CHECK(!CheckCircleSegmentIntersection(-100.0, 20.0, 100.0, 20.0, 0.0, 0.0, 5.0),
          "a segment passing beside a world is not a hit");

    // Kepler orbit: over one full revolution a world with eccentricity e swings between a(1 - e) and a(1 + e).
    {
        OrbiterSimulationEngine k;
        const auto& s = k.GetState();
        const double a = s.planet_orbit_radius[0], ecc = s.planet_eccentricity[0];
        double rmin = 1e9, rmax = 0.0;
        for (int t = 0; t < 1400; ++t) {
            k.UpdateTick();
            const double r = std::hypot(s.planet_x[0], s.planet_y[0]);
            rmin = std::min(rmin, r);
            rmax = std::max(rmax, r);
        }
        CHECK(ecc > 0.0 && std::fabs(rmin - a * (1.0 - ecc)) < 0.5, "perihelion matches a(1 - e)");
        CHECK(std::fabs(rmax - a * (1.0 + ecc)) < 0.5, "aphelion matches a(1 + e)");
    }

    // Raycast: a line that starts inside a world hits it; a line through the star's centre hits the star;
    // a line well clear of every body hits nothing.
    {
        OrbiterSimulationEngine r;
        const auto& s = r.GetState();
        const double px = s.planet_x[0], py = s.planet_y[0];
        CHECK(r.FirstBodyOnSegment(px, py, px + 1.0, py) == 0, "a line starting inside a world hits that world");
        CHECK(r.FirstBodyOnSegment(0.0, -1.0, 0.0, 1.0) == -2, "a line through the star's centre hits the star");
        CHECK(r.FirstBodyOnSegment(0.0, 5000.0, 10.0, 5000.0) == -1, "a line clear of every body hits nothing");
    }

    std::printf(failures ? "FAILED: %d\n" : "all tick guarantees hold\n", failures);
    return failures ? 1 : 0;
}
