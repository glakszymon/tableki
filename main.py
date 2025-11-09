from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from fractions import Fraction


# ================================
# 🎨 KONFIGURACJA KOLORÓW (HEX)
# ================================
COLORS = {
    "background": HexColor("#000000"),   # czarne tło
    "grid": HexColor("#555555"),         # szara siatka
    "axes": HexColor("#FFFFFF"),         # białe osie
    "labels": HexColor("#FFFFFF"),       # białe napisy
    "table_lines": HexColor("#FFFFFF")   # białe linie tabel
}


# ================================
# 🧮 FUNKCJE POMOCNICZE
# ================================

def frac_str(value):
    """Konwertuje liczbę na ładny ułamek zwykły (np. 0.5 → ½, 1.25 → 1¼)."""
    try:
        f = Fraction(value).limit_denominator(8)
        if abs(f.denominator) == 1:
            return f"{f.numerator}"
        elif abs(f.numerator) > abs(f.denominator):
            calkowita = f.numerator // f.denominator
            reszta = abs(f.numerator % f.denominator)
            return f"{calkowita} {reszta}/{f.denominator}"
        else:
            return f"{f.numerator}/{f.denominator}"
    except Exception:
        return f"{value:g}"


def parse_fraction_input(text):
    """Pozwala wprowadzić np. '1/2' lub '3/4' i konwertuje na float."""
    try:
        return float(Fraction(text))
    except Exception:
        return float(text)


# ================================
# 🔧 FUNKCJE RYSUJĄCE
# ================================

def ustaw_tlo(c, szerokosc, wysokosc):
    c.setFillColor(COLORS["background"])
    c.rect(0, 0, szerokosc, wysokosc, fill=True, stroke=False)


def rysuj_siatke(c, szerokosc, wysokosc, jednostka_logiczna=1.0, jednostka_opis="1"):
    zero_x = szerokosc / 2
    zero_y = wysokosc / 2
    jednostka_fizyczna = 28.35  # 1 cm

    # --- Siatka ---
    c.setStrokeColor(COLORS["grid"])
    c.setLineWidth(0.3)

    # pionowe
    x = zero_x
    while x <= szerokosc:
        c.line(x, 0, x, wysokosc)
        if x != zero_x:
            c.line(2 * zero_x - x, 0, 2 * zero_x - x, wysokosc)
        x += jednostka_fizyczna

    # poziome
    y = zero_y
    while y <= wysokosc:
        c.line(0, y, szerokosc, y)
        if y != zero_y:
            c.line(0, 2 * zero_y - y, szerokosc, 2 * zero_y - y)
        y += jednostka_fizyczna

    # --- Osie ---
    c.setStrokeColor(COLORS["axes"])
    c.setLineWidth(1)
    c.line(zero_x, 0, zero_x, wysokosc)  # Y
    c.line(0, zero_y, szerokosc, zero_y)  # X

    # Strzałki
    arrow = 10
    c.line(zero_x, wysokosc, zero_x - 5, wysokosc - arrow)
    c.line(zero_x, wysokosc, zero_x + 5, wysokosc - arrow)
    c.line(szerokosc, zero_y, szerokosc - arrow, zero_y + 5)
    c.line(szerokosc, zero_y, szerokosc - arrow, zero_y - 5)

    # --- Podpisy ---
    c.setFont("Helvetica", 10)
    c.setFillColor(COLORS["labels"])
    c.drawString(szerokosc - 15, zero_y - 20, "x")
    c.drawString(zero_x + 10, wysokosc - 15, "y")

    # --- Oznaczenia wartości ---
    c.setFont("Helvetica", 7)
    krok_logiczny = jednostka_logiczna

    # Oś X
    max_x = int(szerokosc / (2 * jednostka_fizyczna))
    for i in range(-max_x, max_x + 1):
        if i == 0:
            continue
        wartosc = i * krok_logiczny
        x_pos = zero_x + i * jednostka_fizyczna
        if 0 <= x_pos <= szerokosc:
            c.line(x_pos, zero_y - 2, x_pos, zero_y + 2)
            c.drawCentredString(x_pos, zero_y - 12, frac_str(wartosc))

    # Oś Y
    max_y = int(wysokosc / (2 * jednostka_fizyczna))
    for j in range(-max_y, max_y + 1):
        if j == 0:
            continue
        wartosc = j * krok_logiczny
        y_pos = zero_y + j * jednostka_fizyczna
        if 0 <= y_pos <= wysokosc:
            c.line(zero_x - 2, y_pos, zero_x + 2, y_pos)
            c.drawString(zero_x + 5, y_pos - 2, frac_str(wartosc))

    # --- Opis jednostki ---
    c.setFont("Helvetica", 9)
    c.drawString(40, 40, f"Jednostka osi = {jednostka_opis}")


def rysuj_tabele(c, kolumny, wiersze, szerokosc, wysokosc):
    c.setStrokeColor(COLORS["table_lines"])
    c.setLineWidth(0.8)

    szer_kom = szerokosc / kolumny
    wys_kom = wysokosc / wiersze

    for i in range(kolumny + 1):
        x = i * szer_kom
        c.line(x, 0, x, wysokosc)
    for j in range(wiersze + 1):
        y = j * wys_kom
        c.line(0, y, szerokosc, y)


# ================================
# 🚀 GŁÓWNA FUNKCJA
# ================================

def main():
    print("=== 🌌 Generator notatek DARK MODE – v2 ===")
    print("1️⃣ Siatka kartezjańska")
    print("2️⃣ Tabela")
    wybor = input("Wybierz typ (1 lub 2): ")

    format_str = input("Format (A4/L): ").upper()
    rozmiar = landscape(A4) if format_str == "L" else A4
    szerokosc, wysokosc = rozmiar
    c = None

    if wybor == "1":
        jednostka_input = input("Podaj jednostkę (np. 1, 1/2, 3/4): ")
        jednostka_logiczna = parse_fraction_input(jednostka_input)
        jednostka_opis = jednostka_input
        nazwa = f"siatka_dark_{jednostka_opis.replace('/', '-')}.pdf"
        c = canvas.Canvas(nazwa, pagesize=rozmiar)
        ustaw_tlo(c, szerokosc, wysokosc)
        rysuj_siatke(c, szerokosc, wysokosc, jednostka_logiczna, jednostka_opis)
        print(f"✅ Wygenerowano: {nazwa}")

    elif wybor == "2":
        kolumny = int(input("Liczba kolumn: "))
        wiersze = int(input("Liczba wierszy: "))
        nazwa = f"tabela_dark_{kolumny}x{wiersze}.pdf"
        c = canvas.Canvas(nazwa, pagesize=rozmiar)
        ustaw_tlo(c, szerokosc, wysokosc)
        rysuj_tabele(c, kolumny, wiersze, szerokosc, wysokosc)
        print(f"✅ Wygenerowano: {nazwa}")

    else:
        print("Nieprawidłowy wybór.")
        return

    c.save()


if __name__ == "__main__":
    main()
