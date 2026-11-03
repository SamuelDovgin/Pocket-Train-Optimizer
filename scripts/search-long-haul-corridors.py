"""Refine connected candidates for longer, fewer short duties and through hubs."""
from dataclasses import asdict, replace
from importlib import import_module
import json
from pathlib import Path
import sys

from corridor_search import PRESSURES

ConnectedSearch = import_module('search-connected-corridors').ConnectedSearch
ROOT = Path(__file__).resolve().parents[1]


class LongHaulSearch(ConnectedSearch):
    def __init__(self, data, short_penalty, hub_reward):
        super().__init__(data)
        self.short_penalty = short_penalty
        self.hub_reward = hub_reward

    def route_cost(self, path, pressure):
        stats = self.stats(path)
        short = stats['loop'] or len(stats['nodes']) < 5
        return super().route_cost(path, pressure) + self.short_penalty * short

    def score(self, paths, pressure):
        cost, membership = super().score(paths, pressure)
        through_hubs = {city for path in paths for city in path[1:-1]
                        if len(self.stats(path)['nodes']) >= 5 and len(membership[city]) >= 2}
        return cost - self.hub_reward * len(through_hubs), membership


def main():
    data = json.loads((ROOT / 'assets/corridor-data.json').read_text())
    connected = json.loads((ROOT / 'assets/connected-corridors.json').read_text())
    starts = {'connected': connected['plan'], 'shortcut': data['plans']['network_hubs_b']}
    runs, candidates = [], {}
    pressures = [(140, 25, 16), (220, 40, 25), (300, 55, 45), (380, 70, 65)]
    for index, (short, hub, access) in enumerate(pressures):
        search = LongHaulSearch(data, short, hub)
        pressure = replace(PRESSURES[1], key=f'long_haul_{index}',
                           label='Long-haul hubs', short=230, fleet=300,
                           access=access, hub=0, endpoint=0, loops=False)
        for offset, (label, plan) in enumerate(starts.items()):
            # Open each compact loop at its least valuable edge so the next
            # round can absorb its remaining track into longer paths.
            paths = [tuple(line['path']) for line in plan['lines']]
            for path in paths[:]:
                if path[0] == path[-1]:
                    edge = min(search.stats(path)['ids'], key=search.access_impact.get)
                    paths = search.remove_edge(paths, edge)
            # Some loop cuts violate path geometry. Replace only those small
            # paths with individual edges before the search joins them anew.
            paths = [piece for path in paths for piece in (
                [path] if search.valid(path, False) else
                [search.canonical((a,b)) for a,b in zip(path,path[1:])]
            )]
            start = tuple(sorted(paths))
            search.validate(start, loops=False)
            paths, trace = search.search(pressure, 261106100 + index * 10 + offset,
                                         offset, proposals=12000, start=start)
            key = f'{pressure.key}_{offset}'
            metrics = search.metrics(paths, pressure)
            runs.append({'id': key, 'start': label, 'short_penalty': short, 'through_hub_reward': hub, **trace})
            candidates[key] = {'pressure': asdict(pressure), 'paths': paths, 'metrics': metrics}
            print(key, metrics['tracks'], len(paths), metrics['interchanges'], file=sys.stderr, flush=True)
    exporter = import_module('build-corridor-candidates')
    print(json.dumps({'runs': runs, 'plans': exporter.export_plans(data['edges'], candidates, len(data['cities']))}))


if __name__ == '__main__':
    main()
