import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Coquille } from "./mise-en-page/Coquille";
import Connexion from "./ecrans/Connexion";
import { AccueilModule, PageModules } from "./ecrans/Accueil";
import { AConstruire, Introuvable, ListeModule } from "./ecrans/Modules";
import { ECRANS } from "./ecrans/registre";
import { CONSTRUITS } from "./ecrans/construits";

// Version publiée en page de démonstration : adresses après « # », le serveur ne connaît qu'un fichier
const Routeur = import.meta.env.VITE_ROUTEUR === "hash" ? HashRouter : BrowserRouter;

// Parcours de Microfina++ (manuel, p. 5 à 13) : connexion, page des modules, page du menu général du module.
export default function App() {
  return (
    <Routeur>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route index element={<PageModules />} />
        <Route element={<Coquille />}>
          <Route path="principal" element={<AccueilModule />} />
          <Route path="paie" element={<AccueilModule />} />
          <Route path="immobilisations" element={<AccueilModule />} />
          {ECRANS.map((e) => {
            const Ecran = CONSTRUITS[e.id];
            return <Route key={e.id} path={e.chemin} element={Ecran ? <Ecran /> : <AConstruire id={e.id} />} />;
          })}
          <Route path=":module" element={<ListeModule />} />
          <Route path="*" element={<Introuvable />} />
        </Route>
      </Routes>
    </Routeur>
  );
}
