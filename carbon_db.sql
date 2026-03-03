--
-- PostgreSQL database dump
--

\restrict zUkthMvQ8niesgqfYvkyTdNxWruYhhUFNhTzjqarYdOIOsI8SiaZHcelcGEWAHc

-- Dumped from database version 13.23
-- Dumped by pg_dump version 13.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: buyer_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    reporting_year smallint NOT NULL,
    industry_type character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buyer_profiles_reporting_year_check CHECK (((reporting_year >= 2000) AND (reporting_year <= 2100)))
);


ALTER TABLE public.buyer_profiles OWNER TO postgres;

--
-- Name: carbon_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carbon_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    project_id uuid NOT NULL,
    credits_traded numeric(18,6) NOT NULL,
    price_per_credit numeric(12,4) NOT NULL,
    total_value numeric(18,4) NOT NULL,
    currency character varying(8) DEFAULT 'USD'::character varying NOT NULL,
    trade_date timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(32) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT carbon_transactions_credits_traded_check CHECK ((credits_traded > (0)::numeric))
);


ALTER TABLE public.carbon_transactions OWNER TO postgres;

--
-- Name: emission_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emission_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    buyer_id uuid NOT NULL,
    scope1_co2e numeric(18,6) DEFAULT 0 NOT NULL,
    scope2_co2e numeric(18,6) DEFAULT 0 NOT NULL,
    scope3_co2e numeric(18,6) DEFAULT 0 NOT NULL,
    total_co2e numeric(18,6) DEFAULT 0 NOT NULL,
    gas_co2 numeric(18,6) DEFAULT 0 NOT NULL,
    gas_ch4 numeric(18,6) DEFAULT 0 NOT NULL,
    gas_n2o numeric(18,6) DEFAULT 0 NOT NULL,
    gas_hfc134a numeric(18,8) DEFAULT 0 NOT NULL,
    gas_sf6 numeric(18,8) DEFAULT 0 NOT NULL,
    total_absorption numeric(18,6) DEFAULT 0 NOT NULL,
    net_balance numeric(18,6) DEFAULT 0 NOT NULL,
    offset_ratio_pct numeric(8,4) DEFAULT 0 NOT NULL,
    raw_input jsonb,
    sector_breakdown jsonb,
    sink_breakdown jsonb,
    year smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.emission_records OWNER TO postgres;

--
-- Name: seller_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    project_name character varying(256) NOT NULL,
    project_type character varying(64) NOT NULL,
    methodology character varying(128) NOT NULL,
    baseline_emission numeric(18,6) NOT NULL,
    annual_reduction numeric(18,6) NOT NULL,
    leakage numeric(18,6) DEFAULT 0 NOT NULL,
    buffer_percent numeric(5,2) DEFAULT 10.0 NOT NULL,
    credits_available numeric(18,6) DEFAULT 0 NOT NULL,
    price_per_credit numeric(12,4) NOT NULL,
    vintage_start smallint NOT NULL,
    vintage_end smallint NOT NULL,
    verification_doc_url character varying(512),
    project_boundary text,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.seller_projects OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organisation_name character varying(256) NOT NULL,
    email character varying(320) NOT NULL,
    password_hash character varying(256) NOT NULL,
    organisation_type character varying(128) NOT NULL,
    country character varying(128) NOT NULL,
    state character varying(128) NOT NULL,
    district character varying(128) NOT NULL,
    zone character varying(128),
    ward character varying(128),
    role character varying(16) DEFAULT 'buyer'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vw_regional_emission; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_regional_emission AS
 SELECT u.country,
    u.state,
    u.district,
    er.year,
    sum(er.total_co2e) AS total_emission_co2e,
    sum(er.total_absorption) AS total_absorption_co2e,
    sum(er.net_balance) AS net_balance_co2e,
    count(DISTINCT er.buyer_id) AS num_organisations
   FROM ((public.emission_records er
     JOIN public.buyer_profiles bp ON ((bp.id = er.buyer_id)))
     JOIN public.users u ON ((u.id = bp.user_id)))
  GROUP BY u.country, u.state, u.district, er.year;


ALTER TABLE public.vw_regional_emission OWNER TO postgres;

--
-- Name: vw_yearly_trend; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_yearly_trend AS
 SELECT er.year,
    sum(er.total_co2e) AS total_emission_co2e,
    sum(er.total_absorption) AS total_absorption_co2e,
    sum(er.net_balance) AS net_balance,
    COALESCE(sum(ct.credits_traded), (0)::numeric) AS credits_traded
   FROM ((public.emission_records er
     JOIN public.buyer_profiles bp ON ((bp.id = er.buyer_id)))
     LEFT JOIN public.carbon_transactions ct ON (((ct.trade_date >= make_date((er.year)::integer, 1, 1)) AND (ct.trade_date <= make_date((er.year)::integer, 12, 31)))))
  GROUP BY er.year
  ORDER BY er.year;


ALTER TABLE public.vw_yearly_trend OWNER TO postgres;

--
-- Data for Name: buyer_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.buyer_profiles (id, user_id, reporting_year, industry_type, created_at) FROM stdin;
5ed00675-b08d-430b-ba02-64dd44f63750	cfde6448-23ed-4fb4-8ed8-d8c64188d6aa	2024	cement	2026-03-02 11:25:56.898616+05:30
fed80c07-1191-4890-bf0d-422baedf43f5	3f1487ca-c661-4bc9-9546-e9337a34a26a	2026	cement	2026-03-02 11:38:29.863258+05:30
53da129c-4af9-4376-b68c-375a6ddee683	cfde6448-23ed-4fb4-8ed8-d8c64188d6aa	2026	cement	2026-03-02 11:23:14.104414+05:30
\.


--
-- Data for Name: carbon_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carbon_transactions (id, buyer_id, seller_id, project_id, credits_traded, price_per_credit, total_value, currency, trade_date, status, created_at) FROM stdin;
\.


--
-- Data for Name: emission_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emission_records (id, buyer_id, scope1_co2e, scope2_co2e, scope3_co2e, total_co2e, gas_co2, gas_ch4, gas_n2o, gas_hfc134a, gas_sf6, total_absorption, net_balance, offset_ratio_pct, raw_input, sector_breakdown, sink_breakdown, year, created_at) FROM stdin;
14f87f9c-6630-4cb3-8b10-192b8bd9ce82	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 8, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 9032, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430793913", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 11:23:14.162741+05:30
21447f70-6957-456b-90bd-e4c409cca6e6	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 8, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 9032, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430924125", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 11:25:24.232908+05:30
1c5d2903-ff87-4a61-9089-b6ddb1a68c0a	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 199, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 9032, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430935659", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 11:25:35.701569+05:30
8ed99431-e7a7-401a-a653-092587af16e1	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 199, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 903243, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430942607", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 11:25:42.635011+05:30
b1054809-c940-497a-828c-412daf66018d	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 199, "manufacturing_category": "medium"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 903243, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430949619", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 11:25:49.658806+05:30
0a0067e1-fe5c-4348-ab00-24fd77c31595	5ed00675-b08d-430b-ba02-64dd44f63750	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 199, "manufacturing_category": "medium"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 903243, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430956867", "industry_type": "chemical", "reporting_year": 2024}	{}	{}	2024	2026-03-02 11:25:56.909412+05:30
c4258292-fece-4c9a-8b84-905c2d50bff1	5ed00675-b08d-430b-ba02-64dd44f63750	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 388, "manufacturing_category": "medium"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 903243, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772430975767", "industry_type": "chemical", "reporting_year": 2024}	{}	{}	2024	2026-03-02 11:26:15.792677+05:30
b87a3a7c-e781-4b74-ac5e-b504e175f85f	5ed00675-b08d-430b-ba02-64dd44f63750	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "diesel", "fuel_unit": "tonnes", "fuel_quantity": 0.95, "industry_type": "chemical", "number_of_factories": 388, "manufacturing_category": "medium"}, "scope2": {"electricity_kwh": 50000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 0.39, "transportation_co2e": 1.3}, "tree_count": 903243, "forest_area_m2": 467321, "other_absorption_co2e": 48732}, "project_id": "buyer-1772431052095", "industry_type": "chemical", "reporting_year": 2024}	{}	{}	2024	2026-03-02 11:27:32.210764+05:30
6dfdf67f-1ca5-4f87-93d6-7a90b0fbf4c1	5ed00675-b08d-430b-ba02-64dd44f63750	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 499.99, "industry_type": "cement", "number_of_factories": 2, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 44.96, "transportation_co2e": 120.5}, "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}, "project_id": "buyer-1772431664036", "industry_type": "cement", "reporting_year": 2024}	{}	{}	2024	2026-03-02 11:37:44.424058+05:30
7a98a6ba-81a5-4a68-a4fa-fe4b51f939c9	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 11:38:29.882418+05:30
1e63cd0a-dc9e-4391-98ca-3d8808776ed1	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:11:38.553594+05:30
eeaf8ceb-973c-4dfc-bd21-323a246065d8	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:12:20.108793+05:30
1c2f83ed-5e77-4b13-8ee4-a990548e9b76	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:20:16.34996+05:30
281900d6-3b7d-4458-8da2-dcb0d6d661a9	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:20:55.843483+05:30
9dde26ab-2d87-4c3e-ba45-4c9098b6fb2a	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:23:43.458075+05:30
ff8e15b9-acbc-45c8-b97e-ccac86c7eb5a	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 12:49:45.773743+05:30
9d8478ab-7daa-4cc1-b840-8352766cd0ad	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 13:13:02.002673+05:30
83e0006a-46cc-476d-a109-027109eb30b1	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 199.96, "industry_type": "chemical", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 504932, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 8963.98, "transportation_co2e": 3920}, "tree_count": 1029232, "forest_area_m2": 86549, "other_absorption_co2e": 89}, "project_id": "buyer-1772437520858", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 13:15:21.067917+05:30
471c8d28-b249-4be7-8ef4-6c6e2f09c4de	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 13:21:00.764071+05:30
734c6e40-cda8-42d0-b01a-21b0903915bc	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 13:24:34.346182+05:30
9d7e9f2f-abff-4fa3-a94d-1d9eb0d34d2e	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 199.96, "industry_type": "chemical", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 504932, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 8963.98, "transportation_co2e": 3920}, "tree_count": 1029232, "forest_area_m2": 86549, "other_absorption_co2e": 89}, "project_id": "buyer-1772439469296", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 13:47:50.310482+05:30
d8bd4e32-6ded-4d71-9d30-88e6f9e59622	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 16:14:18.503905+05:30
c7ad9b3d-2e38-4f6e-9ecf-757a292bb6c6	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 16:22:58.106654+05:30
d3e9e483-aca0-4e64-9dd9-f3ae170495d8	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 16:24:54.172154+05:30
2f89e553-3301-4846-aaf1-6d2a475ab54e	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 16:25:29.305005+05:30
c2822725-9d3e-4b59-b95b-61ca7a2359e2	fed80c07-1191-4890-bf0d-422baedf43f5	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{}	{}	2026	2026-03-02 16:27:06.330076+05:30
0075ea31-1f4f-431d-849b-fa3df296af6f	fed80c07-1191-4890-bf0d-422baedf43f5	3727.800000	205.000000	165.500000	4098.300000	4002.000000	0.600000	0.300000	0.00000000	0.00000000	2500.000000	1598.300000	61.0009	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 500, "industry_type": "cement", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 250000, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 45, "transportation_co2e": 120.5}, "project_id": "buyer-1712345678", "tree_count": 5000, "forest_area_m2": 2000000, "other_absorption_co2e": 0}	{"scope1": 3727.8, "scope2": 205, "scope3": 165.5}	{"trees": 100, "forest": 2400}	2026	2026-03-02 17:19:26.890867+05:30
201c8ca2-81d7-4749-bd46-200c42ddf40e	53da129c-4af9-4376-b68c-375a6ddee683	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.000000	0.00000000	0.00000000	0.000000	0.000000	0.0000	{"emission": {"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 199.96, "industry_type": "chemical", "number_of_factories": 3, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 504932, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 8963.98, "transportation_co2e": 3920}, "tree_count": 1029232, "forest_area_m2": 86549, "other_absorption_co2e": 89}, "project_id": "buyer-1772452202024", "industry_type": "chemical", "reporting_year": 2026}	{}	{}	2026	2026-03-02 17:20:02.058699+05:30
ab4f5d19-43d9-4196-b4d0-3c6c487b4587	53da129c-4af9-4376-b68c-375a6ddee683	902780.511744	28.352320	93.990000	902902.854064	879581.387440	145.305088	72.652544	0.00000000	0.00000000	18067.447600	884835.406464	2.0010	{"scope1": {"fuel_type": "coal", "fuel_unit": "tonnes", "fuel_quantity": 5675.98, "industry_type": "cement", "number_of_factories": 64, "manufacturing_category": "heavy"}, "scope2": {"electricity_kwh": 34576, "grid_emission_factor": 0.82}, "scope3": {"waste_co2e": 6.99, "transportation_co2e": 87}, "project_id": "buyer-1772452296112", "tree_count": 898334, "forest_area_m2": 9823, "reporting_year": 2026, "other_absorption_co2e": 88.98}	{"scope1": 902780.511744, "scope2": 28.35232, "scope3": 93.99}	{"other": 88.98, "trees": 17966.68, "forest": 11.7876}	2026	2026-03-02 17:21:36.322962+05:30
\.


--
-- Data for Name: seller_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seller_projects (id, user_id, project_name, project_type, methodology, baseline_emission, annual_reduction, leakage, buffer_percent, credits_available, price_per_credit, vintage_start, vintage_end, verification_doc_url, project_boundary, status, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, organisation_name, email, password_hash, organisation_type, country, state, district, zone, ward, role, created_at) FROM stdin;
cfde6448-23ed-4fb4-8ed8-d8c64188d6aa	chethan Carbon	chethanuni2002@gmail.com	$2a$12$HtKD4QHKnmbGtxvisdnds.aan96EuG.Anh6kiiM4cWWTlwcDJATmi	Manufacturing	India	Andaman and Nicobar Islands	south andaman	dairy farm	3	buyer	2026-03-01 10:58:02.571405+05:30
3f1487ca-c661-4bc9-9546-e9337a34a26a	Acme Cement Ltd	admin@acmecement.com	$2a$12$FYY08536AcXg8u07nE20EeWG1r3EBrrYas.NHn5QEYk8HZawMIGNu	Manufacturing	India	Tamil Nadu	Chennai	North	12	buyer	2026-03-02 11:07:37.208478+05:30
\.


--
-- Name: buyer_profiles buyer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT buyer_profiles_pkey PRIMARY KEY (id);


--
-- Name: carbon_transactions carbon_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carbon_transactions
    ADD CONSTRAINT carbon_transactions_pkey PRIMARY KEY (id);


--
-- Name: emission_records emission_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emission_records
    ADD CONSTRAINT emission_records_pkey PRIMARY KEY (id);


--
-- Name: seller_projects seller_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_projects
    ADD CONSTRAINT seller_projects_pkey PRIMARY KEY (id);


--
-- Name: buyer_profiles uq_buyer_profile_year; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT uq_buyer_profile_year UNIQUE (user_id, reporting_year);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_buyer_profiles_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buyer_profiles_user ON public.buyer_profiles USING btree (user_id);


--
-- Name: idx_emission_buyer_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emission_buyer_year ON public.emission_records USING btree (buyer_id, year);


--
-- Name: idx_emission_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emission_year ON public.emission_records USING btree (year);


--
-- Name: idx_seller_credits; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_credits ON public.seller_projects USING btree (credits_available) WHERE (credits_available > (0)::numeric);


--
-- Name: idx_seller_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_price ON public.seller_projects USING btree (price_per_credit);


--
-- Name: idx_seller_project_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_project_type ON public.seller_projects USING btree (project_type);


--
-- Name: idx_seller_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_status ON public.seller_projects USING btree (status);


--
-- Name: idx_seller_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_user ON public.seller_projects USING btree (user_id);


--
-- Name: idx_seller_vintage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_vintage ON public.seller_projects USING btree (vintage_start, vintage_end);


--
-- Name: idx_transactions_buyer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_buyer ON public.carbon_transactions USING btree (buyer_id, trade_date DESC);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_date ON public.carbon_transactions USING btree (trade_date DESC);


--
-- Name: idx_transactions_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_project ON public.carbon_transactions USING btree (project_id);


--
-- Name: idx_transactions_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_seller ON public.carbon_transactions USING btree (seller_id, trade_date DESC);


--
-- Name: idx_users_country; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_country ON public.users USING btree (country);


--
-- Name: idx_users_district; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_district ON public.users USING btree (country, state, district);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_state ON public.users USING btree (country, state);


--
-- Name: buyer_profiles buyer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_profiles
    ADD CONSTRAINT buyer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: carbon_transactions carbon_transactions_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carbon_transactions
    ADD CONSTRAINT carbon_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: carbon_transactions carbon_transactions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carbon_transactions
    ADD CONSTRAINT carbon_transactions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.seller_projects(id);


--
-- Name: carbon_transactions carbon_transactions_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carbon_transactions
    ADD CONSTRAINT carbon_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: emission_records emission_records_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emission_records
    ADD CONSTRAINT emission_records_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.buyer_profiles(id) ON DELETE CASCADE;


--
-- Name: seller_projects seller_projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_projects
    ADD CONSTRAINT seller_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict zUkthMvQ8niesgqfYvkyTdNxWruYhhUFNhTzjqarYdOIOsI8SiaZHcelcGEWAHc

