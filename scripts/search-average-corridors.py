"""Search for long average duties with every city served and at least three stops per train."""
from argparse import ArgumentParser
from dataclasses import asdict, replace
from importlib import import_module
import json
from pathlib import Path
import sys

from corridor_search import PRESSURES

LongHaulSearch = import_module('search-long-haul-corridors').LongHaulSearch
ROOT = Path(__file__).resolve().parents[1]
ALASKA = ('Fairbanks', 'Anchorage', 'Nome')


class AverageSearch(LongHaulSearch):
    def __init__(self, data, average_weight, min_links):
        super().__init__(data, short_penalty=140, hub_reward=35)
        self.average_weight = average_weight
        self.min_links = min_links

    def valid(self, path, loops):
        # Anchorage has two dead ends and a single connection to Vancouver.
        # Pair the dead ends locally to cover both without a one-link duty.
        return path in (ALASKA, ALASKA[::-1]) or super().valid(path, loops)

    def route_cost(self, path, pressure):
        return super().route_cost(path, pressure) + (2400 if len(path) == 2 else 0)

    def score(self, paths, pressure):
        cost, membership = super().score(paths, pressure)
        length = sum(self.stats(path)['fuel'] for path in paths)
        links = sum(len(path) - 1 for path in paths)
        return cost - self.average_weight * length / len(paths) + 170 * max(0, self.min_links - links), membership

    def seed_alaska(self, plan):
        paths = [tuple(line['path']) for line in plan['lines']]
        for path in paths[:]:
            if path[0] == path[-1]:
                edge = min(self.stats(path)['ids'], key=self.access_impact.get)
                paths = self.remove_edge(paths, edge)
        for a, b in zip(ALASKA, ALASKA[1:]):
            paths = self.remove_edge(paths, self.eid(a, b))
        pieces = [piece for path in paths for piece in (
            [path] if self.valid(path, False) else
            [self.canonical((a, b)) for a, b in zip(path, path[1:])]
        )]
        return tuple(sorted([*pieces, ALASKA]))


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--pool', type=Path, help='Write candidate plans for simulation screening')
    args = parser.parse_args()
    data = json.loads((ROOT / 'assets/corridor-data.json').read_text())
    long_haul = json.loads((ROOT / 'assets/long-haul-corridors.json').read_text())['plan']
    connected = json.loads((ROOT / 'assets/connected-corridors.json').read_text())['plan']
    starts = {'long_haul': long_haul, 'fewer_trains': data['plans']['long_runs_b'], 'connected': connected}
    runs, candidates = [], {}
    for index, (average_weight, min_links, access, fleet) in enumerate((
        (8, 167, 28, 260), (16, 166, 25, 330), (26, 160, 18, 390), (38, 150, 12, 460),
    )):
        search = AverageSearch(data, average_weight, min_links)
        pressure = replace(PRESSURES[1], key=f'average_{index}', label='Longer average routes',
                           short=140, fleet=fleet, access=access, hub=0, endpoint=0, loops=False)
        for offset, (label, plan) in enumerate(starts.items()):
            start = search.seed_alaska(plan)
            search.validate(start, loops=False)
            paths, trace = search.search(pressure, 261107200 + index * 10 + offset,
                                         offset, proposals=16000, start=start)
            key = f'{pressure.key}_{offset}'
            metrics = search.metrics(paths, pressure)
            runs.append({'id': key, 'start': label, 'average_weight': average_weight, 'link_target': min_links, **trace})
            singletons = sum(len(path) == 2 for path in paths)
            print(key, metrics['tracks'], metrics['fleet'], metrics['interchanges'],
                  round(metrics['total_track_distance'] / metrics['fleet'], 1),
                  f'{singletons} two-stop duties', file=sys.stderr, flush=True)
            if singletons:
                continue
            candidates[key] = {'pressure': asdict(pressure), 'paths': paths, 'metrics': metrics}
    # Start a second round from the strongest valid averages to improve the
    # tradeoff further without assuming the first search reached an optimum.
    leaders = sorted(candidates.items(), key=lambda item: (
        item[1]['metrics']['total_track_distance'] / item[1]['metrics']['fleet']
    ), reverse=True)[:3]
    for index, weight in enumerate((50, 90)):
        search = AverageSearch(data, weight, 163)
        pressure = replace(PRESSURES[1], key=f'average_refine_{index}', label='Longer average routes',
                           short=120, fleet=360, access=16, hub=0, endpoint=0, loops=False)
        for offset, (start_id, result) in enumerate(leaders):
            paths, trace = search.search(pressure, 261107600 + index * 10 + offset, offset,
                                         proposals=20000, start=result['paths'])
            key = f'{pressure.key}_{offset}'
            runs.append({'id': key, 'start': start_id, 'average_weight': weight, 'link_target': 163, **trace})
            if any(len(path) == 2 for path in paths):
                continue
            metrics = search.metrics(paths, pressure)
            candidates[key] = {'pressure': asdict(pressure), 'paths': paths, 'metrics': metrics}
            print(key, metrics['tracks'], metrics['fleet'], metrics['interchanges'],
                  round(metrics['total_track_distance'] / metrics['fleet'], 1),
                  file=sys.stderr, flush=True)

    exporter = import_module('build-corridor-candidates')
    local_search = AverageSearch(data, 0, 0)
    local_pressure = replace(PRESSURES[1], key='alaska_only', label='Alaska adjustment', loops=False)
    local_paths = local_search.seed_alaska(long_haul)
    local_search.validate(local_paths, loops=False)
    if not any(len(path) == 2 for path in local_paths):
        candidates['alaska_only'] = {'pressure': asdict(local_pressure), 'paths': local_paths,
                                   'metrics': local_search.metrics(local_paths, local_pressure)}
    plans = exporter.export_plans(data['edges'], candidates, len(data['cities']))
    if args.pool:
        args.pool.write_text(json.dumps(plans, separators=(',', ':')))
    if not plans:
        raise ValueError('No all-city candidate avoided two-stop duties')
    winner = max(plans, key=lambda key: plans[key]['metrics']['total_track_distance'] / plans[key]['fleet'])
    evidence = {
        key: {'mean_distance': plan['metrics']['total_track_distance'] / plan['fleet'],
              'trains': plan['fleet'], 'links': plan['tracks'],
              'shared_stations': plan['metrics']['interchanges']}
        for key, plan in plans.items()
    }
    report = {'version': 1, 'winner': winner, 'plan': plans[winner], 'runs': runs, 'candidates': evidence}
    (ROOT / 'assets/average-corridors.json').write_text(json.dumps(report, separators=(',', ':'))+'\n')
    print('Selected', winner, evidence[winner])


if __name__ == '__main__':
    main()
