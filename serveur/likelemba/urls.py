from django.urls import path
from noyau.api import api

urlpatterns = [path("api/", api.urls)]
