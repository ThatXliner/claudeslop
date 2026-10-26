FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs store.mjs ./
COPY public ./public
COPY seeds.json ./
COPY scripts ./scripts
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4317 DATA_DIR=/data
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4317/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
