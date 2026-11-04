"""Generate a broad, reproducible pool for the final corridor comparison."""
from argparse import ArgumentParser
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, replace
from importlib import import_module
import json
from pathlib import Path
import random

from corridor_search import PRESSURES

AverageSearch = import_module('search-average-corridors').AverageSearch
export_plans = import_module('build-corridor-candidates').export_plans
ROOT = Path(__file__).resolve().parents[1]

# Vary fleet pressure, hub reward, shortcut access, and average distance.
PRESSURES_FINAL = (
    (8, 169, 22, 250, 155, 46), (18, 167, 24, 310, 160, 55),
    (30, 165, 16, 345, 185, 32), (45, 164, 12, 360, 125, 28),
    (8, 171, 46, 215, 120, 70), (15, 170, 30, 255, 100, 62),
    (28, 168, 36, 305, 210, 48), (4, 166, 14, 320, 250, 20),
)


def setup(index):
    avg, links, access, fleet, short, hub = PRESSURES_FINAL[index]
    data = json.loads((ROOT / 'assets/corridor-data.json').read_text())
    search = AverageSearch(data, avg, links)
    search.short_penalty, search.hub_reward = short, hub
    pressure = replace(PRESSURES[1], key=f'final_pressure_{index}', label='Final corridor search',
                       short=150, fleet=fleet, access=access, hub=0, endpoint=0, loops=False)
    return data, search, pressure


def accept(search, paths):
    if any(len(p) < 3 for p in paths):
        return False
    return (sum(len(p) - 1 for p in paths) >= 162 and
            sum(search.stats(p)['fuel'] for p in paths) / len(paths) >= 515)


def run(task):
    index, key, seed, plan = task
    _, search, pressure = setup(index)
    start = search.seed_alaska(plan)
    search.validate(start, loops=False)
    paths, trace = search.search(pressure, seed, 0, proposals=26000, start=start)
    return ({'id': key, 'pressure': index, **trace}, paths if accept(search, paths) else None)


def local_candidates(search, pressure, seeds):
    rng = random.Random(261108901)
    out = {}
    proposals = 0
    for prefix, plan in seeds.items():
        origin = search.seed_alaska(plan)
        for depth in (1, 2, 4, 7):
            for run_index in range(10):
                paths = origin
                for _ in range(depth):
                    score, membership = search.score(paths, pressure)
                    for _ in range(70):
                        proposals += 1
                        trial = search.mutate(paths, membership, pressure, rng)
                        if not trial or trial == paths or not accept(search, trial):
                            continue
                        if search.score(trial, pressure)[0] > score + 500:
                            continue
                        try:
                            search.validate(trial, loops=False)
                        except ValueError:
                            continue
                        paths = trial
                        break
                if paths != origin:
                    out[f'{prefix}_near_{depth}_{run_index}'] = paths
    return out, proposals


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--refine', type=Path, help='JSON of layouts shortlisted by operating simulation')
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    data, search, pressure = setup(0)
    average = json.loads((ROOT / 'assets/average-corridors.json').read_text())
    long_haul = json.loads((ROOT / 'assets/long-haul-corridors.json').read_text())['plan']
    connected = json.loads((ROOT / 'assets/connected-corridors.json').read_text())['plan']
    starts = {'balanced': average['balanced']['plan'], 'longer': average['plan'], 'long_haul': long_haul,
              'connected': connected, 'long_runs': data['plans']['long_runs_b']}
    out, logs = {}, []
    if args.refine:
        seeds = json.loads(args.refine.read_text())
        out, near_count = local_candidates(search, pressure, seeds)
    else:
        tasks = [(index, f'broad_{index}_{label}_{rep}', 261108000 + index * 100 + offset * 4 + rep, plan)
                 for index in range(len(PRESSURES_FINAL))
                 for offset, (label, plan) in enumerate(starts.items())
                 for rep in range(2 if label == 'balanced' else 1)]
        with ProcessPoolExecutor(max_workers=args.workers) as executor:
            for log, paths in executor.map(run, tasks):
                logs.append({key: value for key, value in log.items() if key != 'trace'})
                if paths:
                    out[log['id']] = paths
                print('Search', log['id'], log['proposals'], 'proposals', flush=True)
        near, near_count = local_candidates(search, pressure, {'balanced': starts['balanced'], 'longer': starts['longer']})
        out.update(near)
        out['alaska_adjustment'] = search.seed_alaska(long_haul)
    unique = {tuple(sorted(tuple(line['path']) for line in starts['balanced']['lines']))}
    finalists = {}
    for key, paths in out.items():
        if paths in unique or not accept(search, paths):
            continue
        search.validate(paths, loops=False)
        unique.add(paths)
        finalists[key] = {'pressure': asdict(pressure), 'paths': paths, 'metrics': search.metrics(paths, pressure)}
    result = {'runs': logs, 'local_proposals': near_count,
              'plans': export_plans(data['edges'], finalists, len(data['cities']))}
    args.output.write_text(json.dumps(result, separators=(',', ':')))
    print('Unique layouts for operating screen:', len(finalists), flush=True)


if __name__ == '__main__':
    main()
