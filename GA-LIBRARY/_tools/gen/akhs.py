"""AKHS hydraulic buffer GA sheets (rear flange, catalogue AKHS SERIES.pdf)."""
import os
from buffer import buffer_sheet
from frame import protect
# model: (stroke, ET kJ, ETC kJ/h, FS kN, recoil ext, recoil comp, side angle, weight, L, ØA, ØB, ØC rod, D thk, E sq, F pitch, G hole)
DATA = {
 'AKHS 130-70':  (70, 12, 180, 179, 18.2, 42.5, 3, 21, 290, 130, 98, 35, 19, 170, 130, 22),
 'AKHS 130-100': (100, 16, 280, 188, 17.8, 48, 3, 24, 350, 130, 98, 35, 19, 170, 130, 22),
 'AKHS 130-150': (150, 22, 300, 175, 18.3, 53.5, 2.5, 28, 485, 130, 98, 35, 19, 170, 130, 22),
 'AKHS 160-80':  (80, 28, 380, 340, 18.2, 44.3, 3, 38, 380, 160, 110, 50, 22, 220, 170, 28),
 'AKHS 160-150': (150, 44, 574, 340, 18.3, 53.5, 2, 48, 500, 160, 110, 50, 22, 220, 170, 28),
 'AKHS 190-100': (100, 42, 720, 500, 17.8, 48, 2.5, 52, 440, 190, 110, 50, 25, 280, 220, 33),
 'AKHS 190-150': (150, 65, 840, 500, 18.3, 53.5, 2, 64, 540, 190, 110, 50, 25, 280, 220, 33),
}
def sheet_for(model, outdir, date=None):
    S, ET, ETC, FS, ext, comp, ang, wt, L, A, B, C, Dt, E, F, G = DATA[model]
    cap = round(B * 0.3)
    g = dict(D=A, L=L, S=S, C=0, F=E, P=F, dh=G, t=Dt, cap=cap, rod=C, capD=B)
    params = [('Stroke', '%g' % S, 'mm'), ('Energy capacity per cycle', '%g' % ET, 'kJ'),
              ('Energy capacity per hour', '%g' % ETC, 'kJ/h'), ('Max. buffer force', '%g' % FS, 'kN'),
              ('Recoil force (extension)', '%g' % ext, 'kN'), ('Recoil force (compression)', '%g' % comp, 'kN'),
              ('Permitted side-load angle', '%g' % ang, '°'), ('Nitrogen charging pressure', '10', 'bar'),
              ('Working temperature', '10 to 50', '°C'), ('Weight (approx.)', '%g' % wt, 'kg')]
    notes = ['1. General arrangement for customer approval - not for manufacture.',
             '2. Shown fully extended; dashed line = striker cap face at full stroke.',
             '3. Rear flange mounting, 4 bolts. Rubber bellow over rod supplied as standard.',
             '4. Working temperature 10 to 50 °C; SS construction and sensors on request.',
             '5. Selection: www.cranebuffer.com  |  impactcal.netlify.app']
    code = model.replace(' ', '-')
    meta = dict(title=model, subtitle='HYDRAULIC BUFFER - GENERAL ARRANGEMENT', dwgno='AT/GA/AKHS/' + code[5:],
                rev='A', finish='Painted yellow', material='Steel body, hard-chrome rod', weight='%g kg' % wt)
    if date: meta['date'] = date
    path = os.path.join(outdir, code + '.pdf')
    buffer_sheet(path, meta, g, 'RS', params, notes, model); protect(path)
    return path
if __name__ == '__main__':
    import sys
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for m in DATA: print(sheet_for(m, out))
