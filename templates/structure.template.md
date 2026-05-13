---
tier: 1
# Structure tier. Accepted values: 1, 2, 3, or 4
type: colossus
# Structure type label shown beside the tier
size: 0 ft. tall, 0 ft. wide
# Optional size text for the main stat block
segments:
  list:
    - 1 Segment
# Optional segment summary shown on Main.md
thresholds: [1, 2]
# Optional. Always two values, with the first lower than the second
stress: 0
# Optional non-negative number for shared Stress
experience:
# Optional. Can be plain text or a list. Example: [Huge +2, Ancient +1]
---

# Structure Name

Short description of the full structure.

## Motives & Tactics

List the main goals, behaviors, and combat tendencies as a short comma-separated line.

## Features

### Feature Name - Passive

Describe a feature shared by the whole structure.

## Design notes

Optional author notes about why this structure exists, what inspired it, or how it is meant to be used.

<!--
Segment files live beside Main.md in the same folder. Example segment:

---
adjacentSegments: [Main Segment]
difficulty: 12
healthPoints: 4
attack: +1
weapon: Strike
range: Melee
damage: 1d8+2
damageType: physical
---

# Structure Segment

## Features

### Feature Name - Action

Describe this segment's feature.

Attack fields are optional for segments, but if one attack field is present,
all five are required: attack, weapon, range, damage, and damageType.
-->
