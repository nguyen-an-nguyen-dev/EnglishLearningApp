# Engorace garage art — full collection

One flat-vector system for all 10 cars and 10 avatar frames sold in the Gara.
Shop rows keep their existing `id`, `code`, `visual_key` and API.

## Review page

```bash
cd web
npm run dev
# open http://localhost:5173/cosmetics-preview.html
```

Query flags: `?grid=0` turns the grid off, `?anchors=1` shows anchors,
`?ground=0` hides the ground line. `#cars` and `#frames` jump to a section.
The page shows every item at 240 / 120 / 48 px on its rarity card colour.

## Catalogue (all ready)

| Slot | Shop id | Code | Visual key | Rarity |
| --- | ---: | --- | --- | --- |
| Car | 1 | `car_default` | `car_classic_yellow` | Cơ bản |
| Car | 2 | `car_sport_red` | `car_sport_red` | Hiếm |
| Car | 3 | `car_mint` | `car_mint` | Hiếm |
| Car | 4 | `car_navy` | `car_navy` | Sử thi |
| Car | 5 | `car_aurora` | `car_aurora` | Sử thi |
| Car | 6 | `car_gold` | `car_gold` | Huyền thoại |
| Car | 23 | `car_rickshaw` | `car_rickshaw` | Hiếm |
| Car | 24 | `car_monster` | `car_monster` | Sử thi |
| Car | 25 | `car_formula` | `car_formula` | Huyền thoại |
| Car | 26 | `car_jeep` | `car_jeep` | Sử thi |
| Frame | 7 | `frame_default` | `frame_plain` | Cơ bản |
| Frame | 8 | `frame_bronze` | `frame_bronze` | Hiếm |
| Frame | 9 | `frame_silver` | `frame_silver` | Hiếm |
| Frame | 10 | `frame_gold` | `frame_gold` | Sử thi |
| Frame | 11 | `frame_violet` | `frame_violet` | Sử thi |
| Frame | 12 | `frame_prism` | `frame_prism` | Huyền thoại |
| Frame | 27 | `frame_sakura` | `frame_sakura` | Sử thi |
| Frame | 28 | `frame_dragon` | `frame_dragon` | Huyền thoại · khoá bằng overlay |
| Frame | 29 | `frame_ocean` | `frame_ocean` | Hiếm |
| Frame | 30 | `frame_neon` | `frame_neon` | Sử thi |

File names use `visual_key` because that is the key the shop already resolves.
The numeric id and `code` stay unchanged.

## Tokens

| Token | Value |
| --- | --- |
| ink | `#14203a` |
| glass | `#bfe9ff` |
| headlight | `#fff3b0` |
| taillight | `#ff5a5f` |
| metal | `#c9d6ea` |
| gold | `#ffd23f` |
| orange | `#ff9f2e` |
| blue | `#19b6f0` |
| green | `#38c98a` |
| purple | `#a78bfa` |
| stroke | outer 3, inner 2, ink; spokes/tiny details 1.5 |
| car canvas | `0 0 240 130`, ground `y=108`, max `200×80` |
| frame canvas | `0 0 200 200`, avatar `(100,112) r=46` |
| ring | inner 46, outer 60, default 54 |
| rarity cards | common `#e4eaf2`, rare `#cfe8ff`, epic `#e3d7ff`, legendary `#ffe9a8` |

Every vehicle uses one base colour, a 15% darker lower tone and a 35% white
top-left highlight. No gradients, filters or external fonts in the art.

## Shared parts

`parts/carParts.tsx` — `GroundShadow`, `Wheel`, `WheelArch`, `Window`,
`GlassHighlight`, `DoorSeam`, `Headlight`, `Taillight`, `Bumper`, `Mirror`,
`RoofRack`, `Spoiler`, `Antenna`, `Sparkle`, `HoverPad`, `CarSvg`.

`parts/frameParts.tsx` + `parts/frameGeometry.ts` — `FrameSvg`, `AvatarSlot`,
`Ring`, `SmallRing`, `Bead`, `DecorStar`, `StarPt`, `Crown`, `HexBand`,
`Blossom`, `Bubble`, `NeonBolt`, `MascotEye`, `MascotMouth`, `MascotNose`,
`MascotWhiskers`, `MascotBeak`, `MascotTongue`, plus ring geometry helpers.

Anchors are explicit:
- spoiler = two struts on the boot;
- roof rack = two feet on the roof;
- side exhaust / spare wheel = mounted on the body;
- hover pads = two pylons, bottom at `y=102`;
- frame ornaments = 45° ring points, touching or overlapping the ring;
- laurel/paws/claws/blossoms = drawn on the ring band, not floating.

## Integration

- `CarSideArt.tsx` keeps `CarSideArt` and `CarSidePreview` props, resolves art
  from `garage/catalog.ts`, unknown keys fall back to the classic car.
- `AvatarFrame.tsx` composes one SVG per `visualKey` and switches to the
  small ring at `size <= 48`.
- `CosmeticPreview` and the Gara bay use the new side art without API changes.
- `gara.css` now has a distinct `--gc-card-legendary` and a full-height frame
  bay override. The garage bay car is 230 px with the 22-unit shadow band
  translated out of view.

## Verification

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run build
```

Preview the catalog at `/cosmetics-preview.html`.
