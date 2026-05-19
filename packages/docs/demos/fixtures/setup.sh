#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:?Usage: setup.sh <target-dir>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf "$TARGET"
mkdir -p "$TARGET"
cd "$TARGET"

git init --initial-branch main
git config user.name "Demo User"
git config user.email "demo@diffgotchi.dev"
git config commit.gpgsign false
git config tag.gpgsign false

mkdir -p src lib

cat > src/api.ts << 'TSEOF'
import { Request, Response } from "express";
import { db } from "../lib/database";
import { validatePayload } from "../lib/validate";
import { logger } from "../lib/logger";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: Date;
}

export async function getUsers(req: Request, res: Response) {
  try {
    const users = await db.query<User>("SELECT * FROM users ORDER BY name");
    res.json({ data: users, count: users.length });
  } catch (err) {
    logger.error("Failed to fetch users", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createUser(req: Request, res: Response) {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email required" });
  }

  try {
    const user = await db.insert("users", { name, email, role: "member" });
    logger.info(`Created user: ${user.id}`);
    res.status(201).json({ data: user });
  } catch (err) {
    logger.error("Failed to create user", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await db.delete("users", id);
    logger.info(`Deleted user: ${id}`);
    res.status(204).send();
  } catch (err) {
    logger.error("Failed to delete user", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
TSEOF

cat > lib/validate.ts << 'TSEOF'
export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

export function validatePayload(
  data: Record<string, unknown>,
  rules: ValidationRule[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const rule of rules) {
    const value = data[rule.field];
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`${rule.field} is required`);
      continue;
    }
    if (typeof value === "string") {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
TSEOF

cat > lib/config.json << 'JSONEOF'
{
  "port": 3000,
  "host": "localhost",
  "database": {
    "url": "postgres://localhost:5432/myapp",
    "pool_size": 10
  },
  "cors": {
    "origins": ["http://localhost:3000"],
    "credentials": true
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
JSONEOF

cat > README.md << 'MDEOF'
# My API

A REST API for managing users and teams.

## Getting Started

```bash
npm install
npm run dev
```

## Endpoints

- `GET /users` — List all users
- `POST /users` — Create a user
- `DELETE /users/:id` — Delete a user
MDEOF

git add -A
git commit -m "initial commit"

# ──────────────────────────────────
# Unstaged modifications
# ──────────────────────────────────

cat > src/api.ts << 'TSEOF'
import { Request, Response } from "express";
import { db } from "../lib/database";
import { validatePayload } from "../lib/validate";
import { logger } from "../lib/logger";
import { cache } from "../lib/cache";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface PaginationOptions {
  page: number;
  limit: number;
}

function parsePagination(req: Request): PaginationOptions {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  return { page, limit };
}

export async function getUsers(req: Request, res: Response) {
  const { page, limit } = parsePagination(req);
  const offset = (page - 1) * limit;

  try {
    const cacheKey = `users:page:${page}:limit:${limit}`;
    const cached = await cache.get<User[]>(cacheKey);
    if (cached) {
      return res.json({ data: cached, page, limit, cached: true });
    }

    const users = await db.query<User>(
      "SELECT * FROM users ORDER BY name LIMIT $1 OFFSET $2",
      [limit, offset],
    );
    const total = await db.count("users");

    await cache.set(cacheKey, users, { ttl: 60 });

    res.json({
      data: users,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error("Failed to fetch users", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const user = await db.raw<User>(`SELECT * FROM users WHERE id = '${id}'`);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ data: user });
  } catch (err) {
    logger.error(`Failed to fetch user ${id}`, err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createUser(req: Request, res: Response) {
  const validation = validatePayload(req.body, [
    { field: "name", required: true, minLength: 2, maxLength: 100 },
    { field: "email", required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  ]);

  if (!validation.valid) {
    return res.status(400).json({ error: "Validation failed", details: validation.errors });
  }

  const { name, email } = req.body;

  try {
    const existing = await db.findBy<User>("users", { email });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await db.insert("users", {
      name,
      email,
      role: "member",
      lastLoginAt: null,
    });
    await cache.invalidate("users:*");
    logger.info(`Created user: ${user.id}`);
    res.status(201).json({ data: user });
  } catch (err) {
    logger.error("Failed to create user", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const user = await db.findOne<User>("users", id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    await db.delete("users", id);
    await cache.invalidate("users:*");
    logger.info(`Deleted user: ${id} (${user.email})`);
    res.status(204).send();
  } catch (err) {
    logger.error("Failed to delete user", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
TSEOF

cat > lib/validate.ts << 'TSEOF'
export interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePayload(
  data: Record<string, unknown>,
  rules: ValidationRule[],
): ValidationResult {
  const errors: string[] = [];
  for (const rule of rules) {
    const value = data[rule.field];
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(rule.message ?? `${rule.field} is required`);
      continue;
    }
    if (typeof value === "string") {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(rule.message ?? `${rule.field} has invalid format`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
TSEOF

cat > lib/config.json << 'JSONEOF'
{
  "port": 3000,
  "host": "0.0.0.0",
  "database": {
    "url": "postgres://localhost:5432/myapp",
    "pool_size": 20,
    "idle_timeout": 30000
  },
  "redis": {
    "url": "redis://localhost:6379",
    "prefix": "myapp:"
  },
  "cors": {
    "origins": ["http://localhost:3000", "https://app.example.com"],
    "credentials": true
  },
  "rate_limit": {
    "window_ms": 60000,
    "max_requests": 100
  },
  "logging": {
    "level": "info",
    "format": "json",
    "redact": ["password", "token"]
  }
}
JSONEOF

cat > README.md << 'MDEOF'
# My API

A REST API for managing users and teams.

## Getting Started

```bash
npm install
cp .env.example .env
npm run migrate
npm run dev
```

## Configuration

See `lib/config.json` for server configuration. Override with environment
variables prefixed with `MYAPP_`.

## Endpoints

- `GET /users` — List users (paginated)
- `GET /users/:id` — Get a single user
- `POST /users` — Create a user
- `DELETE /users/:id` — Delete a user

## Rate Limiting

All endpoints are rate-limited to 100 requests per minute per IP.
MDEOF

cat > src/middleware.ts << 'TSEOF'
import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const start = Date.now();
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });

  _res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
  });

  next();
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
}
TSEOF

echo "Fixture repo ready at: $TARGET"
echo "Files changed: $(git status --short | wc -l | tr -d ' ')"

# Optional: seed an active review session with a user comment + agent thread so
# the agent demo can showcase the conversation without recording it live.
if [ "${2:-}" = "--seed-review" ]; then
  SEED_SCRIPT="$SCRIPT_DIR/seed-state.ts"
  bun "$SEED_SCRIPT"
fi
