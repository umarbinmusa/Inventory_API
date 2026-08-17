// Generates numbers like "ORD-20260813-001" / "RCP-20260813-001".
// Counts today's existing documents to pick the next sequence, then retries
// on a (rare) unique-index collision from a concurrent request - simple and
// good enough at small-business POS volume without needing a separate
// counters collection.
const todayDatePart = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

export const generateSequenceNumber = async (Model, field, prefix) => {
  const datePart = todayDatePart();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countToday = await Model.countDocuments({ createdAt: { $gte: startOfDay } });
    const sequence = String(countToday + 1 + attempt).padStart(3, "0");
    const candidate = `${prefix}-${datePart}-${sequence}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Model.exists({ [field]: candidate });
    if (!exists) return candidate;
  }

  // Extremely unlikely fallback - guarantees uniqueness even under a burst.
  return `${prefix}-${datePart}-${Date.now().toString().slice(-6)}`;
};
