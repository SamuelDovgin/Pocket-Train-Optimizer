# Clean-slate corridor search · 27-train recommendation

[Interactive comparison, maps and reference checklist](https://samueldovgin.github.io/Pocket-Train-Optimizer/docs/corridor-search.html).

The tuning-selected candidate uses 27 trains and 141 of 191 available connections. Every one of the 139 cities remains connected. It has zero branches and 0 compact loops. 50 links are unused, not deleted from an existing game.

## Search constraints and pressures

The topology search reads only station names, reference-image positions, regions, available connections and distances. It omits starting owners, completed tracks, purchase stages and prior plans. There are no protected starting tracks or fixed long spines. The resulting graph is selected before any reference-map migration is constructed.

Each railroad is a simple path or a standalone compact cycle. Open paths must have at least 85% chord directness and no individual turn above 100 degrees. A loop has 3–4 distinct stations, at most 260 track-distance and at most 170 reference-image pixels in diameter. No lollipop or loop with an attached stem is permitted. A 2,400 track-distance construction bound limits extreme routes; this is not an actual train tank.

The network-aware pressures penalize missing shortcut links by full-map weighted edge betweenness × track-distance. This is an access proxy, not claimed lost revenue. Surrogate cost also combines endpoint bend loss, cumulative turn cost, fleet size, a short-line term below 160 image pixels, off-hub intersections, endpoint placement and total track-distance, less an endpoint-span term. Loop bend cost uses a discounted local-collector allowance; it is a declared shape exception, not extra cargo payout. Weights use mixed proxy units and express preferences, not actual prices. Current per-car payout stays direct map separation × cargo multiplier.

Map-derived hub candidates use weighted betweenness and spatial separation, up to three per region. A separate community-nominated set tests Paris, Madrid, Moscow, Cairo, Beijing, Tehran, New York, Caracas, Dakar, Broome, Kupang, Singapore and Fortaleza. A designated hub is a search preference; actual shared stations in a candidate may differ.

Moves re-pair route arms at intersections, merge and cut routes, swap unused/used physical edges while preserving global connectivity, add/remove redundant links and extract/break compact loops. All accepted topology states retain every city and have unique track ownership.

40 campaigns attempted 618,030 proposals, with 274,086 valid candidates. Each pressure gets three independent starts capped at 18,000 proposals, followed by a compatible cross-seed refinement capped at 24,000. After 12,000 attempted proposals a run may stop following 7,000 since its last improvement. These are bounded heuristic plateaus, not a proof of a global optimum.

| Tuning-selected preference | Trains | Links | Weighted chord directness | Loops |
| --- | ---: | ---: | ---: | ---: |
| Balanced long corridors | 30 | 147 | 94.0% | 0 |
| Fewer trains · longer runs | 25 | 154 | 92.3% | 0 |
| Strong straightness pressure | 48 | 146 | 98.0% | 0 |
| Concentrated transfer hubs | 27 | 141 | 93.8% | 0 |
| Compact collector loops allowed | 27 | 141 | 93.8% | 0 |
| Community-nominated hub crossings | 27 | 141 | 93.8% | 0 |
| All-track coverage comparison | 50 | 191 | 94.4% | 1 |
| Long corridors with useful shortcuts | 38 | 169 | 93.9% | 8 |
| Hub crossings with shortcut access | 40 | 172 | 93.8% | 8 |
| Stronger network-access pressure | 47 | 177 | 95.0% | 9 |
| One Nordic collector loop | 28 | 142 | 93.8% | 1 |
| Nordic and Australia collector loops | 30 | 143 | 93.9% | 2 |

## Operating selection and held-out comparison

2,384 simulations use the existing physical operating core. Four express/corridor-loading dispatch configurations are tuned per candidate on separate policy seeds. Geometry selection uses three additional seeds over eight settings: uniform, local, global, light, infrequent check-ins, long-run, generic refueling and high capacity. Following the preference to keep the long-route vision primary, this shortlist conservatively permits at most two compact collectors. Explicit Nordic and Australia variants test natural regional exceptions; loop-rich variants that fragment main spines remain comparisons. Selection utility is the geometric mean of normalized reward per train raised to 0.65 and reward per dispatch raised to 0.35. This favors fleet/attention efficiency; it is not a new payout formula or a net-profit calculation.

The geometry recommendation is frozen before held-out episodes on 12 entirely different seeds per setting. Those outcomes do not choose the winner. Every candidate uses the same 139 destinations and available geography. Total reward, per-train reward and per-command reward are reported separately because fleet sizes differ. The comparison references are the previous 38- and 28-corridor experiments, not a player save.

Job probabilities, counts, approximate payout geometry and train settings are assumptions. Board grouping, Bux/crates/events, repair/capital costs, engine-specific statistics and a finite action budget remain absent. The high-capacity case uses 28 generic slots; tank 600 is illustrative. A line can be longer than a tank because express commands stop/refuel along it.

| Held-out setting | Total reward / old 38 reference | Per train / reference | Per command / reference |
| --- | ---: | ---: | ---: |
| uniform | 0.57× | 0.80× | 1.10× |
| local | 0.57× | 0.80× | 1.11× |
| global | 0.62× | 0.87× | 1.21× |
| light | 0.45× | 0.63× | 0.87× |
| infrequent | 0.52× | 0.73× | 0.78× |
| long_run | 0.74× | 1.04× | 1.43× |
| refueling | 0.41× | 0.57× | 0.88× |
| high_capacity | 0.41× | 0.58× | 0.81× |

## Chosen train duties

Open routes shuttle out and back. Ordered loop stops are circuits. Route labels were assigned independently of current colors. Distances below are total assigned track-distance, not tank requirements.

- **R01 · 635**: Adelaide → Alice Springs → Broome → Kupang → Jakarta → Singapore → Bangkok → Kolkata → New Delhi

- **R02 · 867**: Algiers → Tripoli → Cairo → Amman → Baghdad → Tehran → Kabul → New Delhi → Chengdu → Xi'An → Shanghai → Nagasaki → Tokyo

- **R03 · 47**: Anchorage → Fairbanks

- **R04 · 230**: Athens → Amman → Riyadh → Dubai

- **R05 · 566**: Boston → New York → St. Louis → Denver → San Francisco → Honolulu

- **R06 · 865**: Buenos Aires → Porto Alegre → Rio de Janeiro → Salvador → Fortaleza → Dakar → Casablanca → Madrid → Bordeaux → Paris → Amsterdam → Copenhagen → Stockholm

- **R07 · 370**: Cairo → Khartoum → Nairobi → Zanzibar → Harare → Pretoria

- **R08 · 763**: Cape Town → Porto Alegre → Asuncion → Arequipa → Lima → Easter Island

- **R09 · 246**: Caracas → Bogota → Managua → Mexico City

- **R10 · 285**: Chengdu → Hanoi → Hong Kong → Manila → Manado

- **R11 · 1378**: Christchurch → Wellington → Auckland → Sydney → Melbourne → Adelaide → Perth → Antananarivo → Harare → Luanda → Kinshasa → Lagos → Bamako → Dakar

- **R12 · 128**: Denver → Calgary → Edmonton

- **R13 · 255**: Dublin → London → Paris → Munich → Budapest → Istanbul

- **R14 · 335**: Fortaleza → Belem → Caracas → San Juan → Havana → Miami

- **R15 · 242**: Glasgow → Reykjavik → Tasiilaq

- **R16 · 679**: Kyiv → Volgograd → Urumqi → Beijing → Shenyang → Vladivostok → Sendai

- **R17 · 834**: Los Angeles → Phoenix → Houston → New Orleans → Atlanta → Washington DC → New York → Lisbon → Madrid → Barcelona → Milan → Rome

- **R18 · 381**: Manaus → Arequipa → Santiago → Punta Arenas

- **R19 · 520**: Minneapolis → Winnipeg → Calgary → Vancouver → Anchorage → Nome

- **R20 · 1077**: Munich → Berlin → Minsk → Moscow → Perm → Novosibirsk → Yakutsk → Magadan → Anadyr

- **R21 · 153**: Oslo → Stockholm → Helsinki → St. Petersburg

- **R22 · 196**: Perth → Broome → Darwin

- **R23 · 236**: Seoul → Shenyang → Harbin → Yakutsk

- **R24 · 164**: Shanghai → Beijing → Ulan Bator

- **R25 · 445**: St. Louis → Chicago → Detroit → Toronto → Montreal → Goose Bay → Nuuk → Tasiilaq

- **R26 · 196**: Sydney → Brisbane → Cairns → Port Moresby

- **R27 · 234**: Tehran → Karachi → Mumbai → Bangalore

## Work backward from the public reference

Public reference of 15 owned tracks only; does not read browser saves or assert this is the player’s current game. The historical construction tracker is not rewritten. A separate optional reference checklist records completion in its own local storage key and requires the player to check the starting-map assumption.

The dry-run has 141 steps, 0 unresolved steps, and 3 additional feeder/holding routes. Every intermediate owner graph is checked for connectivity. Final ownership is branch-free if the sequence is complete. Existing tracks are retained; a built link absent from the operating graph needs a separate feeder/holding arrangement, not demolition. Such extra routes would be outside the reported operating fleet.

Labels are matched after selection to preserve as many existing ownerships as possible. Builds connect to the current physical and recipient networks; licenses precede cross-region purchases. Corrections are deferred while connected purchases can progress, then used to unlock the remaining target or align ownership. This is a connectivity schedule, not an optimized phase-by-phase earnings strategy. A usable engine, safe positions, live fees and sufficient cash must be verified at each actual step.

| Order | Action | Connection / region | Owner / change |
| ---: | --- | --- | --- |
| 1 | BUILD | Amsterdam ↔ Copenhagen | Cyan |
| 2 | BUILD | Copenhagen ↔ Stockholm | Cyan |
| 3 | BUILD | Oslo ↔ Stockholm | R21 |
| 4 | BUILD | Helsinki ↔ Stockholm | R21 |
| 5 | BUILD | Helsinki ↔ St. Petersburg | R21 |
| 6 | BUILD | Budapest ↔ Istanbul | Pink |
| 7 | BUILD | Berlin ↔ Minsk | R20 |
| 8 | BUILD | Minsk ↔ Moscow | R20 |
| 9 | BUILD | Kyiv ↔ Volgograd | R16 |
| 10 | BUILD | Glasgow ↔ Reykjavik | R15 |
| 11 | CORRECT OWNERSHIP | Berlin ↔ Munich | Green → R20 |
| 12 | CORRECT OWNERSHIP | Budapest ↔ Kyiv | Pink → F01 |
| 13 | CORRECT OWNERSHIP | Milan ↔ Munich | Green → F03 |
| 14 | CORRECT OWNERSHIP | Milan ↔ Rome | Blue → Green |
| 15 | CORRECT OWNERSHIP | Milan ↔ Paris | Blue → F03 |
| 16 | CORRECT OWNERSHIP | London ↔ Paris | Blue → Pink |
| 17 | BUILD | Dublin ↔ London | Pink |
| 18 | LICENSE | Africa |  |
| 19 | BUILD | Casablanca ↔ Madrid | Cyan |
| 20 | BUILD | Casablanca ↔ Dakar | Cyan |
| 21 | BUILD | Bamako ↔ Dakar | R11 |
| 22 | BUILD | Bamako ↔ Lagos | R11 |
| 23 | BUILD | Kinshasa ↔ Lagos | R11 |
| 24 | BUILD | Kinshasa ↔ Luanda | R11 |
| 25 | BUILD | Harare ↔ Luanda | R11 |
| 26 | BUILD | Harare ↔ Pretoria | R07 |
| 27 | BUILD | Harare ↔ Zanzibar | R07 |
| 28 | BUILD | Nairobi ↔ Zanzibar | R07 |
| 29 | BUILD | Khartoum ↔ Nairobi | R07 |
| 30 | BUILD | Cairo ↔ Khartoum | R07 |
| 31 | BUILD | Antananarivo ↔ Harare | R11 |
| 32 | BUILD | Cairo ↔ Tripoli | R02 |
| 33 | BUILD | Algiers ↔ Tripoli | R02 |
| 34 | LICENSE | Asia |  |
| 35 | BUILD | Amman ↔ Cairo | R02 |
| 36 | BUILD | Amman ↔ Baghdad | R02 |
| 37 | BUILD | Baghdad ↔ Tehran | R02 |
| 38 | BUILD | Amman ↔ Riyadh | R04 |
| 39 | BUILD | Dubai ↔ Riyadh | R04 |
| 40 | BUILD | Amman ↔ Athens | R04 |
| 41 | BUILD | Kabul ↔ Tehran | R02 |
| 42 | BUILD | Kabul ↔ New Delhi | R02 |
| 43 | BUILD | Kolkata ↔ New Delhi | R01 |
| 44 | BUILD | Bangkok ↔ Kolkata | R01 |
| 45 | BUILD | Bangkok ↔ Singapore | R01 |
| 46 | BUILD | Jakarta ↔ Singapore | R01 |
| 47 | BUILD | Jakarta ↔ Kupang | R01 |
| 48 | BUILD | Karachi ↔ Tehran | R27 |
| 49 | BUILD | Karachi ↔ Mumbai | R27 |
| 50 | BUILD | Bangalore ↔ Mumbai | R27 |
| 51 | BUILD | Moscow ↔ Perm | R20 |
| 52 | BUILD | Chengdu ↔ New Delhi | R02 |
| 53 | BUILD | Chengdu ↔ Xi'An | R02 |
| 54 | BUILD | Chengdu ↔ Hanoi | R10 |
| 55 | BUILD | Hanoi ↔ Hong Kong | R10 |
| 56 | BUILD | Hong Kong ↔ Manila | R10 |
| 57 | BUILD | Shanghai ↔ Xi'An | R02 |
| 58 | BUILD | Nagasaki ↔ Shanghai | R02 |
| 59 | BUILD | Nagasaki ↔ Tokyo | R02 |
| 60 | BUILD | Beijing ↔ Shanghai | R24 |
| 61 | BUILD | Manado ↔ Manila | R10 |
| 62 | BUILD | Beijing ↔ Ulan Bator | R24 |
| 63 | BUILD | Novosibirsk ↔ Perm | R20 |
| 64 | BUILD | Urumqi ↔ Volgograd | R16 |
| 65 | BUILD | Beijing ↔ Urumqi | R16 |
| 66 | BUILD | Beijing ↔ Shenyang | R16 |
| 67 | BUILD | Seoul ↔ Shenyang | R23 |
| 68 | BUILD | Shenyang ↔ Vladivostok | R16 |
| 69 | BUILD | Harbin ↔ Shenyang | R23 |
| 70 | BUILD | Sendai ↔ Vladivostok | R16 |
| 71 | BUILD | Harbin ↔ Yakutsk | R23 |
| 72 | BUILD | Novosibirsk ↔ Yakutsk | R20 |
| 73 | BUILD | Magadan ↔ Yakutsk | R20 |
| 74 | BUILD | Anadyr ↔ Magadan | R20 |
| 75 | LICENSE | North America |  |
| 76 | BUILD | Reykjavik ↔ Tasiilaq | R15 |
| 77 | BUILD | Nuuk ↔ Tasiilaq | R25 |
| 78 | BUILD | Goose Bay ↔ Nuuk | R25 |
| 79 | BUILD | Goose Bay ↔ Montreal | R25 |
| 80 | BUILD | Montreal ↔ Toronto | R25 |
| 81 | BUILD | Detroit ↔ Toronto | R25 |
| 82 | BUILD | Chicago ↔ Detroit | R25 |
| 83 | BUILD | Chicago ↔ St. Louis | R25 |
| 84 | BUILD | Denver ↔ St. Louis | R05 |
| 85 | BUILD | Calgary ↔ Denver | R12 |
| 86 | BUILD | Calgary ↔ Edmonton | R12 |
| 87 | BUILD | Calgary ↔ Vancouver | R19 |
| 88 | BUILD | Calgary ↔ Winnipeg | R19 |
| 89 | BUILD | Minneapolis ↔ Winnipeg | R19 |
| 90 | BUILD | New York ↔ St. Louis | R05 |
| 91 | BUILD | Boston ↔ New York | R05 |
| 92 | BUILD | Denver ↔ San Francisco | R05 |
| 93 | BUILD | Anchorage ↔ Vancouver | R19 |
| 94 | BUILD | Anchorage ↔ Fairbanks | R03 |
| 95 | BUILD | Anchorage ↔ Nome | R19 |
| 96 | BUILD | Honolulu ↔ San Francisco | R05 |
| 97 | BUILD | Lisbon ↔ New York | Green |
| 98 | BUILD | New York ↔ Washington DC | Green |
| 99 | BUILD | Atlanta ↔ Washington DC | Green |
| 100 | BUILD | Atlanta ↔ New Orleans | Green |
| 101 | BUILD | Houston ↔ New Orleans | Green |
| 102 | BUILD | Houston ↔ Phoenix | Green |
| 103 | BUILD | Los Angeles ↔ Phoenix | Green |
| 104 | LICENSE | Oceania |  |
| 105 | BUILD | Broome ↔ Kupang | R01 |
| 106 | BUILD | Broome ↔ Darwin | R22 |
| 107 | BUILD | Alice Springs ↔ Broome | R01 |
| 108 | BUILD | Adelaide ↔ Alice Springs | R01 |
| 109 | BUILD | Broome ↔ Perth | R22 |
| 110 | BUILD | Antananarivo ↔ Perth | R11 |
| 111 | BUILD | Adelaide ↔ Perth | R11 |
| 112 | BUILD | Adelaide ↔ Melbourne | R11 |
| 113 | BUILD | Melbourne ↔ Sydney | R11 |
| 114 | BUILD | Brisbane ↔ Sydney | R26 |
| 115 | BUILD | Brisbane ↔ Cairns | R26 |
| 116 | BUILD | Cairns ↔ Port Moresby | R26 |
| 117 | BUILD | Auckland ↔ Sydney | R11 |
| 118 | BUILD | Auckland ↔ Wellington | R11 |
| 119 | BUILD | Christchurch ↔ Wellington | R11 |
| 120 | LICENSE | South America |  |
| 121 | BUILD | Dakar ↔ Fortaleza | Cyan |
| 122 | BUILD | Belem ↔ Fortaleza | R14 |
| 123 | BUILD | Fortaleza ↔ Salvador | Cyan |
| 124 | BUILD | Rio de Janeiro ↔ Salvador | Cyan |
| 125 | BUILD | Porto Alegre ↔ Rio de Janeiro | Cyan |
| 126 | BUILD | Asuncion ↔ Porto Alegre | R08 |
| 127 | BUILD | Buenos Aires ↔ Porto Alegre | Cyan |
| 128 | BUILD | Arequipa ↔ Asuncion | R08 |
| 129 | BUILD | Arequipa ↔ Lima | R08 |
| 130 | BUILD | Arequipa ↔ Santiago | R18 |
| 131 | BUILD | Arequipa ↔ Manaus | R18 |
| 132 | BUILD | Belem ↔ Caracas | R14 |
| 133 | BUILD | Caracas ↔ San Juan | R14 |
| 134 | BUILD | Havana ↔ San Juan | R14 |
| 135 | BUILD | Havana ↔ Miami | R14 |
| 136 | BUILD | Bogota ↔ Caracas | R09 |
| 137 | BUILD | Bogota ↔ Managua | R09 |
| 138 | BUILD | Managua ↔ Mexico City | R09 |
| 139 | BUILD | Punta Arenas ↔ Santiago | R18 |
| 140 | BUILD | Easter Island ↔ Lima | R08 |
| 141 | BUILD | Cape Town ↔ Porto Alegre | R08 |

## Source context

The user-supplied Reddit excerpt by u/Wroberts19 explicitly describes all-track coverage rather than maximum earnings from longer routes. Replies suggest fewer trains for limited play sessions, major Paris/Moscow hubs and longer continental duties. These inform candidate pressures, not a guarantee that an exact human layout is optimal. The excerpt also mentions historical Port Moresby fuel of 50, while this input still has a provisional 70-unit Cairns–Port Moresby connection. The old comment does not verify a current value; this discrepancy and the other provisional lengths remain unresolved.

## Reproduce

```sh
python3 scripts/corridor_search.py
python3 scripts/add-corridor-loop-examples.py
python3 scripts/build-corridor-candidates.py
node scripts/evaluate-corridors.cjs
python3 scripts/migrate-corridor-reference.py
node scripts/build-corridor-maps.cjs
python3 scripts/render-corridor-maps.py
python3 scripts/document-corridor-search.py
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
```

The SVG authoring step is Node-only; PNG rendering additionally needs CairoSVG and system Cairo. The shipped site requires neither Python nor a server-side solver. Raw candidates, pressure weights, traces, seeds and selection records are in `assets/corridor-data.json` and `assets/corridor-results.json`.
