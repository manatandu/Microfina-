"""LibreOffice sans écran : met le sommaire et les numéros de page à jour, enregistre le Word, exporte le PDF.
Usage : python3 finir.py <entrée.docx> <sortie.docx> <sortie.pdf>"""
import os
import subprocess
import sys
import time

import uno
from com.sun.star.beans import PropertyValue

entree, docx, pdf = (os.path.abspath(x) for x in sys.argv[1:4])
port = 2093
p = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore", f"--accept=socket,host=127.0.0.1,port={port};urp;"])
local = uno.getComponentContext()
res = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
for _ in range(60):
    try:
        ctx = res.resolve(f"uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext")
        break
    except Exception:
        time.sleep(1)


def prop(n, v):
    x = PropertyValue(); x.Name, x.Value = n, v
    return x


bureau = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
doc = bureau.loadComponentFromURL(uno.systemPathToFileUrl(entree), "_blank", 0, (prop("Hidden", True),))
idx = doc.getDocumentIndexes()
for i in range(idx.getCount()):
    idx.getByIndex(i).update()
doc.refresh()
for i in range(idx.getCount()):
    idx.getByIndex(i).update()
doc.storeToURL(uno.systemPathToFileUrl(docx), (prop("FilterName", "MS Word 2007 XML"),))
doc.storeToURL(uno.systemPathToFileUrl(pdf), (prop("FilterName", "writer_pdf_Export"),))
try:
    doc.close(True)
except Exception:
    pass
try:
    bureau.terminate()
except Exception:
    pass
p.wait(timeout=60)
print("ok")
