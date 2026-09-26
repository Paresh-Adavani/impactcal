"""Adoni Tech GA sheet frame - A4 landscape, house-style title block, faint logo watermark.
All drawing helpers take mm; origin bottom-left of page."""
import os, datetime, io
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
for name, f in [('DV', 'DejaVuSans.ttf'), ('DVB', 'DejaVuSans-Bold.ttf')]:
    for d in ['/usr/share/fonts/truetype/dejavu', HERE]:
        p = os.path.join(d, f)
        if os.path.exists(p):
            pdfmetrics.registerFont(TTFont(name, p)); break

PW, PH = 297.0, 210.0
THICK, THIN, HATCH = 0.5, 0.18, 0.13
LOGO = os.path.join(HERE, 'adonitech_logo_transparent.png')
ADDRESS = 'SLU-W-39, Addl. MIDC, Kodoli, Satara 415004, India'
TODAY = datetime.date.today().strftime('%d-%m-%y')

_wm_cache = {}
def watermark_image(alpha=0.07):
    if alpha not in _wm_cache:
        im = Image.open(LOGO).convert('RGBA')
        a = im.split()[3].point(lambda v: int(v * alpha))
        im.putalpha(a)
        buf = io.BytesIO(); im.save(buf, 'PNG'); buf.seek(0)
        _wm_cache[alpha] = ImageReader(buf)
    return _wm_cache[alpha]


class Sheet:
    """One A4 landscape GA sheet."""
    # drawing area (inside inner border, above title block)
    X0, X1 = 12.0, 285.0
    Y0, Y1 = 10.0, 200.0
    TB_W, TB_H = 140.0, 52.0      # title block size (bottom right)

    def __init__(self, path, meta):
        self.path = path; self.m = meta
        self.c = canvas.Canvas(path, pagesize=(PW * mm, PH * mm))
        self.c.setTitle(meta.get('title', '')); self.c.setAuthor('Adoni Tech')
        self.c.setSubject('General arrangement drawing - for customer approval')

    # ---- primitives (mm) ----
    def lw(self, w): self.c.setLineWidth(w * mm)
    def line(self, x1, y1, x2, y2, w=THIN, dash=None):
        self.c.setLineWidth(w * mm)
        if dash: self.c.setDash([d * mm for d in dash], 0)
        self.c.line(x1 * mm, y1 * mm, x2 * mm, y2 * mm)
        if dash: self.c.setDash()
    def rect(self, x, y, w, h, lw=THICK, fill=None, color=None):
        self.c.setLineWidth(lw * mm)
        if color is not None:
            self.c.setFillColorRGB(*color); self.c.rect(x * mm, y * mm, w * mm, h * mm, stroke=1, fill=1); self.c.setFillGray(0); return
        if fill is not None:
            self.c.setFillGray(fill); self.c.rect(x * mm, y * mm, w * mm, h * mm, stroke=1, fill=1); self.c.setFillGray(0)
        else: self.c.rect(x * mm, y * mm, w * mm, h * mm, stroke=1, fill=0)
    def circle(self, x, y, r, lw=THICK, fill=None, color=None):
        self.c.setLineWidth(lw * mm)
        if color is not None:
            self.c.setFillColorRGB(*color); self.c.circle(x * mm, y * mm, r * mm, stroke=1, fill=1); self.c.setFillGray(0); return
        if fill is not None:
            self.c.setFillGray(fill); self.c.circle(x * mm, y * mm, r * mm, stroke=1, fill=1); self.c.setFillGray(0)
        else: self.c.circle(x * mm, y * mm, r * mm, stroke=1, fill=0)
    def poly(self, pts, lw=THICK, fill=None, color=None):
        c = self.c; c.setLineWidth(lw * mm); p = c.beginPath(); p.moveTo(pts[0][0] * mm, pts[0][1] * mm)
        for x, y in pts[1:]: p.lineTo(x * mm, y * mm)
        p.close()
        if color is not None: c.setFillColorRGB(*color); c.drawPath(p, stroke=1, fill=1); c.setFillGray(0)
        elif fill is not None: c.setFillGray(fill); c.drawPath(p, stroke=1, fill=1); c.setFillGray(0)
        else: c.drawPath(p, stroke=1, fill=0)
    def text(self, x, y, s, size=2.5, bold=False, rot=0, anchor='l'):
        c = self.c; c.saveState(); c.setFont('DVB' if bold else 'DV', size * mm)
        c.translate(x * mm, y * mm); c.rotate(rot)
        w = pdfmetrics.stringWidth(s, 'DVB' if bold else 'DV', size * mm) / mm
        dx = {'l': 0, 'c': -w / 2, 'r': -w}[anchor]
        c.drawString(dx * mm, 0, s); c.restoreState()
    def tw(self, s, size=2.5, bold=False):
        return pdfmetrics.stringWidth(s, 'DVB' if bold else 'DV', size * mm) / mm
    def centerline(self, x1, y1, x2, y2):
        self.line(x1, y1, x2, y2, THIN, dash=(6, 1.2, 1.2, 1.2))
    def arrow(self, x, y, ang, size=2.2):
        import math
        c = self.c; c.saveState(); c.setLineWidth(THIN * mm)
        a = math.radians(ang)
        p = c.beginPath(); p.moveTo(x * mm, y * mm)
        for s in (1, -1):
            p.lineTo((x - size * math.cos(a) + s * size * 0.18 * math.sin(a)) * mm,
                     (y - size * math.sin(a) - s * size * 0.18 * math.cos(a)) * mm)
        p.close(); c.setFillGray(0); c.drawPath(p, stroke=0, fill=1); c.restoreState()

    # ---- dimensions ----
    def dim_h(self, x1, x2, y, label, yfeat=None, txt_above=True, size=2.5):
        """horizontal dimension between x1..x2 at height y; extension lines from yfeat (tuple or float)."""
        if yfeat is not None:
            yf = yfeat if isinstance(yfeat, (tuple, list)) else (yfeat, yfeat)
            for x, f in ((x1, yf[0]), (x2, yf[1])):
                d = 1 if y > f else -1
                self.line(x, f + d * 1.0, x, y + d * 1.5, THIN)
        self.line(x1, y, x2, y, THIN)
        w = self.tw(label, size)
        inside = abs(x2 - x1) > 2 * 2.2 + w * 0.3
        if inside:
            self.arrow(x1, y, 180); self.arrow(x2, y, 0)
        else:
            self.arrow(x1, y, 0); self.arrow(x2, y, 180)
        yt = y + 0.8 if txt_above else y - 3.0
        self.text((x1 + x2) / 2, yt, label, size, anchor='c')
    def dim_v(self, y1, y2, x, label, xfeat=None, txt_left=False, size=2.5):
        if xfeat is not None:
            xf = xfeat if isinstance(xfeat, (tuple, list)) else (xfeat, xfeat)
            for y, f in ((y1, xf[0]), (y2, xf[1])):
                d = 1 if x > f else -1
                self.line(f + d * 1.0, y, x + d * 1.5, y, THIN)
        self.line(x, y1, x, y2, THIN)
        w = self.tw(label, size)
        if abs(y2 - y1) > 2 * 2.2 + 1:
            self.arrow(x, y1, 270); self.arrow(x, y2, 90)
        else:
            self.arrow(x, y1, 90); self.arrow(x, y2, 270)
        xt = x - 0.8 if txt_left else x + 2.8
        self.text(xt, (y1 + y2) / 2, label, size, rot=90, anchor='c')
    def leader(self, x, y, xt, yt, label, size=2.5):
        self.line(x, y, xt, yt, THIN); self.line(xt, yt, xt + (4 if xt >= x else -4), yt, THIN)
        self.text(xt + (4.8 if xt >= x else -4.8), yt - 0.9, label, size, anchor='l' if xt >= x else 'r')
        self.circle(x, y, 0.4, THIN, fill=0)

    # ---- frame ----
    def frame(self):
        c = self.c; m = self.m
        # watermark - faint logo centred in drawing area
        img = watermark_image(0.07)
        w = 150.0; h = w * 360 / 1200
        c.drawImage(img, ((PW - w) / 2) * mm, (95 - h / 2 + 15) * mm, w * mm, h * mm, mask='auto')
        # borders
        self.rect(5, 5, PW - 10, PH - 10, THIN)
        self.rect(self.X0, self.Y0, self.X1 - self.X0, self.Y1 - self.Y0, THICK)
        # zone grid
        cols = 6; rows = 4
        cw = (self.X1 - self.X0) / cols; rh = (self.Y1 - self.Y0) / rows
        for i in range(1, cols):
            x = self.X0 + i * cw
            self.line(x, 5, x, self.Y0, THIN); self.line(x, self.Y1, x, PH - 5, THIN)
        for i in range(cols):
            x = self.X0 + (i + 0.5) * cw
            self.text(x, 6.6, str(i + 1), 2.5, anchor='c'); self.text(x, PH - 8.4, str(i + 1), 2.5, anchor='c')
        for j in range(1, rows):
            y = self.Y0 + j * rh
            self.line(5, y, self.X0, y, THIN); self.line(self.X1, y, PW - 5, y, THIN)
        for j in range(rows):
            y = self.Y0 + (j + 0.5) * rh - 1.2
            L = 'DCBA'[rows - 1 - j]
            self.text(8.5, y, L, 2.5, anchor='c'); self.text(PW - 8.5, y, L, 2.5, anchor='c')
        self.title_block()

    def title_block(self):
        m = self.m
        x0 = self.X1 - self.TB_W; y0 = self.Y0; W = self.TB_W; H = self.TB_H
        self.rect(x0, y0, W, H, THICK)
        # column split: left 78 mm (notes + names), right 62 mm (logo/title/dwg)
        xs = x0 + 74
        self.line(xs, y0, xs, y0 + H, THIN)
        # --- left block ---
        yt = y0 + H
        # notes row (top 16 mm)
        self.line(x0, yt - 16, xs, yt - 16, THIN)
        xa = x0 + 34; xb = x0 + 52
        self.line(xa, yt - 16, xa, yt, THIN); self.line(xb, yt - 16, xb, yt, THIN)
        t = self.text
        t(x0 + 1, yt - 2.6, 'UNLESS OTHERWISE SPECIFIED:', 1.7)
        t(x0 + 1, yt - 4.8, 'DIMENSIONS ARE IN MILLIMETERS', 1.7)
        t(x0 + 1, yt - 7.0, 'GENERAL ARRANGEMENT - OUTLINE ONLY', 1.7)
        t(x0 + 1, yt - 9.2, 'DIMENSIONS SUBJECT TO CHANGE', 1.7)
        t(x0 + 1, yt - 11.4, 'WITHOUT PRIOR NOTICE', 1.7)
        t(x0 + 1, yt - 13.6, 'PROJECTION: FIRST ANGLE', 1.7)
        t(xa + 1, yt - 2.6, 'FINISH:', 1.7); t(xa + 1, yt - 6.2, m.get('finish', ''), 1.9)
        t(xb + 1, yt - 2.6, 'DEBUR AND', 1.7); t(xb + 1, yt - 4.8, 'BREAK SHARP', 1.7); t(xb + 1, yt - 7.0, 'EDGES', 1.7)
        # names table
        drawn_date = m.get('date', TODAY)
        appv_date = m.get('appv_date')
        if not appv_date:
            try: appv_date = (datetime.datetime.strptime(drawn_date, '%d-%m-%y') + datetime.timedelta(days=2)).strftime('%d-%m-%y')
            except ValueError: appv_date = drawn_date
        rows = [('DRAWN', m.get('drawn', 'PARESH ADAVANI'), drawn_date),
                ("CHK'D", m.get('chk', ''), ''),
                ("APPV'D", m.get('appv', 'PARESH ADAVANI'), appv_date),
                ('MFG', '', ''), ('Q.A', '', '')]
        y = yt - 16
        hdr = 4.0; rh = (y - 5.0 - (y0)) / 5 if False else 4.8
        # header
        self.line(x0, y - hdr, xs, y - hdr, THIN)
        c1 = x0 + 12; c2 = x0 + 40; c3 = x0 + 58
        for cx in (c1, c2, c3): self.line(cx, y0 + 6.0, cx, y, THIN)
        t(c1 + 8, y - 2.9, 'NAME', 1.7, anchor='c'); t(c2 + 9, y - 2.9, 'SIGNATURE', 1.7, anchor='c'); t(c3 + 8, y - 2.9, 'DATE', 1.7, anchor='c')
        yy = y - hdr
        for lab, nm, dt in rows:
            self.line(x0, yy - rh, xs, yy - rh, THIN)
            t(x0 + 1, yy - 3.4, lab, 1.8); t(c1 + 1, yy - 3.4, nm, 1.8); t(c3 + 1, yy - 3.4, dt, 1.8)
            if nm and m.get('sig') and lab in ('DRAWN', "APPV'D"):
                self.c.drawImage(m['sig'], (c2 + 1) * mm, (yy - rh + 0.4) * mm, 16 * mm, (rh - 0.8) * mm, mask='auto', preserveAspectRatio=True)
            yy -= rh
        # material / weight row at bottom (6 mm)
        t(x0 + 1, y0 + 3.7, 'MATERIAL:', 1.7); t(x0 + 12, y0 + 3.7, m.get('material', ''), 1.9)
        self.line(x0 + 44, y0, x0 + 44, y0 + 6.0, THIN)
        t(x0 + 45, y0 + 3.7, 'WEIGHT:', 1.7); t(x0 + 56, y0 + 3.7, m.get('weight', ''), 1.9)
        # --- right block ---
        xr = xs; wr = x0 + W - xs
        # top: DO NOT SCALE | REVISION (6mm)
        self.line(xr, yt - 6, x0 + W, yt - 6, THIN)
        xm = xr + wr * 0.62; self.line(xm, yt - 6, xm, yt, THIN)
        t(xr + wr * 0.31, yt - 3.9, 'DO NOT SCALE DRAWING', 1.7, anchor='c')
        t(xm + 1, yt - 2.6, 'REVISION', 1.6); t(xm + 1, yt - 5.1, m.get('rev', 'A'), 1.9, bold=True)
        # logo band (11 mm)
        self.line(xr, yt - 17, x0 + W, yt - 17, THIN)
        lw_ = 34.0; lh = lw_ * 360 / 1200
        self.c.drawImage(ImageReader(LOGO), (xr + 2) * mm, (yt - 6 - 1 - lh) * mm, lw_ * mm, lh * mm, mask='auto')
        t(xr + 38, yt - 10.2, 'ADONI TECH', 1.9, bold=True)
        t(xr + 38, yt - 12.6, 'Addl. MIDC, Kodoli, Satara 415004', 1.6)
        t(xr + 38, yt - 14.9, 'www.adonitech.co.in', 1.6)
        # title (14 mm)
        self.line(xr, yt - 31, x0 + W, yt - 31, THIN)
        t(xr + 1, yt - 19.4, 'TITLE:', 1.6)
        t(xr + wr / 2, yt - 25.5, m.get('title', ''), 3.4, bold=True, anchor='c')
        t(xr + wr / 2, yt - 29.4, m.get('subtitle', ''), 2.0, anchor='c')
        # dwg no row (13 mm)
        self.line(xr, yt - 44, x0 + W, yt - 44, THIN)
        xa4 = x0 + W - 12; self.line(xa4, yt - 44, xa4, yt - 31, THIN)
        t(xr + 1, yt - 33.4, 'DWG NO.', 1.6)
        t(xr + 2, yt - 41.0, m.get('dwgno', ''), 3.6, bold=True)
        t(xa4 + 6, yt - 39.0, 'A4', 3.0, bold=True, anchor='c')
        # bottom: scale | sheet
        xsc = xr + wr * 0.5; self.line(xsc, y0, xsc, yt - 44, THIN)
        t(xr + 1, y0 + 3.2, 'SCALE: ' + m.get('scale', ''), 1.9)
        t(xsc + 1, y0 + 3.2, 'SHEET %s OF %s' % (m.get('sheet', 1), m.get('sheets', 1)), 1.9)

    def tech_table(self, x, y, rows, title='Technical Parameters', colw=(38, 16, 12), rh=5.2):
        """rows = [(label, value, unit)]; x,y = top-left."""
        self.text(x, y - 3.2, title, 2.8, bold=True)
        yy = y - 5.0
        W = sum(colw)
        self.rect(x, yy - rh * len(rows), W, rh * len(rows), THIN)
        cx = x
        for w in colw[:-1]:
            cx += w; self.line(cx, yy - rh * len(rows), cx, yy, THIN)
        for i, (lab, val, unit) in enumerate(rows):
            yl = yy - rh * i
            if i: self.line(x, yl, x + W, yl, THIN)
            self.text(x + 1, yl - rh + 1.6, lab, 2.1)
            self.text(x + colw[0] + colw[1] / 2, yl - rh + 1.6, str(val), 2.1, anchor='c')
            self.text(x + colw[0] + colw[1] + 1, yl - rh + 1.6, unit, 2.1)
        return yy - rh * len(rows)

    def notes(self, x, y, lines, size=2.0, lead=3.0, title=None):
        if title: self.text(x, y, title, 2.4, bold=True); y -= lead + 0.6
        for ln in lines:
            self.text(x, y, ln, size); y -= lead
        return y

    def save(self):
        self.c.showPage(); self.c.save()


def std_scale(L, D, avail_w, avail_h):
    """largest standard scale so that L fits avail_w and D fits avail_h."""
    for s in [0.2, 0.25, 0.4, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30]:
        if L / s <= avail_w and D / s <= avail_h: return s
    return 30


def protect(src, dst=None, owner_pw='adoni@123*'):
    """Set edit/permissions password; open stays free. Allows print + screen readers only."""
    from pypdf import PdfReader, PdfWriter
    dst = dst or src
    r = PdfReader(src); w = PdfWriter(); w.append(r)
    w.add_metadata(r.metadata or {})
    from pypdf.constants import UserAccessPermissions as P
    w.encrypt(user_password='', owner_password=owner_pw, algorithm='AES-256',
              permissions_flag=P.PRINT | P.PRINT_TO_REPRESENTATION | P.EXTRACT_TEXT_AND_GRAPHICS)
    tmp = dst + '.tmp'
    with open(tmp, 'wb') as f: w.write(f)
    os.replace(tmp, dst)
