import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Coquille } from "./mise-en-page/Coquille";
import Connexion from "./ecrans/Connexion";
import MaJournee from "./ecrans/MaJournee";
import { AConstruire, Introuvable, ListeModule } from "./ecrans/Modules";
import { ECRANS } from "./ecrans/registre";
import { CONSTRUITS } from "./ecrans/construits";

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
