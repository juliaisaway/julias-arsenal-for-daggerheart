---
tier: 1
# Adversary tier. Accepted values: 1, 2, 3, or 4
role: standard
# Valid role: bruiser, horde, leader, minion, ranged, skulk, social, solo, standard, support
difficulty: 0
# Non-negative number used for rolls and reactions in the stat block
thresholds: [1, 2]
# Always two values, with the first lower than the second. Example: [7, 18]
healthPoints: 0
# Non-negative number for the adversary's total HP
stress: 0
# Non-negative number for the adversary's total Stress
attack: +0
# Signed integer required. Example: +1 or -2
weapon: Weapon Name
# Name of the main weapon or attack
range: Melee
# Accepted ranges: Melee, Very Close, Close, Far, or Very Far
damage: 1d6
# Base damage for the main attack. Example: 2d8+5
damageType: physical
# Accepted by the build script: physical or magic
experience:
# Optional. Can be plain text or a list. Example: [Voracious +2, Pack Hunter +1]
---

# Adversary Name

Short description of the adversary.

## Motives & Tactics

List the main goals, behaviors, and combat tendencies as a short comma-separated line.

## Features

### Feature Name - Passive

Describe the passive feature.

### Feature Name - Action

Describe the action feature.
