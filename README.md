# nhl-stats

CLI to get NHL statistics for a given team, season, match and more.

## Usage

1. Add `nhl-stats` executable (downloaded from Releases) to PATH.
2. Run commands:

```bash
# updates the local database with match info from a given season.
# can be interrupted and resumed.
#
# args:
# --season 2023 // Required.
nhl-stats update-db --season 2023

# gets match data matching filters and writes data to json or csv.
#
# args:
# --season 2023 // Optional
# --team Penguins // Optional
# --type 2 // Optional. 1 = Preseason, 2 = Regular, 3 = Playoffs
# --game // Optional. Uses match ID (see source for details)
# --output json // Optional. Supports 'json' and 'csv' values.
nhl-stats get --team Penguins --season 2023 --output json
```
