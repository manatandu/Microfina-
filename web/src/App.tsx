import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { Coquille } from "./mise-en-page/Coquille";
import Connexion from "./ecrans/Connexion";
import MaJournee from "./ecrans/MaJournee";
import { AConstruire, Introuvable, ListeModule } from "./ecrans/Modules";
import { ECRANS } from "./ecrans/registre";
import { CONSTRUITS } from "./ecrans/construits";

// Version publiée en page de démonstration : adresses après « # », le serveur ne connaît qu'un fichier
const Routeur = import.meta.env.VITE_ROUTEUR === "hash" ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Routeur>
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route element={<Coquille />}>
          <Route index element={<MaJournee />} />
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
