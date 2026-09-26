"""Apply faint Adoni Tech logo watermark + edit password (qpdf overlay keeps the original streams intact).
Skips files that are already encrypted (generated sheets carry both from frame.py)."""
import os, io, subprocess, sys
from pypdf import PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image
HOME = os.path.expanduser('~')
LIB = os.path.join(HOME, 'mnt/claude/Projects/ImpactCal/GA-LIBRARY')
LOGO = os.path.join(LIB, '_tools/gen/adonitech_logo_transparent.png')
PW = 'adoni@123*'
TMP = os.path.join(HOME, 'wm_tmp'); os.makedirs(TMP, exist_ok=True)
_cache = {}
def overlay(w, h):
    key = (round(w), round(h))
    if key not in _cache:
        im = Image.open(LOGO).convert('RGBA'); a = im.split()[3].point(lambda v: int(v * 0.07)); im.putalpha(a)
        buf = io.BytesIO(); im.save(buf, 'PNG'); buf.seek(0)
        p = os.path.join(TMP, 'wm_%dx%d.pdf' % key)
        c = canvas.Canvas(p, pagesize=(w, h)); lw = min(w, h) * 0.7; lh = lw * 360 / 1200
        c.drawImage(ImageReader(buf), (w - lw) / 2, (h - lh) / 2 + h * 0.08, lw, lh, mask='auto'); c.showPage(); c.save()
        _cache[key] = p
    return _cache[key]
done = skipped = 0
for series in sorted(os.listdir(LIB)):
    d = os.path.join(LIB, series)
    if not os.path.isdir(d) or series.startswith('_'): continue
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.pdf'): continue
        p = os.path.join(d, f)
        r = PdfReader(p)
        if r.is_encrypted: skipped += 1; continue
        pg = r.pages[0]; wm = overlay(float(pg.mediabox.width), float(pg.mediabox.height))
        t1 = os.path.join(TMP, 'a.pdf'); t2 = os.path.join(TMP, 'b.pdf')
        subprocess.run(['qpdf', p, '--overlay', wm, '--', t1], check=True)
        subprocess.run(['qpdf', '--encrypt', '', PW, '256', '--modify=none', '--extract=n', '--print=full', '--', t1, t2], check=True)
        with open(t2, 'rb') as src, open(p, 'wb') as dst: dst.write(src.read())
        done += 1
print('watermarked+protected', done, 'already protected', skipped)
