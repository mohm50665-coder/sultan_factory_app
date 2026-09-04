from pathlib import Path
import re

ROOTS = [Path('app'), Path('components'), Path('lib'), Path('server')]
STRING_RE = re.compile(r"(?:\"([^\"]{2,})\"|'([^']{2,})'|`([^`]{2,})`)")
ENGLISH_RE = re.compile(r"[A-Za-z]{3,}")
ARABIC_RE = re.compile(r"[\u0600-\u06ff]")
SKIP_WORDS = {'import','from','export','const','return','function','true','false','className','style','default','https','http','localhost','application','json','string','number','Error','Promise','GET','POST'}

for root in ROOTS:
    for path in sorted(root.rglob('*.tsx')) + sorted(root.rglob('*.ts')):
        for lineno, line in enumerate(path.read_text(errors='ignore').splitlines(), 1):
            if line.lstrip().startswith('//') or line.lstrip().startswith('*'):
                continue
            for match in STRING_RE.finditer(line):
                value = next((g for g in match.groups() if g is not None), '')
                words = ENGLISH_RE.findall(value)
                if not words or ARABIC_RE.search(value):
                    continue
                if value.startswith(('/', '@/', '@/')) or value in SKIP_WORDS:
                    continue
                if all(word.lower() in SKIP_WORDS for word in words):
                    continue
                print(f'{path}:{lineno}: {value[:180]}')
                break
