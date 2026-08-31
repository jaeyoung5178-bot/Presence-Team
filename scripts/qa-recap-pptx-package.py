"""Validate native recap charts without opening or modifying the source deck.

Run with the bundled Python (lxml) and an OOXML schema directory:
  python qa-recap-pptx-package.py FILE.pptx --schemas /path/to/ISO-IEC29500-4_2016
"""
import argparse
import posixpath
from zipfile import ZipFile
from pathlib import Path
from lxml import etree as E

parser = argparse.ArgumentParser()
parser.add_argument('pptx')
parser.add_argument('--schemas', required=True)
args = parser.parse_args()
C = '{http://schemas.openxmlformats.org/drawingml/2006/chart}'
schema = E.XMLSchema(E.parse(str(Path(args.schemas) / 'dml-chart.xsd')))
failures = []
charts = 0
with ZipFile(args.pptx) as archive:
    assert archive.testzip() is None, 'ZIP CRC failure'
    names = set(archive.namelist())
    for name in names:
        if name.endswith(('.xml', '.rels')):
            root = E.fromstring(archive.read(name))
            if name.endswith('.rels'):
                base = posixpath.dirname(posixpath.dirname(name))
                for rel in root:
                    if rel.get('TargetMode') == 'External':
                        continue
                    target = posixpath.normpath(posixpath.join(base, rel.get('Target'))).lstrip('/')
                    if target not in names:
                        failures.append(f'{name}: missing relationship target {target}')
            if name.startswith('ppt/charts/chart'):
                charts += 1
                if not schema.validate(root):
                    failures.extend(f'{name}: {e.message}' for e in schema.error_log)
                series = root.findall('.//' + C + 'ser')
                ids = [s.find(C + 'idx').get('val') for s in series]
                if len(set(ids)) != len(ids):
                    failures.append(f'{name}: duplicate series IDs {ids}')
                area = root.find('.//' + C + 'areaChart')
                line = root.find('.//' + C + 'lineChart')
                if area is not None and line is not None:
                    for component in ('cat', 'val'):
                        a = area.find(C + 'ser/' + C + component)
                        b = line.find(C + 'ser/' + C + component)
                        # Data columns differ; cached category labels and values must match.
                        av = [x.text for x in a.findall('.//' + C + 'v')]
                        bv = [x.text for x in b.findall('.//' + C + 'v')]
                        if av != bv:
                            failures.append(f'{name}: line and fill {component} do not match')
                    ax = [x.get('val') for x in area.findall(C + 'axId')]
                    lx = [x.get('val') for x in line.findall(C + 'axId')]
                    if ax != lx:
                        failures.append(f'{name}: line and fill axes differ')
    if not charts:
        failures.append('No native charts')
if failures:
    raise SystemExit('\n'.join(failures))
print(f'PASS: {charts} native charts, schema, unique series IDs, relationships, line/fill alignment')
