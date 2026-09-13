DELETE FROM usage_events
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY generation_id ORDER BY occurred_at ASC, id ASC) AS row_number
    FROM usage_events
    WHERE generation_id IS NOT NULL
  ) duplicates
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_generation_unique_idx ON usage_events (generation_id);
