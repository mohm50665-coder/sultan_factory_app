from pathlib import Path
import markdown

root = Path('/home/ubuntu/sultan_factory_app')
source = root / 'docs' / 'consultant_system_overview_ar.md'
output = root / 'docs' / 'consultant_system_overview_ar.html'
text = source.read_text(encoding='utf-8')
html_body = markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'])
html = f'''<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>الملف التعريفي الشامل لتطبيق مصنع السلطان</title>
<style>
@page {{ size: A4; margin: 18mm 16mm; }}
body {{ direction: rtl; font-family: "DejaVu Sans", "Arial", sans-serif; color: #1f2937; line-height: 1.75; font-size: 11pt; }}
h1 {{ color: #0f4c81; font-size: 24pt; border-bottom: 3px solid #0f4c81; padding-bottom: 8px; }}
h2 {{ color: #0f4c81; font-size: 17pt; margin-top: 22px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }}
h3 {{ color: #155e75; font-size: 13pt; margin-top: 16px; }}
p {{ text-align: justify; }}
table {{ width: 100%; border-collapse: collapse; margin: 12px 0 18px; font-size: 9.5pt; direction: rtl; }}
th {{ background: #0f4c81; color: white; padding: 7px; border: 1px solid #94a3b8; text-align: right; }}
td {{ padding: 6px; border: 1px solid #cbd5e1; vertical-align: top; }}
tr:nth-child(even) td {{ background: #f8fafc; }}
blockquote {{ border-right: 4px solid #0f766e; background: #ecfeff; padding: 10px 14px; margin: 14px 0; }}
code {{ direction: ltr; unicode-bidi: embed; background: #f1f5f9; padding: 1px 4px; }}
pre {{ direction: ltr; text-align: left; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; white-space: pre-wrap; }}
li {{ margin: 3px 0; }}
hr {{ border: 0; border-top: 1px solid #cbd5e1; margin: 18px 0; }}
</style>
</head>
<body>{html_body}</body>
</html>'''
output.write_text(html, encoding='utf-8')
print(output)
