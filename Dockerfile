# ----------------------------
# Step 1: Build the NestJS app
# ----------------------------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    # Copy package.json and lockfile
    COPY package*.json ./
    
    # Install all dependencies (including dev for TS build)
    RUN npm install
    
    # Copy the rest of the source code
    COPY . .
    
    # Install missing type definitions for TypeScript
    RUN npm install --save-dev @types/express @types/multer @types/bcrypt
    
    # Build the NestJS app
    RUN npm run build
    
    # ----------------------------
    # Step 2: Run the app
    # ----------------------------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Copy compiled app + node_modules
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package*.json ./
    
    # Expose port
    EXPOSE 3000
    
    # Set environment
    ENV NODE_ENV=production
    ENV PORT=3000
    
    # Start the compiled app
    CMD ["node", "dist/main.js"]
    