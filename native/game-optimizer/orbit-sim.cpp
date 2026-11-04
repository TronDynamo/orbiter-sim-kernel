// Orbit simulation core — runs every frame inside WebAssembly and owns all scene motion:
// orbital mechanics, camera flight + zoom, planet focus scaling, star lighting vectors, depth ordering,
// starfield parallax/twinkle and hit-testing. The browser only paints what this module outputs.
//
// Work is scheduled by bs9::EntityScheduler: planets are pinned Hot (updated every frame); starfield
// particles are tiered by distance from the view centre so distant ones update less often. Any number of
// extra entities can be added through sim_add_body / sim_init(star count) without touching the renderer.
#include "bs9/scheduler.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace {
constexpr float TAU = 6.28318530718f;
constexpr int BODY_STRIDE = 12;  // sx, sy, R, depth, ca, sa, Lx, Ly, Lz, lit, wx, wy
constexpr int STAR_STRIDE = 4;   // x, y, alpha, size

struct Body { float orbit, speed, phase, radius, sel = 1.f; };
struct Star { float u, v, size, tw, tws, a, depth; };

struct Sim {
  std::vector<Body> bodies;
  std::vector<Star> stars;
  std::vector<float> bodyOut, starOut;
  std::vector<int32_t> order;
  float cam[7] = {0, 0, 0, 0, 1, 0, 0};  // ax, ay, fx, fy, z, time, real
  float stats[8] = {};
  float w = 1000, h = 600, base = 1, panel = 0;
  float speed = 1, zoom = 1.6f, selScale = 1.75f, orbitY = 0.55f, sinE = 0.55f;
  int visibleStars = 0, selected = -1;
  bool camInit = false;
  bs9::EntityScheduler starScheduler{bs9::SchedulerConfig{220.f, 420.f, 700.f, 4000.f, {1, 2, 3, 4, 0}, 0.75f, 0}};
};
Sim S;

void layoutStars() {
  std::vector<bs9::Entity> ents(S.stars.size());
  for (std::size_t i = 0; i < S.stars.size(); ++i) {
    ents[i].id = static_cast<bs9::EntityId>(i);
    ents[i].position = {S.stars[i].u * S.w, S.stars[i].v * S.h, 0.f};
  }
  S.starScheduler.set_entities(std::move(ents));
  S.starScheduler.set_players({bs9::Vec3{S.w * 0.5f, S.h * 0.52f, 0.f}});
  S.starScheduler.retier();
}

inline void worldOf(const Body& b, float& wx, float& wy, float& ca, float& sa) {
  const float a = b.phase + S.cam[5] * b.speed;
  ca = std::cos(a); sa = std::sin(a);
  wx = ca * b.orbit; wy = sa * b.orbit * S.orbitY;
}
}  // namespace

extern "C" {

void sim_init(int starCount, uint32_t seed) {
  S.stars.clear();
  uint64_t s = seed ? seed : 1234;
  auto r = [&]() { s = (s * 16807ull) % 2147483647ull; return static_cast<float>(s) / 2147483647.f; };
  for (int i = 0; i < starCount; ++i) {
    Star st;
    st.u = r(); st.v = r();
    const float k = r();
    st.size = k < 0.08f ? 1.6f : (r() < 0.4f ? 1.1f : 0.7f);
    st.tw = r() * TAU; st.tws = 0.6f + r() * 1.8f; st.a = 0.35f + r() * 0.6f; st.depth = 0.2f + r() * 0.8f;
    S.stars.push_back(st);
  }
  S.starOut.assign(S.stars.size() * STAR_STRIDE, 0.f);
  S.visibleStars = starCount;
  layoutStars();
}

void sim_clear_bodies() { S.bodies.clear(); S.selected = -1; }

int sim_add_body(float orbit, float speed, float phase, float radius) {
  S.bodies.push_back({orbit, speed, phase, radius, 1.f});
  S.bodyOut.assign(S.bodies.size() * BODY_STRIDE, 0.f);
  S.order.assign(S.bodies.size(), 0);
  return static_cast<int>(S.bodies.size()) - 1;
}

void sim_set_view(float w, float h, float base, float panelWidth) {
  const bool resized = w != S.w || h != S.h;
  S.w = w; S.h = h; S.base = base; S.panel = panelWidth;
  if (resized) layoutStars();
}

void sim_set_params(float speed, int visibleStars, float zoom, float selScale, float orbitY, float sinE) {
  S.speed = speed; S.visibleStars = std::clamp(visibleStars, 0, static_cast<int>(S.stars.size()));
  S.zoom = zoom; S.selScale = selScale; S.orbitY = orbitY; S.sinE = sinE;
}

void sim_select(int idx) { S.selected = idx >= 0 && idx < static_cast<int>(S.bodies.size()) ? idx : -1; }
void sim_reset_camera() { S.camInit = false; for (auto& b : S.bodies) b.sel = 1.f; }

void sim_step(float dt) {
  dt = std::clamp(dt, 0.f, 0.05f);
  S.cam[5] += dt * S.speed;  // simulation time (orbit speed setting)
  S.cam[6] += dt;            // real time (twinkle, plasma)
  const float k = 1.f - std::exp(-dt * 3.2f);

  // camera target: whole system, or locked onto the selected planet beside the detail panel
  float tax = S.w * 0.5f, tay = S.h * 0.52f, tfx = 0.f, tfy = 0.f, tz = 1.f;
  if (S.selected >= 0) {
    float wx, wy, ca, sa; worldOf(S.bodies[S.selected], wx, wy, ca, sa);
    tax = (S.w - S.panel) * 0.64f; tay = S.h * 0.525f; tfx = wx; tfy = wy; tz = S.zoom;
  }
  if (!S.camInit) { S.cam[0] = tax; S.cam[1] = tay; S.cam[2] = tfx; S.cam[3] = tfy; S.cam[4] = tz; S.camInit = true; }
  else {
    S.cam[0] += (tax - S.cam[0]) * k; S.cam[1] += (tay - S.cam[1]) * k;
    S.cam[2] += (tfx - S.cam[2]) * k; S.cam[3] += (tfy - S.cam[3]) * k;
    S.cam[4] += (tz - S.cam[4]) * k;
  }
  const float zb = S.cam[4] * S.base;
  const float cosE = std::sqrt(std::max(0.f, 1.f - S.sinE * S.sinE));

  // planets: pinned hot, every frame
  for (std::size_t i = 0; i < S.bodies.size(); ++i) {
    Body& b = S.bodies[i];
    b.sel += ((static_cast<int>(i) == S.selected ? S.selScale : 1.f) - b.sel) * k;
    float wx, wy, ca, sa; worldOf(b, wx, wy, ca, sa);
    float* o = &S.bodyOut[i * BODY_STRIDE];
    o[0] = S.cam[0] + (wx - S.cam[2]) * zb;
    o[1] = S.cam[1] + (wy - S.cam[3]) * zb;
    o[2] = b.radius * zb * (0.9f + 0.15f * sa) * b.sel;
    o[3] = sa; o[4] = ca; o[5] = sa;
    o[6] = -ca; o[7] = sa * S.sinE; o[8] = -sa * cosE;     // direction to the star (view space)
    o[9] = std::max(0.f, -sa * 0.5f + 0.5f);               // visible lit fraction
    o[10] = wx; o[11] = wy;
    S.order[i] = static_cast<int32_t>(i);
  }
  std::stable_sort(S.order.begin(), S.order.end(), [](int32_t a, int32_t b) { return S.bodyOut[a * BODY_STRIDE + 3] < S.bodyOut[b * BODY_STRIDE + 3]; });

  // starfield: tiered by the game optimizer
  const float px = S.cam[2] * S.cam[4] * 0.04f, py = S.cam[3] * S.cam[4] * 0.04f;
  const float t = S.cam[6];
  const auto st = S.starScheduler.tick([&](const bs9::Entity& e) {
    const Star& s = S.stars[e.id];
    float* o = &S.starOut[e.id * STAR_STRIDE];
    float x = std::fmod(s.u * S.w - px * s.depth, S.w); if (x < 0) x += S.w;
    float y = std::fmod(s.v * S.h - py * s.depth, S.h); if (y < 0) y += S.h;
    o[0] = x; o[1] = y; o[2] = s.a * (0.55f + 0.45f * std::sin(t * s.tws + s.tw)); o[3] = s.size;
  });
  S.stats[0] = static_cast<float>(st.updated + S.bodies.size());
  S.stats[1] = static_cast<float>(S.stars.size() + S.bodies.size());
  for (int i = 0; i < 5; ++i) S.stats[2 + i] = static_cast<float>(st.tier_counts[i]);
  S.stats[7] = static_cast<float>(S.starScheduler.work_ratio());
}

int sim_hit(float x, float y) {
  int best = -1; float bd = 1e30f;
  for (std::size_t i = 0; i < S.bodies.size(); ++i) {
    const float* o = &S.bodyOut[i * BODY_STRIDE];
    const float dx = o[0] - x, dy = o[1] - y, d = std::sqrt(dx * dx + dy * dy);
    if (d < std::max(o[2] + 6.f, 12.f) && d < bd) { bd = d; best = static_cast<int>(i); }
  }
  return best;
}

int sim_body_count() { return static_cast<int>(S.bodies.size()); }
int sim_star_count() { return S.visibleStars; }
float* sim_bodies() { return S.bodyOut.data(); }
float* sim_stars() { return S.starOut.data(); }
int32_t* sim_order() { return S.order.data(); }
float* sim_camera() { return S.cam; }
float* sim_stats() { return S.stats; }

}  // extern "C"
