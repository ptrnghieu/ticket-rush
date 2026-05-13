"""
One-time schema migration script.

Run once after pulling these changes:
    cd backend && python migrate.py

Safe to run multiple times — each ALTER is guarded by a column-existence check.
"""

import pymysql
from app.core.config import settings

conn = pymysql.connect(
    host=settings.DB_MASTER_HOST,
    port=settings.DB_MASTER_PORT,
    user=settings.DB_MASTER_USER,
    password=settings.DB_MASTER_PASSWORD,
    database=settings.DB_NAME,
    charset="utf8mb4",
)

def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
        (settings.DB_NAME, table, column),
    )
    return cursor.fetchone()[0] > 0

with conn.cursor() as cur:
    # 1. Expand qr_code from VARCHAR(500) to TEXT
    if column_exists(cur, "tickets", "qr_code"):
        cur.execute("ALTER TABLE tickets MODIFY COLUMN qr_code LONGTEXT NULL")
        print("✓ tickets.qr_code → LONGTEXT")
    else:
        print("  tickets.qr_code not found, skipping")

    # 2. Add event_type ENUM to events
    if not column_exists(cur, "events", "event_type"):
        cur.execute(
            "ALTER TABLE events ADD COLUMN event_type ENUM("
            "'concert','festival','theater','sports','conference','cinema','comedy','other'"
            ") NULL DEFAULT 'other' AFTER status"
        )
        print("✓ events.event_type column added")
    else:
        print("  events.event_type already exists, skipping")

    # 3. Create favorites table
    cur.execute("SHOW TABLES LIKE 'favorites'")
    if not cur.fetchone():
        cur.execute(
            "CREATE TABLE favorites ("
            "  id INT AUTO_INCREMENT PRIMARY KEY,"
            "  user_id INT NOT NULL,"
            "  event_id INT NOT NULL,"
            "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
            "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
            "  UNIQUE KEY uq_favorite (user_id, event_id),"
            "  KEY ix_favorites_user (user_id),"
            "  KEY ix_favorites_event (event_id),"
            "  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,"
            "  CONSTRAINT fk_fav_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE"
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )
        print("✓ favorites table created")
    else:
        print("  favorites table already exists, skipping")

conn.commit()
conn.close()
print("\nMigration complete.")
