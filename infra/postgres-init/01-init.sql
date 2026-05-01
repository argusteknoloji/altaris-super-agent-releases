-- Altaris Platform — initial database setup
-- Multi-tenant via Row-Level Security; single physical database, tenant_id discrimination

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenant registry (no RLS — system table)
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    keycloak_realm  TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users mapped to Keycloak subjects
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    keycloak_sub      TEXT NOT NULL,
    email             TEXT NOT NULL,
    display_name      TEXT,
    role              TEXT NOT NULL DEFAULT 'member',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, keycloak_sub)
);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);

-- Agent sessions (terminal sessions opened by altaris CLI or web chat)
CREATE TABLE IF NOT EXISTS agent_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source          TEXT NOT NULL CHECK (source IN ('cli','web','remote')),
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    title           TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS agent_sessions_tenant_user_idx ON agent_sessions(tenant_id, user_id);

-- Session messages (full transcript)
CREATE TABLE IF NOT EXISTS session_messages (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool','system')),
    content         JSONB NOT NULL,
    tokens_in       INT,
    tokens_out      INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_messages_session_idx ON session_messages(session_id, created_at);

-- Audit log (security & KVKK trail)
CREATE TABLE IF NOT EXISTS audit_events (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    actor           TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT,
    resource_id     TEXT,
    ip              INET,
    user_agent      TEXT,
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_tenant_time_idx ON audit_events(tenant_id, occurred_at DESC);

-- Row-Level Security
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events     ENABLE ROW LEVEL SECURITY;

-- Tenant context is set per-connection by API: SET app.tenant_id = '<uuid>'
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_sessions ON agent_sessions
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_messages ON session_messages
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_audit ON audit_events
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Seed: dev tenant
INSERT INTO tenants (slug, name, keycloak_realm)
VALUES ('argus', 'Argus Teknoloji (dev)', 'altaris')
ON CONFLICT (slug) DO NOTHING;
