FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

# Aplica as migrations antes de subir; se falharem, o container não inicia.
# Em seguida o servidor garante a conta de demonstração (no Render) e escuta.
CMD ["sh", "-c", "npx prisma generate --schema=./prisma/schema.prisma && npx prisma migrate deploy && npm run start"]
