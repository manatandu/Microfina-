-- S20 : nature d'un lieu sous une ville ou un territoire, Commune, Secteur ou Chefferie (décision du porteur du 21/11/2026, registre S20-9).
-- Sous le territoire de Businga, la commune de Businga et le secteur de Businga portent le même nom.
update localite set nature = 'Commune' where niveau = 'commune' and nature = '';
