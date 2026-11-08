"""Génère les icônes PNG de la PWA (même dessin que icons/icon.svg).
Usage : python tools/make-icons.py   (nécessite Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"


def draw(size: int, maskable: bool = False) -> Image.Image:
    s = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill="#2b2046")
        # zone de sécurité : on réduit le dessin à 80 %
        pad, k = 51 * s, 0.8
    else:
        d.rounded_rectangle([0, 0, size, size], radius=112 * s, fill="#2b2046")
        pad, k = 0, 1.0

    def P(x, y):
        return (pad + x * s * k, pad + y * s * k)

    def rect(x, y, w, h, fill, r=0):
        d.rounded_rectangle([*P(x, y), *P(x + w, y + h)], radius=r * s * k, fill=fill)

    d.ellipse([*P(360, 70), *P(440, 150)], fill="#ffe9b3")
    d.ellipse([*P(384, 60), *P(456, 132)], fill="#2b2046")
    d.polygon([P(96, 210), P(256, 120), P(416, 210)], fill="#a8423a")
    rect(116, 210, 280, 200, "#e9d7b7")
    for (x, y, c) in [(146, 240, "#ffd84a"), (226, 240, "#ff9f43"), (306, 240, "#3b3552"),
                      (146, 320, "#3b3552"), (306, 320, "#ffd84a")]:
        rect(x, y, 60, 56, c, 8)
    rect(226, 330, 60, 80, "#8b5e3c", 6)
    rect(96, 410, 320, 18, "#8c7656", 6)
    return img


OUT.mkdir(exist_ok=True)
draw(192).save(OUT / "icon-192.png")
draw(512).save(OUT / "icon-512.png")
draw(512, maskable=True).save(OUT / "icon-512-maskable.png")
print("icônes générées dans", OUT)
