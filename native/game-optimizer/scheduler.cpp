// BotStudio9 game optimizer. See LICENSE.txt.
#include "bs9/scheduler.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
namespace bs9 {
float distance_sq(const Vec3& a, const Vec3& b) noexcept {
const float dx = a.x - b.x;
const float dy = a.y - b.y;
const float dz = a.z - b.z;
return dx * dx + dy * dy + dz * dz;
}
const char* tier_name(Tier t) noexcept {
switch (t) {
case Tier::Hot:
return "hot";
case Tier::Warm:
return "warm";
case Tier::Cool:
return "cool";
case Tier::Cold:
return "cold";
case Tier::Frozen:
return "frozen";
default:
return "?";
}
}
void EntityScheduler::set_entities(std::vector<Entity> entities) {
entities_ = std::move(entities);
tiers_.assign(entities_.size(), Tier::Frozen);
next_due_.assign(entities_.size(), 0);
phase_.resize(entities_.size());
for (std::size_t i = 0; i < entities_.size(); ++i) {
phase_[i] = static_cast<std::uint32_t>(entities_[i].id * 2654435761u >> 16);
}
deferred_.clear();
queued_.assign(entities_.size(), 0);
retier();
for (std::size_t i = 0; i < entities_.size(); ++i) {
const std::uint32_t interval =
cfg_.intervals[static_cast<std::size_t>(tiers_[i])];
next_due_[i] = interval > 1 ? phase_[i] % interval : 0;
}
}
void EntityScheduler::set_players(std::vector<Vec3> players) {
players_ = std::move(players);
}
Tier EntityScheduler::classify(const Entity& e) const {
if (e.pinned || e.activity >= cfg_.activity_promote) return Tier::Hot;
if (players_.empty()) return Tier::Frozen;
float best = std::numeric_limits<float>::max();
for (const auto& p : players_) {
best = std::min(best, distance_sq(e.position, p));
}
const float scale = 1.0f - 0.5f * std::clamp(e.activity, 0.f, 1.f);
const float d = std::sqrt(best) * scale;
if (d <= cfg_.hot_radius) return Tier::Hot;
if (d <= cfg_.warm_radius) return Tier::Warm;
if (d <= cfg_.cool_radius) return Tier::Cool;
if (d <= cfg_.cold_radius) return Tier::Cold;
return Tier::Frozen;
}
void EntityScheduler::retier() {
for (std::size_t i = 0; i < entities_.size(); ++i) {
const Tier before = tiers_[i];
const Tier now = classify(entities_[i]);
if (now == before) continue;
tiers_[i] = now;
if (now < before) {
next_due_[i] = static_cast<std::uint32_t>(frame_);
} else {
const std::uint32_t interval =
cfg_.intervals[static_cast<std::size_t>(now)];
next_due_[i] = static_cast<std::uint32_t>(
frame_ + (interval > 1 ? phase_[i] % interval : 1));
}
}
}
Tier EntityScheduler::tier_of(EntityId id) const {
for (std::size_t i = 0; i < entities_.size(); ++i) {
if (entities_[i].id == id) return tiers_[i];
}
return Tier::Frozen;
}
FrameStats EntityScheduler::tick(const UpdateFn& fn) {
FrameStats stats;
stats.frame = frame_;
naive_updates_ += entities_.size();
std::vector<std::size_t> due;
due.reserve(entities_.size() / 4 + deferred_.size() + 1);
queued_.assign(entities_.size(), 0);
for (const EntityId idx : deferred_) {
if (idx < queued_.size() && queued_[idx] == 0) {
queued_[idx] = 1;
due.push_back(idx);
}
}
deferred_.clear();
for (std::size_t i = 0; i < entities_.size(); ++i) {
const auto tier = tiers_[i];
++stats.tier_counts[static_cast<std::size_t>(tier)];
const std::uint32_t interval = cfg_.intervals[static_cast<std::size_t>(tier)];
if (interval == 0) continue;
if (static_cast<std::uint64_t>(next_due_[i]) > frame_) continue;
if (queued_[i] != 0) continue;
queued_[i] = 1;
due.push_back(i);
}
stats.candidates = due.size();
std::stable_sort(due.begin(), due.end(),
[this](std::size_t a, std::size_t b) {
return tiers_[a] < tiers_[b];
});
const std::size_t cap = cfg_.max_updates_per_frame == 0
? due.size()
: std::min(cfg_.max_updates_per_frame, due.size());
for (std::size_t k = 0; k < due.size(); ++k) {
const std::size_t i = due[k];
if (k >= cap) {
deferred_.push_back(static_cast<EntityId>(i));
++stats.deferred;
continue;
}
fn(entities_[i]);
++stats.updated;
++actual_updates_;
const std::uint32_t interval =
cfg_.intervals[static_cast<std::size_t>(tiers_[i])];
next_due_[i] = static_cast<std::uint32_t>(frame_ + std::max(1u, interval));
}
++frame_;
return stats;
}
}
