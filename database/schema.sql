-- =============================================================================
--  CARBON CREDIT MONITORING AND EXCHANGE SYSTEM
--  PostgreSQL Schema  |  v1.0
--  Standards: IPCC 2006 + 2019 Refinement | GWP-100 AR5
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLE 1: USERS
CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_name VARCHAR(256)  NOT NULL,
    email             VARCHAR(320)  NOT NULL UNIQUE,
    password_hash     VARCHAR(256)  NOT NULL,
    organisation_type VARCHAR(128)  NOT NULL,
    country           VARCHAR(128)  NOT NULL,
    state             VARCHAR(128)  NOT NULL,
    district          VARCHAR(128)  NOT NULL,
    zone              VARCHAR(128),
    ward              VARCHAR(128),
    role              VARCHAR(16)   NOT NULL DEFAULT 'buyer',
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_users_email    ON users(email);
CREATE INDEX        idx_users_country  ON users(country);
CREATE INDEX        idx_users_state    ON users(country, state);
CREATE INDEX        idx_users_district ON users(country, state, district);

-- TABLE 2: BUYER_PROFILES
CREATE TABLE IF NOT EXISTS buyer_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporting_year  SMALLINT NOT NULL CHECK (reporting_year BETWEEN 2000 AND 2100),
    industry_type   VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_buyer_profile_year UNIQUE (user_id, reporting_year)
);
CREATE INDEX idx_buyer_profiles_user ON buyer_profiles(user_id);

-- TABLE 3: EMISSION_RECORDS (GWP-100 AR5: CO2=1, CH4=28, N2O=265, HFC134a=1300, SF6=23500)
CREATE TABLE IF NOT EXISTS emission_records (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id         UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    scope1_co2e      NUMERIC(18,6) NOT NULL DEFAULT 0,
    scope2_co2e      NUMERIC(18,6) NOT NULL DEFAULT 0,
    scope3_co2e      NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_co2e       NUMERIC(18,6) NOT NULL DEFAULT 0,
    gas_co2          NUMERIC(18,6) NOT NULL DEFAULT 0,
    gas_ch4          NUMERIC(18,6) NOT NULL DEFAULT 0,
    gas_n2o          NUMERIC(18,6) NOT NULL DEFAULT 0,
    gas_hfc134a      NUMERIC(18,8) NOT NULL DEFAULT 0,
    gas_sf6          NUMERIC(18,8) NOT NULL DEFAULT 0,
    total_absorption NUMERIC(18,6) NOT NULL DEFAULT 0,
    net_balance      NUMERIC(18,6) NOT NULL DEFAULT 0,
    offset_ratio_pct NUMERIC(8,4)  NOT NULL DEFAULT 0,
    raw_input        JSONB,
    sector_breakdown JSONB,
    sink_breakdown   JSONB,
    year             SMALLINT    NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Clustered index: buyer_id + year for trend queries
CREATE INDEX idx_emission_buyer_year ON emission_records(buyer_id, year);
CREATE INDEX idx_emission_year       ON emission_records(year);

-- TABLE 4: SELLER_PROJECTS
CREATE TABLE IF NOT EXISTS seller_projects (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_name         VARCHAR(256) NOT NULL,
    project_type         VARCHAR(64)  NOT NULL,
    methodology          VARCHAR(128) NOT NULL,
    baseline_emission    NUMERIC(18,6) NOT NULL,
    annual_reduction     NUMERIC(18,6) NOT NULL,
    leakage              NUMERIC(18,6) NOT NULL DEFAULT 0,
    buffer_percent       NUMERIC(5,2)  NOT NULL DEFAULT 10.0,
    -- Net Credits = (annual_reduction - leakage) * (1 - buffer_percent/100)
    credits_available    NUMERIC(18,6) NOT NULL DEFAULT 0,
    price_per_credit     NUMERIC(12,4) NOT NULL,
    vintage_start        SMALLINT NOT NULL,
    vintage_end          SMALLINT NOT NULL,
    verification_doc_url VARCHAR(512),
    project_boundary     TEXT,
    status               VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Non-clustered indexes for listing/filter queries
CREATE INDEX idx_seller_project_type ON seller_projects(project_type);
CREATE INDEX idx_seller_vintage      ON seller_projects(vintage_start, vintage_end);
CREATE INDEX idx_seller_price        ON seller_projects(price_per_credit);
CREATE INDEX idx_seller_status       ON seller_projects(status);
CREATE INDEX idx_seller_user         ON seller_projects(user_id);
CREATE INDEX idx_seller_credits      ON seller_projects(credits_available) WHERE credits_available > 0;

-- TABLE 5: CARBON_TRANSACTIONS
CREATE TABLE IF NOT EXISTS carbon_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id         UUID NOT NULL REFERENCES users(id),
    seller_id        UUID NOT NULL REFERENCES users(id),
    project_id       UUID NOT NULL REFERENCES seller_projects(id),
    credits_traded   NUMERIC(18,6) NOT NULL CHECK (credits_traded > 0),
    price_per_credit NUMERIC(12,4) NOT NULL,
    total_value      NUMERIC(18,4) NOT NULL,
    currency         VARCHAR(8)   NOT NULL DEFAULT 'USD',
    trade_date       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    status           VARCHAR(32)  NOT NULL DEFAULT 'completed',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- Clustered: temporal queries dominate dashboard trends
CREATE INDEX idx_transactions_date    ON carbon_transactions(trade_date DESC);
CREATE INDEX idx_transactions_buyer   ON carbon_transactions(buyer_id, trade_date DESC);
CREATE INDEX idx_transactions_seller  ON carbon_transactions(seller_id, trade_date DESC);
CREATE INDEX idx_transactions_project ON carbon_transactions(project_id);

-- VIEWS
CREATE OR REPLACE VIEW vw_regional_emission AS
SELECT u.country, u.state, u.district, er.year,
    SUM(er.total_co2e)       AS total_emission_co2e,
    SUM(er.total_absorption)  AS total_absorption_co2e,
    SUM(er.net_balance)       AS net_balance_co2e,
    COUNT(DISTINCT er.buyer_id) AS num_organisations
FROM emission_records er
JOIN buyer_profiles bp ON bp.id = er.buyer_id
JOIN users u            ON u.id = bp.user_id
GROUP BY u.country, u.state, u.district, er.year;

CREATE OR REPLACE VIEW vw_yearly_trend AS
SELECT er.year,
    SUM(er.total_co2e)       AS total_emission_co2e,
    SUM(er.total_absorption)  AS total_absorption_co2e,
    SUM(er.net_balance)       AS net_balance,
    COALESCE(SUM(ct.credits_traded), 0) AS credits_traded
FROM emission_records er
JOIN buyer_profiles bp ON bp.id = er.buyer_id
LEFT JOIN carbon_transactions ct
    ON ct.trade_date BETWEEN MAKE_DATE(er.year,1,1) AND MAKE_DATE(er.year,12,31)
GROUP BY er.year ORDER BY er.year;
