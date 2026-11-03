"""Clean-slate corridor search: no starting owners, purchases or protected spines."""
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import random
import time

import networkx as nx

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Pressure:
    key: str
    label: str
    bend: float
    turn: float
    fleet: float
    short: float
    hub: float
    endpoint: float
    track: float
    span: float = .15
    loops: bool = False
    full: bool = False
    hub_scheme: str = 'discovered'
    access: float = 0


PRESSURES = [
    Pressure('balanced', 'Balanced long corridors', 3.5, 22, 175, 75, 20, 12, .10),
    Pressure('long_runs', 'Fewer trains · longer runs', 1.6, 12, 300, 100, 14, 8, .12),
    Pressure('straight', 'Strong straightness pressure', 8, 55, 115, 60, 6, 4, .10),
    Pressure('hubs', 'Concentrated transfer hubs', 3.5, 22, 175, 75, 85, 45, .10),
    Pressure('small_loops', 'Compact collector loops allowed', 3.5, 22, 175, 75, 30, 18, .10, loops=True),
    Pressure('community_hubs', 'Community-nominated hub crossings', 3.5, 22, 175, 75, 85, 45, .10, loops=True, hub_scheme='community'),
    Pressure('all_tracks', 'All-track coverage comparison', 3.5, 22, 175, 75, 30, 18, .10, loops=True, full=True),
    Pressure('network_long', 'Long corridors with useful shortcuts', 2.5, 20, 230, 75, 20, 12, .10, loops=True, access=10),
    Pressure('network_hubs', 'Hub crossings with shortcut access', 3.5, 24, 175, 75, 40, 18, .10, loops=True, hub_scheme='community', access=30),
    Pressure('network_dense', 'Stronger network-access pressure', 4, 28, 175, 75, 35, 15, .10, loops=True, access=70),
]


class CorridorSearch:
    def __init__(self, data):
        # Deliberately omit plans, original owners, status, stages, base and done.
        self.cities = sorted(data['cities'])
        self.pos = data['reward_geometry']['coordinates']
        self.edges = {e['id']: {k: e[k] for k in ('id', 'a', 'b', 'fuel', 'water')} for e in data['edges']}
        self.graph = nx.Graph()
        self.graph.add_weighted_edges_from((e['a'], e['b'], e['fuel']) for e in self.edges.values())
        self.fuel = {self.eid(e['a'], e['b']): e['fuel'] for e in self.edges.values()}
        self.chord = {key: math.dist(self.pos[e['a']], self.pos[e['b']]) for key, e in self.edges.items()}
        centrality = nx.betweenness_centrality(self.graph, weight='weight')
        edge_centrality = nx.edge_betweenness_centrality(self.graph, weight='weight')
        self.access_impact = {self.eid(a,b): value*self.fuel[self.eid(a,b)] for (a,b),value in edge_centrality.items()}
        self.hubs = []
        for region in sorted(set(data['regions'].values())):
            options = sorted((c for c in self.cities if data['regions'][c] == region and self.graph.degree(c) >= 3), key=lambda c: (-centrality[c], c))
            chosen = []
            for c in options:
                if all(math.dist(self.pos[c], self.pos[h]) >= 110 for h in chosen):
                    chosen.append(c)
                if len(chosen) >= 3:
                    break
            self.hubs.extend(chosen)
        self.hubs = frozenset(self.hubs)
        self.hub_options = {'discovered': self.hubs, 'community': frozenset({'Paris','Madrid','Moscow','Cairo','Beijing','Tehran','New York','Caracas','Dakar','Broome','Kupang','Singapore','Fortaleza'})}
        self.small_cycles = []
        for cycle in nx.simple_cycles(self.graph, length_bound=4):
            p = self.canonical(tuple(cycle) + (cycle[0],))
            if self.valid(p, True):
                self.small_cycles.append(p)
        self.small_cycles = sorted(set(self.small_cycles))
        evidence = {'cities': self.cities, 'edges': self.edges, 'reward_coordinates': self.pos, 'regions': data['regions']}
        self.input_hash = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def eid(a, b):
        return '|'.join(sorted((a, b)))

    @staticmethod
    def canonical(p):
        if p[0] == p[-1]:
            q = p[:-1]
            i = q.index(min(q))
            a = q[i:] + q[:i]
            r = tuple(reversed(q))
            i = r.index(min(r))
            b = r[i:] + r[:i]
            best = min(a, b)
            return best + (best[0],)
        return min(p, tuple(reversed(p)))

    @lru_cache(maxsize=150000)
    def stats(self, p):
        loop = p[0] == p[-1]
        nodes = p[:-1] if loop else p
        ids = tuple(self.eid(a, b) for a, b in zip(p, p[1:]))
        fuel = sum(self.fuel[k] for k in ids)
        length = sum(self.chord[k] for k in ids)
        span = max(math.dist(self.pos[a], self.pos[b]) for a in nodes for b in nodes) if loop else math.dist(self.pos[p[0]], self.pos[p[-1]])
        turn = 0
        max_turn = 0
        for a, b, c in zip(p, p[1:], p[2:]):
            u = (self.pos[b][0] - self.pos[a][0], self.pos[b][1] - self.pos[a][1])
            v = (self.pos[c][0] - self.pos[b][0], self.pos[c][1] - self.pos[b][1])
            cosine = max(-1, min(1, (u[0]*v[0] + u[1]*v[1]) / max(1e-9, math.hypot(*u)*math.hypot(*v))))
            turn += 1 - cosine
            max_turn = max(max_turn, math.degrees(math.acos(cosine)))
        # A local collector loop is a permitted exception, not a long-haul payout bonus.
        loss = .15 * length if loop else length - span
        return {'fuel': fuel, 'length': length, 'span': span, 'bend': loss, 'turn': 0 if loop else turn,
                'loop': loop, 'ids': ids, 'nodes': nodes, 'max_turn': max_turn}

    def valid(self, p, loops):
        if len(p) < 2:
            return False
        loop = p[0] == p[-1]
        nodes = p[:-1] if loop else p
        if len(set(nodes)) != len(nodes) or any(self.eid(a, b) not in self.fuel for a, b in zip(p, p[1:])):
            return False
        s = self.stats(self.canonical(p))
        if s['fuel'] > 2400:  # declared construction bound, not a real train tank
            return False
        if loop:
            return loops and 3 <= len(nodes) <= 4 and s['fuel'] <= 260 and s['span'] <= 170
        return s['span']/s['length'] >= .85-1e-10 and s['max_turn'] <= 100+1e-10

    def route_cost(self, p, w):
        s = self.stats(p)
        return (w.bend*s['bend'] + w.turn*s['turn'] + w.fleet + w.short*max(0, 160-s['span'])/160
                - w.span*s['span'] + w.track*s['fuel'])

    def score(self, paths, w):
        membership = defaultdict(list)
        hubs = self.hub_options[w.hub_scheme]
        cost = 0
        for i, p in enumerate(paths):
            cost += self.route_cost(p, w)
            for c in self.stats(p)['nodes']:
                membership[c].append(i)
            if p[0] != p[-1]:
                cost += w.endpoint*sum(c not in hubs and self.graph.degree(c) >= 3 for c in (p[0], p[-1]))
        cost += w.hub*sum(len(ids)-1 for c, ids in membership.items() if len(ids) >= 2 and c not in hubs)
        if w.access:
            used = {key for p in paths for key in self.stats(p)['ids']}
            cost += w.access*sum(value for key,value in self.access_impact.items() if key not in used)
        return cost, membership

    def merge(self, a, b, w):
        if a[0] == a[-1] or b[0] == b[-1]:
            return None
        common = set(a) & set(b)
        if len(common) != 1:
            return None
        c = next(iter(common))
        if c not in (a[0], a[-1]) or c not in (b[0], b[-1]):
            return None
        aa = a if a[-1] == c else tuple(reversed(a))
        bb = b if b[0] == c else tuple(reversed(b))
        p = self.canonical(aa + bb[1:])
        return p if self.valid(p, w.loops) else None

    def coalesce(self, paths, w, rng, noise=0):
        paths = list(paths)
        while True:
            ends = defaultdict(list)
            for i, p in enumerate(paths):
                if p[0] != p[-1]:
                    ends[p[0]].append(i)
                    ends[p[-1]].append(i)
            best = None
            for c, ids in ends.items():
                for k, i in enumerate(ids):
                    for j in ids[:k]:
                        p = self.merge(paths[i], paths[j], w)
                        if p is None:
                            continue
                        gain = self.route_cost(paths[i], w) + self.route_cost(paths[j], w) - self.route_cost(p, w)
                        gain += w.hub*(c not in self.hub_options[w.hub_scheme]) + rng.uniform(-noise, noise)
                        if gain > 0 and (best is None or gain > best[0]):
                            best = (gain, i, j, p)
            if best is None:
                return tuple(sorted(paths))
            _, i, j, p = best
            paths = [q for k, q in enumerate(paths) if k not in (i, j)] + [p]

    def initial(self, w, rng, seed_index):
        if w.full or seed_index == 0:
            allowed = set(self.edges)
        else:
            g = self.graph.copy()
            for a, b, d in g.edges(data=True):
                d['weight'] *= rng.uniform(.4, 1.8)
            tree = nx.minimum_spanning_tree(g)
            allowed = {self.eid(a, b) for a, b in tree.edges}
            # Extra crosslinks can eliminate odd junctions or create useful shortcuts.
            extra = sorted(set(self.edges) - allowed)
            rng.shuffle(extra)
            allowed.update(extra[:rng.randrange(5, 20)])
        paths = [tuple(key.split('|')) for key in sorted(allowed)]
        if w.loops and seed_index % 2 == 0:
            nordic = ('Copenhagen', 'Oslo', 'Stockholm', 'Copenhagen')
            if all(self.eid(a, b) in allowed for a, b in zip(nordic, nordic[1:])):
                paths = self.extract_loop(paths, self.canonical(nordic))
        return self.coalesce(paths, w, rng, 70)

    def remove_edge(self, paths, key):
        out = []
        for p in paths:
            s = self.stats(p)
            if key not in s['ids']:
                out.append(p)
                continue
            i = s['ids'].index(key)
            if s['loop']:
                q = p[:-1]
                path = q[i+1:] + q[:i+1]
                if len(path) >= 2:
                    out.append(self.canonical(path))
            else:
                out.extend(self.canonical(q) for q in (p[:i+1], p[i+1:]) if len(q) >= 2)
        return out

    def extract_loop(self, paths, loop):
        result = list(paths)
        for key in self.stats(loop)['ids']:
            result = self.remove_edge(result, key)
        return result + [loop]

    def mutate(self, paths, membership, w, rng):
        candidate = self._mutate(paths, membership, w, rng)
        return candidate if candidate and all(self.valid(p, w.loops) for p in candidate) else None

    def _mutate(self, paths, membership, w, rng):
        draw = rng.random()
        if draw < .55:
            crossings = [c for c, ids in membership.items() if len(ids) >= 2]
            if not crossings:
                return None
            c = rng.choice(crossings)
            i, j = rng.sample(membership[c], 2)
            if self.stats(paths[i])['loop'] or self.stats(paths[j])['loop']:
                return None
            arms = []
            for p in (paths[i], paths[j]):
                at = p.index(c)
                arms.extend(q for q in (p[at::-1], p[at:]) if len(q) > 1)
            rng.shuffle(arms)
            replacements = []
            while len(arms) >= 2:
                a, b = arms.pop(), arms.pop()
                p = self.canonical(tuple(reversed(a)) + b[1:])
                if not self.valid(p, w.loops):
                    return None
                replacements.append(p)
            replacements.extend(arms)
            return tuple(sorted([p for k, p in enumerate(paths) if k not in (i, j)] + replacements))
        if draw < .70:
            choices = [i for i, p in enumerate(paths) if len(p) >= 3]
            if not choices:
                return None
            i = rng.choice(choices)
            p = paths[i]
            if p[0] == p[-1]:
                at = rng.randrange(len(p)-1)
                q = p[:-1]
                a, b = q[at], q[(at+1) % len(q)]
                result = self.remove_edge(paths, self.eid(a, b))
                if w.full:
                    result.append(self.canonical((a, b)))
                return tuple(sorted(result))
            at = rng.randrange(1, len(p)-1)
            return tuple(sorted([q for k, q in enumerate(paths) if k != i] + [self.canonical(p[:at+1]), self.canonical(p[at:])]))
        if draw < .79 and w.loops:
            loop = rng.choice(self.small_cycles)
            result = self.extract_loop(paths, loop)
            if sorted(result) == sorted(paths):
                return None
            return tuple(sorted(result))
        if w.full:
            return None
        used = {key for p in paths for key in self.stats(p)['ids']}
        unused = sorted(set(self.edges)-used)
        if draw < .93 and unused:
            new = rng.choice(unused)
            a, b = new.split('|')
            # Add an unused chord and delete a link on its physical cycle.
            g = nx.Graph(tuple(key.split('|')) for key in sorted(used))
            walk = nx.shortest_path(g, a, b)
            old = rng.choice([self.eid(x, y) for x, y in zip(walk, walk[1:])])
            result = self.remove_edge(paths, old) + [self.canonical((a, b))]
            return self.coalesce(result, w, rng) if rng.random() < .5 else tuple(sorted(result))
        if draw < .97 and unused:
            key = rng.choice(unused)
            return self.coalesce(list(paths) + [tuple(key.split('|'))], w, rng)
        if used:
            key = rng.choice(sorted(used))
            result = self.remove_edge(paths, key)
            g = nx.Graph(tuple(k.split('|')) for p in result for k in self.stats(p)['ids'])
            if set(g) == set(self.cities) and nx.is_connected(g):
                return tuple(sorted(result))
        return None

    def validate(self, paths, full=False, loops=True):
        if not all(self.valid(p, loops) for p in paths):
            raise ValueError('Railroad must be a simple path or an allowed compact cycle')
        ids = [key for p in paths for key in self.stats(p)['ids']]
        if len(ids) != len(set(ids)):
            raise ValueError('A physical connection has multiple owners')
        g = nx.Graph(tuple(k.split('|')) for k in ids)
        if set(g) != set(self.cities) or not nx.is_connected(g):
            raise ValueError('Lost a city or global connectivity')
        if full and set(ids) != set(self.edges):
            raise ValueError('Full-coverage comparison lost a link')
        return True

    def search(self, w, seed, seed_index, proposals=18000, start=None):
        rng = random.Random(seed)
        current = start or self.initial(w, rng, seed_index)
        cost, members = self.score(current, w)
        best, best_cost, last_gain, valid, accepted = current, cost, 0, 0, 0
        trace = [{'proposal': 0, 'cost': cost, 'fleet': len(current)}]
        for iteration in range(1, proposals+1):
            candidate = self.mutate(current, members, w, rng)
            if candidate is None or candidate == current:
                continue
            candidate_cost, next_members = self.score(candidate, w)
            valid += 1
            temperature = 8 + 160*(1-iteration/proposals)**2
            if candidate_cost < cost or rng.random() < math.exp(min(0, (cost-candidate_cost)/temperature)):
                current, cost, members = candidate, candidate_cost, next_members
                accepted += 1
            if candidate_cost < best_cost-1e-8:
                best, best_cost, last_gain = candidate, candidate_cost, iteration
                trace.append({'proposal': iteration, 'cost': best_cost, 'fleet': len(best)})
            if iteration >= 12000 and iteration-last_gain >= 7000:
                break
        self.validate(best, w.full, w.loops)
        return best, {'seed': seed, 'proposals': iteration, 'valid_proposals': valid, 'accepted': accepted,
                      'best_cost': best_cost, 'last_improvement': last_gain, 'trace': trace}

    def metrics(self, paths, pressure=None):
        pressure = pressure or PRESSURES[0]
        chosen_hubs = self.hub_options[pressure.hub_scheme]
        _, membership = self.score(paths, pressure)
        values = [self.stats(p) for p in paths]
        opened = [s for s in values if not s['loop']]
        length = sum(s['length'] for s in opened)
        hubs = sorted(({'city': c, 'lines': len(ids), 'designated': c in chosen_hubs} for c, ids in membership.items() if len(ids) >= 2), key=lambda x: (-x['lines'], x['city']))
        return {'fleet': len(paths), 'tracks': sum(len(s['ids']) for s in values), 'cities': len(self.cities),
                'branches': 0, 'loops': sum(s['loop'] for s in values),
                'weighted_directness': sum(s['span'] for s in opened)/length,
                'mean_span': sum(s['span'] for s in opened)/len(opened),
                'short_lines': sum(s['span'] < 160 and not s['loop'] for s in values),
                'total_track_distance': sum(s['fuel'] for s in values), 'interchanges': len(hubs),
                'hubs': hubs, 'hub_endpoint_share': sum(p[0] in chosen_hubs or p[-1] in chosen_hubs for p in paths)/len(paths)}


def main():
    data = json.loads((ROOT/'assets/operating-data.json').read_text())
    search = CorridorSearch(data)
    pool, logs = {}, []
    started = time.monotonic()
    for pressure in PRESSURES:
        winners = []
        for i in range(3):
            paths, log = search.search(pressure, 261103000 + PRESSURES.index(pressure)*100+i, i)
            winners.append((paths, log))
            print(pressure.key, i, search.metrics(paths)['fleet'], len({k for p in paths for k in search.stats(p)['ids']}), round(log['best_cost']), flush=True)
        winners.sort(key=lambda item: item[1]['best_cost'])
        for rank, (paths, log) in enumerate(winners[:2]):
            key = pressure.key + ('_a' if rank == 0 else '_b')
            pool[key] = {'pressure': pressure.__dict__, 'paths': paths, 'metrics': search.metrics(paths, pressure)}
        logs.extend({'pressure': pressure.key, **log} for _, log in winners)
    # Cross-seed each preference with the best compatible geometry found anywhere.
    for wi, pressure in enumerate(PRESSURES):
        compatible = []
        for candidate in pool.values():
            paths = tuple(tuple(p) for p in candidate['paths'])
            if any(search.stats(p)['loop'] for p in paths) and not pressure.loops:
                continue
            used = {k for p in paths for k in search.stats(p)['ids']}
            if pressure.full and len(used) != len(search.edges):
                continue
            compatible.append(paths)
        start = min(compatible, key=lambda paths: search.score(paths, pressure)[0])
        paths, log = search.search(pressure, 261104000+wi, 0, proposals=24000, start=start)
        pool[pressure.key+'_a'] = {'pressure': pressure.__dict__, 'paths': paths, 'metrics': search.metrics(paths, pressure)}
        logs.append({'pressure': pressure.key, 'cross_seed_refinement': True, **log})
        print('REFINED', pressure.key, len(paths), round(log['best_cost']), flush=True)
    result = {'version': 1, 'input_sha256': search.input_hash, 'current_configuration_used': False,
              'protected_reference_tracks': [], 'fixed_spines': [], 'hub_sets': {k:sorted(v) for k,v in search.hub_options.items()}, 'shortcut_access_impact': search.access_impact,
              'limits': {'minimum_open_route_directness': .85, 'maximum_open_route_turn_degrees': 100, 'max_path_track_distance': 2400, 'max_loop_track_distance': 260, 'max_loop_stations': 4, 'max_loop_diameter_pixels': 170},
              'stopping_rule': 'Three independent starts per pressure, at most 18,000 proposals/start, then a compatible cross-seed refinement up to 24,000 per pressure; stop after 12,000 with 7,000 since last gain. Bounded annealing plateau, not a global proof.',
              'elapsed_seconds': time.monotonic()-started, 'runs': logs, 'candidates': pool}
    (ROOT/'analysis/corridor-search.json').write_text(json.dumps(result, indent=2))
    print('COMPLETE', sum(x['proposals'] for x in logs), 'proposals', round(result['elapsed_seconds']), 'seconds', flush=True)


if __name__ == '__main__':
    main()
