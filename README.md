# Faturas Casagrande

App de faturas de cartão da família: importa faturas (PDF, CSV, OFX), classifica os gastos por categoria e cartão, mostra tendências e acompanha pontos e cashback.
Site: https://marcoecasagrande-code.github.io/faturas-casagrande

- `index.html`: o app (gerado a partir da versão do Claude).
- `firebase-shim.js`: liga o app ao Firebase (login Google + Firestore), no mesmo projeto do Treinos.
- Os dados ficam no Firebase (coleção `faturas`), protegidos pelas regras de acesso da família; não ficam neste repositório.
