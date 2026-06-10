#!/usr/bin/env python3
# Génère 6 emblèmes de niveau Meello en SVG, style écusson hexagonal en relief.
# Inspiré du badge IconScout : dégradé clair->foncé, biseau intérieur, épaisseur 3D, ombre portée.
# Sans étoile : numéro de niveau au centre.

paliers = [
    # nom_fichier, label, niveau_exemple, light, mid, dark, base_dark, bevel
    ("01_nouvelle_pousse", "Nouvelle pousse", "1",   "#F0997B", "#D85A30", "#A33D1D", "#7A2E15", "#F5C4B3"),
    ("02_membre_installe", "Membre installé", "10",  "#5DCAA5", "#0F6E56", "#0A5343", "#063D30", "#9FE1CB"),
    ("03_moteur",          "Moteur",          "25",  "#85B7EB", "#185FA5", "#114A82", "#072E54", "#B5D4F4"),
    ("04_pilier",          "Pilier",          "50",  "#7F77DD", "#3C3489", "#2E2870", "#211B4D", "#CECBF6"),
    ("05_figure",          "Figure",          "75",  "#ED93B1", "#993556", "#7A2843", "#5C1A30", "#F4C0D1"),
    ("06_legende",         "Légende Meello",  "100", "#FAC775", "#BA7517", "#8A560F", "#5C3806", "#FAC775"),
]

# Hexagone pointe en haut/bas (flat-left/right) façon l'image de référence.
# Centre à (100,100), rayon ~78.
def hexagon(cx, cy, w, h_top, h_bot):
    # points d'un hexagone "pointu haut/bas" : haut, hd, bd, bas, bg, hg
    import math
    pts = []
    for ang in [-90, -30, 30, 90, 150, 210]:
        r = math.radians(ang)
        pts.append((cx + w*math.cos(r), cy + w*math.sin(r)))
    return " ".join(f"{x:.1f},{y:.1f}" for x,y in pts)

def make(nfile, label, niveau, light, mid, dark, basedark, bevel):
    cx, cy = 100, 96
    R = 74          # rayon écusson principal
    Rin = 56        # rayon biseau intérieur
    depth = 12      # épaisseur 3D (décalage vers le bas)
    main = hexagon(cx, cy, R, 0, 0)
    base = hexagon(cx, cy+depth, R, 0, 0)
    inner = hexagon(cx, cy, Rin, 0, 0)
    fsz = 46 if len(niveau) == 1 else (40 if len(niveau) == 2 else 34)
    svg = f'''<svg width="200" height="200" viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{light}"/>
      <stop offset="1" stop-color="{mid}"/>
    </linearGradient>
    <linearGradient id="inner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{mid}"/>
      <stop offset="1" stop-color="{dark}"/>
    </linearGradient>
  </defs>
  <polygon points="{base}" fill="{basedark}"/>
  <polygon points="{main}" fill="url(#face)"/>
  <polygon points="{inner}" fill="url(#inner)"/>
  <polygon points="{inner}" fill="none" stroke="{bevel}" stroke-width="2.5" stroke-opacity="0.55"/>
  <text x="{cx}" y="{cy+fsz*0.34:.0f}" text-anchor="middle" font-family="Arial, sans-serif" font-size="{fsz}" font-weight="700" fill="#ffffff">{niveau}</text>
</svg>'''
    return svg

import os
outdir = os.path.dirname(os.path.abspath(__file__))
for nfile, label, niveau, light, mid, dark, basedark, bevel in paliers:
    svg = make(nfile, label, niveau, light, mid, dark, basedark, bevel)
    with open(os.path.join(outdir, nfile + ".svg"), "w") as f:
        f.write(svg)
    print("écrit", nfile + ".svg")
print("OK")
