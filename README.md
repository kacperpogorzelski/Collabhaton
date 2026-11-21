# Collabhaton

## Deploy

1. **Fork / repo na GitHubie** i konto na [Render](https://render.com) (lub inna platforma obslugujaca Dockerfile).
2. **New -> Blueprint** i wskaz repo; Render wczyta `render.yaml` (usluga `investly`, Docker, health check `/health`).
3. **Zmienne srodowiskowe:** wklej `DEEPSEEK_API_KEY` w panelu Render (klucz nigdy nie trafia do repo) albo ustaw `DEMO_OFFLINE=1`. Bez `DATABASE_URL` aplikacja dziala na wbudowanym SQLite w pamieci (stan znika po restarcie). Po deployu otworz adres uslugi.

Lokalnie:

```bash
docker build -t investly .
docker run --rm -e PORT=9000 -p 9000:9000 -e DEMO_OFFLINE=1 investly
curl http://localhost:9000/health   # {"status":"ok","app":"investly"}
```
