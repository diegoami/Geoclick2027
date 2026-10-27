"""Parse only settlement rows from the published RZS workbook; no Excel runtime."""
import collections
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
# Census oblast header -> canonical game district, GeoNames ADM1.ADM2 code.
# The codes are from the ADM2 records in the same pinned RS gazetteer.
DISTRICTS = {
    "Beogradska oblast (Grad Beograd)": ("Belgrade", "SE.0"),
    "Zapadnobačka oblast": ("West Bačka", "VO.5"),
    "Južnobanatska oblast": ("South Banat", "VO.4"),
    "Južnobačka oblast": ("South Bačka", "VO.6"),
    "Severnobanatska oblast": ("North Banat", "VO.3"),
    "Severnobačka oblast": ("North Bačka", "VO.1"),
    "Srednjobanatska oblast": ("Central Banat", "VO.2"),
    "Sremska oblast": ("Syrmia", "VO.7"),
    "Zlatiborska oblast": ("Zlatibor", "SE.16"),
    "Kolubarska oblast": ("Kolubara", "SE.9"),
    "Mačvanska oblast": ("Mačva", "SE.8"),
    "Moravička oblast": ("Moravica", "SE.17"),
    "Pomoravska oblast": ("Pomoravlje", "SE.13"),
    "Rasinska oblast": ("Rasina", "SE.19"),
    "Raška oblast": ("Raška", "SE.18"),
    "Šumadijska oblast": ("Šumadija", "SE.12"),
    "Borska oblast": ("Bor", "SE.14"),
    "Braničevska oblast": ("Braničevo", "SE.11"),
    "Zaječarska oblast": ("Zaječar", "SE.15"),
    "Jablanička oblast": ("Jablanica", "SE.23"),
    "Nišavska oblast": ("Nišava", "SE.20"),
    "Pirotska oblast": ("Pirot", "SE.22"),
    "Podunavska oblast": ("Podunavlje", "SE.10"),
    "Pčinjska oblast": ("Pčinja", "SE.24"),
    "Toplička oblast": ("Toplica", "SE.21"),
}
populations = collections.Counter()
census_districts = {}
current_district = None
with zipfile.ZipFile(sys.argv[1]) as archive:
    strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", ns)]
    sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    for row in sheet.findall("m:sheetData/m:row", ns):
        values = {}
        for cell in row.findall("m:c", ns):
            value = cell.find("m:v", ns)
            if value is not None:
                values[re.sub(r"\d", "", cell.attrib["r"])] = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
        label = " ".join(values.get("E", "").split())
        if label in DISTRICTS:
            current_district = DISTRICTS[label]
        elif " oblast" in label and str(values.get("C", "")).isdigit():
            raise ValueError("Unknown census district header: " + label)
        # Aggregate/header rows have no 'u' marker. Never confuse their totals
        # with the population of the named urban settlement below them.
        if values.get("D") != "u" or not str(values.get("C", "")).isdigit():
            continue
        name = values["E"]
        # Belgrade and Nis are split by their constituent municipalities.
        # (varos/varosica) means town; it does not identify a different place.
        name = re.sub(r"^(Beograd|Niš) \([^)]+\)$", r"\1", name)
        name = re.sub(r" \((?:varoš|varošica)\)$", "", name)
        if current_district is None:
            raise ValueError("Urban settlement without a census district: " + name)
        if name in census_districts and census_districts[name] != current_district:
            raise ValueError("Ambiguous urban name in multiple census districts: " + name)
        census_districts[name] = current_district
        populations[name] += int(values["C"])
if sum(populations.values()) != 4120782 or len(populations) != 167:
    raise ValueError("RZS urban total/grouping changed; review the source edition")
if populations["Beograd"] != 1197714 or populations["Novi Pazar"] != 71462:
    raise ValueError("Settlement/municipality separation failed")

def normal(value):
    return "".join(char for char in unicodedata.normalize("NFKD", value.casefold().replace("đ", "d")) if not unicodedata.combining(char) and char.isalnum())

places = []
with zipfile.ZipFile(sys.argv[2]) as archive:
    for line in archive.read("RS.txt").decode("utf-8").splitlines():
        cells = line.split("\t")
        if len(cells) < 19 or cells[6] != "P" or cells[8] != "RS" or cells[7] in ("PPLH", "PPLQ"):
            continue
        places.append(cells)
features = []
excluded = []
for name, population in populations.most_common():
    if population < 1000:
        continue
    display = "Belgrade" if name == "Beograd" else name
    candidates = []
    census_district, geonames_district = census_districts[name]
    for cells in places:
        if cells[10] + "." + cells[11] != geonames_district:
            continue
        primary = {normal(cells[1]), normal(cells[2])}
        aliases = {normal(alias) for alias in cells[3].split(",")}
        if normal(display) in primary or normal(name) in primary:
            rank = 0
        elif normal(display) in aliases or normal(name) in aliases:
            rank = 1
        else:
            continue
        seat_rank = 0 if cells[7] in ("PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4") else 1
        candidates.append((seat_rank, rank, -int(cells[14] or 0), cells))
    candidates.sort(key=lambda candidate: candidate[:3])
    if not candidates:
        if population >= 10000:
            raise ValueError("Missing coordinates for eligible urban settlement: " + name)
        excluded.append({"name": name, "population": population, "reason": "No exact gazetteer name/alias match"})
        continue
    if len(candidates) > 1 and candidates[0][:3] == candidates[1][:3]:
        raise ValueError("Ambiguous gazetteer identity within census district: " + name)
    point = candidates[0][3]
    features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [float(point[5]), float(point[4])]}, "properties": {
        "NAME": display, "NAME_EN": display, "NAME_DE": "Belgrad" if display == "Belgrade" else display,
        "NAME_IT": "Belgrado" if display == "Belgrade" else display,
        "censusDistrict": census_district, "geoNamesDistrictCode": geonames_district,
        "ADM0NAME": "Serbia", "ADM0CAP": int(display == "Belgrade"), "POP_MAX": population,
        "POP1950": 0, "populationDate": "2022-10-01T00:00:00Z", "coordinatePrecision": 0,
        "geonames": "https://www.geonames.org/" + point[0], "settlementName": name,
        "populationDefinition": "RZS 2022 urban settlement; municipal parts combined, administrative totals excluded"
    }})
print(json.dumps({"features": features, "excluded": excluded, "urbanTotal": 4120782, "urbanSettlements": 167}, ensure_ascii=False))
