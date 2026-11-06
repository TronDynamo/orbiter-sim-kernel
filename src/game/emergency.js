// Emergency Burn: a ship that is engaged and given a reroute vector lights its thrusters hard for a short window.
// Tactical cost is propellant. With the tank empty the ship burns dirty at standard speed, with no boost or chaff.
export const EMERGENCY = {
  seconds: 4,          // length of the burn window
  thrust: 0.6,         // +60% acceleration while it lasts
  evasion: 0.4,        // +40% evasion while it lasts (defensive chaff)
  cost: 2,             // propellant charges spent to ignite
  tps: 60,             // kernel ticks per second, used to run the window down
};
