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

-- Invitations (tenant onboarding)
CREATE TABLE IF NOT EXISTS invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'tenant_member',
    token           TEXT NOT NULL UNIQUE,
    invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_tenant_idx ON invitations(tenant_id);

-- API keys (CLI device long-lived tokens)
CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    prefix          TEXT NOT NULL,
    hash            TEXT NOT NULL,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_tenant_user_idx ON api_keys(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);

-- Provider configurations per tenant (Anthropic, Ollama, LM Studio endpoints + secrets)
CREATE TABLE IF NOT EXISTS provider_configs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    name            TEXT NOT NULL,
    base_url        TEXT,
    api_key_enc     TEXT,
    default_model   TEXT,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, provider, name)
);
CREATE INDEX IF NOT EXISTS provider_configs_tenant_idx ON provider_configs(tenant_id);

ALTER TABLE invitations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invites  ON invitations
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_keys     ON api_keys
    USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_provider ON provider_configs
    USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Seed: dev tenant
INSERT INTO tenants (slug, name, keycloak_realm)
VALUES ('argus', 'Argus Teknoloji (dev)', 'altaris')
ON CONFLICT (slug) DO NOTHING;
