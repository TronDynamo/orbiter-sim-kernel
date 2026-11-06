// Guarantees for the tick path: no heap allocation while the simulation runs, and swept hits that cannot skip a world.
// Run with `npm test`. The global operator new below counts every heap allocation in the process.
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

    std::printf(failures ? "FAILED: %d\n" : "all tick guarantees hold\n", failures);
    return failures ? 1 : 0;
}
