"""Search denser, branch-free alternatives without loading the player's tracks."""
from dataclasses import asdict, replace
import json
import sys
from pathlib import Path
from importlib import import_module

from corridor_search import CorridorSearch, PRESSURES

ROOT = Path(__file__).resolve().parents[1]


class ConnectedSearch(CorridorSearch):
    def route_cost(self, path, pressure):
        stats = self.stats(path)
        # A short connector has to earn its own engine. Span matters more than
        # station count alone, but also charge for routes with few useful stops.
        short = max(0, 5 - len(stats['nodes']))
        return super().route_cost(path, pressure) + 55 * short

    def score(self, paths, pressure):
        cost, membership = super().score(paths, pressure)
        through = {city for path in paths for city in (
            path[:-1] if path[0] == path[-1] else path[1:-1]
        )}
        return cost + 50 * (len(self.cities) - len(through)), membership


def main():
    data = json.loads((ROOT / 'assets/corridor-data.json').read_text())
    search = ConnectedSearch(data)
    results = {}
    runs = []
    seen = {tuple(sorted(tuple(line['path']) for line in plan['lines']))
            for plan in data['plans'].values()}
    for index, access in enumerate((16, 30, 50, 80)):
        pressure = replace(
            PRESSURES[1], key=f'connected_{access}', label='Connected long routes',
            access=access, loops=True, short=220, fleet=290, hub=8, endpoint=4,
            hub_scheme='community',
        )
        for offset, start_id in enumerate(('hubs_a', 'network_hubs_b')):
            start = tuple(sorted(tuple(line['path']) for line in data['plans'][start_id]['lines']))
            paths, log = search.search(pressure, 261105000 + index * 10 + offset, offset,
                                       proposals=8000, start=start)
            runs.append({'access': access, 'start': start_id, **log})
            if paths in seen:
                continue
            seen.add(paths)
            key = f'{pressure.key}_{offset}'
            results[key] = {'pressure': asdict(pressure), 'paths': paths,
                            'metrics': search.metrics(paths, pressure)}
            print(key, results[key]['metrics']['tracks'], len(paths), file=sys.stderr, flush=True)
    exporter = import_module('build-corridor-candidates')
    plans = exporter.export_plans(data['edges'], results, len(data['cities']))
    print(json.dumps({'runs': runs, 'plans': plans}))


if __name__ == '__main__':
    main()
