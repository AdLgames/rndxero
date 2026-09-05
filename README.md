# DERELICT

A card-stacking survival builder aboard a dead space station. Drag a card onto a
card; everything else emerges. The oxygen runs out on a clock and the station's
logs disagree with each other about what killed the last crew.

Godot 4.3+, GDScript. Full design in [DERELICT_GDD.md](DERELICT_GDD.md).

## Running

Open the project folder in Godot 4.3 or newer and press play.
`scenes/Title.tscn` is the main scene.

- **Drag a card onto another** to stack them. Picking a card up takes everything
  above it, as in Stacklands.
- A stack that matches a recipe works on its own, provided a **crew card** is on
  it. The bar at the bottom of the top card is its progress.
- **Space** or the Pause button stops the cycle clock. **Esc** closes an overlay.
- **Recipes** lists what you have discovered, across all runs.

You start with six oxygen and one Salvager who breathes one a cycle, so you have
six cycles to build a Scrubber. The path is Scrap+Scrap → Wire, Wire+Scrap →
Circuit, Circuit+Battery → Scrubber, which spends exactly the three Scrap and
the Battery you begin with. That is deliberate (§4).

## Status

**M0 through M2 of the five milestones in §14 are built** — the prototype, the
vertical slice and content complete. That is: all five sectors and their pack
pools, all fifty recipes from §5, the hazard drift table, crew traits, morale
and relationships, the twelve Logs, ARIA, the four endings, and
meta-progression.

Not built: **M3 polish** (final art, audio, tutorial, accessibility, Steam page)
and **M4 launch**. Also unbuilt, and called out separately because §13 lists it
under Tech rather than a milestone: **per-cycle autosave of a run**. Meta
progression does persist — recipes discovered, logs recovered, endings reached.

## Layout

```
data/       eight content files -- cards, recipes, packs, hazards, traits,
            balance, logs, aria. Section 13: designers add content without code.
scenes/     Title, Main, Board, Card, ui/
scripts/
  autoload/ Events (bus), Data (content), Meta (what survives a run), Game (the cycle)
  ui/       HUD, Toast, ChoicePrompt, LogReader, AriaPanel, RecipeBook, EndingScreen, Title
  *.gd      Board, Card, Stack, CraftLogic, CrewLogic, HazardLogic,
            PackLogic, PowerLogic, StoryLogic, EndingLogic, Main
tools/      placeholder art generator
```

`Stack` is the unit of play: an ordered pile with a position. `CraftLogic`
matches a pile's contents against the recipe table as an unordered multiset and
requires an exact match — an extra card means no recipe, which is what makes
clearing a stack a deliberate act.

## Decisions the GDD left open

Recorded here because each one is a real fork, and all are commented where they
are implemented.

- **What needs power.** §5 says a Generator "powers 3 modules" but never says
  which modules require power. Requiring it of everything would strand a new run
  — the Scrubber arrives long before any generator — so `needs_power` is set
  only on the tier-2 and prototype modules. Life support never needs it.
- **Benches are not ingredients.** A Workshop is something you stack *onto*, so
  counting it in the recipe multiset would stop every recipe matching. Cards
  with `craft_speed` are excluded from matching, like crew.
- **Recipes that keep their inputs.** 17, 21, 24, 43, 45–50 keep some inputs, so
  they would fire again the frame they finished. Reading a Log is gated on the
  Log being unread; ARIA's dialogue is gated to once a cycle. The Airlock and
  Sensor Array are *kept* rather than consumed by recipes 21 and 24, because
  consuming them would strand the player with no way to open packs or catch
  Signals.
- **Ruins.** §10 gives the Engineer "Scrap + ruin → module" and §5's table never
  lists it. Added, with a fallback that gets the metal back for anyone else. A
  ruin remembers what it was.
- **Two spec gaps in the numbers.** §2 lists four beats in a cycle; the crew
  upkeep, hazard consequences and slot check in §§3, 6, 7 and 10 all also attach
  to a cycle boundary, so the cycle runs nine steps in a documented order.

## Content

12 Logs at roughly 130 words each, not the ~300 §15 estimates — they are read on
an overlay mid-run, and 300 words is a long time to be looking away from a board
that is still burning. 32 ARIA dialogue nodes against §15's ~40. Both are
complete as stories; neither hits the word count.

## Art

Everything is placeholder, from `tools/gen_placeholder_art.py`: §12's
near-monochrome cold blue-grey with one warm amber accent for anything living or
powered. Each of the 59 faces is a type silhouette plus an identicon derived
from the card id, so the board reads without 59 hand-drawn icons. Card name and
effect are Labels, not baked into the image, so they stay sharp and survive the
art being replaced.

> This repository previously held four unrelated projects (ClaimTrail,
> Giantfall, LANES and Ashford Crossing); all remain in git history.
