# Étude : garde-fou en base contre un solde d'épargne négatif (audit du 21/11/2026, constat F11, point B11)

Demande du porteur du 25/11/2026 : étude avant construction.

## 1. Ce que disent les textes et le registre

- PCCI, compte 33 : un compte de dépôt débiteur n'existe que comme créance à surveiller ; un compte courant débiteur douteux est viré au compte 39.
- Instr. BCC 003, art. 7, al. 2 : le compte courant débiteur sans mouvement créditeur significatif depuis plus de 30 jours est un crédit douteux.
- Registre S27-4 : « Solde négatif = Oui » n'est permis que pour un produit rangé en Courant ; une épargne (330), un dépôt à terme (340) ou une épargne bloquée (334) ne devient jamais débiteur : le déposant prête à l'institution.
- Registre S74-6 : au guichet, aucun découvert ; le découvert d'un compte courant est un crédit.

## 2. Ce que fait le logiciel aujourd'hui

- Aucun écran ne met un compte d'épargne en négatif. Le guichet ne paie jamais au-delà du disponible ; les frais de tenue de compte ne sont pas prélevés sans disponible ; le remboursement par prélèvement et l'engagement par signature s'arrêtent au disponible et verrouillent le compte avant de le lire (B11, 25/11/2026).
- La seule contre-passation (annulation d'un règlement de crédit, S142) recrédite le compte du client ; elle ne le débite pas.
- Contrôle sur les données du parcours complet (311 étapes) : aucun compte de dépôt en solde négatif.
- Toutes les écritures passent par une seule fonction (`poster`, `serveur/noyau/services.py`), mais rien en base n'empêche un débit de trop : une erreur future du code, deux opérations mal verrouillées ou une correction faite à la main dans la base passeraient.

## 3. Proposition

1. **Dans `poster`** : avant d'écrire, pour chaque ligne au débit d'un compte de dépôt (`contrat` = `depot:…`), le solde après l'écriture reste positif ou nul, sauf si le produit a « Solde négatif = Oui » (compte courant). Message clair : « Le compte … passerait en solde négatif : une épargne ne devient pas débitrice (PCCI, compte 33 ; registre S27-4). »
2. **En base** : un déclencheur sur `ligne_ecriture` refait le même contrôle à l'insertion, pour ce qui passerait à côté de `poster` (correction à la main, code futur). Même message.
3. **Essais** : un débit au-delà du solde est refusé par `poster` et, en passant outre `poster`, par la base ; le compte courant à « Solde négatif = Oui » reste possible (essai des comptes courants débiteurs, B4, mis à jour en conséquence).
4. Le disponible (solde moins les blocages et les sorties en attente) reste contrôlé par chaque écran : la base garde le dernier rempart, le solde.

Aucune question au porteur : la règle vient du PCCI et des décisions S27-4 et S74-6 déjà retenues. Effort : quelques heures, parcours complet compris.
