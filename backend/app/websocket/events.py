"""WebSocket message type constants shared by server and frontend."""

# Seat status changed (available / locked / sold)
SEAT_STATUS_CHANGED = "seat_status_changed"

# Queue position update sent to a waiting user
QUEUE_POSITION_UPDATED = "queue_position_updated"

# User has been admitted from the queue — they can now select seats
QUEUE_ADMITTED = "queue_admitted"

# Server heartbeat
PING = "ping"
PONG = "pong"
