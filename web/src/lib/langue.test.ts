import { describe, expect, it } from "vitest";
import { chargerDictionnaire, traduire } from "./langue";
import { reglesAide } from "./aide";

describe("langue des libellés (manuel p. 14, article XX ; registre T118)", () => {
  it("traduit mot pour mot, avec la marque de champ, par gabarit, par liste et phrase par phrase", () => {
    chargerDictionnaire({
      exact: { "Enregistrer": "Save", "Nom": "Name", "Type de pièce": "ID type", "Date de naissance :": "Date of birth:", "Crédit": "Loan",
        "Enregistré avec succès !": "Saved successfully.", "Journée fermée : aucune écriture possible.": "Business day closed: no entry can be posted." },
      gabarits: [["À remplir : {0}.", "Required: {0}."], ["{0} du crédit {1}", "{0} for loan {1}"], ["Montant de {0} à {1}", "Amount from {0} to {1}"]],
    });
    expect(traduire("Enregistrer")).toBe("Save");
    expect(traduire("  Enregistrer ")).toBe("  Save ");                       // les espaces de bord restent
    expect(traduire("Nom *")).toBe("Name *");                                  // zone obligatoire
    expect(traduire("Nom :")).toBe("Name:");
    expect(traduire("Date de naissance : *")).toBe("Date of birth: *");
    expect(traduire("À remplir : Nom, Type de pièce.")).toBe("Required: Name, ID type.");   // liste glissée dans un gabarit
    expect(traduire("Écriture du crédit 0412/L001/00001")).toBe("Écriture for loan 0412/L001/00001");   // la donnée reste
    expect(traduire("Montant de 10 à 20")).toBe("Amount from 10 to 20");
    expect(traduire("Enregistré avec succès ! Journée fermée : aucune écriture possible.")).toBe("Saved successfully. Business day closed: no entry can be posted.");
    expect(traduire("Kalala Mbuyi Josée")).toBe("Kalala Mbuyi Josée");         // inconnu : tel quel
    expect(traduire("1 000 000,00 CDF")).toBe("1 000 000,00 CDF");
  });

  it("l'aide montre les règles tirées des textes, sans les notes internes au projet", () => {
    expect(reglesAide(["Manuel Microfina++, p. 115 : capture", "Registre S91-1", "Instr. BCC 007, art. 18 : le Conseil statue en appel (registre T107)",
      "PCCI § 3.3 : livre-journal ; registre S115-1 à S115-4", "Instr. BCC 007, art. 18 : le Conseil statue en appel"]))
      .toEqual(["Instr. BCC 007, art. 18 : le Conseil statue en appel", "PCCI § 3.3 : livre-journal"]);
  });
});
