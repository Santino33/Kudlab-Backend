FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN SCARF_ANALYTICS=false npm ci
COPY --chown=node:node . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 CMD node -e "fetch('http://127.0.0.1:3000/api/auth/get-session').then(r=>process.exit(r.status===401?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run db:migrate && exec npm start"]
