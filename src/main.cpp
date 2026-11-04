#include <iostream>

#include "orbiter_kernel.hpp"

int main() {
    orbiter::OrbiterSimulationEngine engine;
    // Warhead from Aureus's orbit toward Verdant Hub (planet index 1).
    engine.LaunchSuperweapon(orbiter::WeaponClass::THERMONUCLEAR_ICBM, 110.0, 0.0, 1);
    engine.RunBenchmark(20000);

    const auto& s = engine.GetState();
    std::cout << "\n[System Status Post-20k Ticks]\n";
    std::cout << " - Aureus coord: (" << s.planet_x[0] << ", " << s.planet_y[0] << ")\n";
    std::cout << " - Verdant coord: (" << s.planet_x[1] << ", " << s.planet_y[1] << ")\n";
    std::cout << " - Conduit 0 length: " << s.conduit_current_length[0]
              << (s.conduit_snapped[0] ? " [SNAPPED]" : " [INTACT]") << "\n";
    std::cout << " - Verdant population: " << s.planet_population[1] << "\n";
    return 0;
}
