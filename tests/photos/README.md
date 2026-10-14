# Labelled photos

Real photos for measuring how well a tap on a photo finds the thing meant (*Tap things on the photo*, issues #35,
#37, #39). Each is 1024 pixels wide. `labels.json` lists, per photo, where to tap and the outline that's meant,
in those pixels:

- `split`: `dev` photos were used while choosing how picking works; `holdout` photos were only scored afterwards,
  to check it generalises.
- `targets`: `tap` (x, y), `kind` (`rect` for things with four corners, `any` otherwise), and `levels`: the
  acceptable outlines, innermost first. A raised-panel door has two (its panel and the whole door); a shape lying
  between them (one of the door's moldings) counts as right too.

Labels were marked by hand on zoomed crops, to within about 3 pixels.

| File | Source | Licence |
|---|---|---|
| `blue-kitchen.jpg` | [Blue white kitchen interior (Unsplash)](https://commons.wikimedia.org/wiki/File:Blue_white_kitchen_interior_(Unsplash).jpg), Wikimedia Commons | CC0 |
| `front-door.jpg` | [Front Door, Philip Porcher House, Charleston, SC](https://commons.wikimedia.org/wiki/File:Front_Door,_Philip_Porcher_House,_Harleston_Village,_Charleston,_SC_(49364384742).jpg), Wikimedia Commons | CC0 |
| `dining-room.jpg` | [Betimmering eetkamer - Dining Room Wainscot](https://commons.wikimedia.org/wiki/File:Betimmering_eetkamer_-_Dining_Room_Wainscot_(5260603758).jpg), Flickr Commons via Wikimedia Commons | No known copyright restrictions |
| `porch.jpg` | [Front door of Jennifer's home](https://commons.wikimedia.org/wiki/File:Front_door_of_Jennifer%27s_home_(5804901207).jpg), Flickr via Wikimedia Commons | CC BY 2.0 |
| `fireplace.jpg` | [The Living Room at 219 North Delaware Street](https://commons.wikimedia.org/wiki/File:The_Living_Room_at_219_North_Delaware_Street_(da5c22a2-6ce1-40aa-8b98-18308aa4f4cc).jpg), Wikimedia Commons | Public domain |

`node bench/pick.bench.mjs` scores them; `PHOTOS=/some/dir` adds a folder of your own laid out the same way
(photos and a `labels.json`), which stays out of the repository.
