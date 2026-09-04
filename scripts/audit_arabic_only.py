from pathlib import Path
import re
AR = re.compile(r'[\u0600-\u06ff]{2,}')
for root in ('app','components','lib'):
    for p in sorted(Path(root).rglob('*.tsx')):
        for n, line in enumerate(p.read_text(errors='ignore').splitlines(), 1):
            if not AR.search(line):
                continue
            if any(token in line for token in ('isAr', 'isRtl', 'language', 't(', 'labelAr', 'descriptionAr', 'label:')):
                continue
            if line.lstrip().startswith('//') or line.lstrip().startswith('*'):
                continue
            if '<Text' in line or 'placeholder=' in line or 'Alert.alert' in line or 'window.alert' in line or 'title:' in line:
                print(f'{p}:{n}:{line.strip()}')
