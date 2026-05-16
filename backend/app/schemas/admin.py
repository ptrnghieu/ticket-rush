from pydantic import BaseModel


class DashboardResponse(BaseModel):
    event_id: int
    event_name: str
    total_seats: int
    sold_seats: int
    locked_seats: int
    available_seats: int
    occupancy_rate: float   # percentage: sold / total * 100
    total_revenue: float
    favorite_count: int = 0


class AudienceAnalyticsResponse(BaseModel):
    event_id: int
    total_buyers: int
    gender_breakdown: dict   # {"male": N, "female": N, "other": N, "unknown": N}
    age_groups: dict         # {"under_18": N, "18_25": N, "26_35": N, ...}
