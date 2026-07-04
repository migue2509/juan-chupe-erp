"""
Comando de gestión: geocodifica direcciones históricas de domicilios
y las carga en HeatmapPoint.

Uso:
    python manage.py load_heatmap_points
    python manage.py load_heatmap_points --clear   # borrar existentes antes de cargar
"""
import time
import re
import requests
from django.core.management.base import BaseCommand
from apps.deliveries.models import HeatmapPoint

ADDRESSES = [
    "cr 74 # 95 100", "calle 92b #69-23", "cr 74 95 100", "Cra 74a 88a 04",
    "calle 80c 74-25", "calle 92b #69 23", "diagonal 79a 76 290 Pilarica Flex",
    "Cl 76DA #89c 66 Aures", "calle 89a 72 18", "cr 72 #95 121",
    "cra 74 #91-81", "calle 89a 74c 08", "carrera 76 #94 23", "cll 84 #67a 76",
    "cra 75 #90-6", "calle 83 #67a 184", "carrera 74a #97-90", "carrera 77 # 94-42",
    "carrera 74a #92-74", "calle 104B # 74a 83", "carrera 76 #94 23",
    "calle 85b 67a 28", "cra 77 #89 47", "CL 76A #89C 66 AURES I PLAZA PILARICA",
    "carrera 89b #89 101", "carrera 70A 96-84", "cr 68 101 66", "cra 72 93 114",
    "calle 92b 69-23", "calle 80 #87-25", "carrera 76 80c 06", "cra 72 #93 114",
    "carrea 71a 84 54", "carrera 73b 94-94", "calle 80b 65-194",
    "calle 84 cra 67a 25", "cra 76 #91-38", "cra 74a 89a 30", "cra 74 91-81",
    "cra 72 93 114", "calle 92 dd 72-18", "cra 73a 93 29", "65b 93-86",
    "cra 74a #94-34", "cra 71 #93 20", "carrera 74a #97-90", "carrera 74 # 91 84",
    "calle 81 87 41", "calle 92 67a-83", "cra 71 B 89 B 39 int 401",
    "calle 93 #72-23", "cra 72b #78b-85", "cra 74 95 100", "carrera 74a #97-90",
    "cra 74a 92 44 apt 401", "calle 80 #70 14", "calle 91A 70a 24",
    "calle 92bb 68b 14", "cra 76 91 38", "cll 76 94 63", "cra 74 #91-81",
    "calle 79b #68a-21", "cra 74 91 81", "cra 74 89a 88", "calle 81 87 41",
    "carrera 66 #95 12", "cra 74a 95 14", "calle 92b #69-23", "cra70 92dd 13",
    "carrera 74a #92-74", "cra 75 #90-6", "cra 76 91a 49", "carrera 74a #97-90",
    "carrera 80 79c 131", "carrera 74A 88a 04", "calle 92cr 74a-08",
    "cl 79 72A 64", "cra 74a 89a 30", "cra 71 b 89 b 39",
    "cra 72b #78b-85 senderos del palmar",
    "carrera 69 #93-55", "cra 74 91-81", "71C 89a-13", "cra 94 a 78b 67",
    "cr 66a 93 109", "carrera 67 97 117", "calle 91A 65 29", "carrera 74 91-84",
    "cra 71a 93 15", "cra 74 95 121", "cra 74 91-81", "calle 83 #93a 50",
    "cra 71 89 A 13", "Cra 76 91 38", "cra 74a #97-52", "calle 89a #74c 08",
    "crr 74 A 88 A 52", "calle 92 dd 71a 24", "carrera 74 91 84", "cra 68a 92c 12",
    "cl 94 78b 3", "cra 65A 93 64", "cra 76 91 38", "cl 94 75b 3",
    "calle 93 50b 16", "cra 75b 92 60", "calle 81 87 41", "carrera 71c 89a79",
    "cra 71a #84 54", "cra 74 n 95 100", "calle 89a 74c 08",
    "carrera 74 A 88 A 04", "CLL 76 94 63", "carrera 75 91A 34",
    "CALLE 91 69 70", "CRA 75 95 100", "CRA 74 91-81", "cra 75 90-6",
    "calle 56 40-33",
]

MED_LAT = 6.2442
MED_LNG = -75.5812


def normalize(addr):
    addr = addr.lower().strip()
    addr = re.sub(r'#', ' ', addr)
    addr = re.sub(r'\bcr\b', 'carrera', addr)
    addr = re.sub(r'\bcra\b', 'carrera', addr)
    addr = re.sub(r'\bcrr\b', 'carrera', addr)
    addr = re.sub(r'\bcarrea\b', 'carrera', addr)
    addr = re.sub(r'\bcll\b', 'calle', addr)
    addr = re.sub(r'\bcl\b', 'calle', addr)
    addr = re.sub(r'\bdiag\b', 'diagonal', addr)
    addr = re.sub(r'\s+', ' ', addr).strip()
    return addr


def photon_geocode(query, stdout):
    q = query
    if 'medell' not in q:
        q = q + ', Medellín, Colombia'
    try:
        r = requests.get(
            'https://photon.komoot.io/api/',
            params={'q': q, 'lat': MED_LAT, 'lon': MED_LNG, 'limit': 1, 'lang': 'es'},
            timeout=10,
        )
        features = r.json().get('features', [])
        if features:
            coords = features[0]['geometry']['coordinates']
            return float(coords[1]), float(coords[0])
    except Exception as e:
        stdout.write(f'  Photon error: {e}')
    return None, None


def nominatim_geocode(query, stdout):
    q = query
    if 'medell' not in q:
        q = q + ', Medellín, Colombia'
    try:
        r = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={
                'q': q,
                'format': 'json',
                'countrycodes': 'co',
                'limit': 1,
                'viewbox': '-75.72,6.42,-75.44,6.10',
                'bounded': 0,
            },
            headers={'User-Agent': 'JuanChupeERP/1.0'},
            timeout=10,
        )
        results = r.json()
        if results:
            return float(results[0]['lat']), float(results[0]['lon'])
    except Exception as e:
        stdout.write(f'  Nominatim error: {e}')
    return None, None


class Command(BaseCommand):
    help = 'Geocodifica direcciones históricas y las carga en HeatmapPoint'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Eliminar puntos históricos existentes antes de cargar',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted, _ = HeatmapPoint.objects.all().delete()
            self.stdout.write(f'Eliminados {deleted} puntos históricos existentes.')

        # Deduplicar por forma normalizada
        seen = {}
        for addr in ADDRESSES:
            key = normalize(addr)
            if key not in seen:
                seen[key] = addr

        unique = list(seen.items())
        self.stdout.write(
            f'Total direcciones: {len(ADDRESSES)} → Únicas: {len(unique)}'
        )

        ok = 0
        fail = 0
        failed_addrs = []

        for i, (norm_key, original) in enumerate(unique):
            lat, lng = photon_geocode(norm_key, self.stdout)

            if not lat:
                time.sleep(0.3)
                lat, lng = nominatim_geocode(norm_key, self.stdout)

            if lat and lng:
                HeatmapPoint.objects.create(
                    address=original,
                    latitude=round(lat, 7),
                    longitude=round(lng, 7),
                )
                self.stdout.write(
                    f'[{i+1}/{len(unique)}] ✓ {original[:50]:<50} '
                    f'→ ({lat:.5f}, {lng:.5f})'
                )
                ok += 1
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'[{i+1}/{len(unique)}] ✗ No encontrado: {original[:50]}'
                    )
                )
                fail += 1
                failed_addrs.append(original)

            time.sleep(0.6)  # respetar rate limit de Photon/Nominatim

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(f'Resultado: {ok} guardados, {fail} no encontrados')
        )
        if failed_addrs:
            self.stdout.write('No encontradas:')
            for a in failed_addrs:
                self.stdout.write(f'  - {a}')
