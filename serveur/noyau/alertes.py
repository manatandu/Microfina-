"""Audit du 21/11/2026, point bloquant B2, fin (registre T219) : une erreur du serveur part par courriel aux personnes que l'exploitant désigne,
en plus du journal de l'hébergeur. Le message ne porte aucune donnée d'un membre ni d'une opération : la date, la méthode et le chemin sans ses
paramètres, le type de l'erreur et l'endroit du code. Le détail se lit dans le journal du serveur (secret professionnel : loi 002/2002, art. 79 ;
loi 11/020, art. 60). Au plus un courriel par erreur et par quart d'heure, envoyé hors de la requête pour ne pas la retarder."""
import logging
import threading
import time
import traceback

INTERVALLE = 15 * 60


class AlerteCourriel(logging.Handler):
    def __init__(self, destinataires=(), attendre: bool = False):
        super().__init__(level=logging.ERROR)
        self.destinataires = [x for x in destinataires if x]
        self.attendre = attendre                               # essais : l'envoi se fait dans l'appel
        self.derniers: dict[str, float] = {}
        self.verrou = threading.Lock()

    def composer(self, record: logging.LogRecord) -> tuple[str, str, str]:
        """Sujet, corps et clé de regroupement ; rien de ce que la requête contient"""
        requete = getattr(record, "request", None)
        ou = f"{getattr(requete, 'method', '')} {getattr(requete, 'path', '')}".strip() if requete is not None else record.name
        typ, lieu = "", ""
        if record.exc_info and record.exc_info[0]:
            typ = record.exc_info[0].__name__
            pile = traceback.extract_tb(record.exc_info[2])
            lieu = "\n".join(f"  {f.filename.rsplit('/serveur/', 1)[-1]}, ligne {f.lineno}, {f.name}" for f in pile[-4:])
        sujet = f"Exofina : erreur du serveur ({typ or record.levelname}) sur {ou}"[:200]
        corps = (f"Date : {time.strftime('%d/%m/%Y %H:%M:%S %Z', time.localtime(record.created))}\nRequête : {ou}\nErreur : {typ or record.levelname}\n"
                 + (f"Code :\n{lieu}\n" if lieu else "") + "\nLe détail est dans le journal du serveur. Ce message ne contient aucune donnée d'un membre.")
        return sujet, corps, f"{typ}|{ou}"

    def emit(self, record: logging.LogRecord) -> None:
        if not self.destinataires:
            return
        try:
            sujet, corps, cle = self.composer(record)
            with self.verrou:
                if time.time() - self.derniers.get(cle, 0) < INTERVALLE:
                    return
                self.derniers[cle] = time.time()
            if self.attendre:
                self.envoyer(sujet, corps)
            else:
                threading.Thread(target=self.envoyer, args=(sujet, corps), daemon=True).start()
        except Exception:                                      # une alerte qui échoue ne casse jamais la requête
            self.handleError(record)

    def envoyer(self, sujet: str, corps: str) -> None:
        from django.conf import settings
        from django.core.mail import send_mail
        try:
            send_mail(sujet, corps, settings.SERVER_EMAIL, self.destinataires, fail_silently=False)
        except Exception:
            logging.getLogger("exofina.securite").warning("alerte par courriel non envoyée", exc_info=True)
