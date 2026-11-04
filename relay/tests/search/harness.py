"""Synthetic contract fixtures, not claimed recordings of live Meta output."""
import base64
import io
import json
from copy import deepcopy
from pathlib import Path

from PIL import Image

CONTEXT = {'now': '2026-11-04T14:00:00+09:00', 'timeZone': 'Asia/Seoul'}
QUERIES = {'normal': 'Find the blue jacket', 'shop-specific': 'The blue jacket in the second shop',
           'time-specific': 'The jacket I saw 20 min ago', 'note-specific': 'The jacket at the shop I marked vintage',
           'past-trip': 'The jacket from Saturday', 'not-found': 'Find a yellow raincoat',
           'turn-limit': 'Find the striped coat', 'upstream-timeout': 'Find the blue jacket',
           'photo-limit': 'Find the blue jacket'}
VECTOR = [1.0] + [0.0] * 511


def image(width=5, height=5, value=127, *, mask=False):
    buffer = io.BytesIO()
    Image.new('L' if mask else 'RGB', (width, height), value).save(buffer, format='PNG')
    return {'mimeType': 'image/png', 'data': base64.b64encode(buffer.getvalue()).decode(), 'width': width, 'height': height}


def candidates(concept='a blue jacket'):
    return [{'id': str(i), 'label': concept, 'score': score,
             'mask': image(value=255, mask=True), 'bbox': [0, 0, 5, 5]}
            for i, score in enumerate([0.9, 0.5, 0.5, 0.01])]


def visits():
    rows = []
    for day, trip in [('2026-11-04', 'today'), ('2026-10-31', 'saturday')]:
        for n in [2, 1]:
            rows.append({'tripRef': f'trip_{trip}', 'tripStartedAt': day + 'T12:00:00+09:00',
                         'tripStatus': 'ended', 'tripEndedAt': day + 'T13:59:00+09:00',
                         'shopRef': f'shop_{trip}_{n}', 'n': n, 'startedAt': day + f'T13:{n}0:00+09:00',
                         'descriptionState': 'none', 'note': 'vintage' if n == 2 else 'plain',
                         'photoCount': 1, 'firstPhotoAt': day + 'T13:35:00+09:00',
                         'lastPhotoAt': day + 'T13:35:00+09:00'})
    return {'visits': rows, 'matchingCount': 4, 'truncated': False}


def found(scenario='normal', refs=None):
    refs = refs or ['photo_blue_1']
    past = scenario == 'past-trip'
    return [{'photoRef': ref, 'shopRef': 'shop_saturday_2' if past else 'shop_today_2',
             'takenAt': ('2026-10-31' if past else '2026-11-04') + 'T13:35:00+09:00', 'score': 0.8}
            for ref in refs]


def call(name, arguments, ident='wire_call'):
    value = {'id': ident, 'name': name, 'arguments': arguments}
    if name == 'find_photos':
        value['phraseVector'] = VECTOR
    return {'toolCalls': [value]}


def provider_call(name, arguments, ident='provider:call/1'):
    return {'status': 'completed', 'output': [{'type': 'function_call', 'status': 'completed',
            'call_id': ident, 'name': name, 'arguments': json.dumps(arguments)}]}


def provider_text(text):
    return {'status': 'completed', 'output': [{'type': 'message', 'role': 'assistant', 'status': 'completed',
                                             'content': [{'type': 'output_text', 'text': text}]}]}


def sam_text(scores=(0.01, 0.9, 0.9)):
    # Published codec example from the official meta-sam-parser package README.
    payload = '!!!!!(QO(0lu8?'
    return '<0f>' + ','.join(f'{i}<|box;x1=0;y1=0;x2=4;y2=4;w=5;h=5;c={score}|>'
                            f'<|mask;x=0;y=0;c={score};data=5,5,!{payload}|>' for i, score in enumerate(scores))


def fixture(root, scenario, operation, step, expected, body, *, status=200, match=None, ignore=None):
    directory = Path(root) / scenario
    directory.mkdir(parents=True, exist_ok=True)
    stem = f'{operation}.{step:02d}'
    (directory / f'{stem}.request.json').write_text(json.dumps({'expected': expected,
        'match': match if match is not None else ['/query'], 'ignore': ignore or []}))
    (directory / f'{stem}.response.json').write_text(json.dumps({'status': status, 'body': body}))


def install_scenarios(root):
    for scenario, query in QUERIES.items():
        expected = {'query': query, 'context': CONTEXT}
        first = call('list_visits', {}, 'visit_call')
        if scenario == 'upstream-timeout':
            fixture(root, scenario, 'search-turn', 1, expected,
                    {'error': {'code': 'upstream_timeout', 'message': 'unused', 'retryable': True}}, status=504)
            continue
        fixture(root, scenario, 'search-turn', 1, expected, first, ignore=['/context/now'])
        concept = {'not-found': 'a yellow raincoat', 'turn-limit': 'a striped coat'}.get(scenario, 'a blue jacket')
        args = {'phrase': concept}
        if scenario in ('shop-specific', 'note-specific'):
            args['shopRefs'] = ['{{toolResults[0].result.visits[0].shopRef}}']
        if scenario == 'time-specific':
            args.update(timeFrom='2026-11-04T13:35:00+09:00', timeTo='2026-11-04T13:45:00+09:00')
        if scenario == 'past-trip':
            args.update(timeFrom='2026-10-31T00:00:00+09:00', timeTo='2026-11-01T00:00:00+09:00')
        fixture(root, scenario, 'search-turn', 2,
                {'query': query, 'toolResults': [{'name': 'list_visits'}]}, call('find_photos', args, 'find_call'),
                match=['/query', '/toolResults/0/name'], ignore=['/queryToken', '/toolResults/0/toolCallId'])
        third = {'not_found': {'reason': 'No matching photos in your trips.'}} if scenario == 'not-found' else call(
            'extract_items', {'photoRefs': ['{{toolResults[0].result[0].photoRef}}'], 'concept': concept}, 'extract_call')
        fixture(root, scenario, 'search-turn', 3, {'query': query, 'toolResults': [{'name': 'find_photos'}]}, third,
                match=['/query', '/toolResults/0/name'], ignore=['/queryToken', '/toolResults/0/toolCallId',
                '/toolResults/0/result/0/photoRef', '/toolResults/0/result/0/shopRef', '/toolResults/0/result/0/takenAt'])
        fixture(root, scenario, 'search-segment', 1,
                {'concept': concept, 'photos': [{'photoRef': 'ignored', 'image': image()}]},
                {'photos': [{'photoRef': '{{photos[0].photoRef}}', 'candidates': candidates(concept)}]},
                match=['/concept', '/photos'], ignore=['/queryToken', '/photos/0/photoRef', '/photos/0/image/data'])
        terminal = {'not_found': {'reason': "I couldn't find it within this search. Ask again or browse your trips."}} if scenario == 'turn-limit' else {
            'final': {'photoRefs': ['{{toolResults[0].result[0].photoRef}}'], 'concept': concept,
                      'summary': 'These photos may contain the jacket.'}}
        fixture(root, scenario, 'search-turn', 4, {'query': query, 'toolResults': [{'name': 'extract_items'}]}, terminal,
                match=['/query', '/toolResults/0/name'], ignore=['/queryToken', '/toolResults/0/toolCallId', '/toolResults/0/result/0/photoRef'])


class Flow:
    def __init__(self, client, scenario='normal'):
        self.client, self.scenario = client, scenario
        self.query = QUERIES[scenario]
        self.token = None
        self.pending = None
        self.headers = {'X-SF-Fixture': scenario}

    def turn(self, result=None, **updates):
        body = {'query': self.query}
        if self.token is None:
            body['context'] = deepcopy(CONTEXT)
        else:
            body.update(queryToken=self.token, toolResults=[{'toolCallId': self.pending['id'],
                        'name': self.pending['name'], 'result': result}])
        body.update(updates)
        response = self.client.post('/v1/search/turn', json=body, headers=self.headers)
        if response.status_code == 200:
            data = response.json()
            self.token = data['queryToken']
            self.pending = data.get('toolCalls', [None])[0]
        return response

    def segment(self, photos=None, **updates):
        body = {'queryToken': self.token, 'concept': self.pending['arguments']['concept'],
                'photos': photos or [{'photoRef': ref, 'image': image()} for ref in self.pending['arguments']['photoRefs']]}
        body.update(updates)
        response = self.client.post('/v1/search/segment', json=body, headers=self.headers)
        if response.status_code == 200:
            self.token = response.json()['queryToken']
        return response

    def to_extract(self, refs=None):
        assert self.turn().status_code == 200
        assert self.turn(visits()).status_code == 200
        assert self.turn(found(self.scenario, refs)).status_code == 200
        return self


def summary(response):
    return [{'photoRef': p['photoRef'], 'candidateCount': len(p['candidates']),
             'topScore': max((c['score'] for c in p['candidates']), default=None)} for p in response.json()['photos']]
