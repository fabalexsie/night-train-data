# Route Variations

## Why Some Routes Take Different Paths in Each Direction

Some night train routes intentionally take different paths depending on the direction of travel. This is not a data error, but rather reflects real-world operational decisions by train operators.

### Example: Amsterdam ↔ Wien (Vienna)

**Route 46: NJ 40421 / NJ 40490**

The ÖBB Nightjet between Amsterdam and Wien takes different routes:

- **NJ 40421** (Amsterdam → Wien): Via **Hannover**
  - Amsterdam → Amersfoort → Deventer → **Hannover** → Kassel → Würzburg → Nürnberg → Regensburg → Passau → Wels → Linz → St. Pölten → Wien

- **NJ 40490** (Wien → Amsterdam): Via **Hamm & Münster**
  - Wien → St. Pölten → Linz → Wels → Passau → Regensburg → Nürnberg → Würzburg → Kassel → **Hamm** → **Münster** → Deventer → Amersfoort → Amsterdam

**Similarity**: Despite the different intermediate stations, these routes share **86.7%** of their stations (13 out of 15 stations match when reversed).

### Why Different Routes?

Train operators may choose different paths for various reasons:
- **Scheduling**: Optimizing arrival/departure times at major stations
- **Track availability**: Working around freight traffic or other passenger services
- **Connections**: Providing better connections to/from intermediate cities
- **Operational efficiency**: Crew changes, maintenance facilities, or refueling stops

### Pattern in ÖBB Nightjet Services

This pattern is consistent across multiple ÖBB Nightjet routes to/from Amsterdam:

| Route | Amsterdam → East | East → Amsterdam |
|-------|------------------|------------------|
| NJ 40421/40490 (Wien) | Via Hannover | Via Hamm & Münster |
| NJ 421/420 (Innsbruck) | Via Hannover | Via Hamm & Münster |

### How the Data Handles This

Our data correctly represents these route variations:
1. Both directions are included in the same route entry
2. The `route_desc` field documents both paths with their train numbers
3. The `combine-routes.js` script can identify and combine routes with 70%+ similarity
4. Each trip maintains its own accurate station list and schedule

### For Users

When searching for routes between two cities, you may see:
- Different intermediate stations depending on direction
- Different travel times due to different routings
- This is expected and reflects the actual train service

If you need specific information about intermediate stops for your journey, always check the direction-specific trip details in the `trip_stop` data.
