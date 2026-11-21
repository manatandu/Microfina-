"""Mesure de chaque appel de l'API (demande du porteur, 21/11/2026 : « le logiciel est lent ») : durée totale, nombre de requêtes SQL et temps passé
en base, rendus dans l'en-tête Server-Timing (lisible dans les outils du navigateur). Un appel lent est noté dans le journal du serveur.
LIKELEMBA_CHRONO=<fichier> : chaque appel est aussi écrit dans ce fichier (une ligne : méthode, chemin, millisecondes, requêtes), pour chercher les routes lourdes."""
import logging
import os
import time

from django.db import connection

journal = logging.getLogger("dwacfina.chrono")
LENT_MS = 1500
FICHIER = os.environ.get("LIKELEMBA_CHRONO")


class Chrono:
    def __init__(self, suivant):
        self.suivant = suivant

    def __call__(self, request):
        if not request.path.startswith("/api/"):
            return self.suivant(request)
        n = [0, 0.0]

        def compter(execute, sql, params, many, context):
            t = time.perf_counter()
            try:
                return execute(sql, params, many, context)
            finally:
                n[0] += 1
                n[1] += time.perf_counter() - t

        t0 = time.perf_counter()
        with connection.execute_wrapper(compter):
            reponse = self.suivant(request)
        total = (time.perf_counter() - t0) * 1000
        reponse["Server-Timing"] = f'total;dur={total:.0f}, bd;dur={n[1] * 1000:.0f};desc="{n[0]} sql"'
        if total > LENT_MS:
            journal.warning("appel lent : %s %s, %d ms, %d requêtes SQL (%d ms)", request.method, request.path, total, n[0], n[1] * 1000)
        if FICHIER:
            with open(FICHIER, "a", encoding="utf-8") as f:
                f.write(f"{request.method}\t{request.path}\t{total:.1f}\t{n[0]}\t{n[1] * 1000:.1f}\n")
        return reponse
