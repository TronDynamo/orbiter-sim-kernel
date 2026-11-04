// BotStudio9 game optimizer. See LICENSE.txt.
#pragma once
#include <cstdint>
#include <functional>
#include <string>
#include <vector>
namespace bs9 {
struct Vec3 {
float x = 0.f, y = 0.f, z = 0.f;
};
[[nodiscard]] float distance_sq(const Vec3& a, const Vec3& b) noexcept;
using EntityId = std::uint32_t;
enum class Tier : std::uint8_t {
Hot = 0,
Warm = 1,
Cool = 2,
Cold = 3,
Frozen = 4,
Count = 5,
};
constexpr std::size_t kTierCount = static_cast<std::size_t>(Tier::Count);
[[nodiscard]] const char* tier_name(Tier t) noexcept;
struct Entity {
EntityId id = 0;
Vec3 position;
float activity = 0.f;
bool pinned = false;
};
struct SchedulerConfig {
float hot_radius = 60.f;
float warm_radius = 150.f;
float cool_radius = 350.f;
float cold_radius = 800.f;
std::uint32_t intervals[kTierCount] = {1, 3, 10, 30, 0};
float activity_promote = 0.75f;
std::size_t max_updates_per_frame = 0;
};
struct FrameStats {
std::uint64_t frame = 0;
std::size_t candidates = 0;
std::size_t updated = 0;
std::size_t deferred = 0;
std::size_t tier_counts[kTierCount] = {};
};
class EntityScheduler {
public:
using UpdateFn = std::function<void(const Entity&)>;
explicit EntityScheduler(SchedulerConfig cfg = {}) : cfg_(cfg) {}
void set_config(const SchedulerConfig& cfg) { cfg_ = cfg; }
[[nodiscard]] const SchedulerConfig& config() const noexcept { return cfg_; }
void set_entities(std::vector<Entity> entities);
void set_players(std::vector<Vec3> players);
[[nodiscard]] std::size_t entity_count() const noexcept {
return entities_.size();
}
void retier();
FrameStats tick(const UpdateFn& fn);
[[nodiscard]] Tier tier_of(EntityId id) const;
[[nodiscard]] std::uint64_t naive_updates() const noexcept {
return naive_updates_;
}
[[nodiscard]] std::uint64_t actual_updates() const noexcept {
return actual_updates_;
}
[[nodiscard]] double work_ratio() const noexcept {
return naive_updates_ == 0
? 1.0
: static_cast<double>(actual_updates_) /
static_cast<double>(naive_updates_);
}
private:
[[nodiscard]] Tier classify(const Entity& e) const;
SchedulerConfig cfg_;
std::vector<Entity> entities_;
std::vector<Vec3> players_;
std::vector<Tier> tiers_;
std::vector<std::uint32_t> next_due_;
std::vector<std::uint32_t> phase_;
std::vector<std::uint8_t> queued_;
std::vector<EntityId> deferred_;
std::uint64_t frame_ = 0;
std::uint64_t naive_updates_ = 0;
std::uint64_t actual_updates_ = 0;
};
}
